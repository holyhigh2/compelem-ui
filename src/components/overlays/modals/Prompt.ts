import { css, csscope, Csscope, emits, h, ifTrue, model, query, tag, Template } from "compelem";
import { isEmpty } from "myfx";
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
@emits('confirm')
@tag("ce-prompt")
export class Prompt extends Modal {
  @query("ce-input")
  input: Input;
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
        class="ce-prompt"
        show-close="false"
        backdrop="true"
        .esc="${(this.esc)}"
        ${model(this.visible, 'visible')}
      >
        <ce-card title="${this._title}" style="width:100%">
          ${ifTrue(isEmpty(this.slots.default), () => h`<div style="padding-block: 1rem;">${this.message}<ce-input style="display: block;width: 96%;margin-left: 2%;" maxlength="500"></ce-input></div>`)}
          <slot></slot>
          <ce-button slot="actions" appearance="pale" @click="${this.onConfirmClick}">${(this.confirmBtnText)}</ce-button>
          <ce-button slot="actions" style="margin-left:.5rem" color="text" appearance="subtle" @click="${this.onCancelClick}">${(this.cancelBtnText)}</ce-button>
        </ce-card>
      </ce-dialog>
    `;
  }

  //////////////////////////////////// methods
  onConfirmClick() {
    this.emit("confirm", { value: this.input.value });
    this.close();
  }
}
