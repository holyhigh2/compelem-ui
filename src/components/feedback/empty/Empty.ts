
import { classes, CompElem, csscope, Csscope, emits, h, prop, show, tag, Template } from "compelem";
import { isEmpty } from "myfx";
import style from "./style.scss?tmpl";
/**
 * 空状态提示
 * @attrs
 *  title {array} 加粗标题
 *  text {string} 描述内容
 *  action-text 按钮文本
 *
 * @slots
 *  - 底部内容
 *  media icon/image插槽
 *  title 标题插槽
 *  text 描述插槽
 *  actions 1-n个按钮
 * @events
 *  action 点击内置action按钮时触发
 *
 * @author holyhigh2
 */
@emits('action')
@tag('ce-empty')
export class Empty extends CompElem {

  //////////////////////////////////// props
  @prop title = '';
  @prop text = '';
  @prop actionText = '';

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  render(): Template {
    // 四个容器必须**无条件渲染**（见 ListItem 里 extra 槽的同类说明）：
    // 依赖 slots.xxx 做 ifTrue 会让 slot 永不存在、内容永远分配不进来。
    // 空态改用响应式 is-empty 类隐藏，避免"只有一段文字"的空态也带出
    // 空的标题行 / actions 内边距（小卡片里那几十 px 很显眼）。
    return h`
    <div class="ce-empty">
      <p class="ce-empty-media" ${classes({ "is-empty": isEmpty(this.slots.media) })}>
        <slot name="media"></slot>
      </p>
      <h3 ${classes({ "is-empty": isEmpty(this.title) && isEmpty(this.slots.title) })}>
        ${this.title}
        <slot name="title"></slot>
      </h3>
      <p class="ce-empty-text" ${classes({ "is-empty": isEmpty(this.text) && isEmpty(this.slots.text) })}>
        ${this.text}
        <slot name="text"></slot>
      </p>
      <div class="ce-empty-actions" ${classes({ "is-empty": isEmpty(this.actionText) && isEmpty(this.slots.actions) })}>
        <ce-button color="text" ${show(!!this.actionText)} @click="${this.onAction}">${this.actionText}</ce-button>
        <slot name="actions"></slot>
      </div>
      <slot></slot>
    </div>
    `;
  }

  //////////////////////////////////// methods
  onAction(e: Event) {
    this.emit('action', {}, e)
  }
}
