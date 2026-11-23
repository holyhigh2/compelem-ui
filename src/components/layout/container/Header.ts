import { CompElem, css, csscope, Csscope, prop, tag, watch } from "compelem";
import { isNumeric } from "myfx";
/**
 * 布局容器 - 头部
 *
 * @attrs
 *  height {number|string} 头部高度。未指定时由 CSS 提供默认 56px（class/style 可覆盖）；
 *                         显式指定时优先（数字按 px 处理，字符串原样写入）
 *
 * @author holyhigh2
 */
@tag('ce-header')
export class Header extends CompElem<null> {
  @prop({ type: [String, Number] }) height: string | number | undefined

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
  // immediate: 初始 attribute 传入的 height 要在 init 阶段生效。
  // 无体组件不写默认内联，避免压制外部 class/style；默认高度由 hostCss 提供。
  @watch('height', { immediate: true })
  watchHeight(nv: string | number | undefined) {
    if (nv == null) {
      this.style.removeProperty('height')
      return
    }
    this.style.height = isNumeric(nv) ? nv + "px" : nv
  }
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods

}
