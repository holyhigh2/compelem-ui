import { classes, csscope, Csscope, debounced, emits, forEach, h, ifTrue, prop, query, QueryCache, show, state, styles, tag, Template, watch } from "compelem";
import { findIndex, isEmpty, upperCase, values } from "myfx";
import { getRectInContainer } from "uiik";
import { AppearanceElem } from "../../../base/Appearance";
import { ExpandVertical } from "../../../icons/icons";
import { Virtualized } from "../../../mixins/Virtualized";
import { ColorHelper, getRGBColorValue, HSL2RGB, RGB2HSL, RGB2HSV, HSV2RGB, toHexString, toHSLString, toRGBString } from "../../../utils/color";
import { beginDrag, type DragSessionHandle } from "../../../utils/dragSession";
import style from "./style.scss?tmpl";

const COLOR_ZONE_WIDTH = 290;
const COLOR_ZONE_HEIGHT = 170;
/**
 * 颜色拾取
 * @attrs
 *  gradient {boolean} 是否可设置渐变色，默认false
 *  inputColor {string} 输入框颜色，默认currentColor
 *  showAlpha {boolean} 是否支持透明度选择，默认false
 *  value {string} 默认值，支持 hex(a)/hsl(a)/rgb(a) 三种格式
 *  palettes {Array<string>} 调色盘颜色数组，不为空时显示指定颜色列表
 * @models
 *  value 默认绑定属性
 * @events
 *  change({value}) 变更时触发
 * @slots
 *  header 
 * 
 * @author holyhigh2
 */
const ColorMode: Record<string, string> = {
  R: 'r',
  H: 'h',
  X: 'x'
}

const colorPointerOff = -4;
const huePointerOff = -1;
@emits('change', 'update:value')
@tag("ce-color-picker")
export class ColorPicker extends Virtualized(AppearanceElem) {

  //////////////////////////////////// props
  @prop gradient = false;
  @prop inputColor = 'currentColor'
  @prop showAlpha = false
  @prop value = ''
  @prop palettes: string[] = []

  @state colorMode = ColorMode.R
  @state colorModeString = 'RGB'
  @state colorString = ''
  @state HSLBeltColors: string[] = []
  @state newColor = ''
  @state alphaValue = 1
  @state huePointerTop = 0
  @state alphaPointerTop = 0
  @state alphaBeltBackground = ''
  @state swatchBackground = 'rgb(255, 0, 0)'
  /**
   * 当前是否有颜色（2026-10-28 修，2026-10-30 恢复）。
   *
   * 宿主用**空串**表示"这一格没有背景色 / 文字色"。修之前空值会被
   * `getRGBColorValue('')` 变成空串 → `parseInt('')` = NaN ⇒ 界面显示
   * `RGBA(NAN,NAN,NAN,1.00)`，而且 `updateColor()` 会按 NaN 算出同样的垃圾串
   * **再 emit 回宿主**（打开取色器那一刻就把脏值写进模型）。
   * 现在空值 = `hasColor === false` 的"无颜色"态：界面复位、不回写。
   */
  @state hasColor = false

  __swatchPointerTop = '100%'
  __swatchPointerLeft = '0'

  currentHSL = [0, 0, 0]//HSL

  @query('.ce-color-picker-color-swatch .ce-color-picker-color-pointer', QueryCache.ONCE) colorPointer!: HTMLElement

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  //////////////////////////////////// computed

  /////////////////////////////////// watches
  @watch("value")
  watchValue(nv: any) {
    const ok = this.syncUI(nv)
    this.hasColor = ok
    // ⚠️ 空值 / 非法值只复位界面，**不回写**：否则 updateColor() 会按 NaN 拼出
    //    RGBA(NAN,NAN,NAN,1.00) 再 emit 回宿主，选一个"没有颜色"的格子就把脏值写进模型。
    if (!ok) return
    this.updateColor()
  }

