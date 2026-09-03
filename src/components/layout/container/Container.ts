import { CompElem, css, csscope, Csscope, state, tag } from "compelem";
import { some } from "myfx";
/**
 * 布局容器 - 容器
 *
 *
 * @slots
 *  default() Container/Header/Footer/Main/Aside
 *
 * @author holyhigh2
 */
@tag('ce-container')
export class Container extends CompElem<null> {
  @state hasAside = false

  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-container{
        display: flex;
        flex: 1;
        height: 100%;
        min-width: 0;
        min-height: 0;
      }
    `;
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  mounted(): void {
    let els = this.children
    let hasAside = some(els, el => el.tagName === 'CE-ASIDE');
    if (hasAside) {
      this.style.flexDirection = 'row'
    } else {
      this.style.flexDirection = 'column'
    }
  }

  //////////////////////////////////// methods
}
