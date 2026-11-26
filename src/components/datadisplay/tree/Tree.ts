import { classes, CompElem, computed, css, csscope, Csscope, debounced, emits, forEach, h, prop, query, state, styles, tag, Template, watch } from "compelem";
import { arrayToTree, assign, concat, each, filterTree, findIndex, findTreeNode, get, isEmpty, isUndefined, map, range, remove, size, tail, test, toArray, trim, walkTree } from "myfx";
import { getBox } from "uiik";
import { CaretDown, CaretRight, CaretUp, Drag, MoveIn } from "../../../icons/icons";
import type { IconFactory } from "../../../icons/registry";
import { CLASS_EXPAND, TreeStructured } from "../../../mixins/TreeStructured";
import { Virtualized } from "../../../mixins/Virtualized";
import { isVisible, nodesToHTML } from "../../../utils/utils";
import { Checkbox } from "../../form/checkbox/Checkbox";
import { Scroller } from "../scroller/Scroller";
import style from "./style.scss?tmpl";

/**
 * 节点声明"不可拖拽"时，行元素上带的类名（见 `#fillRow`）。
 *
 * 数据侧标记是节点数据上的 `draggable: false` —— 树无法推断节点的业务语义
 * （例：`<数据集id>:<字段名>` 叶子能拖到表格单元格，而数据集/分组节点不能），
 * 因此由宿主标注、库只负责消费：隐藏拖拽把手 + 禁止从该行发起拖拽。
 */
const NO_DRAG_CLASS = 'ce-tree-no-drag'

/** 树展开动画的默认时长与曲线，CSS 变量未设置时使用。 */
const ANIM_FALLBACK_MS = 300
const ANIM_FALLBACK_EASING = 'ease'
/** 快照有效期：重填迟迟没来就放弃动画，避免延迟填充误触发。 */
const ANIM_SNAPSHOT_TTL = 600

/** 解析 CSS 时间值（`0.3s` / `300ms`）为毫秒。 */
function parseCssTime(raw: string) {
  const v = parseFloat(raw)
  if (!isFinite(v)) return 0
  return raw.trim().endsWith('ms') ? v : v * 1000
}

/** 读取虚拟节点的定位 Y，来自节点的 inline `translateY`。 */
function readNodeY(el: HTMLElement) {
  const m = /translateY\(([-\d.]+)px\)/.exec(el.style.transform)
  return m ? parseFloat(m[1]) : 0
}

export enum CheckType {
  Leaf = 'leaf',//只选择叶子节点
  Independent = 'independent',//全部可选择但子树不关联父节点
  Cascade = 'cascade'//全部可选择且子树关联父节点
}
/**
 * 树组件
 * @attrs
 *  data {array} 对象数据 {label,checked,disabled,disabledCheckbox...}
 *  nodeKey {string} 节点唯一标识。默认 id
 *  labelKey {string} 用于节点显示的key。默认 label
 *  childrenKey {string} 用于获取子节点的key。默认 children
 *  indent {string|number} 缩进距离，单位像素。默认 14
 *  defaultExpandAll {boolean} 默认展开全部节点。默认 false
 *  showIndentLine {boolean} 显示缩进线。默认false
 *  highlight {boolean} 高亮选中。默认true
 *  hover {boolean} 悬停效果，默认 true
 *  clickType {string} 点击类型node/label。默认 node
 *  expandOnClick {boolean} 点击时展开子树。默认 false
 *  contextmenu {boolean} 支持右键菜单，开启后右键也可以选中节点。默认false
 *  round {boolean} 圆角背景
 *  showCheck {boolean} 显示复选框，默认false
 *  checkType {string} 选择模式，leaf/independent/cascade。默认cascade
 *  showDrag {boolean} 是否可拖动，默认false
 *  caretIcon {string|function} 折叠图标名（c-svg-xxx）或图标工厂，默认内置 CaretRight
 *  accordion {boolean} 手风琴模式，开启后同级只能展开一棵子树。默认false 【未实现】
 *  search {string} 搜索关键字，可过滤显示节点
 * 
 * @methods
 *  appendNode(parentNodeKey,data) 追加一个子节点，parentNode为null时，追加到根
 *  removeNode(data) 删除节点
 *  selectNode(key) 通过nodeKey选中节点
 *  setData(data) 重新设置tree数据
 *  getNode(key?):{node,data} 获取指定node或者当前选中node
 *  getCheckedKeys() 获取所有复选节点的key
 *  setFormatter(formatter) 设置格式化器
 *  expandToLevel(number?) 展开树到指定级别，不传参展开全部
 *  collapseToLevel(number?) 折叠树到指定级别，不传参折叠全部
 *  resetDefaultExpanded() 重置展开节点
 *  expandToNodes(keys) 展开指定节点
 *  collapseToNodes(keys) 折叠指定节点
 *  update() 更新tree结构，当data属性为shallow时使用
 *  refreshView() 刷新当前视图数据
 *  resetVirtualList() 刷新当前视图结构，高度变化时可调用
 *  toggleCheckAll(checked) 全选/取消全选
 *  toggleCheckNode(key,checked) 选中/取消选中指定节点
 *  toggleCheckNodes(keys,checked) 选中/取消选中指定节点列表
 * @events
 *  nodeclick({node,data}) 点击节点时触发
 *  select({node,data}) 选中节点时触发，包含使用API选中
 *  expand({node,data,expanded}) 节点展开/收起时触发，expanded=true 表示刚展开（异步加载子节点的入口）
 *  nodecontextmenu({node,data,event}) 在节点上右键时触发，规则见 ContextMenu 组件
 *  check({node,data,checked}) 节点选中状态变化时触发
 *
 * @author holyhigh2
 */
@emits('nodeclick', 'select', 'expand', 'nodecontextmenu', 'check', 'drop')
@tag("ce-tree")
export class Tree extends TreeStructured(Virtualized(CompElem<any>)) {
  __formatter: Function;
  //////////////////////////////////// props
  @prop({
    type: Array
  }) data: Array<Record<string, any>>;
  @prop highlight = true;
  @prop showIndentLine = false;
  @prop nodeKey = "id";
  @prop labelKey = "label";
  @prop childrenKey = "children";
  @prop indent = 14;
  @prop defaultExpandAll = false;
  @prop round = true;
  @prop contextmenu = true;
  @prop expandOnClick = false;
  @prop hover = true;
  @prop clickType = "node";
  @prop showCheck = false;
  @prop checkType = CheckType.Cascade;
  @prop search = '';

  @prop showDrag = false;
  @prop accordion = false;
  @prop({ type: [String, Function] }) caretIcon: string | IconFactory = CaretRight;

  /**
   * 实际的折叠图标。
   *
   * `@prop` 在 dev 构建下会被类字段初始化器遮蔽（见 `showCheck` 同款注释），
   * 属性赋值读不到，因此 `caret-icon` 属性优先、prop 兜底。
   */
  get caretIconName(): string | IconFactory {
    return this.getAttribute('caret-icon') || this.caretIcon || CaretRight;
  }

  @state expandedIdMap: Record<string, boolean> = {}
  @state treeData: Record<string, any>[] = []
  @state filterTreeData: typeof this.treeData | undefined = undefined
  @state refreshRenderSeed = 0

  @state key = 0;
  draggingNodeId = '';
  @state vScrollWidth: number = 0
  @state vScrollHeight: number = 0

