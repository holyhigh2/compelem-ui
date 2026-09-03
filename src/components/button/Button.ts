import { appearanceStyleSheet } from "@/css/styleSheets";
import { classes, csscope, Csscope, h, ifElse, ifTrue, prop, query, show, state, styles, tag, Template, watch } from "compelem";
import { isBlank, isEmpty } from "myfx";
import { AppearanceElem } from "../../base/Appearance";
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
 *  iconSize {string} 同size，用于定义icon大小。为空时使用size
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
 * @author holyhigh2
 */
@tag("ce-button")
export class Button extends AppearanceElem implements IActivatable {
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
  render(): Template {
    return h`
      <button
        part="root"
        type="${this.type}"
        class="ce-button"
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
            size="${this.iconSize || this.size}"
          >
          </ce-icon>
        `)}
        <span part="text" class="ce-button-text" ${show(!isEmpty(this.slots.default))} @blur>
          <slot></slot>
        </span>
        
        ${ifTrue(!isBlank(this.appendIcon), () => h`
          <ce-icon
            svg="${this.appendIcon}"
            size="${this.iconSize || this.size}"
          >
          </ce-icon>
        `)}
        <slot name="append"></slot>
      </button>
      <div class="is-loading" ${classes({ "ce-button-show": this.showLoading })}>
        ${ifElse(isEmpty(this.slots.loader),
      () => h`
          <div class="ce-button-default">
            <ce-progress-circular class="ce-button-progress" r="9" width="3" .indeterminate="${this.loading}"></ce-progress-circular>
          </div>
        `,
      () => h`<slot name="loader"></slot>`)}
      </div>
      ${super.render()}
    `;
  }

  beforeDestroyed(): void {
    (this.renderRoot?.querySelector('ce-progress-circular') as any)?.destroy()
  }

  //////////////////////////////////// methods
}