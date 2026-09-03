import { classes, CompElem, csscope, Csscope, h, ifTrue, prop, tag, Template, watch } from "compelem";
import { isBoolean, isEmpty } from "myfx";
import { IColorable } from "../../../interfaces/IColorable";
import { ColorHelper } from "../../../utils/color";
import style from "./style.scss?tmpl";
/**
 * 分割线
 * @attrs
 *  vertical {boolean} 是否垂直，默认false
 *  thickness {number} 厚度，单位px
 *  inset {boolean|string} 嵌入模式，分割线长度会减小，默认4rem
 *  inset-align {string} inset模式后对其方式start/center/end，默认center。
 *  type {string} solid/dashed/dotted/double以及其他border-style可选值
 * @slots
 *  default() 分割线中间内容
 *
 * @author holyhigh2
 */
@tag('ce-divider')
export class Divider extends CompElem implements IColorable {

  //////////////////////////////////// props
  @prop({ type: String }) color: string = 'lightgray';
  @prop vertical = false;
  @prop thickness = 1;
  @prop type = 'solid';
  @prop({ type: [Boolean, String] }) inset: boolean | string = false;
  @prop insetAlign = 'center'

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  get cssVars() {
    return {
      '--thickness': `${this.thickness}px`,
      '--inset': `${this.inset ? (isBoolean(this.inset) ? '4rem' : this.inset) : '0px'}`,
      '--border-style': this.type
    }
  }
  /////////////////////////////////// watches
  @watch("color", { immediate: true })
  __watchColor(nv: any, ov: any, sourceName: string) {
    ColorHelper.setColor(nv, this.style, '--color-divider')
  }
  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
    <div class="ce-divider" ${classes({ "is-vertical": this.vertical, ['ce-divider-inset-align-' + this.insetAlign]: true })}>
      <div class="ce-divider-content">
      ${ifTrue(!isEmpty(this.slots.default), () => h`<span class="ce-divider-inner-wrapper"><slot></slot></span>`)}
      </div>
    </div>
    `;
  }

  //////////////////////////////////// methods

}
