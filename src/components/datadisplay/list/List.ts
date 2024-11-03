import { classes, CompElem, html, prop, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 列表容器，会对内部元素应用列表项样式
 * @props
 *  divider {boolean} 是否显示分隔符
 *  card {boolean} 是否卡片外观
 *  hover {boolean} 悬浮效果
 *  size {boolean} 尺寸，sm/md/lg，默认md
 * @slots
 *  - 链接内容。unhoverable属性可以忽略hover效果
 *
 * @author holyhigh2
 */
@tag("l-list")
export class List extends CompElem {
  //////////////////////////////////// props
  @prop divider = true;
  @prop card = false;
  @prop hover = false;
  @prop size = 'md';//small, medium, large

  //////////////////////////////////// styles
  static get styles(): Array<string | CSSStyleSheet> {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`<div class="c-list ${classes({
      __hover: this.hover,
      __divider: this.divider,
      __card: this.card,
      [`__size-` + this.size]: true
    })}">
      <slot></slot>
    </div> `;
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods
}
