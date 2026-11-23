import { ICloseable } from "@/interfaces/ICloseable";
import { classes, css, csscope, Csscope, h, ifElse, prop, show, tag, Template, watch } from "compelem";
import { isEmpty, isString, isUndefined } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { activatable } from "../../../directives/a11y/Activatable";
import { ripples } from "../../../directives/ripples/Ripples";
import { Close } from "../../../icons/icons";
import { t } from "../../../locale";
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
 * @a11y
 *  宿主是 role=tab；aria-selected 与 tabindex 由父级 Tabs.changeTab 统一改写
 *  （整组只留一个 tabindex=0 的停靠点，即 roving tabindex）；disabled 反射 aria-disabled；
 *  关闭图标是 role=button，鼠标走 mousedown、键盘走 Enter/空格。
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
        --tab-height: 2rem;
      }
      :host(.active) .--close {
        width: 1rem;
        margin-left: var(--ce-spacing-xs);
      }
      `];
  }
  /////////////////////////////////// watches
  /**
   * 选中态的兜底默认值：Tabs.changeTab 会按 value 改写 aria-selected / tabindex，
   * 但新增页签在 slotChange 之前还没被改写过，不能留空属性（读屏会把它当成未选中
   * 且可聚焦的普通元素）。已有值时不覆盖，避免把 changeTab 的结果冲掉。
   */
  @watch('disabled', { immediate: true })
  function (nv: boolean) {
    this.setAttribute('role', 'tab')
    this.setAttribute('aria-disabled', String(!!nv))
    if (!this.hasAttribute('aria-selected')) this.setAttribute('aria-selected', 'false')
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1')
  }
  //////////////////////////////////// lifecycles
  /**
   * 父级 Tabs。写成 getter 而不是 render() 局部变量，两个原因：
   *  ① render prelude 里**不能出现 TS 断言** —— analyze 阶段只对 prelude 做后缀 `!` 的
   *     stripTs，`this.parentComponent as Tabs` 会被判为「TS 专有语法」直接阻断编译；
   *  ② 模板里的 `tabs?.closable` 位于 ifElse 回调内，而回调的插值在按类烘焙的 effect
   *     工厂里求值，那里只有 `__comp`，看不到 render() 的局部作用域。
   * （不用 @computed：parentComponent 是普通字段、不是信号，缓存住反而读不到后续变化。）
   */
  get tabs(): Tabs | undefined {
    return this.parentComponent as Tabs | undefined
  }

  /**
   * 波纹颜色：`ripple` 为字符串时作为颜色，true/false 走默认色。
   *
   * 取局部变量再收窄：模板里连写两次 `this.tabs?.ripple` 不会保留类型守卫的收窄。
   */
  get __rippleColor(): string | undefined {
    const ripple = this.tabs?.ripple
    return isString(ripple) ? ripple : undefined
  }

  render(): Template {
    return h`
      <div class="ce-tab" 
      ${classes({
      [`__size-` + this.size]: true,
    })}
      ${ripples({ disabled: !this.tabs?.ripple || !!this.disabled, color: this.__rippleColor, inner: true })} 
      space="${this.space}" ?disabled="${this.disabled}"
      ?title="${this.label}">
      ${ifElse(isEmpty(this.slots.default), () => h`
        <ce-icon class="ce-tabs-icon" ${show(!!this.icon)} .svg="${this.icon}" ></ce-icon> ${this.label}
      `, () => h`<slot></slot>`)}
        <ce-icon class="ce-tabs-close ce-btn-close" size="sm" ${show(!!(this.tabs?.closable && (this.closable || isUndefined(this.closable))))}
          ${activatable({ label: t('actions.close'), activate: () => this.onClickClose() })}
          @mousedown.stop="${this.onClickClose}" .svg="${Close}"></ce-icon>
      </div>
    `;
  }

  //////////////////////////////////// methods
  onClickClose() {
    let tabs = this.parentComponent as Tabs
    tabs?.onClickClose(this)
  }
}
