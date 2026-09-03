
import { classes, csscope, Csscope, emits, h, html, ifElse, ifTrue, prop, tag, Template } from "compelem";
import { AppearanceElem } from "../../../base/Appearance";

import { CheckCircleFill, Close, ExclamationTriFill, InfoFill, TimesCircleFill } from '../../../icons/icons';
import { ICloseable } from "../../../interfaces/ICloseable";
import style from "./style.scss?tmpl";

export const enum MessageType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error'
}
/**
 * 消息提示
 * @attrs
 *  target {string} 目标容器选择器，如果为空。默认parentElement
 *  header {string} 标题
 *  descr {string} 描述信息
 *  showIcon {boolean} 显示图标，默认true
 *  closable {boolean} 是否显示关闭按钮，默认false
 *  type {string} 消息类型，info/success/warning/error
 *  bordered {boolean} 是否显示边框，默认false
 *  html {boolean} 是否支持html显示描述信息，默认false
 * 
 * @events
 *  close() 关闭时触发
 *
 * @author holyhigh2
 */
@emits('close')
@tag('ce-message')
export class Message extends AppearanceElem implements ICloseable {

  iconMap: Record<string, any> = {
    info: InfoFill,
    warning: ExclamationTriFill,
    success: CheckCircleFill,
    error: TimesCircleFill
  }
  //////////////////////////////////// props
  @prop header = '';
  @prop target = '';
  @prop showIcon = true;
  @prop({ type: String }) descr: string = '';
  @prop type = 'info';
  @prop closable: boolean = false;
  @prop html = false
  bordered = false;

  appearance = 'pale'

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <div class="ce-message ce-message-show" ${classes({
      ['ce-message-' + this.type]: true,
      "ce-message-closable": this.closable,
      "ce-message-bordered": this.bordered
    })}>
      <div class="ce-message-main">
        ${ifTrue(this.showIcon, () => h`<div class="ce-message-icon"><ce-icon .svg="${this.iconMap[this.type]}"></ce-icon></div>`)}
        <div class="ce-message-content">
          <h3 class="ce-message-title">${this.header}</h3>
          ${ifElse(this.html, () => h`
            <p class="ce-message-descr" ${html(this.descr)}></p>
          `, () => h`
            <p class="ce-message-descr">${this.descr}</p>
          `)}
        </div>
      </div>
      <ce-icon class="ce-message-close ce-btn-close" .svg="${Close}" @mousedown="${this.onClose}"></ce-icon>
      ${super.render()}
    </div>
    `;
  }

  //////////////////////////////////// methods
  onClose() {
    this.emit('close')
  }
}
