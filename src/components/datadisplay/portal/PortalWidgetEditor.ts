import { CompElem, csscope, Csscope, h, tag, Template } from 'compelem'
import widgetStyle from './portalWidget.scss?tmpl'

/**
 * 门户挂件（编辑态外框）—— **已弃用**
 *
 * `ce-portal-editor` 的 item 已改为 `ce-portal-item`（自带标题栏/按钮/手柄，且位于
 * 编辑器 light DOM），本组件不再参与编辑态渲染，保留导出仅为不打断既有引用。
 *
 * @deprecated 使用 `ce-portal-item`
 * @methods
 *  getContent()
 */
@tag('ce-portal-widget-editor')
export class PortalWidgetEditor extends CompElem {

  @csscope(Csscope.INNER)
  static get css() {
    return [widgetStyle]
  }

  render(): Template {
    return h`
      <div class="ce-portal-widget-frame is-plain">
        <div class="ce-portal-widget-body"><slot></slot></div>
      </div>
    `
  }

  //////////////////////////////////// methods
  getContent(): HTMLElement {
    return this
  }
}
