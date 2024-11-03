
import { classes, CompElem, html, prop, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 文字链接
 * @attrs
 *  target {string} 目标容器选择器，如果为空。默认parentElement
 *  items {array} 字符串数组/{text:,value:,disabled,iconClass}数组，如果数组内容为非对象/字符串则显示为分割条
 *  theme {string} light/dark
 *  trigger {string} hover/click
 *
 *
 * @slots
 *  default() 链接内容
 *
 * @author holyhigh2
 */
@tag('l-link')
export class Link extends CompElem {

  //////////////////////////////////// props
  @prop disabled: boolean = false;
  @prop({ type: String, required: false }) type = 'default';
  @prop underline = true;

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`
    <a class="c-link ${classes({
      ['__' + this.type]: true,
      __underline: this.underline,
      __disabled: this.disabled
    })}" l-bind>
      <slot></slot>
    </a>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods

}
