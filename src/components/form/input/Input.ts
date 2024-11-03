import { bind, classes, createRef, html, ifElse, ifTrue, prop, query, QueryCache, show, state, tag, Template, watch } from "compelem";
import { isBlank, isNil } from "myfx";
import { Close } from "../../../icons/icons";
import { Popup } from "../../overlays/popup/Popup";
import { FormControl } from "../FormControl";
import formStyle from "../style.scss";
import style from "./style.scss";
/**
 * 输入框
 * @attrs
 *  showPassword {boolean} 显示密码图标，默认false
 *  textarea {boolean} 显示为文本域，默认false
 *  autoselect {boolean} 获得焦点时自动选中文本，默认false
 *  clearable {boolean} 显示清除按钮，默认false
 *  inside {boolean} 是否取消插槽区背景色，默认false
 *  type {string} 输入框原生类型，默认text
 *  datalist {array} 可选数据列表，选中时内容会被填充到输入框中
 *  label {string} 显示输入提示
 *  required {boolean} 当值为true且label属性不为空时，显示星号
 * @slots
 *  leading
 *  trailing
 * @events
 *  focus
 *  blur
 *  input
 *
 * @author holyhigh2
 */
@tag("l-input")
export class Input extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  inputRef = createRef<HTMLInputElement>()
  //////////////////////////////////// props
  @prop showPassword = false;
  @prop textarea = false;
  @prop clearable = false;
  @prop inside = false;
  @prop autoselect = false;
  @prop required = false;
  @prop label = '';
  @prop({ type: Array }) datalist: Array<string>;
  @prop type = 'text'
  @prop({ type: [String, Number], sync: true })
  get value() {
    return this.__innerValue ?? ''
  }
  set value(v: any) {
    this.__innerValue = v
    if (isNil(v)) {
      this.__innerValue = '';
    }
    this.emit('update:value', { value: this.__innerValue })
  }
  @state __innerValue: string = '';

  @state hasLeft = false;
  @state hasRight = false;

  static get styles(): string[] {
    return [formStyle, style];
  }

  @query('.--floating')
  floatingBox: HTMLElement;
  @query('.--trailing')
  trailingBox: HTMLElement;
  @query('l-popup', QueryCache.ONCE)
  list: Popup;

  /////////////////////////////////// watches
  @watch('value')
  watchValue(nv: any) {
    this.inputRef.current.value = nv;
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return this.plaintext ? html`${this.__innerValue}` : html`
      <div class="c-form-control c-form-input ${classes({
      __disabled: this.disabled,
      __inside: this.inside,
      __clearable: this.clearable,
      __rounded: this.round,
      __readonly: this.readonly,
      ["__appearance-" + this.appearance]: true,
    })}">
        ${ifElse(
      this.textarea,
      () => html`<textarea ${bind(this.attrs)}></textarea>`,
      () => html`<span class="--leading ${classes({ '__not-empty': this.hasLeft })}" ><slot name="leading" @slotchange="${this.onPrependChange}"></slot></span>
            ${ifTrue(!isBlank(this.label), () => html`
            <label class="--label ${classes({ __empty: !!this.value })}">
              <b style="color:red;vertical-align: text-top;margin-right: 3px;" ${show(this.required)}>*</b>${this.label}
            </label>
            `)}                
            <input 
            class="${classes({ '__round-left': !this.hasLeft, '__round-right': !this.hasRight })}" 
            ref="${this.inputRef}" 
            type="${this.showPassword ? 'password' : this.type}" 
            value="${this.__innerValue}" 
            @input="${this.onInput}"  @change="${this.onChange}" @focus="${this.onFocus}" @blur="${this.onBlur}"
            ?readonly="${this.readonly}" ?disabled="${this.disabled}"
            ${bind(this.attrs)} />
            <span class="--floating ${classes({ '__not-empty': !!this.value })}">
              <l-icon class="--close" .svg="${Close}" @click="${this.onClear}"></l-icon>
            </span>
            <span class="--trailing ${classes({ '__not-empty': this.hasRight })}" >
              <slot name="trailing" @slotchange="${this.onAppendChange}"></slot>
            </span>
            `
    )
      }
</div>
  `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods
  setValue(value: string) {
    this.value = value;
    this.inputRef.current.value = value;
  }
  //保持焦点
  onMousedown(e: Event) {
    e.preventDefault();
    this.inputRef.current.focus();
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
  onInput(e: InputEvent) {
    let input = e.target as HTMLInputElement
    this.value = input.value

    e.stopPropagation();
    this.emit('input', { value: input.value }, { event: e })
  }
  onFocus(e: Event) {
    let input = e.target as HTMLInputElement
    e.stopPropagation();
    if (this.autoselect) {
      input.select()
    }

    this.emit('focus', { value: input.value }, { event: e })
  }
  onBlur(e: Event) {
    e.stopPropagation();
    this.emit('blur', { value: this.inputRef.current.value }, { event: e })
  }
  onChange(e: Event) {
    e.stopPropagation();
    this.emit('change', { value: this.inputRef.current.value }, { event: e })
  }

  clear() {
    this.value = '';
  }
  focus() {
    this.inputRef.current.focus()
  }
  blur() {
    this.inputRef.current.blur()
  }
}