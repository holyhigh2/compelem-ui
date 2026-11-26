import { classes, csscope, Csscope, emits, forEach, h, html, ifTrue, prop, state, styles, tag, Template, watch } from 'compelem'
import { each, find, size } from 'myfx'
import { beginPointerDrag, elementRect, newResizable, type Resizable } from 'uiik'
import { ParentPortal } from './ParentPortal'
import { makePortalItemId, parseWidgetSize, widgetKey } from './layout'
import type { LayoutItem } from './layout'
import { PortalItem } from './PortalItem'
import portalStyle from './portal.scss?tmpl'

// 编辑态 item 是 light DOM 节点，由本入口自带注册（消费方 import 'ce-portal-editor' 即可）
if (typeof customElements !== 'undefined' && !customElements.get('ce-portal-item')) {
  customElements.define('ce-portal-item', PortalItem)
}

interface DropHint {
  col: number
  row: number
  w: number
  h: number
  invalid: boolean
}

/** 一次拖拽会话的载荷（新拖入 / 移动已有卡片） */
interface DragPayload {
  kind: 'new' | 'move'
  /** 挂件类型键（`new` 时用于建 item） */
  key: string
  /** 移动中的 item id（`new` 时为空串） */
  id: string
  w: number
  h: number
}

/**
 * 门户编辑器（视图 + 侧边挂件库 + 拖拽/缩放）
 *
 * 宿主必须有一个确定的高度（自身 `height`，或父容器给了确定高度）：
 * 占位单元格按容器高度铺满画布，高度不定时画布就只剩内容那一块。
 *
 * @attrs
 *  widgets {array} 挂件库 [{id,title,size:'1-2',group,resizable,configurable,minSize,maxSize,img?,preview?}]
 *                  img 可选，挂件库条目的预览插画（URL，优先于 preview）
 *                  preview 可选，挂件库条目的演示快照 HTML（受信内容，img 缺省时退化使用）
 *  layout {object} 当前布局
 *  columns {number} 列数；开启 `min-column-width` 后是**列数下限**
 *  minColumnWidth {number} 每列最小宽度（px），>0 时按容器宽度提升列数
 *  maxColumns {number} 自适应列数上限
 *  rowHeight {number} 行高
 *  gap {number} 间距
 *  maxWidgets {number} 挂件上限，0 不限
 * @events
 *  append({el,item,widget,bind}) 挂件首次出现，宿主向 el 写入内容
 *  change({layout}) 新增/移动/缩放/移除后触发
 *  config({item,widget}) 点击挂件配置按钮
 */
@emits('append', 'change', 'config')
@tag('ce-portal-editor')
export class PortalEditor extends ParentPortal {

  // 重新声明以触发 compelem 的属性表继承合并（同旧实现）
  @prop widgets: any[] = []

  @state hint: DropHint | null = null
  @state resizing: { id: string; w: number; h: number } | null = null
  @state dragging = false
  /**
   * 拖拽期间画布额外铺的行数（起拖 6 行，指针压到底边时继续往下长）：
   * 静态不留落白，靠它把"能放到更靠下的位置"这件事交回拖拽会话自己负责。
   */
  @state dragRows = 0
  /** 视口可容纳的网格行数（驱动占位单元格层数），随容器尺寸变化 */
  @state __cellViewportRows = 0
  __cellRo: ResizeObserver | null = null
  __cellCache: { cols: number; rows: number; list: Array<{ key: string; col: number; row: number }> } | null = null

  /**
   * 当前拖拽会话：
   * 走 uiik `beginPointerDrag`（`mousedown` + 阈值 → `document.mousemove` 驱动），
   * 不用原生 HTML5 DnD —— 原生拖拽会话里浏览器把指针交给拖放机制，
   * `wheel` 不派发、滚动条也拖不动，只能靠"贴边自动滚动 + 画布变长"绕过去；
   * 指针拖拽下滚轮与滚动条都是浏览器原生行为，落点还能用连续坐标自己算。
   */
  __drag: DragPayload | null = null
  /** 会话 cleanup（调用即取消），由 `beginPointerDrag` 返回 */
  __dragCleanup: (() => void) | null = null
  /** 浮动拖拽图（挂在 body 上，避免被模板重渲染回收） */
  __ghostEl: HTMLElement | null = null
  /** 最近一次指针位置：边缘自动滚动时指针不动，靠它重算落点保持跟手 */
  __lastClient: { x: number; y: number } | null = null
  /**
   * 指针是否落在画布视口内（uiik 的 `onMove(hit)` 通道维护）。
   * 落点提示只在「进入画布」后出现 —— 在挂件库里按下并拖动时不该提前亮出放置范围，
   * 离开画布后也要立刻收起。
   */
  __overCanvas = false
  /** 会话期间的 Esc 取消（原生 DnD 自带，指针拖拽要自己补） */
  __escHandler: ((e: KeyboardEvent) => void) | null = null
  /** 编辑态 item 节点（light DOM 子元素）：item id → ce-portal-item */
  #itemEls = new Map<string, HTMLElement>()
  __pointerCleanup: (() => void) | null = null
  // 拖拽/缩放时的边缘自动滚动（行数超一屏后，视口外的行才能到达）
  __autoScrollSpeed = 0
  __autoScrollRaf = 0
  /** 自动延伸画布的节流帧计数（见 __maybeAutoScroll） */
  __growFrames = 0
  /** 挂件库面板宽度（可拖拽调宽，200-360），经 cssVars 下发 */
  @state paletteWidth = 210
  __paletteResize: Resizable | null = null

