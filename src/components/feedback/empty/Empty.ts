
import { CompElem, html, prop, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 空状态提示
 * @attrs
 *  title {array} 加粗标题
 *  text {string} 描述内容
 *  action-text 按钮文本
 *  icon {string} 图标，顶部
 *  image {string} 图片，顶部
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
@tag('l-empty')
export class Empty extends CompElem {

  //////////////////////////////////// props
  @prop title = '';
  @prop text = '';
  @prop actionText = '';
  @prop image = '';
  @prop icon = '';

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  render(): Template {
    return html`
    <div class="c-empty">
      <h3>
        ${this.title}
        <slot name="title"></slot>
      </h3>
      <p>
        ${this.text}
        <slot name="text"></slot>
      </p>
      <div class="actions">
        <l-button color="text" @click="${this.onAction}">${this.actionText}</l-button>
        <slot name="actions"></slot>
      </div>
      <slot></slot>
    </div>
    `;
  }

  //////////////////////////////////// methods
  onAction(e: Event) {
    this.emit('action', {}, { event: e })
  }
}
