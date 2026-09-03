import { classes, createRef, css, csscope, Csscope, emits, h, ifTrue, prop, query, QueryCache, show, state, tag, Template, watch } from "compelem";
import { isBlank, isNil } from "myfx";

import { Close } from "../../../icons/icons";
import { formStyleSheet } from "../styleSheets";
import { BaseInput } from "./BaseInput";
import style from "./input.scss?tmpl";
/**
 * 单行输入框，内容包括
 * 前缀 控制区 后缀
 *      消息
 * @props
 *  value {string|number} 默认值
 *  showPassword {boolean} 显示密码图标，默认false
 *  autoselect {boolean} 获得焦点时自动选中文本，默认false
 *  clearable {boolean} 显示清除按钮，默认false
 *  inside {boolean} 前后插槽是否抱在控制区内，默认false
 *  type {string} 输入框原生类型，默认text
 *  label {string} 显示输入标签
 *  required {boolean} 当label属性不为空时显示星号
 *  placeholder {string} 占位符
 *  active {boolean} 是否激活状态，激活状态会应用focus相同样式，通常用在嵌套组件中
 *  error {boolean} 错误状态，会应用错误样式
 *  errorMessage {string} 错误信息，错误状态时显示的信息，如果为空则显示hint
 *  hint {string} 提示信息
 *  hideHint {boolean} 隐藏提示框，默认false
 *  maxlength {string|number} 最大输入字符数
 *  minlength {string|number} 最小输入字符数
 * @models
 *  value 默认绑定属性，input事件触发变更
 *  changeValue change事件绑定属性，change事件触发变更。如果绑定该属性，可通过value属性设置默认值
 * @slots
 *  prepend
 *  append
 * @events
 *  focus
 *  blur
 *  input
 *  clear
 * @parts
 *  input 输入元素
 *  control formControl元素
 *  close 关闭图标
 *
 * @author holyhigh2
 */
@emits('update:*', 'focus', 'blur', 'input', 'change', 'clear', 'keyup', 'keydown')
@tag("ce-input")
export class Input extends BaseInput {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  inputRef = createRef<HTMLInputElement>()
  //////////////////////////////////// props
  hoverable = true
  rounded = true
  @prop showPassword = false;
  @prop inside = false;
  @prop autoselect = false;
  @prop active = false
  @prop type = 'text'
  @prop({ type: [String, Number], model: true }) value = ''
  @prop({ type: [String, Number] }) changeValue = ''

