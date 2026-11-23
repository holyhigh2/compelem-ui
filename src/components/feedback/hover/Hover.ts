
import { CompElem, emits, event, prop, state, tag, watch } from "compelem";

/**
 * 悬浮
 * @attrs
 *  value {boolean} model属性，单向受控
 *
 * @slots
 *  - 需要hover效果的元素
 * @events
 *  change({isHovering,target}) 当任意包裹元素触发hover效果时触发
 *
 * @author holyhigh2
 */
@emits('change', 'update:value')
@tag('ce-hover')
export class Hover extends CompElem<null> {

  //////////////////////////////////// props
  @prop({ type: Boolean, model: true }) value = false
  @state isHovering = false

  __target: any
  /////////////////////////////////// watches
  @watch('isHovering')
  watchHovering(nv: boolean) {
    this.emit('change', { isHovering: nv, target: this.__target })
  }
  //////////////////////////////////// lifecycles

  //////////////////////////////////// hooks
  @event('mouseenter.capture')
  onMouseEnter(e: MouseEvent) {
    this.value = this.isHovering = true
    this.__target = e.target
  }
  @event('mouseleave.capture')
  onMouseLeave(e: MouseEvent) {
    // 子元素间移动（如文本 → 容器 padding 区）会对子元素派发 mouseleave，
    // relatedTarget 仍指向宿主 flat tree 内节点时不算真正离开
    const rt = e.relatedTarget as Node | null;
    if (rt && this.contains(rt)) return;
    this.value = this.isHovering = false
    this.__target = e.target
  }
  //////////////////////////////////// methods
}
