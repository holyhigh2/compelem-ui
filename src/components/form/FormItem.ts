import { classes, CompElem, html, ifTrue, prop, query, state, tag, Template } from "compelem";
import { closest, isArray, isEmpty } from "myfx";
import { Form } from "./Form";
import { FormControl } from "./FormControl";
import style from "./style.scss";
/**
 * 表单项
 * @attrs
 *  label {string} label内容
 *  prop {string} 属性名，用于关联校验规则
 *  required {boolean} 必填
 * @slots
 *
 * @author holyhigh2
 */
@tag("l-form-item")
export class FormItem extends CompElem {
  //////////////////////////////////// props
  @prop label: string = '';
  @prop prop: string = '';
  @prop({ type: Boolean, sync: true }) required = false;
  @prop rule: Record<string, any> | Record<string, any>[];

  form: Form
  control: FormControl

  @state errorMsg = ''
  @state layout = 'vertical';

  @query('.--form-item-error-message')
  msgSpan: HTMLElement

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`
      <div class="c-form-item ${classes({
      ['--layout-' + this.layout]: true
    })}">
        ${ifTrue(!!this.label, () => html`
          <label part="label" for="${this.prop}" class="--form-item-label">
            ${ifTrue(this.required, () => html`<b style="color:red">*</b>`)}
            ${this.label}
          </label>
        `)}
        <div class="--form-item-wrapper"><slot></slot></div>
        <span class="--form-item-error-message">
          ${this.errorMsg}
        </span>
      </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.form = closest(this.parentComponent!, (node) => node instanceof Form, "parentComponent")!
    if (this.form) {
      this.form._addToForm(this)
      this.layout = this.form.layout
    }
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods
  //如果错误返回 {name,rule} 信息
  async _validate(rule: Record<string, any> | Record<string, any>[]) {
    if (!this.control || !this.prop) return true;

    let rules: any[] = []
    //1. 合并规则
    if (isArray(rule)) {
      rules = rule
    }
    if (rule) rules.push(rule)
    if (this.rule) rules.push(this.rule)
    if (this.required) {
      rules.push({ required: true })
    }
    this.errorMsg = ''

    //1. 获取control值
    let value = this.control.value;
    //2. 校验
    for (let index = 0; index < rules.length; index++) {
      const r = rules[index];
      if (r.validator) {
        let check = await r.validator(value)
        if (!check) {
          this._showErrorMessage(this.prop, r.message)
          throw { name: this.prop, rule: r }
        }
      } else if (r.required) {
        if (!value || value.length < 1 || isEmpty(value)) {
          this._showErrorMessage(this.prop, r.message)
          throw { name: this.prop, rule: r }
        }
      } else {
        //类型标识调用校验器
      }
    }
  }
  _showErrorMessage(prop: string, msg: string) {
    if (msg) {
      this.errorMsg = msg
    } else {
      this.errorMsg = prop + ' is required.'
    }
  }
  changeDisplay(stateName: string, enabled: boolean) {

  }
}