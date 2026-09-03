import { classes, CompElem, computed, css, csscope, Csscope, debounced, emits, forEach, h, prop, query, state, styles, tag, Template, watch } from "compelem";
import { arrayToTree, assign, concat, each, filterTree, findIndex, findTreeNode, get, isEmpty, isUndefined, map, range, remove, size, tail, test, toArray, trim, walkTree } from "myfx";
import { getBox } from "uiik";
import { CLASS_EXPAND, TreeStructured } from "../../../mixins/TreeStructured";
import { Virtualized } from "../../../mixins/Virtualized";
import { isVisible } from "../../../utils/utils";
import { Checkbox } from "../../form/checkbox/Checkbox";
import { Scroller } from "../scroller/Scroller";
import style from "./style.scss?tmpl";

export enum CheckType {
  Leaf = 'leaf',//只选择叶子节点
  Independent = 'independent',//全部可选择但子树不关联父节点
  Cascade = 'cascade'//全部可选择且子树关联父节点
}
/**
 * 树组件
 * @props
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
 *  nodecontextmenu({node,data,event}) 在节点上右键时触发，规则见 ContextMenu 组件
 *  check({node,data,checked}) 节点选中状态变化时触发
 *
 * @author holyhigh2
 */
@emits('nodeclick', 'select', 'nodecontextmenu', 'check')
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

  @state expandedIdMap: Record<string, boolean> = {}
  @state({ shallow: true }) treeData: Record<string, any>[] = []
  @state({ shallow: true }) filterTreeData: typeof this.treeData | undefined = undefined
  @state refreshRenderSeed = 0

  @state key = 0;
  draggingNodeId = '';
  @state vScrollWidth: number = 0
  @state vScrollHeight: number = 0

  currentNodeId: string
  @state activeNodeKey: string;
  @state draggingPreffix: string;
  //上次拖动进入的节点
  lastDragEnterNode: HTMLElement
  childrenMap = new WeakMap<Record<string, any>, Record<string, any>[]>()
  descendantsMap = new WeakMap<Record<string, any>, Record<string, any>[]>()
  nodeIdMap = new WeakMap<Record<string, any>, string>()
  idNodeMap: Record<string, Record<string, any>> = {}

  //check
  _checkedNodeKeys: Set<string> = new Set()
  _indeterminateKeys: Set<string> = new Set()
  //disable
  _disabledNodeKeys: Set<string> = new Set()
  _disabledCheckboxNodeKeys: Set<string> = new Set()

  @query('.ce-tree-drag-bar')
  dragBar: HTMLElement

  @query('.ce-tree-container')
  treeCon: HTMLElement

  ///////////////////////////////////////////虚拟化
  @prop rowHeight = 30;
  @state vCachedRows = 0;

  @state vList: HTMLElement[] = []
  @query('#vpillar')
  declare vPillar: HTMLElement
  @query('ce-scroller')
  scroller: Scroller

  connectedCallback() {
    super.connectedCallback()
    // Virtualized mixin declares vRowHeight: number (no initializer) which becomes a bare
    // declaration under useDefineForClassFields — the property is never created on instances.
    // Sync from rowHeight so the virtual list can calculate visible rows.
    this.vRowHeight = this.vRowHeight || this.rowHeight || 30
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
    new MutationObserver(applyShowCheck).observe(this, { attributes: true, attributeFilter: ['show-check'] })

    // defaultExpandAll: call expandToLevel when attribute is present
    if (this.hasAttribute('default-expand-all')) {
      setTimeout(() => this.expandToLevel(9999), 100)
    }
    new MutationObserver(() => {
      if (this.hasAttribute('default-expand-all')) {
        this.expandToLevel(9999)
      }
    }).observe(this, { attributes: true, attributeFilter: ['default-expand-all'] })

    // expandOnClick: track attribute state for onClick handler
    this.#expandOnClickFromAttr = this.hasAttribute('expand-on-click')
    new MutationObserver(() => {
      this.#expandOnClickFromAttr = this.hasAttribute('expand-on-click')
    }).observe(this, { attributes: true, attributeFilter: ['expand-on-click'] })
  }
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
    let newSize = 0
    walkTree(nv, (node, parent, chain) => {
      newSize++
      let key = node[this.nodeKey]
      if (node.checked) {
        this._checkedNodeKeys.add(key)
      }
      if (node.disabled) {
        this._disabledNodeKeys.add(key)
      }
      if (node.disabledCheckbox) {
        this._disabledCheckboxNodeKeys.add(key)
      }
    })

    if (this._lastDataSize !== newSize && this.renderRoot) {
      this.resetVirtualList()
      // this.resetDefaultExpanded()
    }
    this._lastDataSize = newSize
    this.refreshRenderSeed = Math.random()
  }
  @watch('search')
  watchSearch(v: any) {
    this._doFilter()
    this.nextTick(() => {
      this.refreshView()
    })
  }

  @watch(['draggingPreffix'])
  updateDraggingPreffix() {
    this.__updatableStyleDragging?.replaceSync(this.__getDraggingPreffixCss())
  }
  @watch(['activeNodeKey'])
  updateActiveNodeKey() {
    this.__updatableStyleActive?.replaceSync(this.__getActiveCss())
  }
  /////////////////////////////////// computed
  @computed
  get renderList() {
    //seed
    let x = this.refreshRenderSeed;
    let data = this.filterTreeData ?? this.data

    data = data.length < 1 ? data : this.flattenTreeData(data)
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
      [`__hover-${this.clickType}`]: this.hover,
      "ce-tree-round": this.round,
      "ce-tree-indent-line": this.showIndentLine,
    })}
              >
                <div @dragstart="${this.onDragStart}" @dragend="${this.onDragEnd}" @dragenter="${this.onDragEnter}"
                  class="ce-tree-node-content"
                >
                  <span class="ce-tree-caret" part=""><ce-icon style="display:none" svg="c-svg-caret-right"></ce-icon></span>
                  <span class="ce-tree-checkbox"><ce-checkbox @click.stop @change="${this.onCheck}"></ce-checkbox></span>
                  <span class="ce-tree-dragflag" style="display:none" @mousedown="${this.onDragEmit}"><ce-icon svg="c-svg-drag"></ce-icon></span>
                  <span class="ce-tree-label" part="node-label">
                  </span>
                </div>
            </li>`)}
          </ul>
        </ce-scroller>
      <div class="ce-tree-drag-bar" ?round="${this.round}" @dragenter="${this.onDragbarEnter}" @dragover.prevent @drop="${this.onDrop}">
        <div name="drag-di" action="insertBefore" style="min-width: 20%;"><ce-icon svg="c-svg-caret-up" size="sm"></ce-icon></div>
        <div name="drag-di" action="append" style="flex:1"><ce-icon svg="c-svg-move-in" size="sm"></ce-icon></div>
        <div name="drag-di" action="insertAfter" style="min-width: 20%;"><ce-icon svg="c-svg-caret-down" size="sm"></ce-icon></div>
      </div>
    </div>
    `;
  }
  mounted(): void {
    this.__updatableStyleActive = this.insertStyleSheet(this.__getActiveCss())
    this.__updatableStyleDragging = this.insertStyleSheet(this.__getDraggingPreffixCss())
  }
  updated(changed: Record<string, any>): void {
    if (this.#updateView) {
      this.#updateView = false
      setTimeout(() => {
        //如果data长度发生变更
        // if (!changed.data) return;
        this.scroller.calcBounding()
        setTimeout(() => {
          this.refreshView()
        }, 100);

      }, 0)
    }
  }

  //////////////////////////////////// methods
  __getActiveCss() {
    return css`
      .ce-tree-node[data-node-key="${this.activeNodeKey}"] .--indent-line {
        border-color: var(--active-color);
      }
      .ce-tree-node[data-node-key="${this.activeNodeKey}"].__hover-node .ce-tree-node-content {
          color: var(--active-color);
          background-color: var(--active-bg-color);
          font-weight: bold;
      }
      .ce-tree-node[data-node-key="${this.activeNodeKey}"].__hover-label .ce-tree-node-content .--label {
          color: var(--active-color);
          background-color: var(--active-bg-color);
          font-weight: bold;
      }
    `
  }
  __getDraggingPreffixCss() {
    return css`
      .ce-tree-node[data-node-key^="${this.draggingPreffix}"] .ce-tree-node-content{
        color:var(--ce-color-border);
        background:linear-gradient(90deg, var(--hover-color) 10%, transparent)  !important;
      }
    `
  }
  _doFilter() {
    let s = trim(this.search)
    const pidMap: Record<string, any> = []
    let filterTreeData = filterTree(this.data, (node, parentNode, chain) => {
      let label = get(node, this.labelKey)
      let rs = test(label, s)
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
    })
    filterTreeData.forEach(fd => fd.pid = pidMap[fd[this.nodeKey]])
    const td = arrayToTree(filterTreeData, 'id', 'pid')
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
  /**
   * 更新当前视图数据，用于虚拟表格刷新
   */
  @debounced(50)
  refreshView() {
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
      this.#fillRow(row, rowIndex)
    })
  }

  #updateView = false
  __lastHeight = 0
  resetVirtualList() {
    let oh = this.renderRoot!.offsetHeight
    this.updateV(size(this.renderList), oh)

    //填充行数据
    this.#updateView = true
  }

  onResize() {
    if (!isVisible(this)) return;
    let oh = this.renderRoot!.offsetHeight
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
    if (!this.isMounted) return;

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
    nodeContent.style.paddingLeft = (this.indent * level) + 'px'
    //content
    let content = node.querySelector('.ce-tree-label')!

    this.#updateCaret(node, rowData)

    if (!rowData) {
      content.textContent = ''
      node.dataset.nodeKey = ''
      return
    }

    //disabled
    node.classList.toggle('ce-tree-disabled', this._disabledNodeKeys.has(key))

    //填充行数据
    let cellFn = rowData.cellTmpl
    //id
    node.dataset.nodeKey = key
    //checkbox
    let checkbox = node.querySelector('.ce-tree-checkbox ce-checkbox') as Checkbox
    checkbox?.toggleCheck(this._checkedNodeKeys.has(key))
    checkbox.setIndeterminate(this._indeterminateKeys.has(key))
    if (this._disabledCheckboxNodeKeys.has(key)) {
      checkbox.disabled = true
    }

    content.innerHTML = cellFn ? (cellFn(rowData) as Template).getHTML(this) : this._setFormat(rowData, rowIndex)
  }
  //更新node样式
  #updateCaret(node: HTMLElement, rowData: Record<string, any>) {

    let icon = node.querySelector('.ce-tree-caret')?.firstElementChild as HTMLElement
    //caret
    if (rowData && !isEmpty(rowData[this.childrenKey])) {
      icon.style.display = ''

      if (this.expandedIdMap[rowData[this.nodeKey]]) {
        node.classList.add(CLASS_EXPAND)
      } else {
        node.classList.remove(CLASS_EXPAND)
      }
    } else {
      icon.style.display = 'none'
    }
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
      if (this._checkedNodeKeys.has(key)) {
        this.toggleCheckNode(key, false)
      } else {
        this.toggleCheckNode(key, true)
      }
    }
  }

  onDrop(e: DragEvent) {
    let t = e.target as HTMLElement
    let action = t.getAttribute('action')
    let nodeEl = this.lastDragEnterNode.closest('.ce-tree-node') as HTMLElement
    let nodeId = nodeEl.dataset.nodeId!

    //插入指定节点
    let draggingParent: Record<string, any> = this.idNodeMap[this.draggingNodeId.replace(/-\d+$/, '')];
    let draggingData: Record<string, any> = this.idNodeMap[this.draggingNodeId];
    let targetData: Record<string, any> = this.idNodeMap[nodeId];
    let targetParent: Record<string, any> = this.idNodeMap[nodeId.replace(/-\d+$/, '')];

    //父不能移动到子
    let childNode = findTreeNode(this.descendantsMap.get(draggingData)!, c => this.nodeIdMap.get(c) === nodeId)
    if (childNode) return;

    //del
    remove(draggingParent?.children ?? this.data, (c: Record<string, any>) => this.nodeIdMap.get(c) === this.draggingNodeId)
    //add
    if (!targetData.children) {
      targetData.children = []
    }
    let ary = []
    let i = -1
    switch (action) {
      case 'insertBefore':
        ary = targetParent?.children || this.data
        i = ary.indexOf(targetData) //- 1
        if (i < 0) i = 0
        ary.splice(i, 0, draggingData)
        break;
      case 'append':
        targetData.children.push(draggingData)
        break;
      case 'insertAfter':
        ary = targetParent?.children || this.data
        i = ary.indexOf(targetData) + 1
        ary.splice(i, 0, draggingData)
        break;
    }

  }
  onCheck(obj: Record<string, any>) {
    if (!(obj.target instanceof Checkbox)) return

    let checked = obj.checked
    const nodeEl = obj.target.closest<HTMLElement>('.ce-tree-node')!
    const nodeCheckbox = nodeEl.querySelector('ce-checkbox') as Checkbox
    let nodeId = nodeEl.dataset.nodeKey!
    nodeCheckbox.setIndeterminate(false)
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
        let nId = c[this.nodeKey]
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
        let pId = parentData[this.nodeKey]
        walkTree(parentData[this.childrenKey], (c: any) => {
          let key = c[this.nodeKey]
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
    // if (!this.draggingPreffix) return;
    this.lastDragEnterNode && this.lastDragEnterNode.classList.remove('ce-tree-dragover')
    this.hideDragBar();
  }
  onDragEmit(e: Event) {
    const t = e.target as HTMLElement
    let dom = t.closest('[part="node"]') as HTMLElement;

    this.draggingNodeId = dom.dataset.nodeId!;
    t.parentElement?.setAttribute('draggable', 'true')
    // this.dragstart = true;
  }
  onDragStart(e: DragEvent) {
    let draggingNodeIds: string[] = [this.draggingNodeId]
    const descendants = this.descendantsMap.get(this.idNodeMap[this.draggingNodeId])!

    walkTree(descendants, node => {
      draggingNodeIds.push(this.nodeIdMap.get(node)!)
    })
    this.draggingNodeIds = draggingNodeIds

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
  onDragEnter(e: DragEvent, currentNode: HTMLElement) {
    e.preventDefault()
    e.stopPropagation()

    let t = e.target as HTMLElement

    let node = t.closest('.ce-tree-node') as HTMLElement

    const nodeId = node.dataset.nodeId
    if (this.draggingNodeId === nodeId) {
      this.lastDragEnterNode && this.lastDragEnterNode.classList.remove('ce-tree-dragover')
      this.hideDragBar();
      return;
    }
    if (this.draggingNodeIds.includes(nodeId)) {
      this.lastDragEnterNode && this.lastDragEnterNode.classList.remove('ce-tree-dragover')
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
      this._dragEnter(treeNode as HTMLElement)
      this.lastDragEnterNode = treeNode
    }
  }
  onDragEnd(e: DragEvent) {
    this.dragstart = 'auto'
    if (this.lastDragEnterNode) {
      this.lastDragEnterNode.classList.remove('ce-tree-dragover')
    }

    this.draggingNodeId = '';
    this.hideDragBar();
    this.draggingPreffix = ''
  }
  hideDragBar() {
    if (this.__lastDragDi) {
      this.__lastDragDi.classList.remove('is-selected')
    }
    this.dragBar.style.top = "-1rem"
    this.dragBar.style.height = "0"
  }

  #selectNode(treeNode: HTMLElement, data: any) {
    this.emit("select", { node: treeNode, data });

    this.activeNodeKey = data[this.nodeKey]
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
    return concat(toArray(this._checkedNodeKeys), indeterminate ? toArray(this._indeterminateKeys) : [])
  }

  toggleCheckAll(checked: boolean) {
    if (isUndefined(checked)) {
      checked != this._checkedNodeKeys.size > 0
    }
    const checkedData: typeof this._checkedNodeKeys = new Set()
    this.data.forEach(node => {
      let nId = node[this.nodeKey]
      const cb = this.treeCon.querySelector('[data-node-key="' + nId + '"] ce-checkbox') as Checkbox
      cb.setIndeterminate(false)
      cb?.toggleCheck(checked)
      if (checked) {
        checkedData.add(nId)
      }
    })
    this._indeterminateKeys.clear()
  }
  toggleCheckNode(key: string, checked: boolean) {
    let nodeData = findTreeNode(this.data, (node) => node[this.nodeKey] == key)
    if (!nodeData) return;
    const nodeCheckbox = this.treeCon.querySelector(`[data-node-key="${key}"] ce-checkbox`) as Checkbox
    nodeCheckbox.setIndeterminate(false)
    nodeCheckbox?.toggleCheck(checked)
    if (checked) {
      this._checkedNodeKeys.add(key)
    } else {
      this._checkedNodeKeys.delete(key)
    }
    this._indeterminateKeys.delete(key)
  }
  toggleCheckNodes(keys: string[], checked: boolean) {
    keys.forEach(key => {
      this.toggleCheckNode(key, checked)
    })
  }
}