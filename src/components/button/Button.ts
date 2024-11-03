import { classes, CompElem, html, prop, query, show, styles, tag, Template, watch } from "compelem";
import { ripples } from "../../directives/ripples/Ripples";
import { getRGBColorValue } from "../../utils";
import style from "./btn.scss";
/**
 * 按钮
 * @attrs
 *  appearance {string} 按钮外观。default 透明背景有边框; primary 无边框有背景；secondary 无背景有边框；link 文字按钮；subtle 默认仅显示文字
 *  color {string} 按钮颜色，任意颜色及类型颜色包括：info/success/warning/error/text，默认info
 *  round {boolean} 是否圆角，默认true
 *  disabled {boolean} 是否禁用
 *  circle {boolean} 是否原型按钮，默认false
 *  pill {boolean} 是否药丸型按钮，默认false
 *  flat {boolean} 是否扁平化外观（仅appearance=primary时生效），默认true
 *  block {boolean} 是否块级元素，默认false
 *  loading {boolean} 是否加载状态
 *  active {boolean} 是否激活状态
 *  type {string} button类型，默认button
 *  width {string} 宽度，默认auto
 *  size {string} 尺寸可选 lg/md/sm，默认md
 *  innerStyle {string} 内部元素样式
 *
 * @slots
 *  default() 链接内容
 *
 * @author holyhigh2
 */
@tag("l-button")
export class Button extends CompElem {
  __primitiveWidth: string
  //////////////////////////////////// props
  @prop size = "md"; //lg, md, sm
  @prop({ type: String }) appearance = "primary"; //default, primary, secondary, link, subtle
  @prop({ type: String }) color: string = '';
  @prop round = true;
  @prop disabled = false;
  @prop circle = false;
  @prop pill = false;
  @prop flat = true;
  @prop block = false;
  @prop active = false;
  @prop({ type: Boolean }) loading = false;
  @prop type = "button";
  @prop width = "auto";
  @prop innerStyle = "";

  @query('slot')
  slotEl: HTMLSlotElement;
  @query('l-icon')
  iconEl: HTMLElement;

  //////////////////////////////////// styles
  static get styles(): Array<string | CSSStyleSheet> {
    return [style];
  }
  /////////////////////////////////// watches
  @watch('block', { immediate: true })
  watchBlock(v: boolean) {
    this.style.display = v ? 'block' : 'inline-block'
  }
  @watch("color", { immediate: true })
  watch(nv: any, ov: any, sourceName: string) {
    if (!nv) return;

    let c = nv;
    switch (nv) {
      case 'info': case 'success': case 'warning': case 'error': case 'text':
        c = `var(--l-color-${nv})`
        break;
      default:
        c = getRGBColorValue(c)
    }

    this.style.setProperty('--color', c)
  }
  @watch("width", { immediate: true })
  watchWidth(nv: any, ov: any, sourceName: string) {
    this.style.width = this.width;
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return html`
      <button
        style="${styles(this.innerStyle)}"
        part="button"
        type="${this.type}"
        ${ripples({ disabled: this.disabled || this.loading, color: 'red' })}
        class="c-button ${classes({
      __round: this.round,
      __circle: this.circle,
      __block: this.block,
      __disabled: this.disabled,
      __loading: this.loading,
      __active: this.active,
      __pill: this.pill,
      __flat: this.flat,
      ["__size-" + this.size]: true,
      ["__appearance-" + (this.appearance || 'default')]: true,
    })}"
        ?disabled="${this.disabled}"
        @click="${this.onClick}"
      >
        <slot @slotchange="${this.onSlotChange}"></slot>
        <l-progress-circular class="loading" ${show(this.loading)} r="9" width="3" indeterminate="true"></l-progress-circular>
      </button>
    `;
  }

  //////////////////////////////////// methods
  onSlotChange(e: Event) {
    let slot = e.target as HTMLSlotElement;
    this.__primitiveWidth = this.offsetWidth + "px";
  }
  onClick(e: MouseEvent) {
    e.stopImmediatePropagation();
    e.preventDefault();
    if (this.loading) return;

    this.emit('click', {}, { event: e, bubbles: true })
  }
}