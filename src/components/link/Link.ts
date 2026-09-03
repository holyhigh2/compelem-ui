
import { CompElem, prop, tag, csscope, Csscope } from "compelem";
import style from "./style.scss?tmpl";
/**
 * 文字链接
 * @props
 *  disabled {boolean} 是否禁用
 *  type {string} default/info/success/warning/error，默认default
 *  underline {string} always/hover/none，默认always
 *
 *
 * @slots
 *  default() 链接内容
 *
 * @author holyhigh2
 */
@tag('ce-link')
export class Link extends CompElem {

  //////////////////////////////////// props
  @prop disabled: boolean = false;
  @prop({ type: String, required: false }) type = 'default';
  @prop underline = 'always';

  @csscope(Csscope.HOST)
  static get hostCss() {
    return style;
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods

}
