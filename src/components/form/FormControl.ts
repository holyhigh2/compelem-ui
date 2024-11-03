import { closest, get } from "myfx";

import { CompElem, prop, watch } from "compelem";
import { getRGBColorValue } from "../../utils";
import { Form } from "./Form";
import { FormItem } from "./FormItem";
/**
 * 表单控件基类
 * 提供控件与表单交互的通用接口
 * @attrs
 *  disabled {boolean} 是否禁用
 *  readonly {boolean} 是否只读
 *  plaintext {boolean} 是否显示明文
 *  round {boolean} 是否圆角
 *  appearance {boolean} 外观，default 或 underline
 *  size {boolean} 尺寸，lg, md, sm, xs
 *  name {string} 属性名词，匹配formModel的key，支持作用域链
 *  color {string} 按钮颜色，任意颜色及类型颜色包括：info/success/warning/error/text，默认info
 * 
 * @author holyhigh2
 */
export abstract class FormControl extends CompElem {
  @prop disabled = false;
  @prop readonly = false;
  @prop plaintext = false;

  @prop appearance = "default"; //default/underline
  @prop color = '';
  @prop size = "md"; //lg, md, sm, xs
  @prop round = true;
  @prop loading = false;
  @prop({ type: String }) name: string;
  abstract value: any;

  form: Form
  formItem: FormItem
  /////////////////////////////////// watches
  @watch("color", { immediate: true })
  watchColor(nv: any, ov: any, sourceName: string) {
    if (!nv) return;

    let c = nv;
    switch (nv) {
      case 'info': case 'success': case 'warning': case 'error': case 'text':
        c = `var(--l-color-${nv})`
        break;
      default:
        c = getRGBColorValue(c)
    }

    this.style.setProperty('--color', c)
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.form = closest(this.parentComponent!, (node) => node instanceof Form, "parentComponent")!
    if (this.form) {
    }
    this.formItem = closest(this.parentComponent!, (node) => node instanceof FormItem, "parentComponent")!
    if (this.formItem) {
      this.formItem.control = this;
    }
    let that = this;
    //监控change
    this.addEventListener('change', (e: Event) => {
      let control = e.target as FormControl;
      if (that.form) {
        that.form._setChange(control.name || get(control.formItem, 'prop'), control.value, e)
      }
    })
  }
  mounted(): void {
  }

  //////////////////////////////////// methods
  //变更显示状态
  abstract changeDisplay(stateName: string, enabled: boolean): void;
}