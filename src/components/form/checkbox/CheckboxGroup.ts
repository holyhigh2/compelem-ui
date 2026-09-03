import { css, csscope, Csscope, emits, h, prop, state, tag, Template } from "compelem";
import { join, remove } from 'myfx';
import { FormControl } from "../FormControl";
import { Checkbox } from './Checkbox';
import style from "./style.scss?tmpl";
/**
 * 复选框组
 * @attrs
 *  max {number} 最多可选中的复选项，超过后其他复选项显示禁用，默认9999
 *  value {array} 按顺序对应复选框的value，受控属性
 * @slots
 *  - 1-n个复选框组件
 * @events
 *  change({value})
 *
 * @author holyhigh2
 */
@emits('update:value')
@tag("ce-checkbox-group")
export class CheckboxGroup extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop max = 9999;
  @prop({ type: Array<String>, model: true }) value: Array<string> = [];
  @state label = '';

  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`:host{
      display: inline-block;
      vertical-align: super;
    }`];
  }
  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles

  render(): Template {
    return this.plaintext ? h`${join(this.value, ',')}` : h`
      <div class="ce-form-checkbox-group">
        <slot ></slot>
      </div>`;
  }

  //////////////////////////////////// methods
  childrenSize: 0
  _addChild(checkbox: Checkbox) {
    let values = this.value;
    if (checkbox.getAttribute('value')! === values[this.childrenSize++]) {
      checkbox.checked = true;
    }
  }
  onClick(e: Event) {
    if (this.readonly)
      e.preventDefault();
  }
  onCheckChange(value: string, checked: boolean) {
    if (checked) {
      this.value.push(value)
    } else {
      remove(this.value, v => v == value)
    }
  }
  clear() {

  }
}