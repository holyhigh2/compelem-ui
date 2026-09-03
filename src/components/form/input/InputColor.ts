import { classes, csscope, Csscope, emits, h, model, prop, query, state, styles, tag, Template, watch } from "compelem";

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
    throw new Error("Method not implemented.");
  }
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }

  //////////////////////////////////// props
  @prop value = ''
  @prop showAlpha = false

  @state __innerValue: string = ''

  @query('.ce-input-color-panel') colorPanel!: Overlay

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
        <div class="ce-input-color-block" ${classes({ "ce-input-none-color": isBlank(this.__innerValue) })} ${styles({ backgroundColor: this.__innerValue })} @click="${this.openLayer}"></div>
        <ce-overlay placement="top-end" auto-active close-on-click opacity="0.25" class="ce-input-color-panel" >
          <ce-card class="ce-input-time-card" style="padding: var(--ce-spacing-xs);">
            <ce-color-picker ${model(this.__innerValue)}" .show-alpha="${this.showAlpha}"></ce-color-picker>
            <ce-divider></ce-divider>
            <footer slot="actions" style="padding-top:.25rem;gap: 1rem;display: flex;justify-content: flex-end;align-items: center;">
              <ce-button appearance="outlined" color="info" @click="${this.confirm}">确定</ce-button>
            </footer>
          </ce-card>
        </ce-overlay>
      </div>
    `;
  }

  //////////////////////////////////// methods
  openLayer(ev: MouseEvent) {
    this.colorPanel.openBy(ev.target as any)
  }
  confirm() {
    this.emit('update:value', { value: this.__innerValue })
    this.colorPanel.close()
  }
}