import { classes, CompElem, css, csscope, Csscope, h, ifTrue, prop, query, state, tag, Template } from "compelem";
import { closest, get, isArray, isEmpty, isNil } from "myfx";
import { Form } from "./Form";
import { FormControl } from "./FormControl";
import style from "./style.scss?tmpl";
/**
 * 表单项
 * @attrs
 *  label {string} label内容
 *  prop {string} 属性名，用于关联校验规则
 *  required {boolean} 必填
 *  validateOn {string} 触发验证的事件，默认change
 * @slots
 *  - 表单项内容
 *  label 表单项title
 * @author holyhigh2
 */
@tag("ce-form-item")
export class FormItem extends CompElem {
  //////////////////////////////////// props
  @prop label: string = '';
  @prop prop: string = '';
  @prop({ type: Boolean, model: true }) required = false;
  @prop({ type: [Object, Array] }) rule: Record<string, any> | Record<string, any>[];
  @prop validateOn = 'change'

  form: Form
  control: FormControl

  @state layout = 'vertical';

  @query('.ce-form-form-item-error-message')
  msgSpan: HTMLElement

  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`
      :host{
        margin-bottom: 1.5rem;
        vertical-align: top;
        display: block;
      }  
    `];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
      <div class="ce-form-item" ${classes({
      ['--layout-' + this.layout]: true
    })}>
        ${ifTrue(!!this.label || !isEmpty(this.slots.label), () => h`
          <label part="label" for="${this.prop}" class="ce-form-form-item-label">
            ${ifTrue(this.required, () => h`<b style="color:red">*</b>`)}
            ${this.label}
            <slot name="label"></slot>
          </label>
        `)}
        <div class="ce-form-form-item-wrapper"><slot></slot></div>
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
  mounted(): void {
    let that = this
    this.control && this.control.addEventListener(this.validateOn, e => {
      let rule = get<Record<string, any> | Record<string, any>[]>(this.form.rules, that.prop)
      that._validate(rule)
    })
  }

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
        if (isNil(value) || value.length < 1 || isEmpty(value + '')) {
          this._showErrorMessage(this.prop, r.message)
          throw { name: this.prop, rule: r }
        } else {
          this._resetValidation()
        }
      } else {
        //类型标识调用校验器
      }
    }
  }
  _resetValidation() {
    this.control.toggleAttribute('error', false)
    this.control.error = false;
  }
  _reset() {
    this.control.value = ''
  }
  _showErrorMessage(prop: string, msg: string) {
    let errorMsg = ''
    if (msg) {
      errorMsg = msg
    } else {
      errorMsg = prop + ' is required.'
    }
    this.control.toggleAttribute('error', true)
    this.control.toggleAttribute('error-message', true)
    this.control.error = true;
    this.control.errorMessage = errorMsg;
  }
  changeDisplay(stateName: string, enabled: boolean) {

  }
}