import { CompElem, emits, state } from "compelem";
import { Options } from ".";
import { t } from "../../../locale";
/**
 * 内置模态框基类
 * @author holyhigh2
 */
@emits("confirm", "cancel")
export class Modal extends CompElem {
  //////////////////////////////////// props
  @state _title: string = '';
  @state message = '';
  @state confirmBtnText = t('actions.confirm');
  @state cancelBtnText = t('actions.cancel');
  @state visible = false;
  @state esc = true;

  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles

  //////////////////////////////////// methods
  open(message: string, title?: string, options?: Options) {
    this.message = message;
    this._title = title || '';
    if (options) {
      if (options.confirmButtonText)
        this.confirmBtnText = options.confirmButtonText
      if (options.cancelButtonText)
        this.cancelBtnText = options.cancelButtonText
      // 未显式给 esc 时保持默认（true）：`!!options.esc` 会把「只传文案」的调用静默关掉 ESC
      if (options.esc !== undefined) this.esc = options.esc
    }

    this.visible = true;
  }
  close() {
    this.visible = false;
  }
  onConfirmClick() {
    this.emit('confirm')
    this.#confirmCbk?.()
    this.close()
  }
  onCancelClick() {
    this.emit('cancel')
    this.#cancelCbk?.()
    this.close()
  }
  #confirmCbk: () => void
  #cancelCbk: () => void
  onConfirm(cbk: () => void) {
    this.#confirmCbk = cbk
  }
  onCancel(cbk: () => void) {
    this.#cancelCbk = cbk
  }
}