  @csscope(Csscope.INNER)
  static get css() {
    return [portalStyle]
  }

  /** 绑定给 light DOM 事件的原生监听器（箭头函数保住 this） */
  __onItemConfig = (e: Event) => this.onItemConfig(e)
  __onItemRemove = (e: Event) => this.onItemRemove(e)
  __onItemResize = (e: Event) => this.onItemResize(e)

  get cssVars() {
    return {
      '--portal-gap': `${this.gap || 0}px`,
      '--portal-columns': `${this.__effectiveCols()}`,
      '--portal-row-height': `${Math.max(1, this.rowHeight || 1)}px`,
      '--portal-palette-width': `${this.paletteWidth}px`,
    }
  }

  //////////////////////////////////// computed
  get paletteGroups(): Array<{ label: string; list: any[] }> {
    const groups: Array<{ label: string; list: any[] }> = []
    const index: Record<string, any[]> = {}
    each(this.widgets || [], (w: any) => {
      const key = widgetKey(w)
      if (!key) return
      // 不可用（无权限 / 已下线）的挂件不进挂件库：拖进来也只能渲染占位，
      // 而且会让用户误以为"配置完就能用"。它仍然留在 widgetMap 里 —— 布局里
      // 已有的那张卡片要靠声明来显示标题与占位文案。
      if (w.available === false) return
      const s = parseWidgetSize(w.size)
      // 没有分组时按尺寸归组；与条目上的文案保持一致（宽 × 高）
      const label = String(w.group || `${s.w} × ${s.h}`)
      if (!index[label]) {
        index[label] = []
        groups.push({ label, list: index[label] })
      }
      index[label].push(w)
    })
    return groups
  }

  //////////////////////////////////// 撤销 / 重做
  /**
   * 一次用户操作 = 一条历史（新增 / 移动 / 缩放 / 移除都在 `__commit` 前压栈）。
   *
   * 栈属于**编辑会话的临时态**：不经过宿主、不落盘，刷新即清空。
   * 持久化的撤销（版本历史、回滚）是另一层能力，由宿主与服务端负责。
   */
  #undoStack: LayoutItem[][] = []
  #redoStack: LayoutItem[][] = []

  @state canUndo = false
  @state canRedo = false

  __snapshot(): LayoutItem[] {
    return this.items.map((it) => ({
      ...it,
      ...(it.config ? { config: JSON.parse(JSON.stringify(it.config)) } : {}),
    }))
  }

  /** 所有会改变布局的提交都走这里：先记历史，再走基类的归一化与 change 广播 */
  __commitWithHistory(next: LayoutItem[]) {
    this.#undoStack.push(this.__snapshot())
    if (this.#undoStack.length > 50) this.#undoStack.shift()
    // 新分支：重做栈作废（与编辑器通用语义一致）
    this.#redoStack.length = 0
    this.__commit(next)
    this.__syncHistory()
  }

  __syncHistory() {
    this.canUndo = this.#undoStack.length > 0
    this.canRedo = this.#redoStack.length > 0
  }

  onUndo() {
    const prev = this.#undoStack.pop()
    if (!prev) return
    this.#redoStack.push(this.__snapshot())
    this.__commit(prev)
    this.__syncHistory()
  }

  onRedo() {
    const next = this.#redoStack.pop()
    if (!next) return
    this.#undoStack.push(this.__snapshot())
    this.__commit(next)
    this.__syncHistory()
  }

  /**
   * 快捷键：Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做。
   * 拖拽 / 缩放进行中忽略（此时布局处于临时态，撤销会把会话打乱）。
   */
  __onKeydown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    if (this.dragging || this.resizing) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    const key = e.key.toLowerCase()
    if (key === 'z') {
      e.preventDefault()
      if (e.shiftKey) this.onRedo()
      else this.onUndo()
    } else if (key === 'y') {
      e.preventDefault()
      this.onRedo()
    }
  }

