import { bind, classes, html, ifElse, prop, query, show, state, tag, Template, watch } from "compelem";
import { isBlank, isEmpty, isUndefined } from 'myfx';
import { Card } from '../../datadisplay/card/Card';
import { FormControl } from '../FormControl';
import formStyle from "../style.scss";
import style from "./style.scss";
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
@tag("l-radio")
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
  @prop({ type: Boolean, sync: true }) checked = false;
  @state _label = '';

  @query('input')
  input: HTMLInputElement;
  @query('.label>l-card')
  cardEl: Card;

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
      <label class="c-form-radio ${classes({
      __disabled: this.disabled,
      __reverse: this.reverse,
      __indeterminate: this.indeterminate
    })}" >
        <div class="box-container" ${show(!this.card)}>
          <input type="radio" tabindex="0" name="${this.name}" ${bind(this.attrs)} value="${this.value || this._label}" ?checked="${this.checked}" @click="${this.onClick}" @change="${this.onChange}" ?readonly="${this.readonly}" ?disabled="${this.disabled}"/>
          <div class="box c-form-control ${classes({ __disabled: this.disabled, __readonly: this.readonly })}"></div>
        </div>
        <div class="label">
        ${ifElse(this.card, () => html`
          <l-card title="${this.title}" subtitle="${this.subtitle}" shadow="never">
          </l-card>
        `, () => html`<div class="title">${this.title}</div><p class="subtitle">${this.subtitle}</p><slot></slot>`)}
        </div>
      </label>`;
  }

  mounted(): void {
    if (isBlank(this.value) && !isEmpty(this.slots.default)) {
      this._label = this.slots.default[0].textContent!
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

    if (this.cardEl) this.cardEl.toggleAttribute('checked', t.checked)
    if (this.slots.default && this.slots.default[0] instanceof HTMLElement) {
      this.slots.default[0].toggleAttribute('checked', t.checked)
    }
    this.emit('change', { value: t.value, checked: t.checked }, { event: e })
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
}