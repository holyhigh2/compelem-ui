import { html, sync, tag, Template } from "compelem";
import { Modal } from "./Modal";
/**
 * 警告框，用于外部调用
 *
 * @slots
 *  default 弹框内容
 *
 * @author holyhigh2
 */
@tag("l-alert")
export class Alert extends Modal {
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
        class="c-alert"
        show-close="false"
        backdrop="static"
        .esc="${this.esc}"
        .visible="${sync(this.visible)}"
        .title="${this._title}"
      >
        ${this.message}<slot></slot>
        <l-button slot="footer" @click="${this.onConfirm}">${this.confirmBtnText}</l-button>
      </l-dialog>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods
}
