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
        /* 折叠动画默认关闭（0s = 旧行为：宽度瞬时切换）。
           需要动画时在任意外层设 --ce-aside-transition-duration: .3s；
           与内部 ce-list 共用同一条曲线时，再设 --ce-aside-transition-timing-function，
           并把列表侧的 --ce-list-transition-duration 设成同一时长，避免「行在动、外壳不动」的错帧。 */
        transition: width var(--ce-aside-transition-duration, 0s) var(--ce-aside-transition-timing-function, ease);
      }  
    `;
  }

  /////////////////////////////////// watches
  // immediate: 初始 attribute 传入的 width 需要在 init 阶段生效（非 immediate 的 watch 仅响应运行时变更）
  @watch('width', { immediate: true })
  watchWidth(nv: string | number) {
    let w = nv ?? 'auto'
    this.style.width = isNumeric(w) ? w + 'px' : w
  }
  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods

}
