import { CompElem, css, csscope, Csscope, tag } from "compelem";
/**
 * 布局容器 - 头部
 *
 *
 * @author holyhigh2
 */
@tag('ce-header')
export class Header extends CompElem<null> {

  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-header{
        display: block;
        text-align: center;
        height: 56px;
      }
    `;
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods

}
