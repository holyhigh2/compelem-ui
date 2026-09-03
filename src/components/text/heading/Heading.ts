import { CompElem, csscope, Csscope, prop, tag, watch } from "compelem";
import { IColorable } from "../../../interfaces/IColorable";
import { ColorHelper } from "../../../utils/color";
import style from "./style.scss?tmpl";
/**
 * 标题组件
 * @attrs
 *  color {string} 字体颜色，默认currentColor
 *  level {number} 1-6，默认3
 *
 * @slots
 *  default() 标题内容
 *
 * @author holyhigh2
 */
@tag('ce-heading')
export class Heading extends CompElem<null> implements IColorable {

  //////////////////////////////////// props
  @prop({ type: String }) color: string;
  @prop level = 3;

  @csscope(Csscope.HOST)
  static get hostCss() {
    return style;
  }
  /////////////////////////////////// watches
  @watch("color", { immediate: true })
  __watchColor(nv: any, ov: any) {
    ColorHelper.setColor(nv, this.style)
  }
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods
}
