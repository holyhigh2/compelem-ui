import { classes, csscope, Csscope, h, ifTrue, prop, tag, Template } from "compelem";
import { closest, isBlank, isEmpty, isString } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";

import { ripples } from "../../../directives/ripples/Ripples";
import { tooltip } from "../../../directives/tooltip/Tooltip";
import { IActivatable } from "../../../interfaces/IActivatable";
import { List } from "./List";
import style from "./style-item.scss?tmpl";
/**
 * 列表项组件，可以单独使用
 * @props
 *  ripple {boolean|string} 是否启用水波效果，默认true
 *  heading {string} 主标题
 *  subheading {string} 次标题
 *  subheading-lines {number} 次标题最大展示行数，默认1 
 *  center {boolean} 内容居中，默认false
 *  active {boolean} 是否激活状态
 *  href {string} 点击后跳转的URL地址
 *  value {string} 当ce-list开启selectable后，列表项选中时的值
 *  link {boolean} 是否连接，会开启悬浮效果，默认false
 *  collapsed {boolean} 是否折叠，折叠后仅显示列表项图标且鼠标悬浮后会显示title，默认false
 *  disabled {boolean} 是否禁用，禁用后不可点击，默认false
 *  selectable {boolean} 是否可选择，禁用后点击不会切换激活状态
 *  tooltip {string} tooltip信息，默认空
 *  
 * @parts
 *  root 根元素
 *  content 内容包装容器
 *  heading 主标题
 *  subheading 次标题
 *  append 右侧容器
 * @slots
 *  - 主标题内容
 *  subheading 次标题内容 
 *  prepend 左侧内容
 *  append 右侧内容
 *  
 *
 * @author holyhigh2
 */
@tag("ce-list-item")
export class ListItem extends AppearanceElem implements IActivatable {
  //////////////////////////////////// props
  @prop({ type: [Boolean, String] }) ripple: boolean | string = true;
  //标题（主要内容）
  @prop heading = '';
  //副标题（次要内容）
  @prop subheading = ''
  @prop active = false
  @prop link = false
  @prop subheadingLines = 1
  @prop({ type: String }) value: string
  @prop({ type: String }) href: string
  @prop collapsed = false
  @prop center = false
  @prop selectable = true
  @prop tooltip = ''

  parentList: List
  rounded = true

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  get cssVars() {
    return {
      '--list-item-webkit-line-clamp': this.subheadingLines,
      '--list-item-padding-block': isEmpty(this.slots.subtitle) ? '0' : 'var(--ce-spacing-xs)'
    }
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super()
  }
  mounted(): void {
    this.parentList = closest<List>(this, node => node instanceof List, 'parentComponent')!
  }

  render(): Template {
    return h`<div part="root" class="ce-list-item" 
    ${classes({
      [`ce-list-size-` + this.size]: true,
      "ce-list-link": !!this.value || this.link
    })}
    data-action="click"
    ?disabled="${this.disabled}" 
    ?href="${this.href}" ?value="${this.value}" 
    ${ripples({ disabled: !this.ripple || this.disabled || this.loading, color: isString(this.ripple) ? this.ripple : undefined, refer: () => this })}
    ${tooltip({ content: this.tooltip, placement: 'right' })}>
      <div class="ce-list-prepend">
        <slot name="prepend"></slot>
      </div>
      <div part="content" class="ce-list-content" ${classes({
      "is-center": this.center,
      "ce-list-line1": isEmpty(this.subheading) && isEmpty(this.slots.subheading)
    })}>
        <div class="ce-list-heading" part="heading">
          <slot></slot> ${this.heading}
        </div>
        <div class="ce-list-subheading" part="subheading">
          <slot name="subheading"></slot> ${ifTrue(!isBlank(this.subheading), () => h`<span style="opacity: 0.6;">${this.subheading}</span>`)}
        </div>
      </div>
      <div part="append" class="ce-list-append">
        <slot name="append"></slot>
      </div>
    </div>
    ${super.render()}
    `;
  }

  //////////////////////////////////// methods
}
