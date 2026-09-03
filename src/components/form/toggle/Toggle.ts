import { classes, csscope, Csscope, emits, h, ifTrue, prop, query, state, styles, tag, Template, watch } from "compelem";
import { isBoolean } from "myfx";

import { FormControl } from "../FormControl";
import formStyle from "../style.scss?tmpl";
import style from "./style.scss?tmpl";
/**
 * 开关组件
 * @attrs
 *  activeText {string} 激活时的文本
 *  inactiveText {string} 未激活时的文本
 *  activeValue {string} 激活时的值，默认 'active'
 *  inactiveValue {string} 未激活时的值，默认 'inactive'
 *  value {string|boolean} 当值为字符串时匹配in/activeValue，受控属性 
 *  inset {boolean} 嵌入模式，默认true
 *  
 *  其他FormControl属性
 * @models
 *  value 默认绑定属性
 * @slots
 *  - 显示label内容
 *  active 激活时显示内容
 *  inactive 非激活时显示内容
 * @events
 *  change({value,checked})
 *
 * @author holyhigh2
 */
@emits('change', 'update:value')
@tag("ce-toggle")
export class Toggle extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop activeText = ' ';
  @prop inactiveText = ' ';
  @prop activeValue = 'active';
  @prop inactiveValue = 'inactive';
  @prop inset = true;
  @prop({ type: [String, Boolean], model: true }) value: boolean | string = '';

  @state __innerValue: typeof this.value
  @state checked = false;

  round = 'pill'

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyle, style];
  }
  get renderEl() {
    return this.formContrl
  }
  @query('.ce-form-control')
  formContrl: HTMLElement
  @query('input')
  input: HTMLInputElement;
  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  function(nv: string | boolean) {
    this.__innerValue = nv
    if (isBoolean(nv)) {
      this.checked = nv;
    } else if (/(?:^true$)|(?:^false$)/.test(nv)) {
      this.checked = nv === 'true' ? true : false
    } else {
      this.checked = this.activeValue == nv ? true : false;
    }
    if (this.input) {
      this.input.checked = this.checked
    }
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return this.plaintext ? h`${this.checked ? this.activeText : this.inactiveText}` : h`
      <label class="ce-form-toggle" ${classes({
      "is-disabled": this.disabled
    })}>
        <div class="ce-form-control" ${classes({ "is-inset": this.inset })} ${styles({
      width: '100%',
      overflow: 'visible'
    })}>
          <input type="checkbox" tabindex="0" ?disabled="${this.disabled}" ?checked="${this.checked}" @click.stop="${this.onClick}" @change="${this.onChange}"/>
          <div class="ce-form-toggle-track" ${classes({ "is-disabled": this.disabled, "is-rounded": this.round, "is-readonly": this.readonly })}>
            ${ifTrue(this.inset, () => h`
              <span class="is-active">
              ${this.activeText}
              <slot name="active"></slot>
            </span>
            <span class="is-inactive">${this.inactiveText}<slot name="inactive"></slot></span>  
            `)}
          </div>
          <div class="ce-form-toggle-thumb"></div>
        </div>
        
        <div class="ce-form-toggle-label"><slot></slot></div>
      </label>`;
  }

  //////////////////////////////////// methods
  onClick(e: Event) {
    if (this.readonly)
      e.preventDefault();
  }
  onChange(e: Event) {
    let t = e.target as HTMLInputElement

    let value = t.checked ? (this.activeValue || 'active') : (this.inactiveValue || 'inactive')
    if (isBoolean(this.__innerValue)) {
      if (this.__innerValue === t.checked) return
      this.value = this.__innerValue = t.checked
    } else {
      if (this.__innerValue == value) return
      this.value = this.__innerValue = value
    }

    this.emit('change', { value: value, checked: t.checked }, e)
  }
  toggleCheck() {
    this.checked = !this.checked
  }
}