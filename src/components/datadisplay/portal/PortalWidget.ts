import { classes, CompElem, csscope, Csscope, h, ifTrue, prop, tag, Template } from 'compelem'
import widgetStyle from './portalWidget.scss?tmpl'

/**
 * 门户挂件（视图态外框）
 *
 * 内容由 `ce-portal` 的宿主通过 `append` 写入本元素的 light DOM，再经 `<slot>` 呈现；
 * 因此挂件内容不进入本组件的 shadow，宿主的挂件样式可通过父级 shadow 的样式表命中。
 *
 * `denied` 为 true 时**不投影 slot**，改为渲染内建的「不可用」占位 —— 该挂件当前
 * 无权限 / 已下线，但布局项仍然保留（不删数据，权限恢复后内容会重新注入）。
 *
 * @attrs
 *  title {string} 卡片标题（空则不渲染标题栏）
 *  overflow {string} visible/hidden
 *  denied {boolean} 是否处于不可用态
 *  deniedText {string} 不可用文案
 * @methods
 *  getContent()
 */
@tag('ce-portal-widget')
export class PortalWidget extends CompElem {

  /**
   * 卡片标题。空串 = 不画标题栏（纯内容卡片，如欢迎语）。
   *
   * 视图态和编辑态必须都能显示：编辑时看到的卡和用户实际看到的卡应该是同一张，
   * 否则「编辑态有标题、保存后标题消失了」会被当成 bug 反复报。
   */
  @prop({ type: String }) title = ''
  @prop({ type: String }) overflow = 'hidden'
  @prop({ type: Boolean }) denied = false
  @prop({ type: String }) deniedText = '暂无访问权限'
  /**
   * 头部是否有宿主注入的内容（如卡片级筛选）。
   *
   * 没有标题栏时也要把 bar 渲染出来 —— 否则筛选没地方放；空的时候（没有标题、
   * 也没有宿主内容）整条 bar 不渲染，保持"无标题卡片"原本的观感。
   */
  @prop({ type: Boolean }) headerExtra = false

  @csscope(Csscope.INNER)
  static get css() {
    return [widgetStyle]
  }

  render(): Template {
    return h`
      <div ${classes({ 'ce-portal-widget-frame': true, 'is-overflowed': this.overflow === 'visible', 'is-denied': this.denied })}>
        ${ifTrue(!!this.title || this.headerExtra, () => h`
          <div class="ce-portal-widget-bar">
            ${ifTrue(!!this.title, () => h`<span class="ce-portal-widget-title">${this.title}</span>`)}
            <!-- 宿主注入的头部内容（卡片级筛选等）：右对齐 -->
            <slot name="header-extra"></slot>
          </div>
        `)}
        ${ifTrue(!this.denied, () => h`
          <div class="ce-portal-widget-body"><slot></slot></div>
        `)}
        ${ifTrue(this.denied, () => h`
          <div class="ce-portal-denied">
            <svg class="ce-portal-denied-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2"></rect>
              <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
            </svg>
            <span class="ce-portal-denied-text">${this.deniedText}</span>
          </div>
        `)}
      </div>
    `
  }

  //////////////////////////////////// methods
  getContent(): HTMLElement {
    return this
  }
}
