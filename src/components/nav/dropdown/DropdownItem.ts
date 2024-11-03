import { CompElem, html, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 下拉菜单项
 * @attrs
 *
 *
 * @slots
 *  - 选项
 *
 * @author holyhigh2
 */
@tag('l-dropdown-item')
export class DropdownItem extends CompElem {

  //////////////////////////////////// props

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
    <slot></slot>
    `;
  }

  //////////////////////////////////// methods

}
