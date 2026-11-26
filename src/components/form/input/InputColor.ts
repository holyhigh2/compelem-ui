import { classes, createRef, csscope, Csscope, emits, h, ifTrue, model, prop, query, state, styles, tag, Template, watch } from "compelem";

import { isBlank } from "myfx";
import appearanceStyle from "../../../base/appearance.scss?tmpl";
import { Overlay } from "../../overlays/overlay/Overlay";
import { formStyleSheet } from "../styleSheets";
import { BaseInput } from "./BaseInput";
import { inputStyleSheet } from "./styleSheets";

/**
 * 颜色输入框
 * @attrs
 *  value {string} 默认值，支持 hex(a)/hsl(a)/rgb(a) 三种格式
 *  showAlpha {boolean} 是否支持透明度选择，默认false
 * @models
 *  value {string} 颜色字符串，受控
 * @slots
 * @events
 *  close({value}) 关闭某个tag时触发
 *  clear 清除所有tag时触发
 *
 * @author holyhigh2
 */
@emits('update:value')
@tag("ce-input-color")
export class InputColor extends BaseInput {
  clear(): void {
    this.__innerValue = '';
    this.emit('update:value', { value: '' });
  }

  //////////////////////////////////// props
  @prop value = ''
  @prop showAlpha = false
  /** 调色盘颜色数组，非空时浮层内取色面板显示调色盘（透传给内部 ce-color-picker） */
  @prop palettes: string[] = []
  /**
   * 是否允许「无色」：开启后浮层底部出现「无色」按钮，点击把值置空并回写 `update:value {value: ''}`。
   *
   * 默认关闭 —— 不是所有宿主都想让颜色变成"空"（如表格列配置的颜色条件）。
   * 需要"无颜色"语义的字段（组态属性面板的 fill/stroke）显式打开，替代此前在宿主外层
   * 另挂一个色块按钮做「设为无色」的做法（两个同色色块并排，视觉上纯冗余）。
   */
  @prop allowNone = false

  @state __innerValue: string = ''

  @query('.ce-input-color-panel') colorPanel!: Overlay

  /**
   * 浮层里的取色器（**必须用 ref 拿**，不能 querySelector）。
   *
   * `ce-overlay` 在 `mounted()` 里会把默认插槽的节点搬进自己的 shadow
   * （`Overlay.ts:210-216`，整棵 renderRoot 再挂到 body 的 `.ce-overlay-container`）
   * —— 搬完以后 `this.shadowRoot.querySelector('ce-color-picker')` 就找不到了。
   */
  pickerRef = createRef<any>()

  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return appearanceStyle;
  }
  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet];
  }

  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  watchValue(nv: string) {
    this.__innerValue = nv
  }
  /////////////////////////////////// computed

  //////////////////////////////////// lifecycles

  constructor() {
    super()
    this.round = "sm"
  }
  render(): Template {
    return h`
      <div class="ce-input-color">
        <div class="ce-input-color-block" ${classes({ "ce-input-none-color": isBlank(this.__innerValue) })} ${styles({ backgroundColor: this.__innerValue })} @click="${this.openLayer}">${ifTrue(isBlank(this.__innerValue), () => h`<span class="ce-input-color-none">默认</span>`)}</div>
        <ce-overlay surface placement="bottom-start" auto-active close-on-click opacity="0.25" class="ce-input-color-panel" @open="${() => this.__syncPicker()}" @opened="${() => this.__syncPicker()}">
          <ce-card class="ce-input-time-card" style="padding: var(--ce-spacing-xs);--ce-card-gap: var(--ce-spacing-xs);">
            <ce-color-picker ref="${this.pickerRef}" style="--ce-color-picker-padding-bottom: var(--ce-spacing-xs);" ${model(this.__innerValue)} .show-alpha="${this.showAlpha}" .palettes="${this.palettes}"></ce-color-picker>
            <ce-divider></ce-divider>
            <div slot="actions" style="gap: 1rem;display: flex;justify-content: flex-end;align-items: center;">
              ${ifTrue(this.allowNone, () => h`<ce-button appearance="pale" @click="${this.chooseNone}">无色</ce-button>`)}
              <ce-button appearance="outlined" color="info" @click="${this.confirm}">确定</ce-button>
            </div>
          </ce-card>
        </ce-overlay>
      </div>
    `;
  }

  //////////////////////////////////// methods
  /**
   * 打开浮层后把当前值补进取色器。
   *
   * 幂等：值相同时直接返回，不会和 `model` 形成回环。
   */
  __syncPicker() {
    const p = this.pickerRef.current as any
    if (!p || p.value === this.__innerValue) return
    p.value = this.__innerValue
  }
  openLayer(ev: MouseEvent) {
    // 禁用/加载中态不展开浮层（与 Select.__showList 同口径）：
    // 样式层的 opacity/cursor 只做视觉，点色块仍会触发 click，必须在此拦住。
    if (this.disabled || this.loading) return
    this.colorPanel.openBy(ev.target as any)
  }

  /**
   * 「无色」：先把浮层里的取色器复位成无颜色态（棋盘格 + 红斜线，见 ColorPicker 的
   * `hasColor === false` 分支），再清空值回写宿主并关闭浮层。
   *
   * 顺序不能反：`picker.value = ''` 只走 `syncUI → resetUI`（不 emit），
   * 若先关浮层再赋值，重开时 `__syncPicker` 会拿 `__innerValue`（已空）比较，
   * 视觉正确但用户看不到"点了就变成无颜色"的即时反馈。
   */
  chooseNone() {
    const p = this.pickerRef.current as any
    if (p) p.value = ''
    this.clear()
    this.colorPanel.close()
  }

  confirm() {
    this.emit('update:value', { value: this.__innerValue })
    this.colorPanel.close()
  }
}