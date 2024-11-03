import { CompElem, html, state, tag, Template } from "compelem";
import { some } from "myfx";
import { Aside } from "./Aside";
import style from "./container.scss";
/**
 * 布局容器 - 容器
 *
 *
 * @slots
 *  default() Container/Header/Footer/Main/Aside
 *
 * @author holyhigh2
 */
@tag('l-container')
export class Container extends CompElem {
  @state hasAside = false

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

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

    let hasAside = some(els, el => el instanceof Aside);
    if (hasAside) {
      this.style.flexDirection = 'row'
    } else {
      this.style.flexDirection = 'column'
    }
  }
}
