import { bind, classes, csscope, Csscope, emits, h, ifElse, prop, query, show, state, tag, Template, watch } from "compelem";
import { closest, isBlank, isEmpty, isUndefined } from 'myfx';
import { Card } from '../../datadisplay/card/Card';
import { FormControl } from '../FormControl';
import formStyle from "../style.scss?tmpl";
import { RadioGroup } from "./RadioGroup";
import style from "./style.scss?tmpl";
/**
 * 复选框
 * @attrs
 *  indeterminate {boolean} 中间状态，默认false
 *  value {string} 提交服务器的值，如果为空则使用默认插槽内文本内容
 *  checked {boolean} 是否选中，受控属性，默认false
 *  reverse {boolean} 是否反向显示，默认false
 *  card {boolean} 是否以卡片格式显示，默认false
 *  title {string} 当card属性为true时，作为title显示
 *  subtitle {string} 当card属性为true时，作为subtitle显示
 *  checkedClass {string} 当card属性为true时，card选中时的样式
 * 
 *  其他FormControl属性
 * @slots
 *  - 显示label内容。当card模式开启时显示body内容
 *  card 当card模式开启时，通过该插槽可以自定义显示内容且会同步更新该元素的checked属性
 * @events
 *  change({value,checked})
 *
 * @author holyhigh2
 */
@emits('change', 'update:checked')
@tag("ce-radio")
export class Radio extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop indeterminate = false;
  @prop reverse = false;
  @prop card = false;
  @prop title = '';
  @prop subtitle = '';
  @prop checkedClass = '';
  @prop({ type: String }) value = '';
  @prop({ type: Boolean, model: true }) checked = false;
  @state _label = '';

  @query('input')
  input: HTMLInputElement;
  @query('.ce-form-radio-label>ce-card')
  cardEl: Card;

  @csscope(Csscope.INNER)
  static get css() {
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
    return h`
      <label class="ce-form-radio" ${classes({
      "is-disabled": this.disabled,
      "ce-form-radio-reverse": this.reverse,
      "ce-form-radio-indeterminate": this.indeterminate
    })}>
      ${ifElse(this.plaintext, () => h`${this.checked ? this.value : ''}`, () => h`
        <div class="ce-form-radio-box" ${show(!this.card)}>
          <input type="radio" tabindex="0" @click.stop name="${this.name}" ${bind(this.attrs)} value="${this.value || this._label}" ?checked="${this.checked}" @change="${this.onChange}" ?readonly="${this.readonly}" ?disabled="${this.disabled}"/>
          <div class="ce-form-radio-box ce-form-control" ${classes({ "is-disabled": this.disabled, "is-readonly": this.readonly })}></div>
        </div>
        <div class="ce-form-radio-label">
        ${ifElse(this.card, () => h`
          <ce-card title="${this.title}" subtitle="${this.subtitle}" shadow="never">
          </ce-card>
        `, () => h`<div class="ce-form-radio-title">${this.title}</div><p class="ce-form-radio-subtitle">${this.subtitle}</p><slot></slot>`)}
        </div>
      `)}
    </label>`;
  }

  #radioGroup: RadioGroup
  mounted(): void {
    let radioGroup = closest<RadioGroup>(this, node => node instanceof RadioGroup, 'parentComponent')
    if (radioGroup) {
      radioGroup._addChild(this)
      this.#radioGroup = radioGroup
    }
    if (isBlank(this.value) && !isEmpty(this.slots.default)) {
      this._label = this.slots.default[0].textContent!
    }
  }
  //////////////////////////////////// methods
  onChange(e: Event) {
    let t = e.target as HTMLInputElement

    this.checked = t.checked

    if (this.cardEl) this.cardEl.toggleAttribute('checked', t.checked)
    if (this.slots.default && this.slots.default[0] instanceof HTMLElement) {
      this.slots.default[0].toggleAttribute('checked', t.checked)
    }
    this.emit('change', { value: t.value, checked: t.checked }, e)
    if (this.#radioGroup) {
      this.#radioGroup.onCheckChange(t.value, this)
    }
  }
  toggleCheck(force: boolean) {
    if (isUndefined(force)) {
      this.input.checked = !this.input.checked
    } else {
      this.input.checked = force
    }
    if (this.cardEl) this.cardEl.toggleAttribute('checked', force)

    if (this.slots.default && this.slots.default[0] instanceof HTMLElement) {
      this.slots.default[0].toggleAttribute('checked', force)
    }
  }
  clear(): void {

  }
}