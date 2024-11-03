import { html, sync, tag, Template } from "compelem";
import { Modal } from "./Modal";
/**
 * 确认框，用于外部调用
 *
 * @slots
 *  default 弹框内容
 *
 * @author holyhigh2
 */
@tag("l-confirm")
export class Confirm extends Modal {
  static get styles() {
    return [`:host{position: fixed;}`]
  }
  //////////////////////////////////// props

  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`
      <l-dialog
        class="c-confirm"
        show-close="false"
        backdrop="static"
        .esc="${(this.esc)}"
        .visible="${sync(this.visible)}"
        .title="${(this._title)}"
      >
        ${(this.message)}<slot></slot>
          <l-button slot="footer" @click="${this.onConfirm}">${(this.confirmBtnText)}</l-button>
          <l-button slot="footer" appearance="subtle" @click="${this.onCancel}">${(this.cancelBtnText)}</l-button>
      </l-dialog>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods
}
