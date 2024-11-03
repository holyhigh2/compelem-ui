import { classes, CompElem, html, ifTrue, prop, tag, Template } from "compelem";
import { Close, Error, Info, Success, Warning } from '../../../icons/icons';
import style from "./style.scss";
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
@tag('l-notification')
export class Notification extends CompElem {

  iconMap: Record<string, any> = {
    info: Info,
    warning: Warning,
    success: Success,
    error: Error
  }
  //////////////////////////////////// props
  @prop closable = false;
  @prop header = '';
  @prop target = '';
  @prop showIcon = true;
  @prop({ type: String, required: true }) descr: string;
  @prop type = 'info';

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args);
  }

  render(): Template {
    let tmpl = html`
    <div class="c-notification ${classes({
      ['__' + this.type]: true,
      __border: this.border,
      __round: this.round,
      __closable: this.closable,
      '--show': this.closable
    })}">
      <div class="main">
        ${ifTrue(this.showIcon, () => html`<div class="c-notification-icon"><l-icon .svg="${this.iconMap[this.type]}"></l-icon></div>`)}
        <div class="c-notification-content">
          <h3 class="c-notification-title">${this.header}</h3>
          <p class="c-notification-descr">${this.descr}</p>
        </div>
      </div>
      ${ifTrue(this.closable, () => html`<l-icon class="c-notification-close c-btn-close" .svg="${Close}" @click="${this.onClose}"></l-icon>`)}
    </div>
    `;
    return tmpl;
  }

  //////////////////////////////////// methods
  onClose() {
    this.close()
    let ev = new CustomEvent("close");
    this.dispatchEvent(ev);
  }
  close() {
    this.renderRoot.classList.remove('--show')
  }
}
