import { classes, html, ifTrue, prop, query, state, styles, tag, Template, watch } from "compelem";
import { isBoolean } from "myfx";
import { FormControl } from "../FormControl";
import formStyle from "../style.scss";
import style from "./style.scss";
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
 * @slots
 *  - 显示label内容
 *  active 激活时显示内容
 *  inactive 非激活时显示内容
 * @events
 *  change({value,checked})
 *
 * @author holyhigh2
 */
@tag("l-toggle")
export class Toggle extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop activeText = '&nbsp;';
  @prop inactiveText = ' ';
  @prop activeValue = '';
  @prop inactiveValue = '';
  @prop inset = true;
  @prop({ type: [String, Boolean], sync: true }) value: boolean | string = '';
  @prop({ type: Number }) width: number;

  @state checked = false;

  static get styles(): string[] {
    return [formStyle, style];
  }
  @query('input')
  input: HTMLInputElement;
  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  function(nv: string | boolean) {
    if (isBoolean(nv)) {
      this.checked = nv;
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
    return this.plaintext ? html`${this.checked ? this.activeText : this.inactiveText}` : html`
      <label class="c-form-toggle ${classes({
      __disabled: this.disabled
    })}" >
        <div class="c-form-control ${classes({ __inset: this.inset })}" style="${styles({
      width: this.width + 'px',
      overflow: 'visible'
    })}">
          <input type="checkbox" tabindex="0" ?disabled="${this.disabled}" ?checked="${this.checked}" @click="${this.onClick}" @change="${this.onChange}"/>
          <div class="--track ${classes({ __disabled: this.disabled, __rounded: this.round, __readonly: this.readonly })}" >
            ${ifTrue(this.inset, () => html`
              <span class="active">
              ${this.activeText}
              <slot name="active"></slot>
            </span>
            <span class="inactive">${this.inactiveText}<slot name="inactive"></slot></span>  
            `)}
          </div>
          <div class="--thumb"></div>
        </div>
        
        <div class="label"><slot></slot></div>
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
    if (isBoolean(this.value)) {
      this.value = t.checked
    } else {
      this.value = value
    }

    this.emit('change', { value: value, checked: t.checked }, { event: e })
  }
}