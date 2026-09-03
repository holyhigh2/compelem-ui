import { css, csscope, Csscope, h, ifTrue, model, tag, Template } from "compelem";
import { Modal } from "./Modal";
/**
 * 确认框，用于外部调用
 *
 * @slots
 *  default 弹框内容
 *
 * @author holyhigh2
 */
@tag("ce-confirm")
export class Confirm extends Modal {
  @csscope(Csscope.INNER)
  static get css() {
    return [css`:host{position: fixed;}`]
  }
  //////////////////////////////////// props

  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
      <ce-dialog
        class="ce-confirm"
        backdrop="true"
        .esc="${(this.esc)}"
        ${model(this.visible, 'visible')}
        .title="${(this._title)}"
      >
        <ce-card title="${this._title}" style="width:100%">
          ${ifTrue(!!this.message, () => h`<div style="padding-block: 1rem;">${this.message}</div>`)}
          <slot></slot>
          <ce-button slot="actions" appearance="pale" @click="${this.onConfirmClick}">${(this.confirmBtnText)}</ce-button>
          <ce-button slot="actions" style="margin-left:.5rem" color="text" appearance="subtle" @click="${this.onCancelClick}">${(this.cancelBtnText)}</ce-button>
        </ce-card>
      </ce-dialog>
    `;
  }

  //////////////////////////////////// methods
}
