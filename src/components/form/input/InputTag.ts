import { computed, csscope, Csscope, emits, forEach, h, ifTrue, prop, query, show, state, tag, Template, watch } from "compelem";
import { isBlank, isEmpty, isString, remove, size, slice, trim } from "myfx";

import appearanceStyle from "../../../base/appearance.scss?tmpl";
import { formStyleSheet } from "../styleSheets";
import { BaseInput } from "./BaseInput";
import { Input } from "./Input";
import { inputStyleSheet } from "./styleSheets";

/**
 * 标签输入框
 * @attrs
 *  max {number} 最大可输入标签数
 *  maxlength {number} 每个标签最大可输入字符数
 *  placeholder {string} 提示符
 *  trigger {string} 创建标签的触发按键，可选Enter/Space/Comma，默认 Enter
 *  clearable {boolean} 支持清除，默认false
 *  max-collapse-tags {number} 最大显示tag数，超过时会折叠标签并仅显示个数，默认0，小于1无效
 * @models
 *  value {Array<string>} tag数组，受控
 * @slots
 *  -(v,i,onClose) 自定义tag
 *  append
 * @events
 *  close({value}) 关闭某个tag时触发
 *  clear 清除所有tag时触发
 *
 * @author holyhigh2
 */
@emits('update:value', 'close', 'clear')
@tag("ce-input-tag")
export class InputTag extends BaseInput {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  @query('ce-input')
  inputEl!: Input;

  static TriggerType = {
    Enter: 'Enter',
    Space: 'Space',
    Comma: 'Comma',
  }

  //////////////////////////////////// props

  @prop({ type: Array }) value: string[] = []
  @prop trigger = InputTag.TriggerType.Enter
  @prop maxCollapseTags = 0

  @state({ prop: 'value' }) __innerValue: string[] = [];
  @state __plusCount: number = 0;
  @state __r = 0

  @csscope(Csscope.GLOBAL)
  static get globalCss(): string {
    return appearanceStyle;
  }
  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet];
  }

  /////////////////////////////////// watches
  @watch('value')
  watchValue(nv: string[]) {
    this.__innerValue = nv ?? []
  }
  /////////////////////////////////// computed
  @computed
  get eachValue() {
    this.__r;
    if (this.maxCollapseTags > 0) {
      this.__plusCount = size(this.__innerValue) - this.maxCollapseTags
      return slice(this.__innerValue, 0, this.maxCollapseTags)
    }
    return this.__innerValue
  }
  //////////////////////////////////// lifecycles
  onCloseBind: Function
  constructor() {
    super()
    this.onCloseBind = this.onClose.bind(this)
  }
  render(): Template {
    return h`
      <ce-input class="ce-input-tag ce-input-floating-icon" clearable .maxlength="${this.maxlength}" @keyup="${this.onKeyup}">
        <div slot="prepend" class="ce-input-tags" style="display: contents;">
          ${forEach(this.eachValue, (v, i) => i, this.slotHooks.default ? (v, i) => h`<span>${this.slotHooks.default(v, i, () => this.onClose(this.__innerValue[i] as any))}</span>` : (v, i) => h`
            <ce-tag content="${v}" closable @close="${this.onClose}">${v}</ce-tag>
          `)}
          ${ifTrue(this.maxCollapseTags > 0 && this.__plusCount > 0, () => h`
              <ce-tag style="">+${this.__plusCount}</ce-tag>
          `)}
        </div>
        ${this.clearable}
        <span slot="append" class="ce-input-floating is-not-empty" >
          <ce-icon class="ce-input-close" size="sm" svg="c-svg-close" @mousedown.stop @click.prevent="${this.onClear}" ${show(this.clearable && !isEmpty(this.__innerValue))}></ce-icon>
          <slot name="append"></slot>
        </span>
      </ce-input>
    `;
  }

  //////////////////////////////////// methods
  __checkMax() {
    let maxNum = parseInt(this.max + "")
    this.inputEl.toggleAttribute('readonly', maxNum > 0 && size(this.__innerValue) >= maxNum)
  }
  onKeyup({ selectionText, event, value }: Record<string, any>) {
    if (event.key === this.trigger && this.trigger === InputTag.TriggerType.Enter ||
      event.key === " " && this.trigger === InputTag.TriggerType.Space ||
      (event.key === "," || event.key === "，") && this.trigger === InputTag.TriggerType.Comma
    ) {
      value = trim(value)
      if (this.trigger === InputTag.TriggerType.Comma) {
        value = value.replace(/[,，]$/, '')
      }
      if (this.__innerValue.includes(value)) return
      if (isBlank(value)) return

      let maxNum = parseInt(this.max + "")
      if (maxNum > 0 && size(this.__innerValue) >= maxNum) {
        return
      }

      this.__innerValue.push(value)
      this.__r = Math.random()
      this.nextTick(() => {
        this.__checkMax()

        this.inputEl.clear()
        this.inputEl.focus()

      })
      this.emit('update:value', { value: this.__innerValue })
    }
  }
  clear() {
    this.inputEl.toggleAttribute('readonly', false)
    this.__innerValue = []
    this.__checkMax()
    this.emit('update:value', { value: '' })
  }
  onClear() {
    this.clear()
    this.emit('clear')
    this.inputEl.focus()
  }
  onClose(ev: Record<string, any>) {
    let v = isString(ev) ? ev : ev.target.getAttribute('content')
    remove(this.__innerValue, iv => iv == v)
    this.__r = Math.random()
    this.__checkMax()

    this.inputEl.focus()

    this.emit('update:value', { value: this.__innerValue })

    this.emit('close', { value: v })
  }
}