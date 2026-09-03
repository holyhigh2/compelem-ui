import { CompElem, csscope, Csscope, tag } from "compelem";
import style from "./style.scss?tmpl";
/**
 * 空间扩张器。可用于flex布局的父元素内自动撑满所在空间
 *
 * @author holyhigh2
 */
@tag('ce-spacer')
export class Spacer extends CompElem<null> {

  //////////////////////////////////// props

  @csscope(Csscope.HOST)
  static get hostCss() {
    return style;
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods
}
