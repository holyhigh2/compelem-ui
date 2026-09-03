import { closest, isBlank, isDefined, isEmpty } from 'myfx';

import { Csscope, Template, bind, classes, csscope, emits, h, prop, query, show, state, styles, tag, watch } from 'compelem';
import { FormControl } from '../FormControl';
import { formStyleSheet } from '../styleSheets';
import { CheckboxGroup } from './CheckboxGroup';
import style from "./style.scss?tmpl";
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
@emits('change', 'update:checked')
@tag("ce-checkbox")
export class Checkbox extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop indeterminate = false;
  @prop({ type: String }) value = '';
  @prop({ type: Boolean, model: true }) checked = false;

  @state({ prop: 'checked' }) __checked = false
  @state label = '';
  @state({ prop: 'indeterminate' }) __indeterminate = false

  @query('input')
  input: HTMLInputElement;

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, style];
  }
  /////////////////////////////////// watches
  @watch('checked')
  function(nv: boolean) {
    this.__checked = this.checked
  }
  @watch('__checked')
  watchChecked(nv: boolean) {
    this.input.checked = nv
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
      <span ${show(this.plaintext)}>${this.checked ? this.value : ''}</span>
      <label
        class="ce-form-checkbox"
        ${classes({
      "is-disabled": this.disabled,
      "is-indeterminate": this.__indeterminate
    })}
      >
        <div class="ce-form-checkbox-container">
          <input
            type="checkbox"
            @click.stop
            tabindex="0"
            name="${this.name}"
            ${bind(this.attrs)}
            value="${this.value || this.label}"
            ?checked="${this.__checked}"
            @change.stop="${this.onChange}"
            ?readonly="${this.readonly}"
            ?disabled="${this.disabled}"
          />
          <div
            class="ce-form-checkbox-box ce-form-control"
            ${classes({ "is-disabled": this.disabled, "is-rounded": this.round, "is-readonly": this.readonly })}
          >
          </div>
        </div>
        <div
          class="ce-form-checkbox-label"
          ${styles({
      'margin-left': isEmpty(this.slots.default) ? '0' : '0.5rem'
    })}
        >
          <slot></slot>
        </div>
      </label>
    `;
  }
  #checkboxGroup: CheckboxGroup
  mounted(): void {
    let checkboxGroup = closest<CheckboxGroup>(this, node => node instanceof CheckboxGroup, 'parentComponent')
    if (checkboxGroup) {
      checkboxGroup._addChild(this)
      this.#checkboxGroup = checkboxGroup
    }

    if (isBlank(this.value) && !isEmpty(this.slots.default)) {
      this.label = this.slots.default[0].textContent!
    }
  }
  //////////////////////////////////// methods
  onChange(e: Event) {
    let t = e.target as HTMLInputElement

    this.__checked = this.checked = t.checked
    this.emit('change', { value: t.value, checked: t.checked }, e)
  }
  toggleCheck(checked?: boolean) {
    if (this.__checked === checked) return;

    if (isDefined(checked)) {
      this.__checked = this.checked = checked!
    } else {
      this.__checked = this.checked = !this.__checked
    }
    this.emit('change', { value: this.input.value, checked: this.__checked })
    if (this.#checkboxGroup) this.#checkboxGroup.onCheckChange(this.input.value, this.checked)
  }
  setIndeterminate(value: boolean) {
    this.__indeterminate = value
  }
  isChecked() {
    return this.__checked
  }
}