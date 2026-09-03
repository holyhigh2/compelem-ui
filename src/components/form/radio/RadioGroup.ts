import { classes, css, csscope, Csscope, emits, h, prop, tag, Template, watch } from "compelem";
import { FormControl } from "../FormControl";
import { Radio } from './Radio';
import style from "./style.scss?tmpl";
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
@emits('update:value')
@tag("ce-radio-group")
export class RadioGroup extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  radioList: Set<Radio> = new Set
  //////////////////////////////////// props
  @prop({ type: String, model: true }) value: string = '';
  @prop reverse = false;
  @prop inline = false;

  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`:host{
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
    return this.plaintext ? h`${this.value}` : h`
      <div class="ce-form-radio-group" ${classes({ "ce-form-radio-inline": this.inline })}>
        <slot></slot>
      </div>`;
  }

  mounted(): void {
  }
  //////////////////////////////////// methods
  _addChild(radio: Radio) {
    let v = this.value;
    if (radio.getAttribute('value') === v) {
      radio.toggleCheck(true);
    }

    this.radioList.add(radio)
  }
  onClick(e: Event) {
    if (this.readonly)
      e.preventDefault();
  }
  onCheckChange(value: string, target: Radio) {

    this.radioList.forEach(radio => {
      if (radio === target) {
        this.value = value;
      } else {
        radio.toggleCheck(false);
      }
    })
  }
  clear(): void {

  }
}