  currentNodeId: string
  @state activeNodeKey: string;
  @state draggingPreffix: string;
  /**
   * 本次拖拽最后进入的合法行内容元素。
   *
   * 它同时是 `onDrop` 的落点依据 —— 进入非法行（自身/后代）或离开树时必须清空，
   * 否则放置会用上一轮（或上一行）的落点。
   */
  lastDragEnterNode: HTMLElement | null = null
  childrenMap = new WeakMap<Record<string, any>, Record<string, any>[]>()
  descendantsMap = new WeakMap<Record<string, any>, Record<string, any>[]>()
  nodeIdMap = new WeakMap<Record<string, any>, string>()
  /**
   * 三项拖拽索引，均在 `watchData` 中整表重建：
   *  `idNodeMap`     key 字符串 → 数据节点（跨过滤副本稳定）
   *  `nodeIdMap`     数据节点 → key 字符串
   *  `descendantsMap`数据节点 → 全部后代（拖走整棵子树）
   *  `parentMap`     数据节点 → 父节点（决定兄弟数组，根节点没有条目）
   */
  idNodeMap: Record<string, Record<string, any>> = {}
  parentMap = new WeakMap<Record<string, any>, Record<string, any>>()
  /** 本次拖拽携带的 key 集合（源节点 + 其全部后代），用于拒绝拖入自身子树 */
  draggingNodeIds: string[] = []

  //check
  /**
   * 勾选/半选/禁用集合的键**恒为 `String(nodeKey)`**。
   *
   * 行 key 来自数据（可能是 number），而 `dataset.nodeKey` 读回恒为 string；`Set` 不像
   * `levelMap` 那样隐式字符串化，混用会让 `has()` 恒为 false（勾选态在下次重填即丢失）。
   */
  _checkedNodeKeys: Set<string> = new Set()
  _indeterminateKeys: Set<string> = new Set()
  //disable
  _disabledNodeKeys: Set<string> = new Set()
  _disabledCheckboxNodeKeys: Set<string> = new Set()
  /** nodeKey 字符串 → 数据节点；对外返回勾选结果时用它还原数据里的原始 key 类型 */
  #nodeByKey: Record<string, Record<string, any>> = {}

  @query('.ce-tree-drag-bar')
  dragBar: HTMLElement

  @query('.ce-tree-container')
  treeCon: HTMLElement

  ///////////////////////////////////////////虚拟化
  @prop rowHeight = 30;
  @state vRowHeight = 0
  @state vCachedRows = 0;

  @state vList: HTMLElement[] = []
  ///////////////////////////////////////////树展开动画
  #animSnapshot: Map<string, number> | null = null
  /** 捕获后、同步重填尚未执行的窗口；期间的 scrollV 属于树重排，不能取消动画。 */
  #animUrgent = false
  #animDurationMs = 0
  #animEasing = ''
  #anims: Animation[] = []
  #animTimer: ReturnType<typeof setTimeout> | null = null
  #animClassTimer: ReturnType<typeof setTimeout> | null = null

  @query('#vpillar')
  declare vPillar: HTMLElement
  @query('ce-scroller')
  scroller: Scroller

