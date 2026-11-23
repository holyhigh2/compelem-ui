import { CompElem, css, csscope, Csscope, prop, state, tag, watch } from "compelem";
import { some } from "myfx";
/**
 * 布局容器 - 容器
 *
 * @attrs
 *  direction {string} auto/row/column，默认 auto：检测到直接的 ce-aside 子元素时横向排列，否则纵向
 *
 * @slots
 *  default() Container/Header/Footer/Main/Aside
 *
 * @author holyhigh2
 */
@tag('ce-container')
export class Container extends CompElem<null> {
  @prop direction = "auto"

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
  @watch('direction')
  watchDirection() {
    this.#applyDirection()
  }
  //////////////////////////////////// lifecycles
  mounted(): void {
    this.#applyDirection()
  }

  //////////////////////////////////// methods
  /**
   * auto 只按**直接**子元素的标签名判断，所以侧栏被自定义元素包一层时（宿主看不到 ce-aside）
   * 需要显式传 direction。
   */
  #applyDirection(): void {
    const direction = this.direction
    if (direction === 'row' || direction === 'column') {
      this.style.flexDirection = direction
      return
    }
    const hasAside = some(this.children, el => el.tagName === 'CE-ASIDE')
    this.hasAside = hasAside
    this.style.flexDirection = hasAside ? 'row' : 'column'
  }
}