  //////////////////////////////////// lifecycles
  mounted(): void {
    this.__bindItemEvents()
    this.__initPortal()
    this.__measureCells()
    document.addEventListener('keydown', this.__onKeydown)
    // 容器尺寸变化时重算视口行数（占位单元格层数）
    const main = this.__scrollEl()
    if (main && typeof ResizeObserver !== 'undefined') {
      this.__cellRo = new ResizeObserver(() => this.__measureCells())
      this.__cellRo.observe(main)
    }
    // 挂件库面板拖拽调宽（uiik resizable，参照 report-builder DesignCanvas 的用法）
    const palette = this.renderRoot?.querySelector('.ce-portal-palette') as HTMLElement | null
    const handle = this.renderRoot?.querySelector('.ce-portal-palette-resizer') as HTMLElement | null
    if (palette && handle) {
      this.__paletteResize = newResizable(palette, {
        handle,
        minSize: [200, 1],
        maxSize: [360, 2000],
        onEnd: ({ w }: { w: number }) => {
          this.paletteWidth = w
        },
      })
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener('keydown', this.__onKeydown)
    this.__unbindItemEvents()
    this.__pointerCleanup?.()
    this.__dragCleanup?.()
    this.__resetDrag()
    this.__cellRo?.disconnect()
    this.__cellRo = null
    this.__paletteResize?.destroy()
    this.__paletteResize = null
  }

  /** item 的事件来自 light DOM（跨 shadow，用原生 CustomEvent 冒泡上来） */
  __bindItemEvents() {
    this.addEventListener('portal-item-config', this.__onItemConfig)
    this.addEventListener('portal-item-remove', this.__onItemRemove)
    this.addEventListener('portal-item-resize', this.__onItemResize)
  }

  __unbindItemEvents() {
    this.removeEventListener('portal-item-config', this.__onItemConfig)
    this.removeEventListener('portal-item-remove', this.__onItemRemove)
    this.removeEventListener('portal-item-resize', this.__onItemResize)
  }

  /**
   * 按容器可用高度算视口能容纳的行数。
   *
   * 可用高度必须扣掉滚动容器的上下内边距：占位单元格撑起的画布高度会原样进
   * `clientHeight`，把 padding 留在里面就等于每轮多算一行，宿主没给确定高度时
   * 画布会被自己越顶越高（行数 → 画布高 → clientHeight → 行数）。
   * 扣掉之后换算是幂等的：画布成为最高元素时 `可用高度 == 画布高度`，行数收敛。
   */
  __measureCells() {
    const main = this.__scrollEl()
    if (!main) return
    const gap = this.gap || 0
    const step = Math.max(1, this.rowHeight || 1) + gap
    const cs = getComputedStyle(main)
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
    const avail = Math.max(0, main.clientHeight - pad)
    const rows = avail > 0 ? Math.max(0, Math.ceil((avail + gap) / step)) : 0
    if (rows !== this.__cellViewportRows) this.__cellViewportRows = rows
  }

  /**
   * 画布当前铺了几行占位单元格。行数**由内容驱动、没有上限**：
   * 挂件堆到第 30 行画布就铺到第 30 行，多屏是自然结果，不是固定网格。
   *
   * 静态只铺到「盖住视口」（ceil）与「内容底边」为止，不留落白 ——
   * 早先固定 +2 行会让内容不足一屏的画布凭空长出 206px，浏览器据此画出滚动条。
   * 拖拽时才有落白，且落白恰好是「最高的那个挂件」的行数：
   * 内容下方要能再塞一个最高挂件，多一行浪费、少一行放不下。
   */
  __gridRows(): number {
    const extra = this.dragging ? Math.max(this.__maxWidgetRows(), this.dragRows) : 0
    return Math.max(this.__cellViewportRows, this.__contentRows()) + extra
  }

  /** 内容底边所在行（最高一张卡片的 row + h） */
  __contentRows(): number {
    return this.items.reduce((m, it) => Math.max(m, it.row + it.h), 0)
  }

  /** 可用挂件里最高的行数 —— 拖拽落白的依据（见 __gridRows） */
  __maxWidgetRows(): number {
    let max = 1
    each(this.widgets || [], (w: any) => {
      if (!widgetKey(w)) return
      max = Math.max(max, parseWidgetSize(w.size).h)
    })
    return max
  }

  /**
   * 内容比视口少整整一行时，把画布高度锁在视口内并裁掉超出的那点（见 `.is-fit`）：
   * 行高固定，`ceil` 出来的最后一行总会比视口多出一截，不裁就只能靠滚动条消化。
   * 要求 `contentRows < viewportRows`（严格小于）才裁，否则最后一行上的卡片会被切到。
   */
  __isFit(): boolean {
    if (this.dragging) return false
    return this.__contentRows() <= this.__cellViewportRows - 1
  }

  /** 占位单元格坐标，带缓存避免拖拽中重复构建 */
  __cells(): Array<{ key: string; col: number; row: number }> {
    const cols = this.__effectiveCols()
    const rows = this.__gridRows()
    if (this.__cellCache && this.__cellCache.cols === cols && this.__cellCache.rows === rows) {
      return this.__cellCache.list
    }
    const list: Array<{ key: string; col: number; row: number }> = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) list.push({ key: c + '-' + r, col: c, row: r })
    }
    this.__cellCache = { cols, rows, list }
    return list
  }

  //////////////////////////////////// auto scroll（拖拽/缩放至容器上下边缘时自动滚动）
  __scrollEl(): HTMLElement | null {
    return (this.renderRoot?.querySelector('.ce-portal-main') as HTMLElement | null) || null
  }

  /** 指针距容器上/下边缘 <48px 时按距离比例滚动（越近越快，clamp ±14px/帧） */
  __maybeAutoScroll(clientY: number) {
    const el = this.__scrollEl()
    if (!el) return
    const rect = el.getBoundingClientRect()
    const threshold = 48
    let speed = 0
    if (clientY < rect.top + threshold) speed = -Math.ceil((rect.top + threshold - clientY) / 4)
    else if (clientY > rect.bottom - threshold) speed = Math.ceil((clientY - (rect.bottom - threshold)) / 4)
    this.__autoScrollSpeed = Math.max(-14, Math.min(14, speed))
    if (this.__autoScrollSpeed !== 0 && !this.__autoScrollRaf) {
      this.__autoScrollRaf = requestAnimationFrame(() => this.__autoScrollTick())
    }
  }

  __autoScrollTick() {
    if (!this.__autoScrollSpeed) {
      this.__autoScrollRaf = 0
      return
    }
    const el = this.__scrollEl()
    if (el) {
      el.scrollTop += this.__autoScrollSpeed
      // 已经滚到底还在往下拖：继续铺行，画布跟着变长（封顶 24 行，别无限涨）
      if (this.__autoScrollSpeed > 0 && this.dragging && this.__atBottom(el)) {
        if (++this.__growFrames >= 12 && this.dragRows < 24) {
          this.__growFrames = 0
          this.dragRows += 2
        }
      } else {
        this.__growFrames = 0
      }
      // 指针不动、容器在滚：不会再有 mousemove，靠记住的坐标重算落点保持跟手
      this.__syncHintAfterScroll()
    }
    this.__autoScrollRaf = requestAnimationFrame(() => this.__autoScrollTick())
  }

  __atBottom(el: HTMLElement): boolean {
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 2
  }

  __syncHintAfterScroll() {
    const p = this.__lastClient
    if (!p || !this.__drag || !this.__overCanvas) return
    this.__applyHint(this.__hintAt(p.x, p.y))
  }

  /** `null` = 收起提示（指针不在画布上 / 会话结束） */
  __applyHint(next: DropHint | null) {
    const cur = this.hint
    if (!cur && !next) return
    if (cur && next && cur.col === next.col && cur.row === next.row && cur.w === next.w && cur.h === next.h && cur.invalid === next.invalid) return
    this.hint = next
  }

  __stopAutoScroll() {
    this.__autoScrollSpeed = 0
    this.__growFrames = 0
    if (this.__autoScrollRaf) {
      cancelAnimationFrame(this.__autoScrollRaf)
      this.__autoScrollRaf = 0
    }
  }

  //////////////////////////////////// drag & drop
  __full() {
    return this.maxWidgets > 0 && size(this.items) >= this.maxWidgets
  }

  /**
   * 条目是否已达「同类上限」（宿主在挂件声明里给的 `maxCount`）。
   *
   * 与 `__full()` 的区别：`__full()` 是整块画布的配额，这里按 type 计数
   * （欢迎卡片 / 每日一句这类"一个人只要一张"的卡）。
   *
   * 达到上限时条目**置灰但仍显示** —— 藏起来会让人以为"没权限 / 没这个挂件"，
   * 那是 `available: false` 的语义，两者不能混。
   */
  __atLimit(w: any): boolean {
    const max = Number((w && w.maxCount) || 0)
    if (!(max > 0)) return false
    const key = widgetKey(w)
    let used = 0
    for (const item of this.items) if (item.type === key) used++
    return used >= Math.floor(max)
  }

  /** 挂件库条目的悬浮说明：达到上限时直接说清，不要让人白拖一次 */
  __paletteTitle(w: any): string {
    const title = String((w && w.title) || widgetKey(w) || '')
    if (this.__full()) return `${title}（挂件数量已达上限）`
    if (this.__atLimit(w)) {
      return `${title}（已达上限 ${Math.floor(Number(w.maxCount))} 张）`
    }
    return `${title}（拖到画布添加）`
  }

  /**
   * 新卡片的实例标题：与画布上已有标题重名时补序号（`列表挂件 2`），不重名返回空串。
   * 按**显示名**去重（同一 type 的两张卡若已被手动改成不同标题，不该再补序号）。
   */
  __newItemTitle(type: string): string {
    const base = this.widgetMap[type]?.title || type
    const used = new Set(this.items.map((it) => this.__titleOf(it)))
    if (!used.has(base)) return ''
    let n = 2
    while (used.has(`${base} ${n}`)) n += 1
    return `${base} ${n}`
  }

  /** 新建布局项：标题按 `__newItemTitle` 决定是否固化 */
  __newItem(type: string, col: number, row: number, w: number, h: number): LayoutItem {
    const title = this.__newItemTitle(type)
    return { id: makePortalItemId(), type, col, row, w, h, ...(title ? { title } : {}) }
  }

  //////////////////////////////////// 拖拽（uiik 指针拖拽，见 __drag 注释）
  /**
   * 挂件库条目起手：`mousedown` 即登记会话，位移越过阈值才算拖拽。
   *
   * 插入**只走拖放**：单击（位移未过阈值）不新增任何卡片，只把会话收干净。
   * `onClick` 通道仍要挂着 —— uiik 在未起拖的 `mouseup` 里不会回调
   * `onCancel/onEnd`，没有这一句 `__resetDrag()`，`__drag` 会一直留值，
   * 之后所有 mousedown 都会被 `if (this.__drag) return` 挡掉。
   */
  onPaletteMouseDown(e: MouseEvent) {
    if (e.button !== 0 || this.__drag) return
    const el = (e.target as HTMLElement | null)?.closest?.('.ce-portal-palette-item') as HTMLElement | null
    if (!el || el.classList.contains('is-disabled')) return
    const key = el.dataset.key || ''
    const widget = this.widgetMap[key]
    if (!widget) return
    const s = parseWidgetSize(widget.size)
    const w = Math.min(s.w, this.__effectiveCols())
    // 阻止默认：否则按住拖动会把面板文字一起选中（起拖后的选择状态收不回来）。
    // 按下位置在条目上而非按钮，不影响条目内任何控件的点击。
    e.preventDefault()
    this.__beginDrag(e, { kind: 'new', key, id: '', w, h: s.h }, this.__newItemTitle(key) || String(widget.title || key))
  }

  /**
   * 卡片起手：只有按在标题栏上才算拖拽（内容区留给挂件自己交互）。
   *
   * 判定全走 `composedPath()` —— 标题栏和按钮都在 `ce-portal-item` 的 shadow 里，
   * 冒泡到网格时 `target` 已被重定向成宿主，只有 path 还留着内部节点。
   * 这也顺手替掉了旧实现里"先记录 pointerdown 命中了谁、再在 dragstart 判定"的两段式守卫。
   */
  onGridMouseDown(e: MouseEvent) {
    if (e.button !== 0 || this.__drag) return
    const path = e.composedPath ? e.composedPath() : []
    const tagOf = (n: EventTarget) => (n as HTMLElement)?.tagName
    const hasClass = (n: EventTarget, c: string) => !!(n as HTMLElement)?.classList?.contains?.(c)
    const itemEl = path.find((n) => tagOf(n) === 'CE-PORTAL-ITEM') as HTMLElement | undefined
    if (!itemEl) return
    // 必须从标题栏起拖：按在挂件内容上不动卡片
    if (!path.some((n) => hasClass(n, 'ce-portal-item-bar'))) return
    // 配置/移除按钮与缩放手柄不是拖拽手柄
    if (path.some((n) => tagOf(n) === 'CE-BUTTON')) return
    if (path.some((n) => hasClass(n, 'ce-portal-item-resize'))) return
    const id = itemEl.dataset.itemId || ''
    const item = find(this.items, (it) => it.id === id)
    if (!item) return
    e.preventDefault()
    this.__beginDrag(e, { kind: 'move', key: item.type, id, w: item.w, h: item.h }, this.__titleOf(item))
  }

  __beginDrag(ev: MouseEvent, payload: DragPayload, label: string) {
    this.__dragCleanup?.()
    this.__drag = payload
    this.__overCanvas = false
    this.__lastClient = { x: ev.clientX, y: ev.clientY }
    this.__dragCleanup = beginPointerDrag<true>({
      ev,
      // 4px 起拖：比点击宽容一点，又不会"轻轻一碰就动"
      threshold: 4,
      /**
       * 命中区 = 画布视口本体，交给 uiik 判定「指针在不在画布上」（`onMove` 的 hit）。
       * 这里用 `.ce-portal-main` 而不用网格：uiik 的 targets 只在起拖时缓存一次，
       * 网格在容器内滚动时它的 rect 会跟着跑，缓存值随后就失效；
       * 视口自身滚动不改自己的矩形，整个会话内都能用。
       */
      targets: () => {
        const main = this.__scrollEl()
        return main ? [{ rect: elementRect(main), data: true }] : []
      },
      onStart: (e) => {
        this.dragging = true
        // 落白从「最高挂件」起：内容下方刚好能再放一个，不是拍脑袋的固定行数
        this.dragRows = this.__maxWidgetRows()
        this.__showGhost(label, e.clientX, e.clientY)
        this.__bindEsc()
      },
      onMove: (hit, e) => {
        this.__lastClient = { x: e.clientX, y: e.clientY }
        this.__moveGhost(e.clientX, e.clientY)
        // 还没进画布（仍在挂件库里）或已经离开：不亮放置范围，也不贴边滚动
        this.__overCanvas = hit !== null
        if (!hit) {
          this.__stopAutoScroll()
          this.__applyHint(null)
          return
        }
        this.__maybeAutoScroll(e.clientY)
        this.__applyHint(this.__hintAt(e.clientX, e.clientY))
      },
      onDrop: () => this.__dropAt(),
      // 单击不插入挂件，只收尾：见 `onPaletteMouseDown` 的注释（不挂这句会漏清 __drag）
      onClick: () => this.__resetDrag(),
      onCancel: () => this.__resetDrag(),
      // 内核的调用顺序是 onEnd 先于 onDrop：这里只收视觉，
      // 若把 dragging / __drag 一起清掉，紧接着的落点计算就会失效。
      onEnd: () => this.__teardownVisuals(),
    })
  }

  /**
   * 松开鼠标落位。落点严格以提示格为准（用户看到的就是它）——
   * 没有提示说明指针不在画布上，当作取消，不在别处凭空落一张卡片。
   */
  __dropAt() {
    const drag = this.__drag
    if (!drag) return
    const hint = this.hint
    const blocked = drag.kind === 'new' && (this.__full() || this.__atLimit(this.widgetMap[drag.key]))
    if (!hint || hint.invalid || blocked) {
      this.__resetDrag()
      return
    }
    if (drag.kind === 'new') {
      this.__commitWithHistory([...this.items, this.__newItem(drag.key, hint.col, hint.row, drag.w, drag.h)])
    } else {
      this.__commitWithHistory(this.items.map((it) => (it.id === drag.id ? { ...it, col: hint.col, row: hint.row } : it)))
    }
    this.__resetDrag()
  }

  //////////////////////////////////// 拖拽视觉（浮动标签 / Esc）
  /**
   * 拖拽图挂到 `body` 而不是 shadow：画布变长会重跑 render，
   * shadow 里手动插入的临时节点会被回收；样式全内联，不依赖 shadow 内的样式表。
   */
  __showGhost(label: string, x: number, y: number) {
    this.__destroyGhost()
    if (typeof document === 'undefined') return
    const el = document.createElement('div')
    el.className = 'ce-portal-drag-ghost'
    el.textContent = label
    el.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'z-index:2147483000',
      'pointer-events:none',
      'padding:5px 10px',
      'border-radius:8px',
      'background:#fff',
      'border:1px solid #d0d5dd',
      'box-shadow:0 6px 18px rgba(16,24,40,.16)',
      'font:500 12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif',
      'color:#344054',
      'white-space:nowrap',
      'transform:translate(12px,14px)',
    ].join(';')
    document.body.appendChild(el)
    this.__ghostEl = el
    this.__moveGhost(x, y)
  }

  __moveGhost(x: number, y: number) {
    const el = this.__ghostEl
    if (!el) return
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }

  __destroyGhost() {
    this.__ghostEl?.remove()
    this.__ghostEl = null
  }

  /** 原生 DnD 自带 Esc 取消，指针拖拽得自己补一个 */
  __bindEsc() {
    this.__unbindEsc()
    this.__escHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      // 调 cleanup = abort → onCancel → __resetDrag
      this.__dragCleanup?.()
    }
    window.addEventListener('keydown', this.__escHandler, true)
  }

  __unbindEsc() {
    if (!this.__escHandler) return
    window.removeEventListener('keydown', this.__escHandler, true)
    this.__escHandler = null
  }

  /** 只收视觉，**不要**在这里清 dragging / __drag（onEnd 先于 onDrop 执行） */
  __teardownVisuals() {
    this.__destroyGhost()
    this.__stopAutoScroll()
    this.__unbindEsc()
  }

  __resetDrag() {
    this.__teardownVisuals()
    this.__dragCleanup = null
    this.__drag = null
    this.__lastClient = null
    this.__overCanvas = false
    this.dragging = false
    this.dragRows = 0
    this.hint = null
  }

  //////////////////////////////////// remove / config
  removeWidget(id: string) {
    this.__commitWithHistory(this.items.filter((it) => it.id !== id))
  }

  /** 从 ce-portal-item 冒泡上来的事件里取 item id（target 已重定向为 item 宿主） */
  __itemIdFrom(e: Event): string {
    const el = (e.target as HTMLElement | null)?.closest?.('ce-portal-item') as HTMLElement | null
    return el?.dataset.itemId || ''
  }

  onItemRemove(e: Event) {
    const id = this.__itemIdFrom(e)
    if (id) this.removeWidget(id)
  }

  onItemConfig(e: Event) {
    const id = this.__itemIdFrom(e)
    const item = find(this.items, (it) => it.id === id)
    if (item) this.emit('config', { item, widget: this.__widgetOf(item) })
  }

  //////////////////////////////////// resize
  onItemResize(e: Event) {
    // 手柄在 ce-portal-item 的 shadow 内，起点坐标由它随事件带出
    const detail = (e as CustomEvent<{ clientX: number; clientY: number }>).detail || { clientX: 0, clientY: 0 }
    const itemId = this.__itemIdFrom(e)
    const item = itemId ? find(this.items, (it) => it.id === itemId) : undefined
    if (!item) return
    e.preventDefault()
    e.stopPropagation()

    const widget: any = this.__widgetOf(item) || {}
    const cols = this.__effectiveCols()
    const minW = Math.max(1, widget.minSize?.w ?? 1)
    const minH = Math.max(1, widget.minSize?.h ?? 1)
    const maxW = Math.min(cols - item.col, widget.maxSize?.w ?? cols)
    const maxH = Math.max(minH, widget.maxSize?.h ?? 99)
    const metrics = this.__metrics()
    const startX = detail.clientX
    const startY = detail.clientY

    this.resizing = { id: item.id, w: item.w, h: item.h }

    const move = (ev: PointerEvent) => {
      this.__maybeAutoScroll(ev.clientY)
      const dc = Math.round((ev.clientX - startX) / (metrics.cw + metrics.gap))
      const dr = Math.round((ev.clientY - startY) / (metrics.ch + metrics.gap))
      this.resizing = {
        id: item.id,
        w: Math.max(minW, Math.min(maxW, item.w + dc)),
        h: Math.max(minH, Math.min(maxH, item.h + dr)),
      }
    }

    const up = () => {
      cleanup()
      const cur = this.resizing
      this.resizing = null
      if (!cur) return
      if (cur.w === item.w && cur.h === item.h) return
      this.__commitWithHistory(this.items.map((it) => (it.id === item.id ? { ...it, w: cur.w, h: cur.h } : it)))
    }

    const cleanup = () => {
      this.__stopAutoScroll()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      this.__pointerCleanup = null
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    this.__pointerCleanup = cleanup
  }

  //////////////////////////////////// metrics
  // `__gridEl()` 在 `ParentPortal`（列数自适应与 `__metrics()` 共用同一个基准）
  __metrics(): { rect: DOMRect; cw: number; ch: number; gap: number } {
    const grid = this.__gridEl()
    const rect = grid?.getBoundingClientRect() || new DOMRect(0, 0, 0, 0)
    const cols = this.__effectiveCols()
    const gap = this.gap || 0
    const cw = rect.width > 0 ? (rect.width - gap * (cols - 1)) / cols : 1
    return { rect, cw: Math.max(1, cw), ch: Math.max(1, this.rowHeight || 1), gap }
  }

  __cellFromPoint(x: number, y: number, w: number, h: number): { col: number; row: number } {
    const m = this.__metrics()
    const cols = this.__effectiveCols()
    const col = Math.floor((x - m.rect.left) / (m.cw + m.gap))
    const row = Math.floor((y - m.rect.top) / (m.ch + m.gap))
    // 行必须落在已经铺好的单元格范围内：拖拽提示（ghost）是按 grid-row 定位的，
    // 一旦指到还不存在的行，grid 会为它生成隐式行 → 画布被 ghost 无限撑长，
    // 自动滚动随之失控（一直滚不到底）。
    const maxRow = Math.max(0, this.__gridRows() - Math.max(1, h))
    return {
      col: Math.min(Math.max(0, col), Math.max(0, cols - Math.max(1, w))),
      row: Math.min(Math.max(0, row), maxRow),
    }
  }

  __isFree(col: number, row: number, w: number, h: number, ignoreId?: string): boolean {
    const cols = this.__effectiveCols()
    if (col < 0 || row < 0 || col + w > cols) return false
    return !this.items.some(
      (it) => it.id !== ignoreId && col < it.col + it.w && it.col < col + w && row < it.row + it.h && it.row < row + h
    )
  }

  __hintAt(x: number, y: number): DropHint | null {
    const drag = this.__drag
    if (!drag) return null
    const w = drag.w
    const h = drag.h
    const cell = this.__cellFromPoint(x, y, w, h)
    const ignoreId = drag.kind === 'move' ? drag.id : undefined
    // 达到同类上限时整块画布都不可落：让落点提示直接变红，而不是松手才静默取消
    const atLimit = drag.kind === 'new' && this.__atLimit(this.widgetMap[drag.key])
    return {
      col: cell.col,
      row: cell.row,
      w,
      h,
      invalid: atLimit || !this.__isFree(cell.col, cell.row, w, h, ignoreId),
    }
  }

  //////////////////////////////////// view helpers
  __itemStyle(item: LayoutItem): Record<string, string> {
    const rs = this.resizing
    const w = rs && rs.id === item.id ? rs.w : item.w
    const h = rs && rs.id === item.id ? rs.h : item.h
    return {
      gridColumn: `${item.col + 1} / span ${Math.max(1, w)}`,
      gridRow: `${item.row + 1} / span ${Math.max(1, h)}`,
    }
  }

  __hintStyle(): Record<string, string> {
    const hint = this.hint
    if (!hint) return {}
    return {
      gridColumn: `${hint.col + 1} / span ${Math.max(1, hint.w)}`,
      gridRow: `${hint.row + 1} / span ${Math.max(1, hint.h)}`,
    }
  }

  /**
   * 挂件库条目上的尺寸文案。
   *
   * 挂件声明的 `size` 是「行-列」（`2-6` = 2 行 6 列），但给用户看的一律是
   * 「宽 × 高」—— 声明格式是内部约定，直接显示 `行 × 列` 会让人以为卡片是竖的。
   */
  __sizeText(widget: any): string {
    const s = parseWidgetSize(widget?.size)
    return `${s.w} × ${s.h}`
  }

  __canResize(item: LayoutItem): boolean {
    // 不可用挂件禁止缩放：尺寸约束（min/max）在服务端手里，客户端不该按缺失的
    // 元数据把它放开成整行宽。移动仍然允许 —— 用户要能把它挪开。
    if (!this.__isAvailable(item)) return false
    return (this.__widgetOf(item)?.resizable ?? true) !== false
  }

  __canConfig(item: LayoutItem): boolean {
    if (!this.__isAvailable(item)) return false
    return !!this.__widgetOf(item)?.configurable
  }

  ////////////////////////////////////
  // 挂件节点同步（keyed reconcile，与视图态同构）
  ////////////////////////////////////
  /**
   * 按 `items` 顺序维护 light DOM 里的 `ce-portal-item`。
   *
   * 与 `Portal.__syncView` 同构：节点按 id 复用，拖动 / 缩放只改定位与 class，
   * 不重建节点 —— 否则挂件内容会随旧节点一起丢掉，而 `__appended` 又会因节点变化
   * 反复触发 append。
   */
  __syncView(): void {
    const items = this.items
    const alive = new Set(items.map((it) => it.id))

    this.#itemEls.forEach((el, id) => {
      if (alive.has(id)) return
      el.remove()
      this.#itemEls.delete(id)
    })

    const ordered: HTMLElement[] = []
    for (const it of items) {
      let el = this.#itemEls.get(it.id)
      if (!el) {
        el = document.createElement('ce-portal-item')
        el.setAttribute('slot', 'items')
        this.#itemEls.set(it.id, el)
      }
      ordered.push(el)
    }

    if (!this.__isInOrder(ordered)) {
      for (const el of ordered) this.appendChild(el)
    }

    // 必须在**连接之后**写 prop：内核的 prop 通道要等组件初始化
    // （`__propDefs` 建立）才可用，未连接时赋值只会落在实例字段上，
    // 首次渲染读到的仍是默认值（表现为标题栏空白）。
    for (const it of items) {
      this.__patchItem(this.#itemEls.get(it.id) as HTMLElement, it)
    }
  }

  __contentNodes(): HTMLElement[] {
    return Array.from(this.#itemEls.values())
  }

  __patchItem(el: HTMLElement, it: LayoutItem): void {
    if (el.dataset.portalId !== it.id) el.dataset.portalId = it.id
    if (el.dataset.itemId !== it.id) el.dataset.itemId = it.id
    // prop 必须走 updateProps：元素在连接前 `el.title = x` 只写实例字段，
    // 不经过内核的 prop 通道，首次渲染读到的仍是默认值（表现为标题栏空白）。
    const anyEl = el as any
    const title = this.__titleForChrome(it)
    if (anyEl.title !== title) anyEl.updateProps?.({ title })
    const canConfig = this.__canConfig(it)
    if (anyEl.configurable !== canConfig) anyEl.updateProps?.({ configurable: canConfig })
    const canResize = this.__canResize(it)
    if (anyEl.resizable !== canResize) anyEl.updateProps?.({ resizable: canResize })
    const denied = !this.__isAvailable(it)
    if (anyEl.denied !== denied) anyEl.updateProps?.({ denied })
    const deniedText = this.__deniedTextOf(it)
    if (anyEl.deniedText !== deniedText) anyEl.updateProps?.({ deniedText })
    el.classList.toggle('is-resizing', !!this.resizing && this.resizing.id === it.id)
    el.classList.toggle('is-moving', this.__drag?.kind === 'move' && this.__drag.id === it.id)
    // 网格定位：resize 过程中用 resizing 的临时跨度（见 __itemStyle）
    const st = this.__itemStyle(it)
    el.style.gridColumn = st.gridColumn
    el.style.gridRow = st.gridRow
  }

  /** 交互状态只影响 class 与跨度，重跑一次同步即可（节点复用，不会重建） */
  @watch(['resizing', 'dragging'])
  watchInteraction() {
    this.__syncView()
  }

  //////////////////////////////////// render
  render(): Template {
    return h`
      <ce-container class="ce-portal-editor">
        <ce-aside class="ce-portal-palette" width="${this.paletteWidth + 'px'}" @mousedown="${this.onPaletteMouseDown}">
          <div class="ce-portal-palette-head">
            <span>挂件库</span>
            <span class="ce-portal-history">
              <button class="ce-portal-history-btn" title="撤销 (Ctrl+Z)" ?disabled="${!this.canUndo}" @click="${this.onUndo}">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
                     stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3.5 7.5h6.2a3.3 3.3 0 0 1 0 6.6H6"></path>
                  <path d="M6 4.5 3 7.5l3 3"></path>
                </svg>
              </button>
              <button class="ce-portal-history-btn" title="重做 (Ctrl+Shift+Z)" ?disabled="${!this.canRedo}" @click="${this.onRedo}">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
                     stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12.5 7.5H6.3a3.3 3.3 0 0 0 0 6.6H10"></path>
                  <path d="M10 4.5 13 7.5l-3 3"></path>
                </svg>
              </button>
            </span>
          </div>
          ${forEach(this.paletteGroups, (g) => g.label, (g) => h`
            <div class="ce-portal-palette-group">
              <div class="ce-portal-palette-label">${g.label}</div>
              ${forEach(g.list, (w: any) => widgetKey(w), (w: any) => h`
                <div ${classes({
                  'ce-portal-palette-item': true,
                  'has-preview': !!(w.img || w.preview),
                  // 达到上限：置灰不可再添加。两种上限分开判 ——
                  //  `__full()` 是整块画布配额，`__atLimit()` 是宿主给的单类上限
                  //  （欢迎卡片 / 每日一句这类"一个人只要一张"的卡）。
                  // 同类型可以摆多张的挂件（如两个列表挂件取不同数据源）不受影响。
                  'is-disabled': this.__full() || this.__atLimit(w),
                })}
                     data-key="${widgetKey(w)}"
                     title="${this.__paletteTitle(w)}">
                  ${ifTrue(!!w.img || !!w.preview, () => h`
                    <div class="ce-portal-palette-preview">
                      ${ifTrue(w.img, () => h`
                        <div class="ce-portal-palette-img" style="background-image:url('${w.img}')"></div>
                      `)}
                      ${ifTrue(!w.img && w.preview, () => h`
                        <div class="ce-portal-palette-preview-inner">${html(w.preview)}</div>
                      `)}
                    </div>
                  `)}
                  <div class="ce-portal-palette-meta">
                    <span class="ce-portal-palette-name">${w.title}</span>
                    <span class="ce-portal-palette-size">${this.__sizeText(w)}</span>
                  </div>
                </div>
              `)}
            </div>
          `)}
        </ce-aside>
        <div class="ce-portal-palette-resizer uii-resizable-handle uii-resizable-handle-e" title="拖拽调整面板宽度"></div>
        <ce-main class="ce-portal-main">
          <div ${classes({ 'ce-portal-grid': true, 'is-editor': true, 'is-dragging': this.dragging, 'is-fit': this.__isFit() })}
               @mousedown="${this.onGridMouseDown}">
            ${forEach(this.__cells(), (c) => c.key, (c) => h`
              <div class="ce-portal-cell" ${styles({ 'grid-column': String(c.col + 1), 'grid-row': String(c.row + 1) })}></div>
            `)}
            <slot name="items"></slot>
            ${ifTrue(!!this.hint, () => h`
              <div ${classes({ 'ce-portal-ghost': true, 'is-invalid': this.hint ? this.hint.invalid : false })} ${styles(this.__hintStyle())}></div>
            `)}
          </div>
        </ce-main>
      </ce-container>
    `
  }
}
