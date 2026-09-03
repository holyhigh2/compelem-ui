import { CompElem, css, csscope, Csscope, prop, tag, watch } from "compelem";
import { isNumeric } from "myfx";
/**
 * 布局容器 - 侧边
 *
 * @author holyhigh2
 */
@tag('ce-aside')
export class Aside extends CompElem<null> {
  @prop({ type: [String, Number] }) width: string | number

  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-aside{
        display: flex;
        flex-shrink:0;
        min-width: 1rem;
        text-align: center;
        flex-direction: column;
      }  
    `;
  }

  /////////////////////////////////// watches
  @watch('width')
  watchWidth(nv: string | number) {
    let w = nv ?? 'auto'
    this.style.width = isNumeric(w) ? w + 'px' : w
  }
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods

}
