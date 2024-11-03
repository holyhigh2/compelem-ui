import { classes, html, prop, tag, Template, watch } from "compelem";
import { FormControl } from "../FormControl";
import { Radio } from './Radio';
import style from "./style.scss";
/**
 * 复选框组
 * @attrs
 *  value {array} 按顺序对应复选框的value，受控属性
 *  reverse {boolean} 是否反向显示，默认false
 *  inline {boolean} 是否水平显示，默认false
 * @slots
 *  - 1-n个单选框组件
 * @events
 *  change({value})
 *
 * @author holyhigh2
 */
@tag("l-radio-group")
export class RadioGroup extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  radioList: Set<Radio> = new Set
  //////////////////////////////////// props
  @prop({ type: String, sync: true }) value: string = '';
  @prop reverse = false;
  @prop inline = false;

  static get styles(): string[] {
    return [style, `:host{
      display: inline-block;
      vertical-align: super;
    }`];
  }
  /////////////////////////////////// watches
  @watch('reverse')
  function(v: boolean) {
    if (v) {
      this.radioList.forEach(el => el.setAttribute('reverse', 'true'))
    } else {
      this.radioList.forEach(el => el.removeAttribute('reverse'))
    }
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return this.plaintext ? html`${this.value}` : html`
      <div class="c-form-radio-group ${classes({ __inline: this.inline })}">
        <slot .node-filter="${{
        type: Radio
      }}"></slot>
      </div>`;
  }

  mounted(): void {

  }
  slotchange(slot: HTMLSlotElement, name: string): void {
    let eles = slot.assignedElements({ flatten: true })

    let v = this.value;
    const that = this;
    eles.forEach((el, i) => {
      if (!(el instanceof Radio)) {
        return;
      }
      // el.setAttribute('reverse','true')
      this.radioList.add(el)
      if (el.getAttribute('value') === v) {
        el.toggleCheck(true);
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
    let { value, checked, target } = e.detail;

    this.radioList.forEach(radio => {
      if (radio === target) {
        this.value = value;
      } else {
        radio.toggleCheck(false);
      }
    })
  }
}