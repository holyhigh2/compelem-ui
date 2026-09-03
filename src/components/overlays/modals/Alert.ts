import { css, csscope, Csscope, h, ifTrue, model, tag, Template } from "compelem";
import { Modal } from "./Modal";
/**
 * 警告框，用于外部调用
 *
 * @slots
 *  default 弹框内容
 *
 * @author holyhigh2
 */
@tag("ce-alert")
export class Alert extends Modal {
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
        class="ce-alert"
        show-close="false"
        backdrop="true"
        .esc="${this.esc}"
        ${model(this.visible, 'visible')}
      >
        <ce-card title="${this._title}" style="width:100%">
          ${ifTrue(!!this.message, () => h`<div style="padding-block: 1rem;">${this.message}</div>`)}
          <slot></slot>
          <ce-button slot="actions" appearance="pale" @click="${this.onConfirmClick}">${(this.confirmBtnText)}</ce-button>
        </ce-card>
      </ce-dialog>
    `;
  }

  //////////////////////////////////// methods
}
