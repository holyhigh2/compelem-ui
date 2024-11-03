import { CompElem, html, prop, tag, Template } from "compelem";
import { isEmpty } from "myfx";
import style from "./style.scss";
/**
 * 手风琴项
 * @props
 * header {string} 标题信息
 *
 *
 * @slots
 *  - 主体内容
 *  header 头部内容
 *
 * @author holyhigh2
 */
@tag('l-accordion-item')
export class AccordionItem extends CompElem {

  //////////////////////////////////// props
  @prop header: string = '';
  @prop disabled = false;

  //////////////////////////////////// state

  static get styles(): string[] {
    return [style];
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();

  }

  render(): Template {
    return html`
    <l-panel .header="${this.header}" collapsible shadow="never">
      ${!isEmpty(this.slots.header) ? html`<slot name="header" slot="header" slot-props></slot>` : ''}
      <slot></slot>
    </l-panel>
    `;
  }

  //////////////////////////////////// methods

}