  /**
   * 颜色串 → 色块 / 色相条 / alpha 条 / 两个指针（**不 emit、不改 `colorString`**）。
   *
   * 从 `watchValue` 里拆出来的唯一理由是输入框：键入 / 粘贴时只要"看得见变化"，
   * 不能顺手把输入框内容规范化（会把用户正在敲的 `#ff` 换成 `RGB(0,0,0)`），
   * 也不能对外 emit（宿主还没确认这是最终值）。提交（回车 / 失焦）仍走
   * `watchValue` —— 原有调用点（色块点击 / 拖拽 / 外部 value 变化）行为完全不变。
   */
  syncUI(nv: string): boolean {
    let rgb = getRGBColorValue(nv)
    let parts = (rgb || '').split(' ')
    let r = parseInt(parts[0], 10)
    let g = parseInt(parts[1], 10)
    let b = parseInt(parts[2], 10)
    // 空串 / 非数值（transparent、currentColor 之类原样返回的串）= 无颜色
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
      this.resetUI()
      return false
    }
    let [h, s, l] = RGB2HSL(r, g, b)

    this.currentHSL[0] = h
    this.currentHSL[1] = s
    this.currentHSL[2] = l
    if (parts[3]) {
      this.alphaValue = parseFloat(parts[3].replace("/", ''))
      this.alphaPointerTop = (1 - this.alphaValue) * COLOR_ZONE_HEIGHT + huePointerOff
    } else {
      this.alphaValue = 1
      this.alphaPointerTop = huePointerOff
    }
    //UI reposition
    this.huePointerTop = h * COLOR_ZONE_HEIGHT + huePointerOff
    let top = this.huePointerTop < 0 ? 0 : this.huePointerTop
    let hueRGB = this.HSLBeltColors[Math.ceil(top)]
    let rgbC = HSL2RGB(h, s, l)
    this.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(' + rgbC[0] + ',' + rgbC[1] + ',' + rgbC[2] + '))'
    this.swatchBackground = hueRGB

    // 色板背景是 HSV 矩形（x=饱和度 s、y=1-明度 v），pointer 必须按同一坐标系定位，
    // 否则外部 value（如预设蓝 59,130,246）会被 HSL 三角模型算出负 y、跑出色板。
    let [, sHsv, vHsv] = RGB2HSV(r, g, b)
    let [x, y] = this.HSV2SwatchXY(sHsv, vHsv)
    this.__swatchPointerTop = y + colorPointerOff + 'px'
    this.__swatchPointerLeft = x + colorPointerOff + 'px'
    let cpStyle = this.colorPointer?.style;
    if (cpStyle) {
      cpStyle.left = this.__swatchPointerLeft;
      cpStyle.top = this.__swatchPointerTop;
    }
    return true
  }

  /**
   * 复位成"无颜色"态：色相 / 指针回到原点、透明度回 1、色块与输入框清空。
   *
   * 刻意不复位 `swatchBackground` 的渐变（那是色块底图，跟当前色无关），只把指针放到
   * 左下角（HSL 0/0/0）—— 用户从这儿开始拖也一样正常出颜色（拖拽会置 hasColor）。
   */
  resetUI() {
    this.currentHSL = [0, 0, 0]
    this.alphaValue = 1
    this.huePointerTop = huePointerOff
    this.alphaPointerTop = huePointerOff
    this.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(0,0,0))'
    this.swatchBackground = this.HSLBeltColors[0] || 'rgb(255, 0, 0)'
    this.__swatchPointerTop = COLOR_ZONE_HEIGHT + colorPointerOff + 'px'
    this.__swatchPointerLeft = colorPointerOff + 'px'
    const cpStyle = this.colorPointer?.style
    if (cpStyle) {
      cpStyle.left = this.__swatchPointerLeft
      cpStyle.top = this.__swatchPointerTop
    }
    this.newColor = ''
    this.colorString = ''
  }

  /**
   * 输入框里改写颜色（键入 / 粘贴）—— **只同步 UI，不提交**。
   *
   * 此前模板里那个 `<ce-input>` **没有任何事件绑定** ⇒ 粘贴一个 `#ff0000` 后
   * 色块、色相条、alpha 条、两个指针全都不动（用户报障：「粘了颜色选择区没变化」）。
   *
   * 守卫用 `CSS.supports('color', v)`（与 `getRGBColorValue` 同口径）：`#ff` 这类
   * 半截串直接忽略 —— 否则会被解析成黑色，指针每敲一个字符就乱跳。
   */
  onColorInput(obj: Record<string, any>) {
    const v = String(obj?.value ?? "").trim()
    if (!this.isColorLiteral(v)) return
    this.hasColor = this.syncUI(v)
  }

  /** 输入框提交（回车 / 失焦）：规范化 + emit `change` / `update:value` */
  onColorCommit(obj: Record<string, any>) {
    const v = String(obj?.value ?? "").trim()
    if (!this.isColorLiteral(v)) return
    // 同一格式同一值（如 hex 模式下把 `#ff0000` 再提交一次）不必重排 + 重发事件
    if (v.toUpperCase() === this.colorString) return
    this.watchValue(v)
  }

  /** 能否被浏览器解析成合法颜色（半截串 / 乱码 / 空串一律 false） */
  isColorLiteral(v: string) {
    if (!v) return false
    try {
      if (typeof CSS !== "undefined" && CSS.supports) return CSS.supports("color", v)
    } catch { }
    return /^#([0-9a-f]{3,8})$/i.test(v)
  }

  @watch("inputColor", { immediate: true })
  watchInputColor(nv: any, ov: any) {
    if (nv === ov && nv === undefined) return
    ColorHelper.setColor(nv, this.style, `--input-color`)
  }

  @watch('colorMode', { immediate: true })
  watchColorMode(nv: string) {
    switch (nv) {
      case ColorMode.R:
        this.colorModeString = this.showAlpha ? 'RGBA' : 'RGB';
        break
      case ColorMode.H:
        this.colorModeString = this.showAlpha ? 'HSLA' : 'HSL';
        break
      case ColorMode.X:
        this.colorModeString = this.showAlpha ? 'HEXA' : 'HEX';
        break
    }
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super()
    //构建hueBelt
    let l = 0.5
    let s = 1

    let colorbelt = [];
    for (var i = 0; i < COLOR_ZONE_HEIGHT; i++) {
      let h = i / COLOR_ZONE_HEIGHT
      let rgb = HSL2RGB(h, s, l)
      colorbelt.push('RGB(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')')
    }
    this.HSLBeltColors = colorbelt
  }
  mounted(): void {
    if (this.__swatchPointerTop) {
      let cpStyle = this.colorPointer.style
      cpStyle.left = this.__swatchPointerLeft
      cpStyle.top = this.__swatchPointerTop
    }
  }
  render(): Template {
    return h`
    <ce-container class="ce-color-picker">
      <ce-main>
        <ce-aside ${show(this.gradient)}>
          <div class="ce-color-picker-gradientbar" style="display:none">
            <div class="ce-color-picker-mode">
              <label class="ce-color-picker-actived" type="none" 
              mode="n"><div class="ce-color-picker-noneGradient" style="height:100%;"></div></label>
              <label  type="linear" style="background-image:-webkit-linear-gradient(left, #fff,#000 90%);" 
              mode="l"></label>
              <label class="" type="radial" style="background-image:radial-gradient(#ddd 10%, #000 80%);" 
              mode="r"></label>
            </div>
            <div class="ce-color-picker-params">
            </div>
            <div class="ce-color-picker-grad-belt">
              <div class="ce-color-picker-cover"></div>
              <i class="fa fa-play ce-color-picker-actived ce-color-picker-grad-pointer" level="0" color="#fff" style="top:-webkit-calc(-.5em - 1px);"></i>
              <i class="fa fa-play ce-color-picker-grad-pointer" level="100"  color="#000" style="top:-webkit-calc(100% - .5em - 2px);"></i>
            </div>
          </div>
        </ce-aside>
        <ce-main style="overflow: visible;">
          <ce-header class="ce-color-picker-color-header">
            <div ${classes({ "color": true, "ce-color-picker-newColor": true, "ce-color-picker-none-color": !this.hasColor })}><div class="ce-color-picker-cover" ${styles({ backgroundColor: this.newColor })}></div></div>
            <slot name="header"></slot>
          </ce-header>
          <ce-main class="ce-color-picker-color-pane" style="display: flex;">
            <div class="ce-color-picker-color-swatch" @pointerdown="${this.dragColorSwatch}" ${styles({
      width: COLOR_ZONE_WIDTH + 'px',
      height: COLOR_ZONE_HEIGHT + 'px',
      minWidth: COLOR_ZONE_WIDTH + 'px',
      minHeight: COLOR_ZONE_HEIGHT + 'px',
      backgroundColor: this.swatchBackground
    })}>
              <div class="ce-color-picker-color-pointer"></div>
            </div>
            <div class="ce-color-picker-hue-belt" ${styles({ height: COLOR_ZONE_HEIGHT + 'px' })} @pointerdown="${this.dragHueBelt}">
              <div class="ce-color-picker-colors">
              ${forEach(this.HSLBeltColors, (c, i) => i, (c, i) => h`
                <div class="ce-color-picker-hue-line" ${styles({ top: i + 'px', background: c })}></div>  
              `)}
              </div>
              <div class="ce-color-picker-pointer" ${styles({ top: this.huePointerTop + 'px' })}></div>
            </div>
            ${ifTrue(this.showAlpha, () => h`
              <div  class="ce-color-picker-alpha-belt" ${styles({ height: COLOR_ZONE_HEIGHT + 'px' })} @pointerdown="${this.dragAlphaBelt}">
                <div class="ce-color-picker-cover" ${styles({ backgroundImage: this.alphaBeltBackground })}></div>
                <div class="ce-color-picker-pointer" ${styles({ top: this.alphaPointerTop + 'px' })}></div>
              </div>
            `)}
          </ce-main>
          <ce-footer class="ce-color-picker-color-footer">
            <ce-button @click="${this.changeColorMode}"  appearance="pale" .icon="${ExpandVertical}">${this.colorModeString}</ce-button>
            <ce-input  .value="${this.colorString}" appearance="default" @input="${this.onColorInput}" @change="${this.onColorCommit}"></ce-input>
          </ce-footer>
        </ce-main>
      </ce-main>
      <ce-divider ${show(!isEmpty(this.palettes))} class="ce-color-picker-palettes-divider"></ce-divider>
      <ce-main ${show(!isEmpty(this.palettes))}>
        ${forEach(this.palettes, (c, i) => i, (c, i) => h`
          <div class="ce-color-picker-color-block" data-color="${c}" style="${`background:` + c}" @click="${this.changeColor}"></div>
        `)}
      </ce-main>
    </ce-container>
    `;
  }

  //////////////////////////////////// methods
  #drag: DragSessionHandle | null = null

  destroyed(): void {
    this.#drag?.end(false)
    this.#drag = null
  }

  changeColor(ev: MouseEvent) {
    let t = ev.currentTarget as HTMLElement
    this.watchValue(t.dataset.color)
  }
  /**
   * 色板坐标 → HSV：x 决定饱和度 s（左0右1），y 决定明度 v（上1下0）。
   * 与 style.scss 中色板背景 `linear-gradient(#0000,#000), linear-gradient(90deg,#fff,#fff0)` 一致。
   */
  swatchXY2HSV(x: number, y: number): [number, number] {
    let s = x / COLOR_ZONE_WIDTH;
    let v = (COLOR_ZONE_HEIGHT - y) / COLOR_ZONE_HEIGHT;
    return [s, v]
  }
  /** HSV → 色板坐标（swatchXY2HSV 的逆运算） */
  HSV2SwatchXY(s: number, v: number): [number, number] {
    let x = s * COLOR_ZONE_WIDTH;
    let y = COLOR_ZONE_HEIGHT * (1 - v);
    return [x, y];
  }
  changeColorMode(ev: MouseEvent) {
    let ks = values(ColorMode)
    let i = findIndex(ks, k => k === this.colorMode)
    let nextMode = ColorMode[upperCase(ks[(i + 1) % 3])]
    this.colorMode = nextMode
    // 无颜色态只换格式标签，别把复位后的 0/0/0 算成黑色填进输入框
    if (!this.hasColor) {
      this.colorString = ''
      return
    }

    let [h, s, l] = [this.currentHSL[0], this.currentHSL[1], this.currentHSL[2]]
    let rgb = HSL2RGB(h, s, l)

    let str = ''
    switch (nextMode) {
      case 'r': str = toRGBString(rgb[0], rgb[1], rgb[2], this.showAlpha ? this.alphaValue : undefined); break;
      case 'x': str = toHexString(rgb[0], rgb[1], rgb[2], this.showAlpha ? this.alphaValue : undefined); break;
      case 'h': str = toHSLString(h, s, l, this.showAlpha ? this.alphaValue : undefined); break;
    }

    this.colorString = str.toUpperCase()
  }
  @debounced(10)
  updateColor() {
    // 无颜色态：不改输入框、不发事件（空就是空，别把 NaN 拼成颜色串回写宿主）
    if (!this.hasColor) {
      this.newColor = ''
      this.colorString = ''
      return
    }
    //转换RGB
    let [h, s, l] = [this.currentHSL[0], this.currentHSL[1], this.currentHSL[2]]
    let rgb = HSL2RGB(h, s, l)

    let str = ''
    switch (this.colorMode) {
      case 'r': str = toRGBString(rgb[0], rgb[1], rgb[2], this.showAlpha ? this.alphaValue : undefined); break;
      case 'x': str = toHexString(rgb[0], rgb[1], rgb[2], this.showAlpha ? this.alphaValue : undefined); break;
      case 'h': str = toHSLString(h, s, l, this.showAlpha ? this.alphaValue : undefined); break;
    }
    //更新颜色提示框
    this.newColor = str
    this.colorString = str.toUpperCase()
    // if (isBlank(this.value)) {
    //   this.newColor = this.colorString = ''
    // }

    if (this.gradient) {
      //修改渐变指针颜色，刷新UI
      // $('.gradientbar .grad-belt i.grad-pointer.actived', cp).attr('color', RGB.toRGBAString());
      // updateGradientColor();
    } else {
      //触发事件
    }
    this.emit('change', { value: this.colorString })
    this.emit("update:value", { value: this.colorString })
  }
  dragColorSwatch(ev: MouseEvent) {
    ev.preventDefault()
    let colorLayer = ev.currentTarget as HTMLElement

    let rect = getRectInContainer(colorLayer, document.body)
    //初始化dragger位置

    var clw = colorLayer.offsetWidth;
    var clh = colorLayer.offsetHeight;

    let cpStyle = this.colorPointer.style
    cpStyle.left = ev.offsetX + colorPointerOff + 'px'
    cpStyle.top = ev.offsetY + colorPointerOff + 'px'

    //修改当前颜色提示、字符提示、触发颜色改变事件
    var x = ev.offsetX;
    var y = ev.offsetY;
    // 色板按 HSV 取 s/v，色相 h 仍由色相条决定（保持 currentHSL[0] 不动）；
    // HSV→RGB→HSL 后只回写 s/l，让显示/alpha 渐变链路继续消费 currentHSL。
    let [sHsv, vHsv] = this.swatchXY2HSV(x, y);
    let currentHSL = this.currentHSL
    let picked = HSV2RGB(currentHSL[0], sHsv, vHsv)
    let [, sHsl, lHsl] = RGB2HSL(picked[0], picked[1], picked[2])
    currentHSL[1] = sHsl
    currentHSL[2] = lHsl
    // 从"无颜色"态开始拖 = 用户正在选色 ⇒ 从此进入有颜色态
    this.hasColor = true
    this.updateColor();

    let rgb = HSL2RGB(currentHSL[0], currentHSL[1], currentHSL[2])
    this.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + '))'

    this.#drag?.end(false)
    this.#drag = beginDrag(colorLayer, ev as PointerEvent, {
      onMove: (e) => {
        var x = e.clientX - rect.x + window.scrollX;
        var y = e.clientY - rect.y + window.scrollY;

        // 捕获后 `e.target` 恒为色块，越界一律按几何位置兜底
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > clw) x = clw;
        if (y > clh) y = clh;

        cpStyle.left = x + colorPointerOff + 'px'
        cpStyle.top = y + colorPointerOff + 'px'

        //更新UI：色板按 HSV 取 s/v（色相不变），转回 HSL 供显示/alpha 渐变使用
        let [sHsv, vHsv] = this.swatchXY2HSV(x, y);
        let picked = HSV2RGB(currentHSL[0], sHsv, vHsv)
        let [, sHsl, lHsl] = RGB2HSL(picked[0], picked[1], picked[2])
        currentHSL[1] = sHsl
        currentHSL[2] = lHsl

        this.huePointerTop = currentHSL[0] * COLOR_ZONE_HEIGHT + huePointerOff

        let rgb = HSL2RGB(currentHSL[0], currentHSL[1], currentHSL[2])
        this.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + '))'

        this.updateColor();
      },
      onEnd: () => { this.#drag = null }
    })
  }
  dragHueBelt(ev: MouseEvent) {
    // 拖动色相条同样意味着"开始选色"（无颜色态下 s/l 已被复位成 0，不会算出 NaN）
    this.hasColor = true
    let t = ev.currentTarget as HTMLElement
    let rect = getRectInContainer(t, document.body)
    let y = ev.offsetY
    this.updateColor()
    this.huePointerTop = y + huePointerOff;
    let h = y / COLOR_ZONE_HEIGHT
    let rgb = HSL2RGB(h, 1, 0.5)
    let currentHSL = this.currentHSL
    currentHSL[0] = h
    this.swatchBackground = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'
    rgb = HSL2RGB(h, currentHSL[1], currentHSL[2])
    this.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + '))'

    let hbh = t.offsetHeight
    ev.preventDefault()

    this.#drag?.end(false)
    this.#drag = beginDrag(t, ev as PointerEvent, {
      onMove: (e) => {
        let y = e.clientY - rect.y + window.scrollY;

        // 捕获后 `e.target` 恒为色相条，越界一律按几何位置兜底
        if (y < 0) y = 0;
        if (y > hbh) y = hbh;

        h = y / COLOR_ZONE_HEIGHT
        let rgb = HSL2RGB(h, 1, 0.5)
        this.swatchBackground = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'
        rgb = HSL2RGB(h, currentHSL[1], currentHSL[2])
        this.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + '))'
        currentHSL[0] = h
        this.huePointerTop = y + huePointerOff
        this.updateColor()
      },
      onEnd: () => { this.#drag = null }
    })
  }
  dragAlphaBelt(ev: MouseEvent) {
    let t = ev.currentTarget as HTMLElement
    let rect = getRectInContainer(t, document.body)
    let y = ev.offsetY
    this.alphaValue = 1 - y / COLOR_ZONE_HEIGHT;
    this.updateColor()
    this.alphaPointerTop = y + huePointerOff;

    let hbh = t.offsetHeight
    ev.preventDefault()

    this.#drag?.end(false)
    this.#drag = beginDrag(t, ev as PointerEvent, {
      onMove: (e) => {
        let y = e.clientY - rect.y + window.scrollY;

        // 捕获后 `e.target` 恒为透明度条，越界一律按几何位置兜底
        if (y < 0) y = 0;
        if (y > hbh) y = hbh;

        this.alphaPointerTop = y + huePointerOff

        this.alphaValue = 1 - y / COLOR_ZONE_HEIGHT;
        this.updateColor()
      },
      onEnd: () => { this.#drag = null }
    })
  }
}