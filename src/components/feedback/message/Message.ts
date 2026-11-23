
import { classes, csscope, Csscope, emits, h, html, ifElse, ifTrue, prop, show, tag, Template, watch } from "compelem";
import { APPEARANCE_LAYER, AppearanceElem } from "../../../base/Appearance";

import { CheckCircleFill, Close, ExclamationTriFill, InfoFill, TimesCircleFill } from '../../../icons/icons';
import { ICloseable } from "../../../interfaces/ICloseable";
import { activatable } from "../../../directives/a11y/Activatable";
import { announceRole } from "../../../directives/a11y/Announce";
import { t } from "../../../locale";
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
 * @parts
 *  root 消息根节点
 *  title 标题
 *  descr 描述内容
 *  close 关闭按钮
 *
 * @a11y
 *  宿主按类型使用 role=alert（error/warning）或 role=status（info/success）；
 *  装饰图标 aria-hidden；无标题时不渲染空 <h3>；关闭按钮可聚焦并响应 Enter/空格。
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
  /**
   * 播报语义写在宿主而不是 shadow 内的 `.ce-message`：toast 插入 DOM 的是宿主，
   * 角色落在宿主上才和「插入即播报」的时序一致，宿主侧也能用
   * `ce-message[role=alert]` 直接审计，不必钻进 shadow。
   */
  @watch('type', { immediate: true })
  function (nv: string) {
    this.setAttribute('role', announceRole(nv))
  }

  render(): Template {
    return h`
    <div class="ce-message ce-message-show" part="root" ${classes({
      ['ce-message-' + this.type]: true,
      "ce-message-closable": this.closable,
      "ce-message-bordered": this.bordered
    })}>
      <div class="ce-message-main">
        ${ifTrue(this.showIcon, () => h`<div class="ce-message-icon" aria-hidden="true"><ce-icon .svg="${this.iconMap[this.type]}"></ce-icon></div>`)}
        <div class="ce-message-content">
          ${ifTrue(!!this.header, () => h`<h3 class="ce-message-title" part="title">${this.header}</h3>`)}
          ${ifElse(this.html, () => h`
            <p class="ce-message-descr" part="descr" ${html(this.descr)}></p>
          `, () => h`
            <p class="ce-message-descr" part="descr">${this.descr}</p>
          `)}
        </div>
      </div>
      <ce-icon class="ce-message-close ce-btn-close" part="close" ${show(this.closable)}
        ${activatable({ label: t('actions.close'), disabled: !this.closable })} .svg="${Close}" @click="${this.onClose}"></ce-icon>
      ${html(APPEARANCE_LAYER)}
    </div>
    `;
  }

  //////////////////////////////////// methods
  onClose() {
    this.emit('close')
  }
}
