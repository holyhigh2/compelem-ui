import { each, get, isEmpty, isObject, set } from "myfx";

import { CompElem, html, prop, tag, Template, watch } from "compelem";
import { FormItem } from "./FormItem";
import style from "./style.scss";
/**
 * 表单框
 * @attrs
 *  asterisk {boolean} 显示星号，默认true
 *  disabled {boolean} 显示禁用
 *  readonly {boolean} 显示制度
 *  plaintext {boolean} 显示文本
 *  rules {object} 校验规则 {xx:{required: true, message: '不能为空', trigger: 'blur' }/[{}]}
 *  layout {string} 布局，inline/vertical/horizontal，默认vertical 
 *  model {object} 
 * @slots
 *  default l-form-item
 * @events
 *  change({control,prop,value})
 * @methods
 *  setModel(model) 设置模型对象绑定表单，表单中控件变动时会自动更新模型数据
 *
 * @author holyhigh2
 */
@tag("l-form")
export class Form extends CompElem {
  formItems: Array<FormItem> = [];
  formModel: Record<string, any>;
  //////////////////////////////////// props
  @prop asterisk = true;
  @prop disabled = false;
  @prop readonly = false;
  @prop plaintext = false;
  @prop layout = 'vertical';
  @prop({ type: Object, sync: true }) rules: Record<string, Record<string, any> | Record<string, any>[]>
  @prop({ type: Object }) model: Record<string, any>;

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  @watch(['disabled', 'readonly', 'plaintext'])
  function(nv: any, ov: any, sourceName: string) {
    this._changeDisplay(sourceName, nv)
  }
  @watch('layout')
  watchLayout(nv: any, ov: any, sourceName: string) {
    each(this.formItems, item => item.layout = nv);
  }
  //////////////////////////////////// lifecycles
  render(): Template {
    return html`
      <form class="c-form">
        <slot></slot>
      </form>
    `;
  }

  //////////////////////////////////// methods
  /**
   * 设置表单模型到对应的控件中
   * @param formModel 表单模型对象，key为 表单项prop/控件name 属性
   */
  setModel(formModel: Record<string, any>) {
    if (!isObject(formModel)) return;

    this.formModel = formModel;
    each(this.formItems, item => {
      let propName = get<string>(item.control, 'name', item.prop || '')
      set(item.control, 'value', get(formModel, propName))
    })
  }
  async validate() {
    let errors = []
    for (let index = 0; index < this.formItems.length; index++) {
      const item = this.formItems[index];
      let rule = get<Record<string, any> | Record<string, any>[]>(this.rules, item.prop)

      try {
        let rs = await item._validate(rule);
      } catch (error) {
        errors.push(error)
      }
    }
    if (!isEmpty(errors)) {
      throw errors
    }
  }
  //用于formItem调用
  _addToForm(item: FormItem) {
    this.formItems.push(item)
  }
  //变更表单内部控件显示状态
  _changeDisplay(stateName: string, enabled: boolean) {
    each(this.formItems, item => {
      item.changeDisplay(stateName, enabled);
    })
  }
  _setChange(propChain: string, value: any, e: Event) {
    set(this.formModel, propChain, value)
    this.emit('change', { control: e.target, prop: propChain, value }, { event: e })
  }
}