import { classes, h, prop, tag, Template, csscope, Csscope } from "compelem";
import { closest, isBoolean } from "myfx";
import { AppearanceElem, AppearanceSpace } from "../../../base/Appearance";

import { List } from "./List";
import style from "./style-header.scss?tmpl";
/**
 * 列表标题，可用于标识分组列表项
 * @props
 *  inset {boolean|string} 嵌入模式，分割线长度会减小，默认4rem
 * @slots
 *  - 标题内容
 *  
 *
 * @author holyhigh2
 */
@tag("ce-list-header")
export class ListHeader extends AppearanceElem {
  //////////////////////////////////// props
  @prop({ type: [Boolean, String] }) inset: boolean | string = false;
  parentList: List

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  get cssVars() {
    return {
      '--list-header-inset': this.inset ? (isBoolean(this.inset) ? '4rem' : this.inset) : '0px'
    }
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super()
    this.space = AppearanceSpace.Loose
  }
  mounted(): void {
    this.parentList = closest(this, n => n instanceof List, 'parentComponent')!
  }

  render(): Template {
    return h`<header class="ce-list-header" ${classes({
      [`ce-list-size-` + this.size]: true
    })} space="${this.space}">
        <slot></slot>
    </header> `;
  }

  //////////////////////////////////// methods
}
