import { CompElem, html, prop, tag, Template } from "compelem";
import { AccordionItem } from "./AccordionItem";
import style from "./style.scss";
/**
 * 手风琴
 * @attrs
 *  items {array} 字符串数组/{text:,value:,disabled,iconClass}数组，如果数组内容为非对象/字符串则显示为分割条
 *  theme {string} light/dark
 *  trigger {string} hover/click，默认hover
 *
 * @events
 *  select({item,index,el}) 菜单项选中时触发
 *  hover({item,index,el}) 菜单项悬浮时触发
 *  close() 关闭时触发
 * @slots
 *  trigger 触发菜单的元素
 *
 * @author holyhigh2
 */
@tag('l-accordion')
export class Accordion extends CompElem {
  //////////////////////////////////// props
  @prop hideOnClick = true
  @prop theme = "light"
  @prop trigger = "hover"

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
    <div class="c-accordion" >
      <slot node-filter="${{
        type: AccordionItem
      }}"></slot>
    </div>
    `;
  }

  //////////////////////////////////// methods

}
