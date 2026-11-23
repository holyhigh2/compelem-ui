import { classes, csscope, Csscope, emits, h, ifTrue, prop, tag, Template } from 'compelem'
import { size } from 'myfx'
import { Empty } from '../../feedback/empty/Empty'
import { ParentPortal } from './ParentPortal'
import type { LayoutItem } from './layout'
import portalStyle from './portal.scss?tmpl'
import { FADE_CSS } from '../../../css/transition'

// 空态用 `ce-empty`（模板依赖）：单入口 `compelem-ui/ce-portal` 也要能显示空态、
// 且 `@action` 走组件事件通道（需要 ctor 在 DefinitionComponentMap 里），故就地 import + 守卫注册。
if (typeof customElements !== 'undefined' && !customElements.get('ce-empty')) {
  customElements.define('ce-empty', Empty)
}

/**
 * 门户（只读视图）
 *
 * 按 `layout` 渲染 CSS Grid；未传 `layout` 时按 `widgets` 自动铺排（兼容旧用法）。
 * 每个挂件首次出现时触发 `append`，宿主向 `el` 写入挂件内容。
 *
 * **挂件节点在 light DOM**：本组件只渲染"壳"（container / main / grid / slot / 空态），
 * 挂件元素作为本组件的子元素由 `__syncView()` 维护，经 `<slot name="widgets">` 投影进
 * grid（slot 为 `display: contents`，挂件自身直接成为 grid item）。
 * 这样挂件内容的历史位置就是**上层组件 shadow 树内的节点**，上层样式表可直接命中，
 * 不需要再把整份挂件样式表当字符串传进 shadow。
 *
 * @attrs
 *  widgets {array} 挂件数组 [{id,title,size,img}]
 *  layout {object} 布局 {version,columns,items:[{id,type,col,row,w,h}]}
 *  columns {number} 列数；开启 `min-column-width` 后是**列数下限**
 *  minColumnWidth {number} 每列最小宽度（px），>0 时按容器宽度提升列数
 *  maxColumns {number} 自适应列数上限
 *  rowHeight {number} 行高
 *  gap {number} 间距
 *  overflow {string} visible/hidden：挂件内容溢出处理
 *  emptyTitle {string} 空态标题（无挂件时）
 *  emptyText {string} 空态描述
 *  emptyActionText {string} 空态按钮文案，置空则隐藏按钮
 * @events
 *  append({el,item,widget,bind})
 *  edit({}) 点击空态按钮，宿主据此进入编辑态
 */
@emits('append', 'edit')
@tag('ce-portal')
export class Portal extends ParentPortal {

  @prop({ type: String }) overflow = 'visible'

  /** 空态标题 */
  @prop({ type: String }) emptyTitle = '暂无挂件'
  /** 空态描述 */
  @prop({ type: String }) emptyText = '添加挂件，开始搭建你的个性化门户'
  /** 空态按钮文案；空串则不显示按钮（只读场景） */
  @prop({ type: String }) emptyActionText = '添加挂件'

  /** 挂件节点（light DOM 子元素）：item id → 元素，跨渲染复用 */
  #widgetEls = new Map<string, HTMLElement>()

  @csscope(Csscope.INNER)
  static get css() {
    return [portalStyle, FADE_CSS]
  }

  get cssVars() {
    return {
      '--portal-gap': `${this.gap || 0}px`,
      // 渲染列数（可能大于 prop 的 columns）：见 `ParentPortal.__effectiveCols()`
      '--portal-columns': `${this.__effectiveCols()}`,
      '--portal-row-height': `${Math.max(1, this.rowHeight || 1)}px`,
    }
  }

  //////////////////////////////////// lifecycles
  mounted(): void {
    this.__initPortal()
  }

