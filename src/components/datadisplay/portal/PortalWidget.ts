import { h, query, tag, Template, csscope, Csscope } from "compelem";
import { AppearanceElem } from "../../../base/Appearance";
import widgetStyle from './portalWidget.scss?tmpl';

/**
 * 门户挂件
 * @props
 *  resizable {boolean}
 * @methods
 *  getContent()
 */
@tag("ce-portal-widget")
export class PortalWidget extends AppearanceElem {

  @query('.ce-portal-editor-content')
  contentEl: HTMLElement

  shadow = 'md'

  __inited = false

  @csscope(Csscope.INNER)
  static get css() {
    return [widgetStyle]
  }

  render(): Template {
    return h`
      <div class="ce-portal-editor-widget" >
        <div class="ce-portal-editor-content"></div>
      </div>
    `;
  }
  resizableInited = false
  mounted(): void {

  }
  //////////////////////////////////// methods

  getContent() {
    return this.contentEl
  }
}
