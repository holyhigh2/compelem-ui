import { classes, csscope, Csscope, emits, h, ifTrue, prop, show, tag, Template, watch } from "compelem";
import { AppearanceElem, AppearanceSize } from "../../../base/Appearance";

import { ICloseable } from "@/interfaces/ICloseable";
import { activatable } from "../../../directives/a11y/Activatable";
import { announceRole } from "../../../directives/a11y/Announce";
import { Check, Close, ExclamationTri, Info, Times } from '../../../icons/icons';
import { t } from "../../../locale";
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
 * @parts
 *  root 通知根节点
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
  /**
   * 播报语义写在宿主而不是 shadow 内的 `.ce-notification`：toast 插入 DOM 的是宿主，
   * 角色落在宿主上才和「插入即播报」的时序一致（与 Message 同一处理）。
   */
  @watch('type', { immediate: true })
  function (nv: string) {
    this.setAttribute('role', announceRole(nv))
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <div tabindex="0" class="ce-notification" part="root" ${classes({
      ['ce-notification-' + this.type]: true,
      "ce-notification-closable": this.closable,
      'ce-notification-show': this.closable
    })}>
      <div class="ce-notification-main">
        ${ifTrue(this.showIcon, () => h`<div class="ce-notification-icon" aria-hidden="true"><ce-icon .svg="${this.iconMap[this.type]}"></ce-icon></div>`)}
        <div class="ce-notification-content">
          ${ifTrue(!!this.header, () => h`<h3 class="ce-notification-title" part="title">${this.header}</h3>`)}
          <p class="ce-notification-descr" part="descr">${this.descr}</p>
        </div>
      </div>
      <ce-icon class="ce-notification-close ce-btn-close" part="close" ${show(this.closable)}
        ${activatable({ label: t('actions.close'), disabled: !this.closable })} .svg="${Close}" @click="${this.onClose}"></ce-icon>
    </div>
    `;
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
