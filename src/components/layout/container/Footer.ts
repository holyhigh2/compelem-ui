import { CompElem, css, csscope, Csscope, tag } from "compelem";
/**
 * 布局容器 - 底部
 *
 *
 * @author holyhigh2
 */
@tag('ce-footer')
export class Footer extends CompElem<null> {

  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-footer{
        text-align: center;
        height: 56px;
      }
    `;
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods

}
