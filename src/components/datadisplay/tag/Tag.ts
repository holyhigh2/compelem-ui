import { classes, CompElem, html, ifTrue, prop, tag, Template, watch } from "compelem";
import { Close } from "../../../icons/icons";
import { getRGBColorValue } from "../../../utils";
import style from "./style.scss";
/**
 * 标签组件
 * @attrs
 *  color {string} 按钮颜色，任意颜色及类型颜色包括：info/success/warning/error/text，默认info
 *  pill {boolean} 是否药丸型按钮，默认false
 *  flat {boolean} 是否扁平化外观，默认true
 *  size {string} 尺寸可选 lg/md/sm，默认md
 *  dot {boolean} 是否显示点，默认false
 *  border {boolean} 是否边框，默认false
 *  closable {boolean} 是否显示关闭按钮，默认false
 * @events
 *  close 点击关闭按钮时触发
 *
 * @slots
 *  default() 链接内容
 *
 * @author holyhigh2
 */
@tag('l-tag')
export class Tag extends CompElem {

  //////////////////////////////////// props
  @prop color: string = '';
  @prop closable = false;
  @prop border = false;
  @prop pill = false;
  @prop dot = false;
  @prop flat = false;
  @prop size = "md"; //lg, md, sm

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  @watch("color", { immediate: true })
  watch(nv: any, ov: any, sourceName: string) {
    if (!nv) return;

    let c = nv;
    switch (nv) {
      case 'info': case 'success': case 'warning': case 'error': case 'text':
        c = `var(--l-color-${nv})`;
        break;
      default:
        c = getRGBColorValue(c)
    }

    this.style.setProperty('--color', c)
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`
    <span class="c-tag ${classes({
      ["__size-" + this.size]: true,
      __pill: this.pill,
      __border: this.border,
      __flat: this.flat
    })}">
      ${ifTrue(this.dot, () => html`<span class="--dot"></span>`)}
      <slot></slot>
      ${ifTrue(this.closable, () => html`<l-icon class="c-btn-close" .svg="${Close}" @click="${this.onClose}"></l-icon>`)}
    </span>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods
  onClose(e: MouseEvent) {
    this.emit('close', {}, { event: e })
  }
}