  ////////////////////////////////////
  // 挂件节点同步（keyed reconcile）
  ////////////////////////////////////
  /**
   * 按 `items` 顺序维护 light DOM 里的挂件节点。
   *
   * 关键点：**必须按 key 复用节点**。节点一旦重建，`__appended` 记录的旧节点就与新节点
   * 不匹配，append 会重新触发（内容重写），但更糟的是如果按位置重建，旧节点上的内容会
   * 随节点一起丢掉。拖动 / 缩放只改 `col/row/w/h`，节点与内容都应原地保留。
   */
  __syncView(): void {
    const items = this.items
    const alive = new Set(items.map((it) => it.id))

    // 1) 移除布局里已不存在的挂件
    this.#widgetEls.forEach((el, id) => {
      if (alive.has(id)) return
      el.remove()
      this.#widgetEls.delete(id)
    })

    // 2) 按 items 顺序整理节点
    const ordered: HTMLElement[] = []
    for (const it of items) {
      let el = this.#widgetEls.get(it.id)
      if (!el) {
        el = this.__createWidget()
        this.#widgetEls.set(it.id, el)
      }
      ordered.push(el)
    }
    if (!this.__isInOrder(ordered)) {
      for (const el of ordered) this.appendChild(el)
    }

    // 3) 写 data / prop / 定位。必须在**连接之后**做：内核的 prop 通道要等组件
    //    初始化（`__propDefs` 建立）才可用，未连接时写 `el.overflow` 只会落在实例
    //    字段上，首次渲染读到的仍是默认值。
    for (const it of items) {
      this.__patchWidget(this.#widgetEls.get(it.id) as HTMLElement, it)
    }
  }

  __contentNodes(): HTMLElement[] {
    return Array.from(this.#widgetEls.values())
  }

  __createWidget(): HTMLElement {
    const el = document.createElement('ce-portal-widget')
    // 先挂 slot 名：节点在插入时才分配，此处设置属性即可
    el.setAttribute('slot', 'widgets')
    return el
  }

  __patchWidget(el: HTMLElement, it: LayoutItem): void {
    if (el.dataset.portalId !== it.id) el.dataset.portalId = it.id
    // 不可用态：不触发 append（见 ParentPortal.__syncContent），外框换成锁 + 文案
    const denied = !this.__isAvailable(it)
    const deniedText = this.__deniedTextOf(it)
    // hideTitle 时连不可用文案也不画标题栏：占位本身会在卡片内容区说明原因
    const baseTitle = this.__titleForChrome(it)
    const title = denied && baseTitle ? `${baseTitle} · ${deniedText}` : baseTitle
    if (el.getAttribute('title') !== title) el.setAttribute('title', title)
    // prop 必须走 updateProps：元素在连接前 `el.overflow = x` 只会写到实例字段上，
    // 不经过内核的 prop 通道，首次渲染读到的仍是默认值。
    const anyEl = el as any
    // 标题同时喂给标题栏（width 受限要省略号）与原生 tooltip（悬停看全）
    if (anyEl.title !== title) anyEl.updateProps?.({ title })
    if (anyEl.overflow !== this.overflow) anyEl.updateProps?.({ overflow: this.overflow })
    if (anyEl.denied !== denied) anyEl.updateProps?.({ denied })
    if (anyEl.deniedText !== deniedText) anyEl.updateProps?.({ deniedText })
    // 网格定位：与模板里 styles(__itemStyle) 等价，改为命令式是因为节点不在模板里
    const st = this.__itemStyle(it)
    el.style.gridColumn = st.gridColumn
    el.style.gridRow = st.gridRow
    // 卡片的最小高度 = 占的行数 × 行高 + 行间距。
    // 视图态行高是 `minmax(rowHeight, auto)`：这条下限保证「拖多大就占多大」，
    // 内容更多时卡片自己长高（高度自适应，见 portalWidget.scss 的 :host）。
    const rows = Math.max(1, it.h)
    const spanH = rows * Math.max(1, this.rowHeight || 1) + (rows - 1) * (this.gap || 0)
    const spanVar = `${spanH}px`
    if (el.style.getPropertyValue('--ce-portal-widget-h') !== spanVar) {
      el.style.setProperty('--ce-portal-widget-h', spanVar)
    }
  }

  //////////////////////////////////// events
  /**
   * 空态按钮：本组件只读，进入编辑态是宿主的职责，这里只表达意图。
   * （宿主不接 `edit` 时按钮点了没反应，可传 `empty-action-text=""` 直接隐藏）
   */
  onEmptyAction(): void {
    this.emit('edit', {})
  }

  //////////////////////////////////// render
  render(): Template {
    return h`
      <ce-container class="ce-portal">
        <ce-main class="ce-portal-main">
          <div ${classes({ 'ce-portal-grid': true, 'is-empty': size(this.items) === 0 })}>
            <slot name="widgets"></slot>
            ${ifTrue(size(this.items) === 0, () => h`
              <ce-empty class="ce-portal-empty"
                        title="${this.emptyTitle}"
                        text="${this.emptyText}"
                        action-text="${this.emptyActionText}"
                        @action="${this.onEmptyAction}"></ce-empty>
            `, { enter: "fade", leave: "fade" })}
          </div>
        </ce-main>
      </ce-container>
    `
  }
}
