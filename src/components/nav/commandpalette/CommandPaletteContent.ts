import { bind, csscope, Csscope, emits, h, prop, tag, Template } from "compelem";
import { AppearanceElem } from "../../../base/Appearance";
import { Search } from "../../../icons/icons";
import style from "./style.scss?tmpl";
/**
 * 命令面板内容
 * @attrs
 *  placeholder 输入框占位符，默认 "Type to search..."
 * @events
 *  search({value}) 搜索时触发
 *  clear 搜索框清除时触发
 *  input({value}) 搜索框输入时触发
 * @slots
 *  - 主体内容
 *  header 头部内容
 *  footer 底部内容
 *
 * @author holyhigh2
 */
@emits('search', 'clear', 'input')
@tag('ce-command-palette-content')
export class CommandPaletteContent extends AppearanceElem {

  //////////////////////////////////// props
  @prop placeholder = 'Type to search...'
  /**
   * 可选项选择器：命令面板是通用容器，列表项由外部以默认 slot 塞入（常包在容器里），
   * 组件无法靠"直接子节点"识别哪些是可选项。约定：可选项携带 `itemSelector` 指定的标记。
   * 默认 `[data-cp-item]`，外部列表项加 `data-cp-item` 即可被 ↑↓ 导航 / 高亮 / 回车确认。
   */
  @prop itemSelector = '[data-cp-item]'

  //////////////////////////////////// state
  /** 当前高亮项的索引（-1 表示无）；用普通字段而非 @state，避免每次移动触发整树重渲染 */
  activeIndex = -1

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
    <div part="content" class="ce-command-palette-pane" ${bind(this.attrs)}>
      <header part="search">
        <ce-input placeholder="${this.placeholder}" bordered="false" clearable @change="${this.onSearch}" @clear="${this.onClear}" @input="${this.onInput}">
          <ce-icon .svg="${Search}" slot="prepend" class="ce-command-palette-search" size="sm"></ce-icon>
          <span slot="append" class="ce-command-palette-esc">Esc</span>
        </ce-input>
        <slot name="header"></slot>
      </header>
      <main>
        <slot></slot>
      </main>
      <footer >
        <slot name="footer" ></slot>
      </footer>
    </div>
    `;
  }
  //////////////////////////////////// methods
  onSearch(obj: Record<string, any>) {
    this.emit('search', obj)
    // 列表随搜索变化：清掉旧高亮，避免高亮停留在已被过滤掉的旧项上
    this.#resetActive()
  }
  onClear() {
    this.emit('clear')
  }
  onInput(obj: Record<string, any>) {
    this.emit('input', obj)
    this.#resetActive()
  }
  focus(): void {
    const input = this.renderRoot?.querySelector('ce-input') as HTMLElement;
    input?.focus();
  }

  /** 收集当前默认 slot 中的可选项（兼容"外层包容器"结构：既取标记元素本身，也递归取其后代） */
  getItems(): HTMLElement[] {
    const slot = this.renderRoot?.querySelector('main slot') as HTMLSlotElement | null
    if (!slot) return []
    const out: HTMLElement[] = []
    for (const node of slot.assignedElements({ flatten: true })) {
      if (!(node instanceof HTMLElement)) continue
      if (node.matches(this.itemSelector)) out.push(node)
      node.querySelectorAll(this.itemSelector).forEach((el) => {
        if (el instanceof HTMLElement) out.push(el)
      })
    }
    return out
  }

  /** 高亮指定索引项，其余还原；越界自动夹紧 */
  #setActive(i: number) {
    const items = this.getItems()
    if (items.length === 0) return
    const idx = Math.max(0, Math.min(i, items.length - 1))
    this.activeIndex = idx
    items.forEach((el, k) => {
      if (k === idx) {
        el.classList.add('ce-cp-active')
        el.style.backgroundColor = 'rgb(var(--ce-color-info-rgb) / 0.1)'
        el.scrollIntoView({ block: 'nearest' })
      } else {
        el.classList.remove('ce-cp-active')
        el.style.backgroundColor = ''
      }
    })
  }

  #resetActive() {
    this.activeIndex = -1
    this.getItems().forEach((el) => {
      el.classList.remove('ce-cp-active')
      el.style.backgroundColor = ''
    })
  }

  /** 自动高亮首项（仅当当前无任何选中时；已有手动导航选择则跳过，防止 opened 延迟/重复触发覆盖） */
  selectFirst() {
    if (this.activeIndex !== -1) return
    this.#resetActive()
    const items = this.getItems()
    if (items.length) this.#setActive(0)
  }

  /** 上下移动高亮；从 -1 起按方向落到首/尾 */
  move(dir: number) {
    const items = this.getItems()
    if (!items.length) return
    let i = this.activeIndex
    if (i < 0) i = dir > 0 ? 0 : items.length - 1
    else i = Math.max(0, Math.min(i + dir, items.length - 1))
    this.#setActive(i)
  }

  /** 回车确认：无高亮项时先选中首项（保证"Enter 打开首个匹配"），再触发其点击行为 */
  confirm() {
    if (this.activeIndex < 0) this.selectFirst()
    const items = this.getItems()
    if (this.activeIndex >= 0 && items[this.activeIndex]) items[this.activeIndex].click()
  }

  /** 由外层 ce-command-palette 在 document 捕获阶段转发的键盘事件 */
  handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.move(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      this.confirm()
    }
  }
}
