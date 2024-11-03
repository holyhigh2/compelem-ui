import { CompElem, html, prop, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 格栅布局 - 列
 *
 *
 * @slots
 *  default() 
 *
 * @author holyhigh2
 */
@tag('l-col')
export class Col extends CompElem {
  @prop({ type: Number }) span: number
  @prop({ type: Number }) offset = 0

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`<slot @slotchange="${this.onSlotChange}"></slot>`;
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
