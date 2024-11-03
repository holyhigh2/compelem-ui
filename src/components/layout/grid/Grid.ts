import { CompElem, html, prop, styles, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 格栅布局 - 容器
 * @props
 *  gutter {string|number} 行间距，默认0
 *  fluid {boolean} 是否宽高盛满，且行列盛满
 *
 * @slots
 *  default() Row
 *
 * @author holyhigh2
 */
@tag('l-grid')
export class Grid extends CompElem {
  @prop({ type: String }) gutter: string | number = '0'
  @prop fluid = false;

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`<div class="c-grid-grid" style="${styles({
      rowGap: isNaN(this.gutter as any) ? this.gutter + '' : this.gutter + 'rem',
      height: this.fluid ? '100%' : 'auto'
    })}">
    <slot @slotchange="${this.onSlotChange}"></slot>
    </div>`;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods
  onSlotChange(e: Event) {
    let slot = e.currentTarget as HTMLSlotElement
    let els = slot.assignedElements()
  }
}
