import { CompElem, css, csscope, Csscope, emits, h, ifTrue, prop, query, state, styles, tag, Template, watch } from "compelem";
import { escapeHtml, isString, map } from "myfx";
import { Menu } from "../menu/Menu";
import { Overlay } from "../../overlays/overlay/Overlay";
import { Search } from "../../../icons/icons";
import style from "./style.scss?tmpl";

/**
 * 按 ce-menu 的 `data-path`（如 `2`、`1-0`）回查原始 item。
 * 不能让 ce-menu 直接回传它的 item —— 那是组件内部映射后的对象，
 * 对外事件的历史契约是原始 items 里的引用。
 */
function resolveOriginalItem(items: Array<any>, path: string) {
  const segs = (path ?? "").split("-");
  let list: Array<any> = items ?? [];
  let item: any;
  for (const seg of segs) {
    item = Array.isArray(list) ? list[Number(seg)] : undefined;
    list = item && Array.isArray(item.children) ? item.children : [];
  }
  return { item, index: segs.length ? Number(segs[segs.length - 1]) : -1 };
}

/**
 * 下拉菜单
 * 基于 ce-menu 实现：分隔线、分组标题、子菜单、键盘导航与 menu/menuitem ARIA 均来自菜单组件
 * @attrs
 *  items {array} 菜单项数组：string | {text|label, value?, iconSvg?, iconClass?, icon?, hotKey?: string[], disabled?, children?}；null 为分割线
 *  theme {string} light/dark
 *  trigger {string} hover/click，默认hover
 *  placement {string} 浮层方位，默认 bottom-end
 *  width {number|string} 面板宽度，默认跟随内容；设置后菜单同步到该宽度
 *  minWidth {string} 菜单最小宽度，默认取 width，未设置 width 时为 10rem
 *  maxHeight {string} 菜单最大高度，超出滚动
 *  radioStyle {string} 单选标记 dot/check，默认 dot
 *  checkPosition {string} 选中标记列 start/end，默认 start
 *  checkIcon {string|function} 勾选图标：已注册的图标名或图标模板函数，空则用内置
 *  searchable {boolean} 是否在菜单顶部显示搜索框，按 text/label 过滤菜单项，默认 false
 *  searchPlaceholder {string} 搜索框占位文字，默认「搜索」
 *  emptyText {string} 搜索无结果时显示的提示，默认「无匹配项」
 *  offset {number} 面板与触发元素之间的间距（px），按 placement 方向自动加在靠近触发元素的一侧
 *  menuVars {object} 透传给 ce-menu 的 CSS 变量（如 --menu-radius），覆盖内置默认
 *
 * @events
 *  select({item,index,el}) 菜单项选中时触发
 *  hover({item,index,el}) 菜单项悬浮时触发
 *  close() 关闭时触发
 *  open() 打开时触发
 * @slots
 *  trigger 触发菜单的元素
 *
 * @author holyhigh2
 */
@emits('select', 'hover', 'open', 'close')
@tag('ce-dropdown')
export class Dropdown extends CompElem {

  @query('ce-overlay')
  overlay: Overlay

  //////////////////////////////////// props
  @prop hideOnClick = true
  @prop theme = "light"
  @prop trigger = "hover"
  @prop placement = "bottom-end"
  @prop({ type: [Number, String] }) width: number | string = ""
  @prop({ type: String }) minWidth = ""
  @prop({ type: String }) maxHeight = ""
  @prop({ type: String }) radioStyle = "dot"
  @prop({ type: String }) checkPosition = "start"
  @prop({ type: [String, Function] }) checkIcon: string | (() => Template) = ""
  @prop({ type: Boolean }) searchable = false
  @prop({ type: String }) searchPlaceholder = "搜索"
  @prop({ type: String }) emptyText = "无匹配项"
  @prop({ type: Number }) offset = 0
  @prop({ type: Object }) menuVars: Record<string, string> | null = null
  @prop({ type: Array, required: true }) items: Array<any> = []

