import { CompElem, emits, prop, state, watch } from 'compelem'
import { each } from 'myfx'
import { layoutFromWidgets, normalizeLayout, resolveColumns, widgetKey } from './layout'
import type { LayoutItem } from './layout'

/**
 * 门户基类（视图态 / 编辑态共享的布局与内容同步逻辑）
 *
 * 数据流：
 *  `layout`（受控布局，可空）→ `items`（内部有效布局）→ `__syncView()` 把 items 落成真实节点
 *  → 每个挂件经 `append` 事件交给宿主填充内容（宿主负责挂件 HTML）
 *
 * 挂件节点归属（两态各自的 `__syncView` 决定）：
 *  - 视图态 `Portal`：挂件是**本组件 light DOM 的子元素**，经命名 slot 投影进 grid，
 *    因此挂件内容的样式由上层（宿主）的样式表直接命中，无需把样式表传进 shadow；
 *  - 编辑态 `PortalEditor`：item 的 chrome 由模板声明式渲染（标题栏/按钮/手柄），
 *    这里默认不做节点同步。
 *
 * 事件：
 *  - append({el,item,widget,bind})  某个挂件首次出现时触发；el 为可写入内容的宿主元素
 *
 * @attrs
 *  widgets {array} 挂件数组 [{id,title,size:'1-2',group?,resizable?,configurable?,minSize?,maxSize?,available?,deniedText?}]
 *      `available: false` 表示该挂件当前不可用（无权限 / 已下线）：不触发 append、
 *      渲染占位、编辑态禁止缩放与配置。布局项**不因此被删除**。
 *  layout {object} 布局 {version,columns,items:[{id,type,col,row,w,h}]}
 *  columns {number} 列数。开启 `minColumnWidth` 后它是**下限**：实际渲染列数取
 *      `max(columns, 按 minColumnWidth 算出的列数)`（见 `__effectiveCols()`）
 *  minColumnWidth {number} 每列最小宽度（px），>0 时按容器实测宽度提升列数；0 = 关闭
 *  maxColumns {number} 自适应列数上限
 *  rowHeight {number} 行高
 *  gap {number} 单元格间距
 *  maxWidgets {number} 挂件数量上限，0 表示不限
 *
 * 注意：本类**不再接收挂件内容样式**。挂件节点由 `__syncView()` 落在本组件的 light DOM，
 * 位置在上层组件的 shadow 树内，样式由上层自己的样式表命中即可。
 */
@emits('append', 'change')
export class ParentPortal extends CompElem {

  @prop({ type: Number, converter: (v: any) => parseInt(v, 10) }) gap = 10
  /**
   * 声明列数。
   *
   * 开启 `minColumnWidth` 后它是**列数下限**而不是定值 —— 见 `__effectiveCols()`。
   */
  @prop({ type: Number, converter: (v: any) => parseInt(v, 10) }) columns = 12
  @prop({ type: Number, converter: (v: any) => parseInt(v, 10) }) rowHeight = 100
  @prop({ type: Number, converter: (v: any) => parseInt(v, 10) }) maxWidgets = 0
  /**
   * 每列最小宽度（px）。> 0 时按容器实测宽度提升列数：容器越宽，能摆的挂件越多。
   * 0 = 关闭自适应（列数恒为 `columns`，旧行为）。
   */
  @prop({ type: Number, converter: (v: any) => parseInt(v, 10) }) minColumnWidth = 0
  /** 自适应列数上限 —— 防超宽屏把卡片切得过细 */
  @prop({ type: Number, converter: (v: any) => parseInt(v, 10) }) maxColumns = 24
  @prop({ type: Array }) widgets: any[] = []
  @prop({ type: Object }) layout: any = null

  @state items: LayoutItem[] = []
  /** 网格实测宽度（ResizeObserver 维护）；0 = 尚未测量，此时按 `columns` 兜底 */
  @state __gridWidth = 0
  /** 列数自适应的观察器 */
  __colsRo: ResizeObserver | null = null

  /** type → 挂件声明 */
  widgetMap: Record<string, any> = {}
  /**
   * 已填充过内容的挂件：id → 承载内容的节点。
   * 记的是**节点身份**而不只是 id：节点被重建（换了一棵树 / 被复用成别的 item）时必须重新
   * 触发 append，否则新节点永远拿不到内容，表现为"白卡"。
   */
  __appended = new Map<string, HTMLElement>()
  __appendRaf = 0

  //////////////////////////////////// watchers
  @watch('widgets', { immediate: true })
  watchWidgets(nv: any[]) {
    const map: Record<string, any> = {}
    each(nv || [], (w: any) => {
      const key = widgetKey(w)
      if (key) map[key] = w
    })
    this.widgetMap = map
    // 没有显式布局时，widgets 即"要显示的挂件"（旧用法）
    if (!this.layout) this.__applyProps()
  }

  @watch(['layout', 'columns', 'maxWidgets'], { immediate: true })
  watchLayout() {
    this.__applyProps()
  }

