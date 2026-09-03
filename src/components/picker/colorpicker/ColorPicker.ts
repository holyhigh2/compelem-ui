import { csscope, Csscope, debounced, emits, forEach, h, ifTrue, prop, query, QueryCache, show, state, styles, tag, Template, watch } from "compelem";
import { findIndex, isEmpty, upperCase, values } from "myfx";
import { getRectInContainer } from "uiik";
import { AppearanceElem } from "../../../base/Appearance";
import { Virtualized } from "../../../mixins/Virtualized";
import { ColorHelper, getRGBColorValue, HSL2RGB, RGB2HSL, toHexString, toHSLString, toRGBString } from "../../../utils/color";
import style from "./style.scss?tmpl";

const COLOR_ZONE_WIDTH = 290;
const COLOR_ZONE_HEIGHT = 170;
/**
 * 颜色拾取
 * @props
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
  @state({ shallow: true }) HSLBeltColors: string[] = []
  @state newColor = ''
  @state originColor = ''
  @state alphaValue = 1
  @state huePointerTop = 0
  @state alphaPointerTop = 0
  @state alphaBeltBackground = ''
  @state swatchBackground = 'rgb(255, 0, 0)'

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

    let rgb = getRGBColorValue(nv)
    let parts = rgb.split(' ')
    let [h, s, l] = RGB2HSL(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]))

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

    let [x, y] = this.HSL2SwatchXY(s, l)
    this.__swatchPointerTop = y + colorPointerOff + 'px'
    this.__swatchPointerLeft = x + colorPointerOff + 'px'
    let cpStyle = this.colorPointer?.style;
    if (cpStyle) {
      cpStyle.left = this.__swatchPointerLeft;
      cpStyle.top = this.__swatchPointerTop;
    }
    this.updateColor()
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
            <div class="color ce-color-picker-newColor"><div class="ce-color-picker-cover" ${styles({ backgroundColor: this.newColor })}></div></div>
            <div class="color ce-color-picker-originColor"><div class="ce-color-picker-cover" ${styles({ backgroundColor: this.originColor })} @click="setColor(window.getComputedStyle(this, null).backgroundColor);"></div></div>
            <slot name="header"></slot>
          </ce-header>
          <ce-main class="ce-color-picker-color-pane" style="display: flex;">
            <div class="ce-color-picker-color-swatch" @mousedown="${this.dragColorSwatch}" ${styles({
      width: COLOR_ZONE_WIDTH + 'px',
      height: COLOR_ZONE_HEIGHT + 'px',
      minWidth: COLOR_ZONE_WIDTH + 'px',
      minHeight: COLOR_ZONE_HEIGHT + 'px',
      backgroundColor: this.swatchBackground
    })}>
              <div class="ce-color-picker-color-pointer"></div>
            </div>
            <div class="ce-color-picker-hue-belt" ${styles({ height: COLOR_ZONE_HEIGHT + 'px' })} @mousedown="${this.dragHueBelt}">
              <div class="ce-color-picker-colors">
              ${forEach(this.HSLBeltColors, (c, i) => i, (c, i) => h`
                <div class="ce-color-picker-hue-line" ${styles({ top: i + 'px', background: c })}></div>  
              `)}
              </div>
              <div class="ce-color-picker-pointer" ${styles({ top: this.huePointerTop + 'px' })}></div>
            </div>
            ${ifTrue(this.showAlpha, () => h`
              <div  class="ce-color-picker-alpha-belt" ${styles({ height: COLOR_ZONE_HEIGHT + 'px' })} @mousedown="${this.dragAlphaBelt}">
                <div class="ce-color-picker-cover" ${styles({ backgroundImage: this.alphaBeltBackground })}></div>
                <div class="ce-color-picker-pointer" ${styles({ top: this.alphaPointerTop + 'px' })}></div>
              </div>
            `)}
          </ce-main>
          <ce-footer class="ce-color-picker-color-footer">
            <ce-button @click="${this.changeColorMode}"  appearance="pale" icon="c-svg-expand-vertical">${this.colorModeString}</ce-button>
            <ce-input  .value="${this.colorString}" appearance="default"></ce-input>
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
  changeColor(ev: MouseEvent) {
    let t = ev.currentTarget as HTMLElement
    this.watchValue(t.dataset.color)
  }
  swatchXY2HSL(x: number, y: number): [number, number] {
    let s = x / COLOR_ZONE_WIDTH;
    let l1 = (COLOR_ZONE_HEIGHT - y) / COLOR_ZONE_HEIGHT;
    let l2 = (COLOR_ZONE_WIDTH - x) / COLOR_ZONE_WIDTH;
    l2 = l2 < 0.5 ? 0.5 : l2;
    //垂直方向亮度1-0 ↓
    //水平方向亮度1-0.5 →
    //l = l*s;
    let l = l1 * l2;

    return [s, l]
  }
  HSL2SwatchXY(s: number, l: number): [number, number] {
    let x = s * COLOR_ZONE_WIDTH;
    let l2 = (COLOR_ZONE_WIDTH - x) / COLOR_ZONE_WIDTH;
    l2 = l2 < 0.5 ? 0.5 : l2;
    let l1 = l / l2;

    let y = COLOR_ZONE_HEIGHT * (1 - l1);

    return [x, y];
  }
  changeColorMode(ev: MouseEvent) {
    let ks = values(ColorMode)
    let i = findIndex(ks, k => k === this.colorMode)
    let nextMode = ColorMode[upperCase(ks[(i + 1) % 3])]
    this.colorMode = nextMode

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
    let [s, l] = this.swatchXY2HSL(x, y);
    let currentHSL = this.currentHSL
    currentHSL[1] = s
    currentHSL[2] = l
    this.updateColor();

    let rgb = HSL2RGB(currentHSL[0], currentHSL[1], currentHSL[2])
    this.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + '))'

    const that = this
    let dragging = true;
    document.onmousemove = function (e) {
      if (!dragging) return;
      var x = e.clientX - rect.x + window.scrollX;
      var y = e.clientY - rect.y + window.scrollY;

      //边界检测
      if (e.target !== colorLayer) {
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > clw) x = clw;
        if (y > clh) y = clh;
      }

      cpStyle.left = x + colorPointerOff + 'px'
      cpStyle.top = y + colorPointerOff + 'px'

      //更新UI
      let [s, l] = that.swatchXY2HSL(x, y);
      currentHSL[1] = s
      currentHSL[2] = l

      that.huePointerTop = currentHSL[0] * COLOR_ZONE_HEIGHT + huePointerOff

      let rgb = HSL2RGB(currentHSL[0], currentHSL[1], currentHSL[2])
      that.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + '))'

      that.updateColor();
    }
    document.onmouseup = function () {
      dragging = false;
      document.onmousemove = null;
      document.onmouseup = null;
    }
  }
  dragHueBelt(ev: MouseEvent) {
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

    const that = this
    let dragging = true;
    let hbh = t.offsetHeight
    ev.preventDefault()
    document.onmousemove = function (e) {
      if (!dragging) return;
      let y = e.clientY - rect.y + window.scrollY;

      //边界检测
      if (e.target !== t) {
        if (y < 0) y = 0;
        if (y > hbh) y = hbh;
      }

      h = y / COLOR_ZONE_HEIGHT
      let rgb = HSL2RGB(h, 1, 0.5)
      that.swatchBackground = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'
      rgb = HSL2RGB(h, currentHSL[1], currentHSL[2])
      that.alphaBeltBackground = 'linear-gradient(to top, rgba(0,0,0,0),rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + '))'
      currentHSL[0] = h
      that.huePointerTop = y + huePointerOff
      that.updateColor()
    }
    document.onmouseup = function () {
      dragging = false;
      document.onmousemove = null;
      document.onmouseup = null;
    }
  }
  dragAlphaBelt(ev: MouseEvent) {
    let t = ev.currentTarget as HTMLElement
    let rect = getRectInContainer(t, document.body)
    let y = ev.offsetY
    this.alphaValue = 1 - y / COLOR_ZONE_HEIGHT;
    this.updateColor()
    this.alphaPointerTop = y + huePointerOff;

    const that = this
    let dragging = true;
    let hbh = t.offsetHeight
    ev.preventDefault()
    document.onmousemove = function (e) {
      if (!dragging) return;
      let y = e.clientY - rect.y + window.scrollY;

      //边界检测
      if (e.target !== t) {
        if (y < 0) y = 0;
        if (y > hbh) y = hbh;
      }

      that.alphaPointerTop = y + huePointerOff

      that.alphaValue = 1 - y / COLOR_ZONE_HEIGHT;
      that.updateColor()
    }
    document.onmouseup = function () {
      dragging = false;
      document.onmousemove = null;
      document.onmouseup = null;
    }
  }
}