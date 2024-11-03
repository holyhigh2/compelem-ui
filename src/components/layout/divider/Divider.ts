import { classes, CompElem, html, ifTrue, prop, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 分割线
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
@tag('l-divider')
export class Divider extends CompElem {

  //////////////////////////////////// props
  @prop vertical = false;
  @prop underline = true;
  @prop type = 'default';

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
    <div class="c-divider ${classes({ __vertical: this.vertical })}">
      ${ifTrue(!this.vertical, () => html`<span class="--inner-wrapper"><slot></slot></span>`)}
    </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods

}
