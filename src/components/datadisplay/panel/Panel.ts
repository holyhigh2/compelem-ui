import { classes, csscope, Csscope, emits, h, ifElse, ifTrue, prop, state, tag, Template, watch } from "compelem";
import { isEmpty } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { ChevronDown, Close } from "../../../icons/icons";
import style from "./style.scss?tmpl";
/**
 * 面板组件
 * @attrs
 *  title {string} 标题信息
 *  value {string|number} 面板唯一标识，用于PanelGroup控制
 *  collapsible {boolean} 是否可折叠，默认false
 *  bodyStyle {string|object} 面板body样式
 *  defaultExpanded {boolean} 是否默认展开，collapsible为false时无效。默认true
 *  bordered {boolean} 是否边框，默认false
 *  closable {boolean} 是否显示关闭按钮，默认false
 *  flush {boolean} title内容齐平外框
 * @events
 *  close 点击关闭按钮时触发
 *  expand 展开时触发
 *  collapse 折叠时触发
 * @parts
 *  header 顶部区域
 *  body 内容区域
 *  card 所有卡片元素
 *  close closable 时的关闭按钮
 * @slots
 *  - 内容区域
 *  title 标题区域
 *
 * @author holyhigh2
 */
@emits('close', 'expand', 'collapse')
@tag('ce-panel')
export class Panel extends AppearanceElem {

  //////////////////////////////////// props
  @prop title: string = '';
  @prop({ type: [String, Number] }) value: string | number = '';
  @prop collapsible = false;
  @prop defaultExpanded = true;
  @prop({ type: [String, Object] }) bodyStyle = '';
  @prop flush = false
  @prop closable = false

  @state expanded = this.defaultExpanded;

  shadowed = true

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  // 将展开状态反射为宿主 [expanded] 属性：PanelGroup 的 HOST 作用域样式表
  // （inset/popout/stagger 变体）需要从组容器一侧定位展开面板
  @watch('expanded', { immediate: true })
  watchExpanded() {
    this.toggleAttribute('expanded', !!this.expanded)
  }

  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
      <div
        class="ce-panel"
        ${classes({
      ['__shadow-' + this.shadow]: this.shadow !== 'none',
      "ce-panel-collapsible": this.collapsible,
      "ce-panel-contracted": !this.expanded,
      "ce-panel-flush": this.flush,
      'is-disabled': this.disabled
    })}
      >
        <header part="header" ${classes({ "ce-panel-header": true, "ce-has-close": this.closable })} id="ce-panel-header">
          ${ifElse(this.collapsible,
      () => h`
              <ce-button
                appearance="subtle"
                .ripple="${false}"
                .hoverable="${!this.readonly}"
                ?readonly="${this.readonly}"
                aria-expanded="${this.expanded}"
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
          ${ifTrue(this.closable, () => h`
            <ce-icon class="ce-panel-close" part="close" size="sm" .svg="${Close}" @click="${this.onClose}"></ce-icon>
          `)}
        </header>
        <main part="body" role="region" aria-labelledby="ce-panel-header"
          ?inert="${!this.expanded}" aria-hidden="${this.expanded ? null : 'true'}">
          <div class="ce-panel-body">
            <slot></slot>
          </div>
        </main>
      </div>
    `;
  }

  //////////////////////////////////// methods
  toggleExpanded() {
    if (this.disabled) return
    if (this.readonly) return
    this.expanded = !this.expanded
    if (this.expanded) {
      this.emit('expand', { value: this.value })
    } else {
      this.emit('collapse', { value: this.value })
    }
  }
  onClose(e: Event) {
    this.emit('close', { value: this.value }, e)
  }
}
