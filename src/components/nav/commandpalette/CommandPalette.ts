import { bind, createRef, csscope, Csscope, emits, h, prop, tag, Template } from "compelem";
import { AppearanceElem } from "../../../base/Appearance";
import { Overlay } from "../../overlays/overlay/Overlay";
import { CommandPaletteContent } from "./CommandPaletteContent";
import style from "./style.scss?tmpl";
/**
 * 命令面板
 * 可做搜索框，命令框等
 * @attrs
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

  /** 已搬移进 pane 的槽节点，重渲染时先清除避免残留重复 */
  #movedNodes: Node[] = [];

  slotChange(slot: HTMLSlotElement, name: string): void {
    const target = this.pane.current;
    // 首帧渲染时 pane ref 可能尚未就绪，open() 中会补一次同步
    if (!target) return;
    const nodes = slot.assignedNodes({ flatten: true });
    if (nodes.length === 0) return;
    this.#movedNodes.forEach((n) => n.parentNode?.removeChild(n));
    this.#movedNodes = [...nodes];
    target.append(...nodes);
  }
  //////////////////////////////////// methods
  open() {
    (this.renderRoot as Overlay).open();
    // Overlay 打开时会把 pane（content 宿主）传送到 document.body，
    // 宿主 shadow 树内的 <slot> 分布关系随之失效（assignedNodes 恒为空）。
    // 因此直接把宿主的 light children 搬进 pane，由 content 自身模板中的
    // <slot>/<slot name="footer"> 接管分发（appended 节点成为其 light children）。
    const pane = this.pane.current;
    if (pane) {
      // 必须整体搬移（含注释/空白文本节点）：ifElse、forEach 等结构指令的锚点就是
      // 这些文本/注释节点。只搬元素会让锚点留在已失效的宿主 light DOM 中，
      // 后续分支切换把新节点插回宿主（不可见），表现为空态提示不显示、
      // 过滤清空后列表不再恢复。
      pane.append(...this.childNodes);
    }
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
    // 列表项在输入框内，ce-input 对非 Escape 键 stopPropagation，
    // 故内部 @keydown 收不到 ↑↓/Enter；改在 document 捕获阶段监听并转发给 content。
    document.addEventListener('keydown', this.#onDocKeydown, true)
    // 自动高亮首项（同步执行：'opened' 时节点已由 open() 搬入 pane，无需 rAF；
    // rAF 在 headless/无合成层环境下会被节流，反而把手动导航的高亮覆盖回首项）
    ;(this.pane.current as CommandPaletteContent | undefined)?.selectFirst()
  }
  onClosed() {
    this.emit('closed')
    document.removeEventListener('keydown', this.#onDocKeydown, true)
  }
  /** document 捕获阶段 keydown：仅当面板打开时存在，转发给 content 处理导航/确认 */
  #onDocKeydown = (e: KeyboardEvent) => {
    (this.pane.current as CommandPaletteContent | undefined)?.handleKeydown(e)
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