import { CompElem, emits, state } from "compelem";
import { Options } from ".";
/**
 * 内置模态框基类
 * @author holyhigh2
 */
@emits("confirm", "cancel")
export class Modal extends CompElem {
  //////////////////////////////////// props
  @state _title: string = '';
  @state message = '';
  @state confirmBtnText = '确定';
  @state cancelBtnText = '取消';
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
      this.esc = !!options.esc
    }

    this.visible = true;
  }
  close() {
    this.visible = false;
  }
  onConfirmClick() {
    this.emit('confirm')
    if (this.#confirmCbk) this.#confirmCbk()
    this.close()
  }
  onCancelClick() {
    this.emit('cancel')
    if (this.#cancelCbk) this.#cancelCbk()
    this.close()
  }
  #confirmCbk: Function
  #cancelCbk: Function
  onConfirm(cbk: Function) {
    this.#confirmCbk = cbk
  }
  onCancel(cbk: Function) {
    this.#cancelCbk = cbk
  }
}
