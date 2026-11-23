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
  //////////////////////////////////// props
  @prop indeterminate = false;
  @prop({ type: String }) value = '';
  @prop({ type: Boolean, model: true }) checked = false;

  @state __checked = this.checked
  @state label = '';
  @state __indeterminate = this.indeterminate

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
      // input 的 value 属性是创建期静态插值（this.value || this.label 此时均为空），
      // label 在 mounted 才可得，这里补写一次，保证表单提交与 change 事件携带正确值
      if (this.input && isBlank(this.input.value)) this.input.value = this.label
    }
  }
  //////////////////////////////////// methods
  onChange(e: Event) {
    let t = e.target as HTMLInputElement
    const val = this.value || this.label
    // 达上限兜底：原生 input 已先翻转，这里把原生态回滚并直接返回（不发 change），
    // 保证视觉、状态、事件三者一致。常规情况下 disabled 已让这条分支不可达
    if (t.checked && this.#checkboxGroup && !this.#checkboxGroup._canCheck(val)) {
      t.checked = false
      return
    }

    this.__checked = this.checked = t.checked
    this.emit('change', { value: val, checked: t.checked }, e)
    // 原生点击路径同步通知所属 CheckboxGroup（此前只有编程接口 toggleCheck 会通知，
    // 导致 group.value 永不更新、update:value 事件缺失）
    if (this.#checkboxGroup) this.#checkboxGroup.onCheckChange(val, t.checked)
  }
  toggleCheck(checked?: boolean) {
    const next = isDefined(checked) ? checked! : !this.__checked
    if (this.__checked === next) return;

    const val = this.value || this.label
    // 达上限前置守卫：DOM 路径由 group 下发的 disabled 拦住，这里覆盖 toggleCheck 等编程路径。
    // 放在置位之前，避免"先点亮再回滚"带来的事件抖动与状态闪烁
    if (next && this.#checkboxGroup && !this.#checkboxGroup._canCheck(val)) return

    this.__checked = this.checked = next
    this.emit('change', { value: val, checked: next })
    // 必须传 next：this.checked 是 prop，setter 赋值只 emit 不落值，读出来是旧值
    if (this.#checkboxGroup) this.#checkboxGroup.onCheckChange(val, next)
  }
  setIndeterminate(value: boolean) {
    this.__indeterminate = value
  }
  isChecked() {
    return this.__checked
  }
}