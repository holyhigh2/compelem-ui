import { classes, csscope, Csscope, h, ifTrue, prop, state, tag, Template } from "compelem";
import { closest, isBlank, isEmpty } from "myfx";
import { AppearanceElem, AppearanceSpace } from "../../../base/Appearance";

import { ChevronDown } from "../../../icons/icons";
import { List } from "./List";
import style from "./style-group.scss?tmpl";
/**
 * 列表组容器
 * @props
 *  title {string} 标题
 *  expanded {boolean} 是否展开组，默认true
 *  collapsable {boolean} 是否可折叠，默认true
 * @slots
 *  prepend 前置内容
 *  
 * @author holyhigh2
 */
@tag("ce-list-group")
export class ListGroup extends AppearanceElem {
  //////////////////////////////////// props
  parentList: List
  @prop({ type: String, required: true }) title: string;
  @prop expanded = true
  @prop collapsable = true

  @state layer = 0

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super()
    this.space = AppearanceSpace.Loose
  }
  mounted(): void {
    this.parentList = closest(this, n => n instanceof List, 'parentComponent')!
    this.layer = 0
    closest(this.parentComponent!, n => {
      if (n instanceof List) return true
      if (n instanceof ListGroup) {
        this.layer++
      }
      return false;
    }, 'parentComponent')
  }

  render(): Template {
    return h`
      <div
        class="ce-list-group"
        ${classes({
      "is-expanded": this.expanded
    })}
      >
        <ce-list-item part="trigger" link @click="${this.toggleExpand}">
          <slot name="prepend" slot="prepend"></slot>
          <span part="title">
            ${ifTrue(!isBlank(this.title), () => h`${this.title}`)}
            ${ifTrue(!isEmpty(this.slots.title), () => h`<slot name="title" slot="title"></slot>`)}
          </span>
          ${ifTrue(this.collapsable, () => h`<ce-icon part="append" slot="append" class="ce-list-caret" .svg="${ChevronDown}"></ce-icon>`)}
        </ce-list-item>
        <div part="children" class="ce-list-children">
          <slot></slot>
        </div>
      </div>
    `;
  }

  //////////////////////////////////// methods
  toggleExpand() {
    if (!this.collapsable) return
    this.expanded = !this.expanded
  }
}
