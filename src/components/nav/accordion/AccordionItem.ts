import { css, csscope, Csscope, h, prop, tag, Template } from "compelem";
import { isEmpty } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
/**
 * 手风琴项
 * @props
 *  header {string} 标题信息
 *  defaultExpanded {boolean} 默认展开，默认true
 *  bodyStyle {string|object} 面板body样式
 * @slots
 *  - 主体内容
 *  header 头部内容
 *
 * @author holyhigh2
 */
@tag('ce-accordion-item')
export class AccordionItem extends AppearanceElem {

  //////////////////////////////////// props
  @prop header: string = '';
  @prop defaultExpanded = true;
  @prop({ type: [String, Object] }) bodyStyle = '';

  //////////////////////////////////// state
  @csscope(Csscope.INNER)
  static get css() {
    return [
      css`
        ce-panel{
          display: block;
          padding:0;
        }
      `
    ]
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <ce-panel .header="${this.header}" .default-expanded="${this.defaultExpanded}" collapsible shadow="never" ?readonly="${this.readonly}" .body-style="${this.bodyStyle}">
      ${!isEmpty(this.slots.header) ? h`<slot name="header" slot="header" slot-props></slot>` : ''}
      <slot></slot>
    </ce-panel>
    `;
  }

  //////////////////////////////////// methods

}