  //////////////////////////////////// state
  /** 是否已首次打开；菜单采用 Select.firstPopup 同款懒渲染——
   * 若随模板初始渲染，会在 Overlay 搬移 slot 内容时打断其初始化 */
  @state opened = false
  /** items 运行期变更计数：ce-menu 的 items 绑定需要整对象替换才会刷新 */
  @state rev = 0
  /** 搜索关键字 */
  @state query = ""
  /** Overlay 的 open 桥接会触发两次；按「每次打开派发一次」去重，关闭时复位 */
  openNotified = false
  /** 点触发器收起时吞掉紧随其后的 mousedown/click，避免 Overlay 再次打开 */
  skipTriggerOpen = false

  //////////////////////////////////// computed
  /** 过滤后的原始项：select/hover 回查用它，不能用展示项的下标 */
  get visibleItems(): Array<any> {
    const items = this.items ?? []
    if (!this.searchable) return items
    this.query
    const q = this.query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      if (it == null) return false
      const text = isString(it) ? it : (it.text ?? it.label ?? "")
      return String(text).toLowerCase().includes(q)
    })
  }
  /** items → ce-menu items（string 视为纯文本项，null 保留为分割线） */
  get menuItems(): Array<any> {
    this.rev
    const list = this.visibleItems
    if (this.searchable && this.query.trim() && list.length === 0) {
      return [{
        custom: () => `<span style="display:block;font-size:12px;line-height:18px;color:var(--menu-fg-muted)">${escapeHtml(this.emptyText)}</span>`,
        disabled: true,
        placeholder: true
      }]
    }
    return map<any, any>(list, (it) => {
      if (it == null) return null
      if (isString(it)) return { text: it }
      return { ...it, text: it.text ?? it.label }
    })
  }
  /** 面板与触发元素之间的间距，加在靠近触发元素的一侧 */
  get offsetStyle(): Record<string, string> {
    if (!this.offset) return {}
    return this.placement.startsWith("top")
      ? { "padding-bottom": this.offset + "px" }
      : { "padding-top": this.offset + "px" }
  }
  /** Overlay 的 width 只管到内容容器，菜单本身仍要 min-width 才能铺满面板 */
  get menuMinWidth(): string {
    if (this.minWidth) return this.minWidth
    const width = this.width
    if (width === "" || width == null) return "10rem"
    const n = Number(width)
    if (isFinite(n)) return n > 0 ? `${n}px` : "10rem"
    return String(width)
  }
  /** ce-menu 会被 Overlay 搬进自己的 shadow 树，宿主样式不再命中，表面参数只能内联 */
  get menuStyleVars(): Record<string, string> {
    return {
      // 描边必须走可主题化的 --ce-menu-ring：写死黑 6% 在深色主题里是黑叠黑，
      // 菜单与页面糊成一片。深色主题把它置为透明，改由 --ce-shadow-md 里的
      // 白色描边环（--ce-shadow-ring）承担边界，避免两层描边叠加发白。
      "--menu-shadow": "var(--ce-menu-ring, 0 0 0 1px rgb(0 0 0 / 0.06)), var(--ce-shadow-md)",
      "--menu-radius": "var(--ce-round-md, 0.5rem)",
      ...(this.menuVars ?? {}),
    }
  }

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      /* inline-flex 让触发元素作为宿主的 flex 子项，避免 inline-block 的行盒基线抬升 */
      ce-dropdown {
        display: inline-flex;
        position: relative;
      }
    `;
  }

  @watch('items', { deep: true })
  onItemsChange() {
    this.rev++
  }

  //////////////////////////////////// render
  render(): Template {
    return h`
    <nav class="ce-dropdown">
      <ce-overlay close-on-click backdrop="false" esc placement="${this.placement}" width="${this.width}" auto-active trigger-mode="${this.trigger}" @open="${this.onOverlayOpen}" @close="${this.onOverlayClose}">
        <slot name="trigger" slot="trigger"></slot>
        ${ifTrue(this.opened, () => h`
        <div class="ce-dropdown__panel" ${styles(this.offsetStyle)}>
          <ce-menu inline round keyboard
            theme="${this.theme}"
            min-width="${this.menuMinWidth}"
            maxHeight="${this.maxHeight}"
            radioStyle="${this.radioStyle}"
            checkPosition="${this.checkPosition}"
            .checkIcon="${this.checkIcon}"
            .items="${this.menuItems}"
            @select="${this.onSelect}"
            @hover="${this.onHover}"
            @escape="${this.onEscape}"
            ${styles(this.menuStyleVars)}
          >
            ${ifTrue(this.searchable, () => h`
            <div slot="header" class="ce-dropdown__search" ${styles({
              padding: "2px 4px 5px",
              // 与下方菜单项之间加一条分隔线；复用菜单自身的边框色，暗色主题自动适配
              "border-bottom": "1px solid var(--menu-border, rgb(var(--ce-color-border-rgb) / 0.6))",
            })}>
              <div class="ce-dropdown__search-box" ${styles({
                "box-sizing": "border-box",
                height: "30px",
                padding: "0 8px",
                display: "flex",
                "align-items": "center",
                gap: "6px",
                "border-radius": "8px",
              })}>
                <ce-icon class="ce-dropdown__search-icon" .svg="${Search}" size="14" ${styles({ flex: "none", color: "var(--menu-fg-muted)" })}></ce-icon>
                <input class="ce-dropdown__search-input" type="text" placeholder="${this.searchPlaceholder}" @input="${this.onSearchInput}" ${styles({
                  flex: "1",
                  "min-width": "0",
                  padding: "0",
                  border: "0",
                  outline: "0",
                  background: "transparent",
                  color: "inherit",
                  font: "inherit",
                  "font-size": "12px",
                  "line-height": "18px",
                })}>
              </div>
              <style>.ce-dropdown__search-input::placeholder { color: var(--menu-fg-muted); }</style>
            </div>
            `)}
          </ce-menu>
        </div>
        `)}
      </ce-overlay>
    </nav>
    <slot style="display:none"></slot>
    `;
  }

//////////////////////////////////// lifecycles
  connectedCallback(): void {
    super.connectedCallback()
    // 收起判定必须先于 Overlay 的 trigger mousedown（它总会 openBy），
    // 故用 pointerdown 记录并关闭，再吞掉同一次手势的 mousedown/click
    document.addEventListener("pointerdown", this.onDocPointerDown, true)
    document.addEventListener("mousedown", this.onDocMouseDown, true)
    document.addEventListener("click", this.onDocClick, true)
  }
  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.onDocPointerDown, true)
    document.removeEventListener("mousedown", this.onDocMouseDown, true)
    document.removeEventListener("click", this.onDocClick, true)
    super.disconnectedCallback()
  }

//////////////////////////////////// methods
  /**
   * 触发元素常在多层 shadow 内，document 上读到的 `event.target` 会被重定向成最外层宿主，
   * `trigger.contains(target)` 永远为假 —— 只有 composedPath() 保留真实的命中路径。
   */
  #inTrigger(e: Event) {
    const trigger = this.overlay?.triggerEl
    if (!trigger) return false
    const path = typeof e.composedPath === "function" ? e.composedPath() : [e.target as EventTarget]
    return path.includes(trigger)
  }
  onDocPointerDown = (e: PointerEvent) => {
    if (this.trigger !== "click" || !this.#inTrigger(e)) return
    if (!this.overlay.__visible) {
      this.skipTriggerOpen = false
      return
    }
    this.skipTriggerOpen = true
    this.overlay.close(e)
  }
  onDocMouseDown = (e: MouseEvent) => {
    if (!this.skipTriggerOpen) return
    if (!this.#inTrigger(e)) {
      this.skipTriggerOpen = false
      return
    }
    e.stopPropagation()
  }
  onDocClick = (e: MouseEvent) => {
    if (!this.skipTriggerOpen) return
    if (!this.#inTrigger(e)) {
      this.skipTriggerOpen = false
      return
    }
    this.skipTriggerOpen = false
    e.stopPropagation()
  }
  onSearchInput(e: Event) {
    this.query = (e.target as HTMLInputElement).value
  }
  focusSearch(attempt: number) {
    const input = this.overlay?.renderRoot?.querySelector(".ce-dropdown__search-input") as HTMLInputElement | null
    if (!input) {
      if (attempt < 20) setTimeout(() => this.focusSearch(attempt + 1), 50)
      return
    }
    input.value = ""
    input.focus()
  }
  /**
   * 只补原生 DOM 通道：`emit()` 在没有 wrapperComponent 时会直接丢弃事件，
   * 而 ce-dropdown 既可能写在模板里（框架通道），也可能被命令式创建（原生监听）。
   * 两条通道的事件名由 @emits 统一约束。
   */
  #dispatch(name: string, arg: Record<string, any>) {
    this.dispatchEvent(
      new CustomEvent(name, { detail: arg, bubbles: false, composed: false, cancelable: true })
    )
  }
  onOverlayOpen(obj: Record<string, any>) {
    if (!this.opened) this.opened = true
    if (!this.openNotified) {
      this.openNotified = true
      const arg = {}
      this.emit('open', arg)
      this.#dispatch('open', arg)
    }
    if (this.searchable) {
      this.query = ""
      // hover 打开不抢焦点，避免扫过触发器就把光标吸进搜索框
      if (this.trigger !== "hover") this.focusSearch(0)
      return
    }
    // 键盘/点击打开的（焦点在触发元素内）把焦点移进菜单，方向键/回车/Esc 才能用；
    // hover 打开保持不聚焦，避免首行出现高亮态。
    const trigger = obj?.trigger as HTMLElement | undefined
    const active = document.activeElement
    if (!trigger || !active || !(trigger === active || trigger.contains(active))) return
    this.focusMenu(0)
  }
  focusMenu(attempt: number) {
    const menu = this.overlay?.renderRoot?.querySelector('ce-menu') as Menu | null
    const first = menu?.renderRoot?.querySelector('ul.ce-menu__list--root > li.ce-menu__item')
    if (!menu || !first) {
      if (attempt < 20) setTimeout(() => this.focusMenu(attempt + 1), 50)
      return
    }
    menu.focusFirst()
  }
  onOverlayClose() {
    if (this.searchable) {
      this.query = ""
      const input = this.overlay?.renderRoot?.querySelector(".ce-dropdown__search-input") as HTMLInputElement | null
      if (input) input.value = ""
    }
    // 收起上次打开时展开的子菜单：内联模式不能调用 menu.close()（它会写 left:-9999px），
    // setItems 会重置 expandedMap 与子层定位。
    const menu = this.overlay?.renderRoot?.querySelector('ce-menu') as Menu | null
    if (menu) menu.setItems(menu.getItems())
    this.openNotified = false
    this.emit('close', {})
    this.#dispatch('close', {})
  }
  onEscape() {
    this.overlay?.close()
  }
  onHover(obj: Record<string, any>) {
    const { item, index } = resolveOriginalItem(this.visibleItems, obj.path)
    const arg = { item, index, el: obj.el }
    this.emit('hover', arg as any)
    this.#dispatch('hover', arg)
  }
  onSelect(obj: Record<string, any>) {
    const { item, index } = resolveOriginalItem(this.visibleItems, obj.path)
    if (item?.placeholder) return
    const arg = { item, index, el: obj.el }
    this.emit('select', arg as any)
    this.#dispatch('select', arg)
    // 先派发 select 再关闭，事件顺序与主流库一致（选择 → 收起）
    if (this.hideOnClick) {
      this.overlay.close()
    }
  }
  setItems(items: any[]) {
    // 整数组替换：in-place 变更依赖深层 watch，而 prop 数组不保证被包裹成响应式，
    // 菜单的 items 绑定也就不会刷新。props 由外部单向传入，组件内只能走 updateProps。
    this.updateProps({ items: [...items] })
  }
  getItems() {
    return this.items
  }
}
