import { appearanceStyleSheet } from "@/css/styleSheets";
import { bind, classes, csscope, Csscope, h, html, ifTrue, prop, query, show, state, styles, tag, Template, watch } from "compelem";
import { isBlank, isEmpty } from "myfx";
import { APPEARANCE_LAYER } from "../../base/Appearance";
import { AriaElem } from "../../base/AriaElem";
import { ripples } from "../../directives/ripples/Ripples";
import { IActivatable } from "../../interfaces/IActivatable";
import style from "./btn.scss?tmpl";
/**
 * 按钮
 * @attrs
 *  appearance {string} 按钮外观
 *  color {string} 按钮颜色，任意颜色及类型颜色包括：info/success/warning/error/text，默认info
 *  round {boolean} 是否圆角，默认true
 *  disabled {boolean} 是否禁用
 *  block {boolean} 是否块级元素，默认false
 *  loading {boolean} 是否加载状态
 *  active {boolean} 是否激活状态
 *  type {string} button类型，默认button
 *  width {string} 宽度，默认auto
 *  size {string} 尺寸可选 lg/md/sm，默认md
 *  iconSize {string} 同size，用于定义icon大小。为空时与按钮文字同号（1em）
 *  icon {string} 图标名称，支持 c-svg-xx
 *  append-icon {string} 图标名称，支持 c-svg-xx
 *  stacked {boolean} 堆叠模式，默认false
 *  value {string} 用于在ButtonGroup中选中时的唯一值，如果未设置则使用 'button_'+按钮在group中的序号
 *  circle {boolean} 是否圆形按钮，默认false
 *
 * @slots
 *  default() 链接内容
 * @parts
 *  root 根元素
 *  icon 前置图标
 *  text 按钮文本
 *
 * @a11y
 *  宿主上的 role / aria-* 透传到 shadow 内的原生 button（读屏只认原生控件上的语义）。
 *  未给值时不写属性，不留 aria-label="undefined" 脏值。
 *
 * @author holyhigh2
 */
@tag("ce-button")
export class Button extends AriaElem implements IActivatable {
  __primitiveWidth: string
  //////////////////////////////////// props
  @prop({ type: Boolean }) active: boolean = false;
  @prop block = false;
  @prop circle = false;
  @prop type = "button";
  @prop icon = "";
  @prop appendIcon = "";
  @prop iconSize = '';
  @prop({ type: [Boolean, String] }) ripple: boolean | string = true;
  @prop stacked = false
  @prop({ type: String }) value: string

  //override 属性
  appearance = 'flat'
  hoverable = true
  rounded = true

  @state showLoading = false

  @query('slot')
  slotEl: HTMLSlotElement;
  @query('ce-progress-circular')
  progress: HTMLElement

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  @csscope(Csscope.HOST)
  static get host() {
    return appearanceStyleSheet
  }
  /////////////////////////////////// watches
  @watch('loading', { immediate: true })
  function(nv: boolean) {
    if (nv) {
      setTimeout(() => {
        if (this.progress) this.progress.style.display = 'inline-block'
        this.showLoading = true
      }, 20);
    } else {
      this.showLoading = false
      setTimeout(() => {
        if (this.progress) this.progress.style.display = 'none'
      }, 500);
    }
  }
  //////////////////////////////////// lifecycles
  /**
   * ⚠️ loader 的 `<slot name="loader">` 必须**常驻**（默认进度环改为 ifTrue 条件支）：
   * 框架的 slots 分组门禁只统计 shadow 内已存在对应 `<slot>` 元素的插槽名
   * （`CompElem.#updateSlotsAry`：`slotKeys.includes(sName)` 才归类）。条件渲染的
   * `<slot name="loader">` 在首渲染（slots 为空、走默认进度环支）时不存在 ⇒
   * 'loader' 永不进 slotKeys ⇒ 运行时后插自定义 loader 内容不触发 slotchange、
   * slots.loader 永为空 ⇒ ifElse 永真，自定义 loader 100% 不生效（死锁）。
   * 常驻后：无内容时分发零节点 + ifTrue 渲染默认进度环；有内容时
   * slotchange → slots.loader 非空 → 默认支移除，分发自定义内容。
   */
  render(): Template {
    return h`
      <button
        part="root"
        type="${this.type}"
        class="ce-button"
        ${bind(this.ariaAttrs)}
        ${classes({
      "ce-button-stacked": this.stacked
    })}
        ${styles({ opacity: this.loading ? '0' : '1' })}
        ?disabled="${this.disabled}"
        ${ripples({ disabled: this.disabled || !this.ripple, refer: () => this })}
      >
        <slot name="prepend"></slot>
        ${ifTrue(!isBlank(this.icon), () => h`
          <ce-icon
            part="icon"
            svg="${this.icon}"
            size="${this.iconSize}"
          >
          </ce-icon>
        `)}
        <span part="text" class="ce-button-text" ${show(!isEmpty(this.slots.default))}>
          <slot></slot>
        </span>
        
        ${ifTrue(!isBlank(this.appendIcon), () => h`
          <ce-icon
            svg="${this.appendIcon}"
            size="${this.iconSize}"
          >
          </ce-icon>
        `)}
        <slot name="append"></slot>
      </button>
      <div class="is-loading" ${classes({ "ce-button-show": this.showLoading })}>
        <slot name="loader"></slot>
        ${ifTrue(isEmpty(this.slots.loader), () => h`
          <div class="ce-button-default">
            <ce-progress-circular class="ce-button-progress" r="9" width="3" .indeterminate="${this.loading}"></ce-progress-circular>
          </div>
        `)}
      </div>
      ${html(APPEARANCE_LAYER)}
    `;
  }

  beforeDestroyed(): void {
    (this.renderRoot?.querySelector('ce-progress-circular') as any)?.destroy()
  }

  //////////////////////////////////// methods
}