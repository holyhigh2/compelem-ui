import { classes, csscope, Csscope, h, ifElse, ifTrue, prop, state, tag, Template } from "compelem";
import { isEmpty } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { ChevronDown } from "../../../icons/icons";
import style from "./style.scss?tmpl";
/**
 * 面板组件
 * @attrs
 *  title {string} 标题信息
 *  collapsible {boolean} 是否可折叠，默认false
 *  bodyStyle {string|object} 面板body样式
 *  defaultExpanded {boolean} 是否默认展开，collapsible为false时无效。默认true
 *  bordered {boolean} 是否边框，默认false
 *  closable {boolean} 是否显示关闭按钮，默认false
 *  flush {boolean} title内容齐平外框
 * @events
 *  close 点击关闭按钮时触发
 * @parts
 *  header 顶部区域
 *  body 内容区域
 *  card 所有卡片元素
 * @slots
 *  - 内容区域
 *  title 标题区域
 *
 * @author holyhigh2
 */
@tag('ce-panel')
export class Panel extends AppearanceElem {

  //////////////////////////////////// props
  @prop title: string = '';
  @prop collapsible = false;
  @prop defaultExpanded = true;
  @prop({ type: [String, Object] }) bodyStyle = '';
  @prop flush = false

  @state({ prop: 'defaultExpanded' }) expanded = false;

  shadowed = true

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
      <div
        class="ce-panel"
        ${classes({
      ['__shadow-' + this.shadow]: this.shadow !== 'none',
      "ce-panel-collapsible": this.collapsible,
      "ce-panel-contracted": !this.expanded,
      "ce-panel-flush": this.flush
    })}
      >
        <header part="header" class="ce-panel-header">
          ${ifElse(this.collapsible,
      () => h`
              <ce-button
                appearance="subtle"
                .ripple="${false}"
                .hoverable="${!this.readonly}"
                ?readonly="${this.readonly}"
                block
                width="100%"
                @click="${this.toggleExpanded}"
              >
                <h3>
                  <slot name="title"></slot>
                  ${ifTrue(isEmpty(this.slots.title), () => h`
                    <span style="flex:1;text-align: left;">${this.title}</span>
                    ${ifTrue(!this.readonly, () => h`<ce-icon class="ce-panel-arrow" .svg="${ChevronDown}"></ce-icon>`)}
                  `)}
                </h3>
              </ce-button>
            `,
      () => h`
              <h3>
                ${this.title} <slot name="title"></slot>
              </h3>
            `
    )}
        </header>
        <main part="body">
          <div class="ce-panel-body">
            <slot></slot>
          </div>
        </main>
      </div>
    `;
  }

  //////////////////////////////////// methods
  toggleExpanded() {
    if (this.readonly) return
    this.expanded = !this.expanded
  }
}