  @state({ prop: 'value' }) __innerValue: string = '';
  @state hasLeft = false;
  @state hasRight = false;

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, style];
  }

  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-input:focus-within {
        outline: none;
        border-color: rgb(var(--form-item-color));
      }
      ce-input[active],
      ce-input:not([disabled], ce-input:focus-within):hover{
        border-color: rgb(var(--form-item-color));
      }
      ce-input[appearance="underlined"]::after {
        content: "";
        border-bottom: 1px solid rgb(var(--form-item-color));
        position: absolute;
        width: 0%;
        left: 50%;
        bottom: 0;
        transition:all .2s;
      }
      ce-input[appearance="underlined"]:focus-within::after{
        width: 100%;
        left: 0%;
      }
    `
  }

  get renderEl() {
    return this.controlEl
  }

  @query('.ce-input-floating')
  floatingBox: HTMLElement;
  @query('.ce-input-append')
  trailingBox: HTMLElement;
  @query('.ce-control', QueryCache.ONCE)
  controlEl: HTMLElement
  @query('input')
  input!: HTMLInputElement
  @query('.ce-message')
  msgEl!: HTMLElement

  /////////////////////////////////// watches
  @watch(['value', 'changeValue'])
  watchValue(nv: any) {
    if (isNil(nv)) {
      nv = ''
    }
    if (nv != this.__innerValue) {
      this.__innerValue = nv
    }
  }
  @watch('appearance')
  watchAppearance(nv: string) {
    this.bordered = nv == 'underlined' ? false : true
  }
  @watch(['hideHint', 'errorMessage'], { immediate: true })
  watchMessage(nv: any) {
    if (!this.hideHint && !isBlank(this.errorMessage)) {
      this.nextTick(() => {
        this.style.marginBottom = this.msgEl.offsetHeight + 'px'
      })
    } else {
      this.style.marginBottom = '0px'
    }
  }
  //////////////////////////////////// lifecycles
  beforeMount(): void {

  }
  mounted(): void {
    // if (this.__innerValue !== this.inputRef.current?.value) {
    //   this.inputRef.current!.value = this.__innerValue
    // }
  }
  render(): Template {
    return h`
      <div class="ce-input" ${classes({
      "ce-input-error": this.error
    })}>
      ${ifTrue(!this.inside, () => h`
        <span class="ce-input-prepend">
          <slot name="prepend" @slotchange="${this.onPrependChange}"></slot>
        </span>
      `)}
        
        <div part="control" class="ce-form-control" ?activated="${this.active}" ?disabled="${this.disabled}">
          ${ifTrue(this.inside, () => h`
            <span class="ce-input-prepend-inside"><slot name="prepend" @slotchange="${this.onPrependChange}"></slot></span>
          `)}
          
          ${ifTrue(!isBlank(this.label), () => h`
          <label class="ce-input-label" ${classes({ "is-empty": !!this.__innerValue })}>
            <b style="color:red;vertical-align:middle;margin-right: 3px;" ${show(this.required)}>*</b>${this.label}
          </label>
          `)}
          <input part="input" autocomplete="one-time-code"
          ${classes({ "is-round-left": !this.hasLeft, "is-round-right": !this.hasRight })} 
          ref="${this.inputRef}" value="${this.__innerValue}"
          placeholder="${this.placeholder}"
          type="${this.showPassword ? 'password' : this.type}" 
          @input="${this.onInput}"  @change="${this.onChange}" @focus="${this.onFocus}" @blur="${this.onBlur}" 
          @keyup="${this.onKeyup}" @keydown="${this.onKeydown}"
          ?readonly="${this.readonly}" ?disabled="${this.disabled}" maxlength="${this.maxlength}" minlength="${this.minlength}"/>
          ${ifTrue(this.clearable, () => h`
            <span part="close" class="ce-input-floating" ${classes({ "is-not-empty": !!this.__innerValue })}>
              <ce-icon class="ce-input-close" .svg="${Close}" @mousedown.stop @click.prevent="${this.onClear}"></ce-icon>
            </span>
          `)}
          ${ifTrue(this.inside, () => h`
            <span class="ce-input-append-inside"><slot name="append" @slotchange="${this.onAppendChange}"></slot></span>
          `)}
        </div>
        ${ifTrue(!this.inside, () => h`
            <span class="ce-input-append"><slot name="append" @slotchange="${this.onAppendChange}"></slot></span>
          `)}
        <div class="ce-message" ${show(!this.hideHint && !isBlank(this.errorMessage))}>
          ${this.error ? (this.errorMessage ?? this.hint) : this.hint}
        </div>
      </div>
  `;
  }
  //////////////////////////////////// methods
  setValue(value: string) {
    this.value = value;
    this.inputRef.current!.value = value;
  }
  onAppendChange(e: Event) {
    let t = e.target as HTMLSlotElement;
    let slotRoots = t.assignedElements();
    if (slotRoots.length > 0) {
      this.hasRight = true
    }
  }
  onPrependChange(e: Event) {
    let t = e.target as HTMLSlotElement;
    let slotRoots = t.assignedElements();
    if (slotRoots.length > 0) {
      this.hasLeft = true
    }
  }
  onClear(e: Event) {
    this.clear()
    this.emit('clear', { value: '' })
  }
  onKeyup(e: KeyboardEvent) {
    e.stopPropagation();
    let t = e.currentTarget as HTMLInputElement
    let selectionText = t.value.substring(t.selectionStart || 0, t.selectionEnd || 0)
    this.emit('keyup', { value: t.value, selectionText, selectionStart: t.selectionStart, selectionEnd: t.selectionEnd }, e)
  }
  onKeydown(e: KeyboardEvent) {
    e.stopPropagation();
    let t = e.currentTarget as HTMLInputElement
    let selectionText = t.value.substring(t.selectionStart || 0, t.selectionEnd || 0)
    this.emit('keydown', { value: t.value, selectionText, selectionStart: t.selectionStart, selectionEnd: t.selectionEnd }, e)
  }
  onInput(e: InputEvent) {
    let input = e.target as HTMLInputElement

    e.stopPropagation();
    this.emit('input', { value: input.value }, e)
    this.emit('update:value', { value: input.value })
  }
  onFocus(e: Event) {
    let input = e.target as HTMLInputElement
    e.stopPropagation();
    if (this.autoselect) {
      input.select()
    }

    this.emit('focus', { value: input.value }, e)
  }
  onBlur(e: Event) {
    e.stopImmediatePropagation();
    e.preventDefault()
    this.emit('blur', { value: this.inputRef.current?.value }, e)

  }
  onChange(e: Event) {
    e.stopPropagation();
    this.__innerValue = this.inputRef.current?.value ?? '';
    this.emit('change', { value: this.inputRef.current?.value }, e)
    this.emit('update:changeValue', { value: this.inputRef.current?.value })
  }
  clear() {
    this.input.value = this.__innerValue = '';
    this.emit('update:value', { value: this.__innerValue })
    this.emit('update:changeValue', { value: this.__innerValue })
  }
  focus() {
    this.inputRef.current?.focus()
  }
  blur() {
    this.inputRef.current?.blur()
  }
  /**
   * 用于外部框架调用
   * @returns 
   */
  getInput() {
    return this.inputRef.current?.value
  }
}