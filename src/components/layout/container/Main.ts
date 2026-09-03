import { CompElem, css, csscope, Csscope, tag } from "compelem";
/**
 * 布局容器 - 主体内容
 *
 * @author holyhigh2
 */
@tag('ce-main')
export class Main extends CompElem<null> {

  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-main{
        display: block;
        flex: 1;
        overflow: hidden;
      }
    `;
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods

}
