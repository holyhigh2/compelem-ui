import { html, query, sync, tag, Template } from "compelem";
import { Input } from "../../form/input/Input";
import { Modal } from "./Modal";
/**
 * 提示框，用于外部调用
 *
 * @slots
 *  default 弹框内容
 *
 * @author holyhigh2
 */
@tag("l-prompt")
export class Prompt extends Modal {
  @query("l-input")
  input: Input;
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
        class="c-prompt"
        show-close="false"
        backdrop="static"
        .esc="${(this.esc)}"
        .visible="${sync(this.visible)}"
        .title="${(this._title)}"
      >
        ${(this.message)}
        <l-input style="display: block;width: 96%;margin-left: 2%;" maxlength="500"></l-input>
        <slot></slot>
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
  onConfirm() {
    this.emit("confirm", { value: this.input.value });
    this.close();
  }
}