  @watch('items')
  watchItems() {
    this.__scheduleAppend()
  }

  //////////////////////////////////// lifecycles
  mounted(): void {
    this.__initPortal()
  }

  __initPortal() {
    this.__scheduleAppend()
    this.__observeCols()
  }

  /**
   * 观测网格实际宽度，驱动列数自适应。
   *
   * 观测的是网格自己而不是宿主：编辑态的网格被挂件库面板挤过，宽度与宿主不同，
   * 而列宽的计算基准（`PortalEditor.__metrics()`）取的也是网格 —— 两者必须是同一个数。
   * 观测自身是安全的：网格宽度由父容器决定，列数变化不会反过来改变它。
   */
  __observeCols() {
    if (this.__colsRo || typeof ResizeObserver === 'undefined') return
    const grid = this.__gridEl()
    if (!grid) return
    // 先同步测一次：否则首帧按 `columns` 铺，等 RO 回调再跳一档，会看见布局闪一下
    this.__gridWidth = grid.getBoundingClientRect().width || 0
    this.__colsRo = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0
      if (!width || Math.abs(width - this.__gridWidth) < 0.5) return
      const before = this.__effectiveCols()
      this.__gridWidth = width
      // 只有「列数真的变了」且没有显式 layout（走自动铺排）时才需要重排：
      // 显式 layout 里项的位置是存档里的列索引，与渲染列数无关。
      if (this.__effectiveCols() !== before && !this.layout) this.__applyProps()
    })
    this.__colsRo.observe(grid)
  }

  __gridEl(): HTMLElement | null {
    return (this.renderRoot?.querySelector('.ce-portal-grid') as HTMLElement | null) || null
  }

  /**
   * 渲染实际使用的列数 —— 规则见 `resolveColumns()`，这里只负责取当前值。
   *
   * 观测不到宽度（未挂载 / 未测量）时退回声明值与存档值，行为等同关闭自适应。
   */
  __effectiveCols(): number {
    return resolveColumns({
      declared: this.columns,
      stored: this.layout?.columns,
      width: this.__gridWidth,
      gap: this.gap,
      minColumnWidth: this.minColumnWidth,
      maxColumns: this.maxColumns,
    })
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.__colsRo?.disconnect()
    this.__colsRo = null
    if (this.__appendRaf) {
      cancelAnimationFrame(this.__appendRaf)
      this.__appendRaf = 0
    }
  }

  //////////////////////////////////// layout
  __applyProps() {
    const cols = this.__effectiveCols()
    const next = this.layout && Array.isArray(this.layout.items)
      ? normalizeLayout(this.layout, cols, this.maxWidgets).items
      : layoutFromWidgets(this.widgets || [], cols)
    if (this.__sameItems(next, this.items)) return
    this.items = next
  }

  __sameItems(a: LayoutItem[], b: LayoutItem[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      const x = a[i]
      const y = b[i]
      // title 必须参与比较：它是唯一「只影响外观、不影响几何」的可编辑字段，
      // 漏掉就会变成「宿主改了标题、存档也变了，但页面上的标题不动」
      // （__applyProps 提前 return，items 不刷新，__patchWidget 就没机会推新标题）
      if (x.id !== y.id || x.type !== y.type || (x.title || '') !== (y.title || '')) return false
      if (x.col !== y.col || x.row !== y.row || x.w !== y.w || x.h !== y.h) return false
    }
    return true
  }

  /** 提交一次布局变更并广播 change（编辑态调用） */
  __commit(items: LayoutItem[]) {
    // 回传的 columns 用**渲染列数**：用户在宽屏摆到第 13 列，存档必须记 14，
    // 否则下次窄屏读出来会按 12 列归一化，把这张卡片夹回左边。
    const cols = this.__effectiveCols()
    this.items = normalizeLayout({ items }, cols, this.maxWidgets).items
    this.emit('change', {
      layout: { version: 1, columns: cols, items: this.items.map((it) => ({ ...it })) },
    })
  }

  //////////////////////////////////// content
  __scheduleAppend() {
    if (this.__appendRaf) cancelAnimationFrame(this.__appendRaf)
    this.__appendRaf = requestAnimationFrame(() => {
      this.__appendRaf = 0
      this.__syncContent()
    })
  }

  /** 为尚未填充过内容的挂件触发 append；已填充且节点未变的挂件保留原内容 */
  __syncContent() {
    // 先让子类把 items 落成真实节点（视图态：light DOM 里的挂件元素）
    this.__syncView()
    if (!this.renderRoot) return
    const ids = new Set(this.items.map((it) => it.id))
    // 布局里已不存在的挂件，丢掉记录（节点由 __syncView 移除）
    this.__appended.forEach((_node, id) => {
      if (!ids.has(id)) this.__appended.delete(id)
    })
    for (const node of Array.from(this.__contentNodes())) {
      const id = node.dataset.portalId
      if (!id) continue
      // 同一节点已填充过 → 保留内容（拖动/缩放只改定位，不会重造节点）
      if (this.__appended.get(id) === node) continue
      const item = this.items.find((it) => it.id === id)
      if (!item) continue
      // 不可用（无权限 / 未注册）的挂件**不触发 append**：宿主的 render 会按旧的
      // config 继续取数，权限一收回就是一串 403。同时清掉记录，权限恢复后要重新填内容。
      if (!this.__isAvailable(item)) {
        this.__appended.delete(id)
        continue
      }
      this.__appended.set(id, node)
      const widget: any = this.widgetMap[item.type] || { id: item.type, title: item.type }
      const contentEl = typeof (node as any).getContent === 'function' ? (node as any).getContent() : node
      this.emit('append', {
        el: contentEl,
        item,
        widget,
        bind(fn: (el: HTMLElement) => void) {
          if (typeof fn === 'function') fn(contentEl)
        },
      })
    }
  }

  /**
   * 把 `items` 同步成真实挂件节点。基类不做（编辑态由模板声明式渲染 item）；
   * 视图态 `Portal` 覆盖为「light DOM 子元素 + keyed reconcile」。
   */
  __syncView(): void {}

  /**
   * 当前承载挂件内容的节点集合。基类按 shadow 内查询（编辑态）；
   * 视图态覆盖为自有节点表 —— 挂件已不在 shadow 里，且避免误扫嵌套 portal 的挂件。
   */
  __contentNodes(): ArrayLike<HTMLElement> {
    const root = this.renderRoot as unknown as ParentNode | undefined
    return root ? root.querySelectorAll<HTMLElement>('[data-portal-id]') : []
  }

  /**
   * light DOM 里的挂件顺序是否已与 `ordered` 一致。
   * 顺序没变就不重排 —— 每次 appendChild 都会触发一次 slot 重新分配。
   *
   * 只比对**已知挂件节点**（而不是靠 `data-portal-id` 过滤）：新建节点在写入
   * id 之前就要参与顺序判定。
   */
  __isInOrder(ordered: HTMLElement[]): boolean {
    const known = new Set<Node>(ordered)
    const cur = Array.from(this.children).filter((el) => known.has(el))
    if (cur.length !== ordered.length) return false
    for (let i = 0; i < ordered.length; i += 1) {
      if (cur[i] !== ordered[i]) return false
    }
    return true
  }

  //////////////////////////////////// view helpers
  __widgetOf(item: LayoutItem): any {
    return this.widgetMap[item.type]
  }

  /**
   * 该挂件当前是否可用（可渲染 + 可注入内容）。
   *
   * 判定规则（组件**不判断原因**，只认声明上的 `available`）：
   *  - 声明里有 `available: false` → 不可用（宿主判定为无权限 / 已下线）；
   *  - 布局里有这个 type，但挂件清单里**没有对应声明** → 不可用
   *    （宿主没给渲染器，画出来也只是空壳）；
   *  - 清单整体为空 → 视为可用：兼容"只传 layout、不传 widgets"的旧用法，
   *    否则首帧会把所有挂件打成不可用（清单可能只是还没下发）。
   */
  __isAvailable(item: LayoutItem): boolean {
    if (!Object.keys(this.widgetMap).length) return true
    const w = this.widgetMap[item.type]
    if (!w) return false
    return w.available !== false
  }

  /** 不可用时的占位文案（宿主可覆盖，缺省给一句通用的） */
  __deniedTextOf(item: LayoutItem): string {
    return this.widgetMap[item.type]?.deniedText || '暂无访问权限'
  }

  /**
   * 挂件标题：**实例标题优先**，其次是挂件类型的名字。
   *
   * 顺序不能反：`item.title` 是用户自己起的「我的待办」「XX 指标」，
   * 类型名只是「列表挂件」这种量产名字，认不出是哪张卡。
   */
  __titleOf(item: LayoutItem): string {
    const own = typeof (item as any)?.title === 'string' ? (item as any).title.trim() : ''
    return own || this.widgetMap[item.type]?.title || item.type
  }

  /**
   * 外框实际显示的标题：`hideTitle` 时为空（不画标题栏）。
   *
   * 与 `__titleOf` 分开：拖拽标签、日志文案仍需要一个能认人的名字，
   * 不能因为用户隐藏了标题栏就让操作失去标识。
   */
  __titleForChrome(item: LayoutItem): string {
    // 三态：布局项上的显式布尔值优先（false 表示用户主动要显示，覆盖挂件默认）；
    // 没设置时跟挂件声明走 —— 欢迎卡片这类纯内容卡的内容里已经有标题，
    // 外框再画一行「欢迎卡片」就是重复信息。
    const own = (item as any)?.hideTitle
    const hidden =
      typeof own === 'boolean' ? own : this.widgetMap[item.type]?.defaultHideTitle === true
    return hidden ? '' : this.__titleOf(item)
  }

  __itemStyle(item: LayoutItem): Record<string, string> {
    return {
      gridColumn: `${item.col + 1} / span ${Math.max(1, item.w)}`,
      gridRow: `${item.row + 1} / span ${Math.max(1, item.h)}`,
    }
  }
}
