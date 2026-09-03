import { bind, createRef, csscope, Csscope, emits, h, prop, tag, Template } from "compelem";
import { AppearanceElem } from "../../../base/Appearance";
import { Overlay } from "../../overlays/overlay/Overlay";
import style from "./style.scss?tmpl";
/**
 * 命令面板
 * 可做搜索框，命令框等
 * @props
 *  backdrop {string} 是否显示遮罩，默认false
 *  autoFocus {boolean} 打开时是否自动聚焦，默认true
 *  placeholder 输入框占位符，默认 "Type to search..."
 * @methods
 *  open() 打开命令面板
 *  close() 关闭命令面板
 * @slots
 *  - 主体内容
 *  header 头部内容
 *  footer 底部内容
 * @events
 *  opened 打开时触发
 *  closed 关闭时触发
 *  beforeopen 打开前触发
 *  beforeclose 关闭前触发
 *  search({value}) 搜索时触发
 *  clear 搜索框清除时触发
 *  input({value}) 搜索框输入时触发
 *
 * @author holyhigh2
 */
@emits('opened', 'closed', 'beforeopen', 'beforeclose', 'search', 'clear', 'input')
@tag('ce-command-palette')
export class CommandPalette extends AppearanceElem {

  //////////////////////////////////// props
  @prop backdrop = false
  @prop autoFocus = true

  pane = createRef<HTMLElement>();
  //////////////////////////////////// state

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return style;
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
    <ce-overlay close-on-click esc @opened="${this.onOpened}" @beforeopen="${this.onOpen}" @beforeclose="${this.onBeforeClose}" @closed="${this.onClosed}" ?backdrop="${this.backdrop}">
      <ce-command-palette-content ref="${this.pane}" part="pane" ${bind(this.attrs)} @search="${this.onSearch}" @clear="${this.onClear}" @input="${this.onInput}">
        <slot></slot>
        <slot name="footer" slot="footer"></slot>
        <slot name="header" slot="header"></slot>
      </ce-command-palette-content>
    </ce-overlay>
    `;
  }

  slotChange(slot: HTMLSlotElement, name: string): void {
    const nodes = slot.assignedNodes({ flatten: true });
    if (nodes.length > 0) {
      this.pane.current?.append(...nodes);
    }
  }
  //////////////////////////////////// methods
  open() {
    (this.renderRoot as Overlay).open();
    if (this.autoFocus) {
      setTimeout(() => {
        this.pane.current?.focus();
      }, 100);
    }
  }
  close() {
    (this.renderRoot as Overlay).close();
  }
  onBeforeClose() {
    this.emit('beforeclose')
  }
  onOpen() {
    this.emit('beforeopen')
  }
  onOpened() {
    this.emit('opened')
  }
  onClosed() {
    this.emit('closed')
  }
  onSearch(obj: Record<string, any>) {
    this.emit('search', obj)
  }
  onClear() {
    this.emit('clear')
  }
  onInput(obj: Record<string, any>) {
    this.emit('input', obj)
  }
}