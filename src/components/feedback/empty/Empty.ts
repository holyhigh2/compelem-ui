
import { CompElem, csscope, Csscope, emits, h, prop, show, tag, Template } from "compelem";
import style from "./style.scss?tmpl";
/**
 * 空状态提示
 * @props
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
    return h`
    <div class="ce-empty">
      <p>
        <slot name="media"></slot>
      </p>
      <h3>
        ${this.title}
        <slot name="title"></slot>
      </h3>
      <p>
        ${this.text}
        <slot name="text"></slot>
      </p>
      <div class="ce-empty-actions">
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
