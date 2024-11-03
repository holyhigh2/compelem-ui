
import { classes, CompElem, html, ifTrue, prop, tag, Template } from "compelem";
import { Close, ErrorFill, InfoFill, SuccessFill, WarningFill } from './../../../icons/icons';
import style from "./style.scss";
/**
 * 消息提示
 * @attrs
 *  target {string} 目标容器选择器，如果为空。默认parentElement
 *  header {string} 标题
 *  descr {string} 描述信息
 *  showIcon {boolean} 显示图标，默认true
 *  round {boolean} 是否圆角，默认true
 *  closable {boolean} 是否显示关闭按钮，默认false
 *  type {string} 消息类型，info/success/warning/error
 *  border {boolean} 是否显示边框，默认false
 *
 * @events
 *  close() 关闭时触发
 *
 * @author holyhigh2
 */
@tag('l-message')
export class Message extends CompElem {

  iconMap: Record<string, any> = {
    info: InfoFill,
    warning: WarningFill,
    success: SuccessFill,
    error: ErrorFill
  }
  //////////////////////////////////// props
  @prop closable = false;
  @prop round = true;
  @prop header = '';
  @prop target = '';
  @prop showIcon = true;
  @prop({ type: String, required: true }) descr: string;
  @prop type = 'info';
  @prop border = false;

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
    <div class="c-message --show ${classes({
      ['__' + this.type]: true,
      __border: this.border,
      __round: this.round,
      __closable: this.closable
    })}">
      <div class="main">
        ${ifTrue(this.showIcon, () => html`<div class="c-message-icon"><l-icon .svg="${this.iconMap[this.type]}"></l-icon></div>`)}
        <div class="c-message-content">
          <h3 class="c-message-title">${this.header}</h3>
          <p class="c-message-descr">${this.descr}</p>
        </div>
      </div>
      <l-icon class="c-message-close c-btn-close" .svg="${Close}" @click="${this.onClose}"></l-icon>
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
  open() {
    this.renderRoot.classList.add('--show')
  }
}
