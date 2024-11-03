import { classes, CompElem, computed, html, ifElse, ifTrue, prop, show, state, styles, tag, Template } from "compelem";
import { isEmpty } from "myfx";
import { ChevronDown } from "../../../icons/icons";
import style from "./style.scss";
/**
 * 面板组件
 * @attrs
 *  header {string} 标题信息
 *  shadow {string} 显示阴影，always / hover / never，默认 always
 *  collapsible {boolean} 是否可折叠，默认false
 *  body-style {string|object} 面板body样式
 *  defaultExpanded {boolean} 默认展开，默认true
 *  border {boolean} 是否边框，默认false
 *  closable {boolean} 是否显示关闭按钮，默认false
 * @events
 *  close 点击关闭按钮时触发
 *
 * @slots
 *  default() 面板内容
 *  header 头部内容
 *
 * @author holyhigh2
 */
@tag('l-panel')
export class Panel extends CompElem {

  //////////////////////////////////// props
  @prop header: string = '';
  @prop shadow = 'always';
  @prop border = false;
  @prop collapsible = false;
  @prop defaultExpanded = true;
  @prop({ type: [String, Object] }) bodyStyle = '';

  @state({ prop: 'defaultExpanded' }) expanded = false;

  static get styles(): string[] {
    return [style];
  }

  @computed
  get hasHeader() {
    return !isEmpty(this.slots.header) || !!this.header
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  render(): Template {
    return html`
    <div class="c-panel ${classes({
      ['__shadow-' + this.shadow]: this.shadow !== 'none',
      __collapsible: this.collapsible,
      __hidden: !this.expanded
    })}">
      <header class="--header" ?visible="${this.hasHeader}" ${show(this.hasHeader)}>
        ${ifElse(this.collapsible,
      () => html`<l-button appearance="subtle" block width="100%" @click="${this.toggleExpanded}"><h3>
        <slot name="header" .expanded="${this.expanded}"></slot>
        ${ifTrue(isEmpty(this.slots.header), () => html`<span style="flex:1;text-align: left;">${this.header}</span> <l-icon class="--arrow" .svg="${ChevronDown}"></l-icon>`)} 
      </h3></l-button>`,
      () => html`<h3>${this.header} <slot name="header" .expanded="${this.expanded}"></slot></h3>`
    )}
      </header>
      <main>
        <div class="--body" style="${styles(this.bodyStyle)}">
          <slot .expanded="${this.expanded}"></slot>
        </div>
      </main>
    </div>
    `;
  }

  //////////////////////////////////// methods
  toggleExpanded() {
    this.expanded = !this.expanded
  }
}
