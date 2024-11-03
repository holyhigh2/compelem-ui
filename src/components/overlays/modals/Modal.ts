import { CompElem, html, state, Template } from "compelem";
import { Options } from ".";
/**
 * 内置模态框基类
 * @author holyhigh2
 */
export class Modal extends CompElem {
  render(): Template {
    return html``;
  }
  //////////////////////////////////// props
  @state _title: string;
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
  onConfirm() {
    this.emit('confirm')
    this.close()
  }
  onCancel() {
    this.emit('cancel')
    this.close()
  }
}