  connectedCallback() {
    super.connectedCallback()
    requestAnimationFrame(() => {
      this.resetVirtualList()
    })
    // Due to useDefineForClassFields + @prop interaction, boolean prop values are always their
    // initializer (false) because the own property shadows the @prop prototype getter.
    // Work around by watching attributes and applying behavior directly.
    const applyShowCheck = () => {
      if (this.hasAttribute('show-check')) {
        const inner = this.shadowRoot?.querySelector('.ce-tree')
        if (inner) inner.classList.add('is-show-check')
      }
    }
    applyShowCheck()

    // defaultExpandAll: 初次连接若已带属性，延迟展开全部（与下方 observer 的属性变化触发是两回事）
    if (this.hasAttribute('default-expand-all')) {
      setTimeout(() => this.expandToLevel(9999), 100)
    }

    // 三个属性观察者统一登记：重连前先断开旧观察者（闭包持 this，否则不可 GC）。
    this.#attrObservers.forEach((o) => o.disconnect())
    this.#attrObservers = [
      new MutationObserver(applyShowCheck),
      new MutationObserver(() => {
        if (this.hasAttribute('default-expand-all')) {
          this.expandToLevel(9999)
        }
      }),
      new MutationObserver(() => {
        this.#expandOnClickFromAttr = this.hasAttribute('expand-on-click')
      }),
    ]
    this.#attrObservers[0].observe(this, { attributes: true, attributeFilter: ['show-check'] })
    this.#attrObservers[1].observe(this, { attributes: true, attributeFilter: ['default-expand-all'] })
    this.#attrObservers[2].observe(this, { attributes: true, attributeFilter: ['expand-on-click'] })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.#attrObservers.forEach((o) => o.disconnect())
    this.#attrObservers = []
  }

  #attrObservers: MutationObserver[] = []
  #expandOnClickFromAttr = false

  /////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  get cssVars() {
    return {
      treeRowHeight: `${this.rowHeight}px`
    }
  }
  /////////////////////////////////// watches
  _lastDataSize = 0
  @watch('data', { immediate: true, deep: true })
  watchData(nv: any, ov: any, srcChain: string, subNv: any) {
    const newSize = this.#buildIndex(nv)
    walkTree(nv, (node) => {
      let key = node[this.nodeKey]
      if (node.checked) {
        this._checkedNodeKeys.add(String(key))
      }
      if (node.disabled) {
        this._disabledNodeKeys.add(String(key))
      }
      if (node.disabledCheckbox) {
        this._disabledCheckboxNodeKeys.add(String(key))
      }
    })

    if (this._lastDataSize !== newSize && this.renderRoot) {
      this.resetVirtualList()
      // this.resetDefaultExpanded()
    }
    this._lastDataSize = newSize
    this.refreshRenderSeed = Math.random()
  }
  /**
   * 整表重建 key/节点索引与父子关系，返回节点总数。
   *
   * 拖拽的增删是**就地改数组**，`data` 的深度监听未必会再来一次，
   * 所以 `onDrop` 之后也直接调本方法，保证索引与新的父子结构一致。
   */
  #buildIndex(data: any): number {
    let size = 0
    this.#nodeByKey = {}
    this.idNodeMap = {}
    this.nodeIdMap = new WeakMap()
    const descendantsMap = new WeakMap<Record<string, any>, Record<string, any>[]>()
    const parentMap = new WeakMap<Record<string, any>, Record<string, any>>()
    walkTree(data, (node, parent, chain) => {
      size++
      const sk = String(node[this.nodeKey])
      this.#nodeByKey[sk] = node
      // 拖拽链路按 key 字符串反查节点：过滤后的行是原节点的副本，
      // 按对象身份查找会落空，key 是唯一跨副本稳定的标识。
      this.idNodeMap[sk] = node
      this.nodeIdMap.set(node, sk)
      if (parent) parentMap.set(node, parent)
      // 祖先链上每个节点都记一份后代列表，供 onDragStart 一次性拖走整棵子树
      each(chain, (ancestor: Record<string, any>) => {
        let list = descendantsMap.get(ancestor)
        if (!list) {
          list = []
          descendantsMap.set(ancestor, list)
        }
        list.push(node)
      })
    })
    this.descendantsMap = descendantsMap
    this.parentMap = parentMap
    return size
  }
  @watch('search')
  watchSearch(v: any) {
    this._doFilter()
    this.nextTick(() => {
      // 搜索会改变行数与内容高度：只 refreshView 会留下多余的滚动高度
      this.resetVirtualList()
    })
  }

  @watch('rowHeight')
  watchRowHeight() {
    this.nextTick(() => {
      this.resetVirtualList()
    })
  }

  @watch(['draggingPreffix'])
  updateDraggingPreffix() {
    this.__updatableStyleDragging?.replaceSync(this.__getDraggingPreffixCss())
  }
  /////////////////////////////////// computed
  @computed
  get renderList() {
    //seed
    let x = this.refreshRenderSeed;
    let data = this.filterTreeData ?? this.data ?? []

    data = (data.length < 1) ? data : this.flattenTreeData(data)
    return data
  }

  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
    <div role="tree" class="ce-tree" ${classes({
      "is-show-check": this.showCheck || this.hasAttribute('show-check'),
      "is-show-drag": this.showDrag || this.hasAttribute('show-drag')
    })} tabindex="0" @resize.debounce="${this.onResize}" @dragleave="${this.onMouseleave}">
        <ce-scroller @scroll="${this.onScroll}" wheel-step="80" .s-width="${this.vScrollWidth}" .s-height="${this.vScrollHeight}">
          <ul class="ce-tree-container"  @mutate.child.debounce:100="${this.onListReady}">
            <li id="vpillar" ></li>
            ${forEach(range(this.vCachedRows), (data, i) => i, (data, i) => h`
            <li part="node" @click="${this.onClick}" @contextmenu="${this.onContextMenu}" data-row-index="${i}" ${styles({ transform: `translateY(${i * this.rowHeight}px)` })}
                class="ce-tree-node" ${classes({
      [`ce-tree-hover-${this.clickType}`]: this.hover,
      "ce-tree-round": this.round,
      "ce-tree-indent-line": this.showIndentLine || this.hasAttribute('show-indent-line'),
    })}
              >
                <div @dragstart="${this.onDragStart}" @dragend="${this.onDragEnd}" @dragenter="${this.onDragEnter}"
                  @mousedown="${this.onNodeContentMouseDown}"
                  class="ce-tree-node-content"
                >
                  <span class="ce-tree-caret" part=""><ce-icon style="display:none" .svg="${this.caretIconName}"></ce-icon></span>
                  <span class="ce-tree-checkbox"><ce-checkbox @click.stop @change="${this.onCheck}"></ce-checkbox></span>
                  <span class="ce-tree-dragflag" style="display:none" @mousedown="${this.onDragEmit}"><ce-icon .svg="${Drag}"></ce-icon></span>
                  <span class="ce-tree-label" part="node-label">
                  </span>
                </div>
            </li>`)}
          </ul>
        </ce-scroller>
      <div class="ce-tree-drag-bar" ?round="${this.round}" @dragenter="${this.onDragbarEnter}" @dragover.prevent @drop="${this.onDrop}">
        <div class="ce-tree-drag-di" name="drag-di" action="insertBefore" style="min-width: 20%;"><ce-icon .svg="${CaretUp}" size="sm"></ce-icon></div>
        <div class="ce-tree-drag-di" name="drag-di" action="append" style="flex:1"><ce-icon .svg="${MoveIn}" size="sm"></ce-icon></div>
        <div class="ce-tree-drag-di" name="drag-di" action="insertAfter" style="min-width: 20%;"><ce-icon .svg="${CaretDown}" size="sm"></ce-icon></div>
      </div>
    </div>
    `;
  }
  mounted(): void {
    this.__updatableStyleDragging = this.insertStyleSheet(this.__getDraggingPreffixCss())
  }
  /**
   * **0.31 起 `updated()` 不再是「本组件重渲染之后」的钩子。**
   *
   * 全框架唯一调用点是 `CompElem#forceUpdate()`（`CompElem.ts:1023`，恒传 `{}`），而 signal
   * 架构下响应式重渲染只跑 per-point effect、**不经过 `forceUpdate()`**；编译期生命周期
   * 白名单（`template-rules.ts:47`）里也没有它 ⇒ 任何依赖 `updated()` 的链路**静默断开**。
   *
   * 旧实现把「虚拟列表刷新后补填行数据」挂在 `updated()` 上：`resetVirtualList()` 置了
   * `#updateView`，却再没有一次重渲染会来读它 ⇒ `refreshView()` 永不执行 ⇒ 数据变更后
   * 行内容不更新（`onListReady()` 只按「首个可见行号 + i」填一次，其推导在数据长度变化后
   * 是错的）。修法：由 `resetVirtualList()` 自己调度（见 `#scheduleViewRefresh()`）。
   */

  //////////////////////////////////// methods
  __getDraggingPreffixCss() {
    return css`
      .ce-tree-node[data-node-key^="${this.draggingPreffix}"] .ce-tree-node-content{
        color:var(--ce-color-border);
        background:linear-gradient(90deg, var(--hover-color) 10%, transparent)  !important;
      }
    `
  }
  /**
   * 搜索生效前的展开态快照：清空关键字时原样还原，
   * 避免"搜一次就把整棵树永久展开"。
   */
  #preSearchExpanded: Record<string, boolean> | null = null
  /**
   * 按 `search` 重建过滤后的树。关键字为空时 `filterTreeData` 置 undefined，
   * `renderList` 回落到原始 `data`——原始节点对象保持身份不变（过滤结果是副本），
   * 拖拽索引、勾选态都不受影响。
   */
  _doFilter() {
    let s = trim(this.search)
    if (!s) {
      if (this.#preSearchExpanded) {
        this.expandedIdMap = this.#preSearchExpanded
        this.#preSearchExpanded = null
      }
      this.filterTreeData = undefined
      return
    }
    if (!this.#preSearchExpanded) {
      this.#preSearchExpanded = { ...this.expandedIdMap }
    }
    const pidMap: Record<string, any> = []
    let filterTreeData = filterTree(this.data, (node, parentNode, chain) => {
      let label = get(node, this.labelKey)
      // 字符串按字面量匹配（test 会转义正则字符），并忽略大小写
      let rs = test(label, s, 'i')
      if (rs) {
        let p = chain[0]
        if (p) {
          pidMap[p[this.nodeKey]] = null
          each(tail(chain), c => {
            pidMap[c[this.nodeKey]] = p[this.nodeKey] ?? null
            p = c
          })
        }

        pidMap[node[this.nodeKey]] = p ? p[this.nodeKey] ?? null : null
      }
      return rs
    }, { childrenKey: this.childrenKey })
    filterTreeData.forEach(fd => fd.pid = pidMap[fd[this.nodeKey]])
    const td = arrayToTree(filterTreeData, this.nodeKey, 'pid', { childrenKey: this.childrenKey })
    // 命中路径上的父节点必须展开，否则折叠态的树搜出来只有根行
    const nextExpanded = { ...this.expandedIdMap }
    walkTree(td, (node) => {
      if (!isEmpty(node[this.childrenKey])) {
        nextExpanded[node[this.nodeKey]] = true
      }
    })
    this.expandedIdMap = nextExpanded
    this.filterTreeData = td
  }
  //重置展开节点
  resetDefaultExpanded() {
    let lastCollapsedRootId = this.collapsedRootId
    this.collapsedRootId = {}

    if (this.defaultExpandAll) {
      this.expandToLevel(9999)
    } else {
      walkTree(this.data, (node, parent, chain, level, index) => {
        if (!isEmpty(node[this.childrenKey])) {
          this.collapsedRootId[this.nodeIdMap.get(node)!] = true
        }
      })
    }

    //记录上次打开的节点
    assign(this.collapsedRootId, lastCollapsedRootId)
  }
  update() {
    this.refreshRenderSeed = Math.random()

    this.nextTick(() => {
      this.resetVirtualList()
    })
    // setTimeout(() => {

    // }, 100);
    // this.resetVirtualList();
  }
  ///////////////////////////////////////////树展开动画
  /** 读取动画时长与曲线，宿主可通过 CSS 变量覆盖。 */
  __animConfig() {
    let ms = ANIM_FALLBACK_MS
    let easing = ANIM_FALLBACK_EASING
    const cs = getComputedStyle(this)
    const raw = cs.getPropertyValue('--ce-tree-duration').trim()
      || cs.getPropertyValue('--ce-list-transition-duration').trim()
    if (raw) ms = parseCssTime(raw)
    easing = cs.getPropertyValue('--ce-tree-easing').trim()
      || cs.getPropertyValue('--ce-list-transition-timing-function').trim()
      || easing
    return { ms, easing }
  }

  /** 开启本轮动画的 CSS 过渡门控，时长结束后自动撤除。 */
  __armAnimClass(ms: number) {
    this.setAttribute('data-tree-anim', '')
    if (this.#animClassTimer) clearTimeout(this.#animClassTimer)
    this.#animClassTimer = setTimeout(() => {
      this.#animClassTimer = null
      this.removeAttribute('data-tree-anim')
    }, ms + 80)
    // 先让过渡声明进入 computed style，紧接着的类切换才会触发过渡
    const inner = this.shadowRoot?.querySelector('.ce-tree-node-content')
    if (inner) void getComputedStyle(inner).transitionProperty
  }

  /** 立即撤除门控：滚动回收期间不能残留过渡。 */
  __disarmAnimClass() {
    if (this.#animClassTimer) {
      clearTimeout(this.#animClassTimer)
      this.#animClassTimer = null
    }
    this.removeAttribute('data-tree-anim')
  }

  /** 清掉快照与激活标记，已启动的动画保留到自然结束。 */
  __endAnim() {
    this.#animUrgent = false
    this.#animSnapshot = null
    if (this.#animTimer) {
      clearTimeout(this.#animTimer)
      this.#animTimer = null
    }
  }

  /** 取消正在进行的动画、放弃本轮快照并关闭过渡门控。 */
  __cancelAnim() {
    const list = this.#anims
    this.#anims = []
    for (const a of list) {
      try { a.cancel() } catch { /* 动画可能已结束 */ }
    }
    this.__disarmAnimClass()
    this.__endAnim()
  }

  /** 切换展开态之前，记录当前可见节点的 `data-node-key` 与定位 Y。 */
  __captureAnim() {
    this.__cancelAnim()
    if (!this.vList || !this.isMounted) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cfg = this.__animConfig()
    if (cfg.ms <= 0) return
    this.#animDurationMs = cfg.ms
    this.#animEasing = cfg.easing
    const snap = new Map<string, number>()
    for (const el of this.vList) {
      const key = el.dataset.nodeKey
      if (!key) continue
      snap.set(key, readNodeY(el))
    }
    this.#animSnapshot = snap
    this.#animUrgent = true
    this.__armAnimClass(cfg.ms)
    this.#animTimer = setTimeout(() => this.__endAnim(), ANIM_SNAPSHOT_TTL)
  }

  /**
   * 重填完成后提交动画：快照里有的节点按 `data-node-key` 做 FLIP 位移，
   * 快照里没有的节点（展开新增的子节点）淡入下滑。
   */
  __playRowAnims() {
    const snap = this.#animSnapshot
    if (!snap) return
    // 两段**串行**：既有行先用 60% 时长让位，落位后新增子行再淡入剩余 40%。
    // `fill: 'backwards'` 让子行在整个 delay 期间保持 opacity 0 —— 默认 fill 下
    // delay 期是元素自然状态（完全不透明），会与仍在位移的旧行叠字。
    const flipMs = Math.round(this.#animDurationMs * 0.6)
    const flipOpts: KeyframeAnimationOptions = {
      duration: flipMs,
      easing: 'ease-out'
    }
    const enterOpts: KeyframeAnimationOptions = {
      duration: this.#animDurationMs - flipMs,
      delay: flipMs,
      easing: this.#animEasing,
      fill: 'backwards'
    }
    for (const row of this.vList) {
      const key = row.dataset.nodeKey
      if (!key) continue
      const newY = readNodeY(row)
      const oldY = snap.get(key)
      let anim: Animation | null = null
      if (oldY != null && Math.abs(oldY - newY) > 0.5) {
        anim = row.animate([
          { transform: `translateY(${oldY}px)` },
          { transform: `translateY(${newY}px)` }
        ], flipOpts)
      } else if (oldY == null) {
        const inner = row.firstElementChild as HTMLElement | null
        if (inner) anim = inner.animate([
          { opacity: 0, transform: 'translateY(-8px)' },
          { opacity: 1, transform: 'none' }
        ], enterOpts)
      }
      if (!anim) continue
      const a = anim
      this.#anims = [...this.#anims, a]
      const drop = () => { this.#anims = this.#anims.filter(x => x !== a) }
      a.onfinish = drop
      a.oncancel = drop
    }
  }

  /** 展开/折叠这轮在 DOM 行池变化后同步重建 vList 与定位，不等 onListReady 的防抖。 */
  __syncVList() {
    const rows = Array.from(this.treeCon.querySelectorAll<HTMLElement>('.ce-tree-node'))
    if (!rows.length) return
    const firstRowNoInView = this.scroller.y / this.rowHeight >> 0
    rows.forEach((row, i) => {
      const rowIndex = firstRowNoInView + i
      row.style.transform = `translateY(${rowIndex * this.rowHeight}px)`
      row.dataset.rowIndex = rowIndex + ''
    })
    this.vList = rows
  }

  /** 点击 caret 的入口：先取快照，再交给 mixin 切换展开态。 */
  toggleExpand(node: Element) {
    this.__captureAnim()
    // 在 mixin 切换之前取行数据：切换只改状态与类名，renderList 此刻仍与点击的行对齐。
    const rowEl = node.closest('[data-row-index]') as HTMLElement | null
    const rowIndex = rowEl ? parseInt(rowEl.dataset.rowIndex!, 10) : NaN
    const data = Number.isInteger(rowIndex) ? this.renderList[rowIndex] : undefined
    super.toggleExpand(node)
    if (rowEl && data) {
      const key = data[this.nodeKey]
      // 与 Ant Design/TDesign 的 expand 语义一致：同一事件带 expanded 标志，调用方按需加载。
      this.emit('expand', { node: rowEl, data, expanded: !!this.expandedIdMap[key] })
    }
  }

  /** 用户滚动时撤除本轮动画；`#animUrgent` 期间是树重排，必须放行。 */
  scrollV(scrollTop: number, cbk: (rowEl: HTMLElement, rowIndex: number) => void) {
    const moved = Math.abs(scrollTop - this.__vLastScrollTop) > 1
    if (!this.#animUrgent && moved &&
      (this.#animSnapshot || this.#anims.length || this.hasAttribute('data-tree-anim'))) {
      this.__cancelAnim()
    }
    super.scrollV(scrollTop, cbk)
  }

  /**
   * 更新当前视图数据，用于虚拟表格刷新
   */
  @debounced(50)
  refreshView() {
    this.__refreshViewNow(false)
  }

  /** `urgent` 为树展开/折叠这轮：内容与几何同帧就位并播放动画。 */
  __refreshViewNow(urgent: boolean) {
    if (isEmpty(this.vList)) return;

    //1. 滚动到指定位置
    this.scrollV(this.scroller.y, (rowEl, rowIndex) => {
      if (rowIndex < 0 || rowIndex >= this.renderList.length) return;
      rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')

      //填充行数据
      this.#fillRow(rowEl, rowIndex)
    })
    //2. 刷新数据，不更新位置
    let rowEls = this.vList.sort((a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
    rowEls.forEach((row, i) => {
      let rowIndex = parseInt(row.dataset.rowIndex!)
      // 无效行号（NaN/负数）说明行元素尚未挂接或已失效，跳过
      if (!(rowIndex >= 0)) return;
      this.#fillRow(row, rowIndex)
    })
    // 只有树展开/折叠这一轮（`urgent`）才消费快照并收尾：展开期间其它来源的
    // `refreshView()` 拿不到新行位置，若顺手 `__endAnim()`，紧随其后的真正这轮
    // 就没有 FLIP，只剩 CSS 门控里的缩进与 caret 过渡。
    if (urgent) {
      this.__playRowAnims()
      this.__endAnim()
    }
  }

  #updateView = false
  /** `#scheduleViewRefresh()` 的去重闩：同一任务循环内只排一次超时。 */
  #viewRefreshPending = false
  __lastHeight = 0
  resetVirtualList() {
    // 防抖/定时回调可能在路由切走后到达：此时 shadow 已拆，renderRoot 为 undefined
    if (!this.renderRoot) return
    let oh = this.renderRoot.offsetHeight
    this.updateV(size(this.renderList), oh)

    //填充行数据
    this.#updateView = true
    this.#scheduleViewRefresh()
  }

  /**
   * `#updateView` 的**唯一消费者**（原 `updated()` 的位置）。
   *
   * 时序与原 `updated()` 里那段完全一致，只把「由下一次重渲染触发」换成「由
   * `resetVirtualList()` 直接调度」：
   *   setTimeout(0) —— 让 `updateV()` 写入的 `vCachedRows` 先驱动模板把
   *     `.ce-tree-node` 包装元素建出来（signal flush 后 DOM 才就绪）；
   *   → `scroller.calcBounding()` 重新量测可视区；
   *   → setTimeout(100) 后再 `refreshView()`，等布局落定（与原实现同）。
   */
  #scheduleViewRefresh() {
    if (this.#viewRefreshPending) return
    this.#viewRefreshPending = true
    setTimeout(() => {
      this.#viewRefreshPending = false
      if (!this.#updateView) return
      this.#updateView = false
      if (!this.scroller) return
      //如果data长度发生变更
      this.scroller.calcBounding()
      if (this.#animUrgent) {
        // 展开/折叠这轮跳过 100ms 等待与 refreshView 的防抖，内容与几何同帧就位
        this.__syncVList()
        this.__refreshViewNow(true)
      } else {
        setTimeout(() => {
          this.refreshView()
        }, 100)
      }
    }, 0)
  }

  onResize() {
    // resize 走 debounce，路由切换后回调可能迟到：此时 shadow 已拆、renderRoot 为 undefined
    if (!this.isMounted || this.isDestroyed || !this.renderRoot) return
    if (!isVisible(this)) return;
    let oh = this.renderRoot.offsetHeight
    if (Math.abs(oh - this.__lastHeight) > 5) {
      this.resetVirtualList()
    }
    this.__lastHeight = oh
  }
  __lastYTo = -1
  __lastXTo = -1
  _scrolled = false
  onScroll(obj: Record<string, any>) {
    let { to, direction, preventDefault } = obj
    this._scrolled = false
    if (direction === 'h') {
      if (to === this.__lastXTo) {
        return;
      }

      this._scrolled = true
      this.__lastXTo = to
      preventDefault()

    } else {
      if (to === this.__lastYTo) return;

      if (to > 0) {
        this.scrolledV = true;
      } else {
        this.scrolledV = false;
      }

      this._scrolled = true
      this.__lastYTo = to;
      this.scrollV(to, (rowEl, rowIndex) => {
        if (rowIndex < 0 || rowIndex >= this.renderList.length) return;
        rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')
        //填充行数据
        this.#fillRow(rowEl, rowIndex)
      })
    }
  }
  onListReady() {
    // 销毁后 isMounted 为 false、`this.scroller` 的门控也读不到元素；离场动画的 freeze
    // 窗口里 isMounted 仍为 true（shadow 未拆），靠 isDestroyed 挡掉这一段。
    if (!this.isMounted || this.isDestroyed || !this.scroller) return;

    this.scroller.calcBounding()
    this.vList = Array.from(this.treeCon.querySelectorAll('.ce-tree-node'))

    //1. 查询行号列表
    let firstRowNoInView = this.scroller.y / this.rowHeight >> 0

    this.vList.forEach((row, i) => {
      let rowIndex = firstRowNoInView + i
      let rowChild = row.firstElementChild as HTMLElement
      row.style.transform = `translateY(${rowIndex * this.rowHeight}px)`
      // rowChild.dataset.rowIndex = 
      row.dataset.rowIndex = rowIndex + ''

      this.#fillRow(row, rowIndex)
    })

  }
  #fillRow(node: HTMLElement, rowIndex: number) {
    const rowData = this.renderList[rowIndex];

    let key = rowData ? rowData[this.nodeKey] : ''
    //indent
    let level = this.levelMap[key] || 0
    const nodeContent = node.firstElementChild as HTMLElement
    // 行元素可能处于回收/重建窗口（数据切换后 refreshView 仍持有旧引用），无子节点时跳过
    if (!nodeContent) return
    nodeContent.style.paddingLeft = (this.indent * level) + 'px'
    //高亮 / 缩进线：虚拟列表的 li 会被复用，两者都必须在每次填充时重算
    node.classList.toggle('is-active',
      !!rowData && this.activeNodeKey != null && String(key) === String(this.activeNodeKey))
    this.#syncIndentLines(node, rowData ? level : 0)
    //content
    let content = node.querySelector('.ce-tree-label') as HTMLElement | null
    if (!content) return

    this.#updateCaret(node, rowData)
    this.#updateDragFlag(node, rowData)

    if (!rowData) {
      content.textContent = ''
      node.dataset.nodeKey = ''
      return
    }

    //disabled
    node.classList.toggle('ce-tree-disabled', this._disabledNodeKeys.has(String(key)))

    //填充行数据
    // 自定义节点内容统一走插槽：使用者用 ${slot(props => h`...`, 'cell')} 传入。
    // 旧的 rowData.cellTmpl（数据里塞运行时函数）在 0.30 无法成立 ——
    // 回调不在任何 render 体内，编译器不会为它生成 subViews，取不到 DOM 结构。
    let cellFn = this.slotHooks.cell
    //id
    node.dataset.nodeKey = key
    //checkbox：行元素处于回收窗口时可能取不到复选框
    let checkbox = node.querySelector('.ce-tree-checkbox ce-checkbox') as Checkbox | null
    const ck = String(key)
    checkbox?.toggleCheck(this._checkedNodeKeys.has(ck))
    checkbox?.setIndeterminate(this._indeterminateKeys.has(ck))
    if (checkbox && this._disabledCheckboxNodeKeys.has(ck)) {
      checkbox.disabled = true
    }

    content.innerHTML = cellFn ? nodesToHTML(this.getSubViewNodes(cellFn, rowData)) : this._setFormat(rowData, rowIndex)
  }
  /**
   * 缩进线：按节点层级在行内创建 `level` 条竖线。
   *
   * 行元素被虚拟列表复用，层级在回收后可能变化 —— 每次整体重建，
   * 增量补齐会残留上一层级多出来的线。
   * `showIndentLine` 是布尔 prop，dev 下被字段初始化器遮蔽，需兼顾属性。
   */
  #syncIndentLines(node: HTMLElement, level: number) {
    const show = this.showIndentLine || this.hasAttribute('show-indent-line')
    node.querySelectorAll(':scope > .ce-tree-indent-line').forEach(el => el.remove())
    node.classList.toggle('ce-tree-indent-line', show)
    if (!show || level <= 0) return
    for (let i = 0; i < level; i++) {
      const line = document.createElement('span')
      line.className = 'ce-tree-indent-line'
      // 与第 i 层祖先 caret 的水平中心对齐（caret 宽 1.25rem ≈ 20px）
      line.style.left = `${this.indent * i + 10}px`
      // 追加在内容之后：`#fillRow` 依赖 `firstElementChild` 仍是 `.ce-tree-node-content`
      node.appendChild(line)
    }
  }
  //更新node样式
  #updateCaret(node: HTMLElement, rowData: Record<string, any>) {
    let icon = node.querySelector('.ce-tree-caret')?.firstElementChild as HTMLElement | null
    //caret
    if (rowData && !isEmpty(rowData[this.childrenKey])) {
      if (icon) icon.style.display = ''
      // 展开态类由样式表消费（`.ce-tree-node.is-expanded > …`），见 CLASS_EXPAND 注释
      node.classList.toggle(CLASS_EXPAND, !!this.expandedIdMap[rowData[this.nodeKey]])
    } else {
      if (icon) icon.style.display = 'none'
      // 行元素是**循环复用**的：上一轮渲染到这里的若是"已展开的父节点"，类会残留
      // 到这一轮的叶子/空行上（进而误命中展开态样式）→ 必须显式清除。
      node.classList.remove(CLASS_EXPAND)
    }
  }
  /**
   * 拖拽把手与行级"不可拖"标记：只对**具备拖拽语义**的节点显示把手。
   *
   * 数据侧标记 `draggable: false`（缺省视为可拖）。
   *
   * 为什么必须用 `!important` 级的 inline 值：模板里把手的 `style="display:none"`
   * 是非 important 的，会被样式表那条 `.ce-tree.is-show-drag … { display: block !important }`
   * 压过 —— "能拖"这一侧靠的正是 important。要让"不可拖"生效，inline 也必须提权
   * （inline + important 特异性最高）；可拖时把 priority 还原为空串，把手即回到
   * "由样式表决定"的默认行为（show-drag 开启才显示）。
   */
  #updateDragFlag(node: HTMLElement, rowData: Record<string, any>) {
    const noDrag = !!rowData && rowData.draggable === false
    const dragFlag = node.querySelector('.ce-tree-dragflag') as HTMLElement | null
    if (dragFlag) {
      dragFlag.style.setProperty('display', 'none', noDrag ? 'important' : '')
    }
    node.classList.toggle(NO_DRAG_CLASS, noDrag)
  }
  _dragEnter(nodeEl: HTMLElement) {
    let rect = getBox(nodeEl, this.renderRoot)

    this.dragBar.style.top = rect.y + "px"
    this.dragBar.style.height = rect.h + 'px'
  }
  _getLabel(node: Record<string, any>): string {
    return get(node, this.labelKey)
  }
  _getNodeId(node: Record<string, any>): string {
    return get(node, this.nodeKey)
  }
  _getNodeChildren(node: Record<string, any>): Array<Record<string, any>> {
    return (get(node, this.childrenKey))
  }
  onContextMenu(e: PointerEvent) {
    if (!this.contextmenu) return;
    const t = e.target as HTMLElement
    if (t.classList.contains("ce-tree-disabled")) return;

    let node: HTMLElement | null = t.closest('[data-row-index]');
    if (!node) return;

    const i = parseInt(node.dataset.rowIndex!)
    const rowData = this.renderList[i]

    this.#selectNode(node, rowData);

    this.emit("nodecontextmenu", {
      node,
      data: rowData
    }, e);
  }
  onClick(e: MouseEvent) {
    let t = e.target as HTMLElement;
    // 节点右侧的自定义操作（cell 插槽里的编辑/删除等）由宿主处理，不参与选中/勾选/展开
    if (t.closest('[data-tree-action]')) return;
    if (t.classList.contains("ce-tree-disabled")) return;
    let isCaret = t.classList.contains("ce-tree-caret");

    let node: HTMLElement | null = null;
    let clickType = this.clickType;

    node = t.closest('[data-row-index]')
    if (!node || !node.dataset.rowIndex) return;

    const i = parseInt(node.dataset.rowIndex!)
    const rowData = this.renderList[i]

    if (!isCaret) {
      this.emit("nodeclick", { node, data: rowData }, e);
      this.#selectNode(t, rowData);
    }

    if (isCaret || this.expandOnClick || this.#expandOnClickFromAttr) {
      this.toggleExpand(t)
    }
    if (!isCaret && clickType === 'node' && (this.showCheck || this.hasAttribute('show-check'))) {
      let key = rowData[this.nodeKey]
      this.toggleCheckNode(key, !this._checkedNodeKeys.has(String(key)))
    }
  }

  /**
   * 放置：把拖拽节点从其兄弟数组摘下，按放置区 `action` 插入目标位置。
   *
   * 行元素上只有 `data-node-key`（`#fillRow` 写入），索引一律走 key 字符串；
   * `data` 是外部持有的普通数组，就地增删后必须自行触发重排
   * （`refreshRenderSeed` + `resetVirtualList`），并 emit `drop` 让宿主同步自己的数据源。
   */
  onDrop(e: DragEvent) {
    const t = e.target as HTMLElement
    const action = t.getAttribute('action')
    const srcKey = this.draggingNodeId
    const lastEnter = this.lastDragEnterNode
    // 没有源（外部拖入/`dragstart` 未走到）或没进入过任何行时无处可放
    if (!srcKey || !lastEnter) return
    const nodeEl = lastEnter.closest('.ce-tree-node') as HTMLElement | null
    const targetKey = nodeEl?.dataset.nodeKey
    if (!targetKey) return
    // 拖到自己或自己的后代上：整棵子树的移动会成环
    if (targetKey === srcKey || this.draggingNodeIds.includes(targetKey)) return

    const draggingData = this.idNodeMap[srcKey]
    const targetData = this.idNodeMap[targetKey]
    if (!draggingData || !targetData) return

    const draggingParent = this.parentMap.get(draggingData)
    const targetParent = this.parentMap.get(targetData)
    // 兄弟数组：有父节点用父节点的 childrenKey 数组，根节点用 data 本体。
    // 只在数组真的存在时采用 —— 取不到就退回 data，避免往临时数组里 splice 把节点弄丢。
    const siblingAry = (parent: Record<string, any> | undefined) => {
      const children = parent ? parent[this.childrenKey] : undefined
      return Array.isArray(children) ? children : this.data
    }
    const draggingAry: Record<string, any>[] = siblingAry(draggingParent)
    // remove 按对象身份删除：过滤后的行是副本，但 idNodeMap 里拿到的是原始节点，身份一致
    remove(draggingAry, (c: Record<string, any>) => c === draggingData)

    switch (action) {
      case 'insertBefore': {
        const ary = siblingAry(targetParent)
        let i = ary.indexOf(targetData)
        if (i < 0) i = 0
        ary.splice(i, 0, draggingData)
        break;
      }
      case 'append': {
        if (isEmpty(targetData[this.childrenKey])) {
          targetData[this.childrenKey] = []
        }
        targetData[this.childrenKey].push(draggingData)
        // 收进自身子树后要展开，否则被拖走的节点看不见落点
        const nextExpanded = { ...this.expandedIdMap }
        nextExpanded[targetKey] = true
        this.expandedIdMap = nextExpanded
        break;
      }
      case 'insertAfter': {
        const ary = siblingAry(targetParent)
        const i = ary.indexOf(targetData) + 1
        ary.splice(i, 0, draggingData)
        break;
      }
      default:
        return
    }

    this.emit('drop', { action, data: draggingData, target: targetData })
    this.#refreshAfterDrop()
  }
  /** 放置后重建结构：索引、过滤结果、行数、滚动高度都可能变。 */
  #refreshAfterDrop() {
    this.#buildIndex(this.data)
    if (this.filterTreeData) {
      this._doFilter()
    }
    this.refreshRenderSeed = Math.random()
    this.resetVirtualList()
  }
  onCheck(obj: Record<string, any>) {
    if (!(obj.target instanceof Checkbox)) return

    let checked = obj.checked
    const nodeEl = obj.target.closest<HTMLElement>('.ce-tree-node')!
    const nodeCheckbox = nodeEl.querySelector('ce-checkbox') as Checkbox | null
    let nodeId = nodeEl.dataset.nodeKey!
    nodeCheckbox?.setIndeterminate(false)
    this._indeterminateKeys.delete(nodeId)

    let nodeData = findTreeNode(this.data, (node) => node[this.nodeKey] == nodeId)!

    if (checked) {
      this._checkedNodeKeys.add(nodeId)
    } else {
      this._checkedNodeKeys.delete(nodeId)
    }
    //级联
    if (this.checkType === CheckType.Cascade) {
      //children
      walkTree(nodeData, (c: any) => {
        let nId = String(c[this.nodeKey])
        const cb = this.treeCon.querySelector('[data-node-key="' + nId + '"] ce-checkbox') as Checkbox
        cb?.toggleCheck(checked)
        if (checked) {
          this._checkedNodeKeys.add(nId)
        } else {
          this._checkedNodeKeys.delete(nId)
        }
        this._indeterminateKeys.delete(nId)
      })
      //parent
      let parentData = nodeData
      do {
        walkTree(this.data, (node, parentNode) => {
          if (node[this.nodeKey] == parentData[this.nodeKey]) {
            parentData = parentNode
            return false
          }
        })
        if (!parentData) break;

        let isAllChecked = true
        let isAllUnChecked = true
        let pId = String(parentData[this.nodeKey])
        walkTree(parentData[this.childrenKey], (c: any) => {
          let key = String(c[this.nodeKey])
          if (this._checkedNodeKeys.has(key)) {
            isAllUnChecked = false
          } else {
            isAllChecked = false
          }
        })

        //虚拟列表父节点DOM可能为空
        const pNode = this.treeCon.querySelector('[data-node-key="' + pId + '"]')
        if (pNode) {
          const pCheckbox = pNode.querySelector<Checkbox>('ce-checkbox')!
          if (isAllChecked) {
            this._checkedNodeKeys.add(pId)
            pCheckbox.toggleCheck(true)
            pCheckbox.setIndeterminate(false)
            this._indeterminateKeys.delete(pId)
          } else if (isAllUnChecked) {
            this._checkedNodeKeys.delete(pId)
            pCheckbox.toggleCheck(false)
            pCheckbox.setIndeterminate(false)
            this._indeterminateKeys.delete(pId)
          } else {
            this._checkedNodeKeys.delete(pId)
            pCheckbox.setIndeterminate(true)
            this._indeterminateKeys.add(pId)
          }
        }
      } while (parentData)
    }

    let data = this.renderList[parseInt(nodeEl.dataset.rowIndex!)]
    this.emit("check", {
      node: nodeEl,
      data,
      checkedData: this._checkedNodeKeys
    });
  }
  onMouseleave(e: MouseEvent) {
    let t = e.relatedTarget as HTMLElement
    if (!t) return
    if (t.closest('.ce-tree-container') || t.closest('.ce-tree-drag-bar')) return
    this.lastDragEnterNode && this.lastDragEnterNode.classList.remove('ce-tree-dragover')
    this.lastDragEnterNode = null
    this.hideDragBar();
  }
  onDragEmit(e: Event) {
    const t = e.target as HTMLElement
    let dom = t.closest('[part="node"]') as HTMLElement;

    // 修复：#fillRow 只在 li 上写 dataset.nodeKey（= nodeKey prop 的值），
    // 从未写过 dataset.nodeId —— 原实现读 nodeId 恒为 undefined，
    // 导致 draggingNodeId 全链路失效（树内排序与 dataTransfer 均为 undefined）。
    this.draggingNodeId = dom.dataset.nodeKey!;
    t.parentElement?.setAttribute('draggable', 'true')
    // this.dragstart = true;
  }
  /**
   * show-drag 开启时整行内容均可发起拖拽（把手保留为视觉提示）。
   * 与 onDragEmit 同一入口：closest('[part="node"]') 取节点、置 draggable。
   * 注意布尔 prop 会被字段初始化器遮蔽，守卫需兼顾 hasAttribute（见 is-show-drag 同款）。
   * checkbox / caret 上的按下不发起拖拽，避免破坏勾选与展开交互。
   */
  onNodeContentMouseDown(e: MouseEvent) {
    if (!(this.showDrag || this.hasAttribute('show-drag'))) return
    const t = e.target as HTMLElement
    if (t.closest('.ce-tree-checkbox') || t.closest('.ce-tree-caret')) return
    // 节点声明不可拖（draggable:false）→ 即便把手不显示，也不允许从该行发起拖拽
    if (t.closest(`.${NO_DRAG_CLASS}`)) return
    this.onDragEmit(e)
  }
  onDragStart(e: DragEvent) {
    // 空源守卫：非拖拽发起路径（如宿主自行置 draggable）到达时 draggingNodeId
    // 为空，继续走会因 idNodeMap[''] → descendantsMap.get(undefined) 抛异常，
    // 且 dataTransfer 不会被写入。
    if (!this.draggingNodeId) return
    // 不可拖节点兜底：行元素被虚拟列表复用时可能仍带着上一轮设置的 draggable
    if ((e.target as HTMLElement).closest(`.${NO_DRAG_CLASS}`)) return
    // 新一轮拖拽：落点必须从零开始，否则 `onDrop` 会沿用上一次的落点
    this.lastDragEnterNode = null
    // 源节点 + 全部后代：拖动父节点时整棵子树一起走，也是"禁止拖入自身子树"的判据
    const draggingData = this.idNodeMap[this.draggingNodeId]
    const descendants = draggingData ? this.descendantsMap.get(draggingData) ?? [] : []
    this.draggingNodeIds = [this.draggingNodeId]
    each(descendants, (node) => {
      const id = this.nodeIdMap.get(node)
      if (id) this.draggingNodeIds.push(id)
    })

    e.stopPropagation()
    const t = e.target as HTMLElement
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      let dom = t.closest('[part="node"]') as HTMLElement;
      // (window as any)._draggingImage = dom

      this.draggingPreffix = this.draggingNodeId
      let label = dom!.firstElementChild!.querySelector('.ce-tree-label') as HTMLElement
      label.style.color = '#333'
      setTimeout(() => {
        label.style.color = 'unset'
      }, 10);
      e.dataTransfer.setDragImage(label, -10, -10);
      e.dataTransfer.setData('draggingNodeId', this.draggingNodeId)
    }
  }
  onDragbarEnter(e: DragEvent, t: HTMLElement) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = 'move'

    if (this.__lastDragDi) {
      this.__lastDragDi.classList.remove('is-selected')
    }

    let treeNode = e.target as HTMLElement
    if (treeNode) {
      treeNode.classList.add('is-selected')
      this.__lastDragDi = treeNode
    }
  }
  onDragEnter(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()

    const t = e.target as HTMLElement
    const node = t.closest('.ce-tree-node') as HTMLElement | null
    // 行键由 `#fillRow` 写在 `data-node-key`（`data-node-id` 从未存在过）
    const nodeKey = node?.dataset.nodeKey
    if (!nodeKey) return
    // 拖到自己或自己的后代上：不显示放置条，并清掉落点（否则 drop 会落到上一行）
    if (this.draggingNodeId === nodeKey || this.draggingNodeIds.includes(nodeKey)) {
      this.lastDragEnterNode && this.lastDragEnterNode.classList.remove('ce-tree-dragover')
      this.lastDragEnterNode = null
      this.hideDragBar();
      return;
    }
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

    if (this.lastDragEnterNode) {
      this.lastDragEnterNode.classList.remove('ce-tree-dragover')
    }

    let treeNode = t.closest<HTMLElement>('.ce-tree-node-content')
    if (treeNode) {
      treeNode.classList.add('ce-tree-dragover')
      this._dragEnter(treeNode)
      this.lastDragEnterNode = treeNode
    }
  }
  onDragEnd(e: DragEvent) {
    this.dragstart = 'auto'
    if (this.lastDragEnterNode) {
      this.lastDragEnterNode.classList.remove('ce-tree-dragover')
      this.lastDragEnterNode = null
    }

    this.draggingNodeId = '';
    this.draggingNodeIds = [];
    this.hideDragBar();
    this.draggingPreffix = ''
  }
  hideDragBar() {
    if (this.__lastDragDi) {
      this.__lastDragDi.classList.remove('is-selected')
    }
    if (!this.dragBar) return
    this.dragBar.style.top = "-1rem"
    this.dragBar.style.height = "0"
  }

  #selectNode(treeNode: HTMLElement, data: any) {
    this.emit("select", { node: treeNode, data });
    if (!data || !this.highlight) return;
    this.activeNodeKey = data[this.nodeKey]
    this.#applyActiveNode()
  }
  /**
   * 把当前选中 key 的高亮落到可见行上。
   *
   * 未做动态样式表的替换（那条链路依赖 `activeNodeKey` 的 watch 与生成选择器），
   * 改为在行元素上维护 `is-active` 类，样式见 style.scss；虚拟列表复用行，
   * 所以每次选中都按 key 统一刷一遍可见行。
   */
  #applyActiveNode() {
    if (!this.treeCon) return
    const active = this.activeNodeKey == null ? '' : String(this.activeNodeKey)
    this.treeCon.querySelectorAll<HTMLElement>('.ce-tree-node').forEach(row => {
      row.classList.toggle('is-active', !!row.dataset.nodeKey && row.dataset.nodeKey === active)
    })
  }
  __lastTreeNodeKey: string;
  //todo 这里需要遍历data，如果不再 collapsedData 中，还需要修改 collapsedData ，并自动展开所有parent
  selectNode(key: string) {
    if (this.__lastTreeNodeKey === key) return;
    let nodeData = findTreeNode(this.data, (node) => node[this.nodeKey] == key)
    if (nodeData) {
      this.__lastTreeNodeKey = key;
      let node = this.treeCon.querySelector(`.ce-tree-node[data-node-key="${key}"]`) as HTMLElement
      this.#selectNode(node, nodeData);
      let oh = this.scroller.offsetHeight
      let scrollTop = this.scroller.y
      if (this.vList.length > 0) {
        let i = findIndex(this.renderList, node => node[this.nodeKey] == key)
        let scrollTo = (i + 2) * this.rowHeight
        let offY = oh + scrollTop - scrollTo
        if (offY < 0) {
          this.scroller.scrollYTo(scrollTop - offY + this.rowHeight)
        }
      }
    }
  }
  removeNode(key: string | HTMLElement) {
    let node =
      key instanceof HTMLElement
        ? key
        : this.renderRoot!.querySelector(`.ce-tree-node[data-node-key="${key}"]`);
    if (node) {
      node.parentNode?.removeChild(node);
    }
  }

  getNode(key?: string) {
    let nodeData = findTreeNode(this.data, (node) => node[this.nodeKey] == key)
    if (nodeData) {
      let node = this.treeCon.querySelector(`.ce-tree-node[data-node-key="${key}"]`)
      return { node: node, data: nodeData }
    }
    return null
  }

  setFormatter(formatter: Function) {
    this.__formatter = formatter
  }
  _setFormat(node: Record<string, any>, rowIndex: number): string {
    if (!this.__formatter) return get<string>(this.renderList[rowIndex], 'label', '');
    return this.__formatter(node) as string
  }

  getCheckedNodes(indeterminate = false) {
    let rs = map(concat(toArray(this._checkedNodeKeys), indeterminate ? toArray(this._indeterminateKeys) : []), key => findTreeNode(this.data, (node) => node[this.nodeKey] == key))
    return rs
  }
  getCheckedKeys(indeterminate = false) {
    const keys = concat(toArray(this._checkedNodeKeys), indeterminate ? toArray(this._indeterminateKeys) : [])
    // 集合内键恒为字符串，对外还原成数据里的原始 key（通常是 number）
    return map(keys, key => {
      const node = this.#nodeByKey[key]
      return node ? node[this.nodeKey] : key
    })
  }

  toggleCheckAll(checked: boolean) {
    if (isEmpty(this.data)) return
    // 递归全量：`data` 只是根节点数组，只遍历一层会漏掉所有子节点
    const allKeys: string[] = []
    walkTree(this.data, (node: any) => { allKeys.push(String(node[this.nodeKey])) })
    // 无参调用语义为"切换"：未全选则全选，已全选则取消。
    if (isUndefined(checked)) {
      checked = this._checkedNodeKeys.size < allKeys.length
    }
    // 只同步 DOM 中存在的行（虚拟化/滚动外的行由下次 #fillRow 按集合回填）
    this.treeCon?.querySelectorAll('.ce-tree-node').forEach(row => {
      const key = (row as HTMLElement).dataset.nodeKey
      if (!key) return
      const cb = row.querySelector('ce-checkbox') as Checkbox | null
      cb?.setIndeterminate(false)
      cb?.toggleCheck(checked)
    })
    this._indeterminateKeys.clear()
    this._checkedNodeKeys.clear()
    if (checked) allKeys.forEach(k => this._checkedNodeKeys.add(k))
  }
  toggleCheckNode(key: string, checked: boolean) {
    let nodeData = findTreeNode(this.data, (node) => node[this.nodeKey] == key)
    if (!nodeData) return;
    const nodeCheckbox = this.treeCon.querySelector(`[data-node-key="${key}"] ce-checkbox`) as Checkbox
    nodeCheckbox?.setIndeterminate(false)
    nodeCheckbox?.toggleCheck(checked)
    const ck = String(key)
    if (checked) {
      this._checkedNodeKeys.add(ck)
    } else {
      this._checkedNodeKeys.delete(ck)
    }
    this._indeterminateKeys.delete(ck)
  }
  toggleCheckNodes(keys: string[], checked: boolean) {
    keys.forEach(key => {
      this.toggleCheckNode(key, checked)
    })
  }
}