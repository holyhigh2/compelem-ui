import { isBlank, isDefined, isEmpty } from 'myfx';

import { bind, classes, html, prop, query, state, styles, tag, Template, watch } from "compelem";
import { FormControl } from '../FormControl';
import formStyle from "../style.scss";
import style from "./style.scss";
/**
 * 复选框
 * @attrs
 *  indeterminate {boolean} 中间状态，默认false
 *  value {string} 提交服务器的值，如果为空则使用默认插槽内文本内容
 *  checked {boolean} 是否选中，受控属性
 * @slots
 *  - 显示label内容
 * @events
 *  change({value,checked})
 *
 * @author holyhigh2
 */
@tag("l-checkbox")
export class Checkbox extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop indeterminate = false;
  @prop({ type: String }) value = '';
  @prop({ type: Boolean, sync: true }) checked = false;
  @state label = '';

  @query('input')
  input: HTMLInputElement;

  static get styles(): string[] {
    return [formStyle, style];
  }
  /////////////////////////////////// watches
  @watch('checked')
  function(nv: boolean) {
    this.input.checked = this.checked
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return this.plaintext ? html`${this.checked ? this.value : ''}` : html`
      <label class="c-form-checkbox ${classes({
      __disabled: this.disabled,
      __indeterminate: this.indeterminate
    })}" >
        <div class="box-container">
          <input type="checkbox" tabindex="0" name="${this.name}" ${bind(this.attrs)} value="${this.value || this.label}" ?checked="${this.checked}" @click="${this.onClick}" @change="${this.onChange}" ?readonly="${this.readonly}" ?disabled="${this.disabled}"/>
          <div class="box c-form-control ${classes({ __disabled: this.disabled, __rounded: this.round, __readonly: this.readonly })}"></div>
        </div>
        <div class="label" style="${styles({
      'margin-left': isEmpty(this.slots.default) ? '0' : '0.5rem'
    })}">
          <slot></slot>
        </div>
      </label>`;
  }

  mounted(): void {
    if (isBlank(this.value) && !isEmpty(this.slots.default)) {
      this.label = this.slots.default[0].textContent!
    }
  }
  //////////////////////////////////// methods
  onClick(e: Event) {
    if (this.readonly)
      e.preventDefault();
  }
  onChange(e: Event) {
    let t = e.target as HTMLInputElement

    this.checked = t.checked
    this.emit('change', { value: t.value, checked: t.checked }, { event: e })
  }
  toggleCheck(checked?: boolean) {
    if (this.checked === checked) return;

    if (isDefined(checked)) {
      this.checked = checked!
    } else {
      this.checked = !this.checked
    }
    this.emit('change', { value: this.input.value, checked: this.checked })
  }
}