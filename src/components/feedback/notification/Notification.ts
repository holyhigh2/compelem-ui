import { classes, csscope, Csscope, emits, h, ifTrue, prop, tag, Template } from "compelem";
import { AppearanceElem, AppearanceSize } from "../../../base/Appearance";

import { ICloseable } from "@/interfaces/ICloseable";
import { Check, Close, ExclamationTri, Info, Times } from '../../../icons/icons';
import style from "./style.scss?tmpl";
/**
 * 通知提示
 * @attrs
 *  target {string} 目标容器选择器，如果为空。默认parentElement
 *  header {string} 标题
 *  descr {string} 描述信息
 *  showIcon {boolean} 显示图标，默认true
 *  closable {boolean} 是否显示关闭按钮，默认false
 *  type {string} 消息类型，info/success/warning/error
 *
 * @events
 *  close() 关闭时触发
 *
 * @author holyhigh2
 */
@emits('close')
@tag('ce-notification')
export class Notification extends AppearanceElem implements ICloseable {

  iconMap: Record<string, any> = {
    info: Info,
    warning: ExclamationTri,
    success: Check,
    error: Times
  }
  //////////////////////////////////// props
  @prop({ type: Boolean }) closable: boolean = false
  @prop header = '';
  @prop target = '';
  @prop showIcon = true;
  @prop({ type: String, required: true }) descr: string;
  @prop type = 'info';

  shadowed = true;
  shadow = AppearanceSize.SM

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  render(): Template {
    let tmpl = h`
    <div tabindex="0" class="ce-notification" ${classes({
      ['ce-notification-' + this.type]: true,
      "ce-notification-closable": this.closable,
      'ce-notification-show': this.closable
    })}>
      <div class="ce-notification-main">
        ${ifTrue(this.showIcon, () => h`<div class="ce-notification-icon"><ce-icon .svg="${this.iconMap[this.type]}"></ce-icon></div>`)}
        <div class="ce-notification-content">
          <h3 class="ce-notification-title">${this.header}</h3>
          <p class="ce-notification-descr">${this.descr}</p>
        </div>
      </div>
      ${ifTrue(this.closable, () => h`<ce-icon class="ce-notification-close ce-btn-close" .svg="${Close}" @click="${this.onClose}"></ce-icon>`)}
    </div>
    `;
    return tmpl;
  }

  //////////////////////////////////// methods
  onClose() {
    this.close()
    this.emit('close')
  }
  close() {
    this.renderRoot?.classList.remove('ce-notification-show')
  }
}
