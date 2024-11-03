import { html, prop, state, tag, Template } from "compelem";
import { join, remove } from 'myfx';
import { FormControl } from "../FormControl";
import { Checkbox } from './Checkbox';
import style from "./style.scss";
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
@tag("l-checkbox-group")
export class CheckboxGroup extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop max = 9999;
  @prop({ type: Array<String>, sync: true }) value: Array<string> = [];
  @state label = '';

  static get styles(): string[] {
    return [style, `:host{
      display: inline-block;
      vertical-align: super;
    }`];
  }
  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return this.plaintext ? html`${join(this.value, ',')}` : html`
      <div class="c-form-checkbox-group">
        <slot ></slot>
      </div>`;
  }

  mounted(): void {

  }
  slotchange(slot: HTMLSlotElement, name: string): void {
    let eles = slot.assignedElements({ flatten: true }) as Array<Checkbox>;
    let values = this.value;
    const that = this;
    eles.forEach((el, i) => {
      if (!(el instanceof Checkbox)) return;

      let v = values[i]
      if (el.getAttribute('value') === v) {
        el.checked = true;
      }
      el.addEventListener('change', (e: CustomEvent) => {
        that.onCheckChange(e)
      })
    })
  }
  //////////////////////////////////// methods

  onClick(e: Event) {
    if (this.readonly)
      e.preventDefault();
  }
  onCheckChange(e: CustomEvent) {
    let { value, checked } = e.detail;
    if (checked) {
      this.value.push(value)
    } else {
      remove(this.value, v => v == value)
    }
  }
}