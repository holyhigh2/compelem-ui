import { ICloseable } from "@/interfaces/ICloseable";
import { classes, css, csscope, Csscope, h, ifElse, prop, show, tag, Template } from "compelem";
import { isEmpty, isString, isUndefined } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { ripples } from "../../../directives/ripples/Ripples";
import { Close } from "../../../icons/icons";
import style from "./style.scss?tmpl";
import { Tabs } from "./Tabs";
/**
 * 页签
 * @attrs
 *  index {string} 当前页签索引
 *  label {string} 当前页签名称
 *  icon {Icon} 当前页签的图标
 *  disabled {boolean} 当前页签是否禁用
 *  closable {boolean} 是否显示关闭按钮。如果未设置以tabs为准
 *
 * @slots
 *  - 名称插槽，设置后忽略label属性
 *
 * @author holyhigh2
 */
@tag("ce-tab")
export class Tab extends AppearanceElem implements ICloseable {
  //////////////////////////////////// props
  @prop({ type: String, required: true }) index: string;
  @prop({ type: String }) label: string;
  @prop icon: () => Template = () => h``;
  @prop disabled = false;
  @prop({ type: Boolean }) closable: boolean

  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`
      :host{
        overflow: hidden;
        position: relative;
        --tab-height:32px;
      }
      :host(.active) .--close {
        width: 1rem;
        margin-left: var(--ce-spacing-xs);
      }
      `];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  render(): Template {
    let tabs = this.parentComponent as Tabs
    return h`
      <div class="ce-tab" 
      ${classes({
      [`__size-` + this.size]: true,
    })}
      ${ripples({ disabled: !tabs?.ripple || this.disabled, color: isString(tabs?.ripple) ? tabs.ripple : undefined, inner: true })} 
      space="${this.space}" ?disabled="${this.disabled}"
      ?title="${this.label}">
      ${ifElse(isEmpty(this.slots.default), () => h`
        <ce-icon class="ce-tabs-icon" ${show(!!this.icon)} .svg="${this.icon}" ></ce-icon> ${this.label}
      `, () => h`<slot></slot>`)}
        <ce-icon class="ce-tabs-close ce-btn-close" size="sm" ${show(tabs?.closable && (this.closable || isUndefined(this.closable)))} @mousedown.stop="${this.onClickClose}" .svg="${Close}"></ce-icon>
      </div>
    `;
  }

  //////////////////////////////////// methods
  onClickClose() {
    let tabs = this.parentComponent as Tabs
    tabs?.onClickClose(this)
  }
}
