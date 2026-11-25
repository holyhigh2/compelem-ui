import { CompElem, csscope, Csscope, h, ifTrue, prop, tag, Template } from 'compelem'
import { Gear, Times } from '../../../icons/icons'
import itemStyle from './portalItem.scss?tmpl'

/**
 * 门户编辑态挂件卡片（标题栏 + 内容 + 缩放手柄）
 *
 * 为什么是一个组件而不是 `ce-portal-editor` 模板里的一段 DOM：
 * item 必须落在 `ce-portal-editor` 的 **light DOM**（经命名 slot 投影进 grid），
 * 这样挂件内容节点才位于上层组件（宿主）的 shadow 树内，上层样式表可直接命中。
 * 而 item 的标题栏、按钮、手柄需要自己的 `:host` 样式与事件语义，正好由组件承载。
 *
 * 事件（原生 CustomEvent，需跨 shadow 冒泡，故不用 `emit`）：
 *  - `portal-item-config`  点击配置按钮
 *  - `portal-item-remove`  点击移除按钮
 *  - `portal-item-resize`  resize 手柄 pointerdown（detail: {clientX, clientY}）
 *
 * 拖拽不在这里实现：起拖由上层 `ce-portal-editor` 在 `mousedown` 时用
 * `composedPath()` 判定（需要认得出标题栏、按钮、手柄），本组件只保留结构
 * 与交互控件的类名（`.ce-portal-item-bar` / `.ce-portal-item-resize` / `ce-button`）。
 *
 * @attrs
 *  title {string} 标题
 *  configurable {boolean} 是否显示配置按钮
 *  resizable {boolean} 是否显示缩放手柄
 *  denied {boolean} 是否处于不可用态（无权限 / 已下线）：标题栏加标记、内容区换占位
 *  deniedText {string} 不可用文案
 * @methods
 *  getContent()
 */
@tag('ce-portal-item')
export class PortalItem extends CompElem {

  @prop({ type: String }) title = ''
  @prop({ type: Boolean }) configurable = false
  @prop({ type: Boolean }) resizable = true
  @prop({ type: Boolean }) denied = false
  @prop({ type: String }) deniedText = '暂无访问权限'

  @csscope(Csscope.INNER)
  static get css() {
    return [itemStyle]
  }

  render(): Template {
    return h`
      <div class="ce-portal-item-bar">
        <span class="ce-portal-item-grip"></span>
        <span class="ce-portal-item-title">${this.title}</span>
        ${ifTrue(this.denied, () => h`
          <span class="ce-portal-item-badge" title="${this.deniedText}">无权限</span>
        `)}
        <!-- 宿主注入的头部内容（卡片级筛选等）：右对齐，位于操作按钮之前 -->
        <slot name="header-extra"></slot>
        ${ifTrue(this.configurable, () => h`
          <ce-button size="sm" icon-size="md" appearance="subtle" .icon="${Gear}" color="text" title="配置" @click="${this.onConfigClick}"></ce-button>
        `)}
        <ce-button size="sm" icon-size="md" appearance="subtle" .icon="${Times}" color="error" title="移除" @click="${this.onRemoveClick}"></ce-button>
      </div>
      ${ifTrue(!this.denied, () => h`
        <div class="ce-portal-item-widget"><slot></slot></div>
      `)}
      ${ifTrue(this.denied, () => h`
        <div class="ce-portal-item-widget is-denied">
          <div class="ce-portal-denied">
            <svg class="ce-portal-denied-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2"></rect>
              <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
            </svg>
            <span class="ce-portal-denied-text">${this.deniedText}</span>
          </div>
        </div>
      `)}
      ${ifTrue(this.resizable, () => h`
        <span class="ce-portal-item-resize" title="拖拽调整大小" @pointerdown="${this.onResizeDown}"></span>
      `)}
    `
  }

  //////////////////////////////////// methods
  /** 内容写进本元素的 light DOM（经 `<slot>` 呈现），因此返回自身 */
  getContent(): HTMLElement {
    return this
  }

  //////////////////////////////////// events
  onConfigClick(e: MouseEvent): void {
    e.stopPropagation()
    this.dispatchEvent(new CustomEvent('portal-item-config', { bubbles: true, composed: true }))
  }

  onRemoveClick(e: MouseEvent): void {
    e.stopPropagation()
    this.dispatchEvent(new CustomEvent('portal-item-remove', { bubbles: true, composed: true }))
  }

  onResizeDown(e: PointerEvent): void {
    e.preventDefault()
    e.stopPropagation()
    this.dispatchEvent(new CustomEvent('portal-item-resize', {
      bubbles: true,
      composed: true,
      detail: { clientX: e.clientX, clientY: e.clientY },
    }))
  }
}
