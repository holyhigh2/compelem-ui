import { CompElem, forEach, html, prop, query, slot, state, tag, Template, watch } from "compelem";
import { clone, cloneDeep, closest, every, findTreeNode, get, remove, toArray, walkTree } from "myfx";
import { getBox } from "uiik";
import { ArrowDownLine, ArrowUpLine, MoveIn } from "../../../icons/icons";
import style from "./style.scss";
import { TreeNode } from "./TreeNode";

const CLASS_EXPAND = "__expanded";
const CLASS_ACTIVE = "__active";
export enum CheckType {
  Leaf = 'leaf',//只选择叶子节点
  Independent = 'independent',//全部可选择但子树不关联父节点
  Cascade = 'cascade'//全部可选择且子树关联父节点
}
/**
 * 树组件
 * @props
 *  data {array} 数据
 *  nodeKey {string} 节点唯一标识。默认 id
 *  labelKey {string} 用于节点显示的key。默认 label
 *  childrenKey {string} 用于获取子节点的key。默认 children
 *  indent {string|number} 缩进距离，单位像素。默认 14
 *  defaultExpandAll {boolean} 默认展开全部节点。默认 false
 *  showIndentLine {boolean} 显示缩进线。默认false
 *  highlight {boolean} 高亮选中。默认true
 *  defaultNode {string} 默认选中的节点标识，对应nodeKey在data中的值
 *  hover {boolean} 悬停效果，默认 true
 *  clickType {string} 点击类型node/label。默认 node
 *  expandOnClick {boolean} 点击时展开子树。默认 false
 *  contextmenu {boolean} 支持右键菜单，开启后右键也可以选中节点。默认false
 *  transition {boolean} 使用过渡动画。默认true
 *  round {boolean} 圆角背景
 *  showCheck {boolean} 显示复选框，默认false
 *  checkType {string} 选择模式，leaf/independent/cascade。默认cascade
 *  showDrag {boolean} 是否可拖动，默认false
 *  accordion {boolean} 手风琴模式，开启后同级只能展开一棵子树。默认false
 * 
 * @methods
 *  appendNode(parentNodeKey,data) 追加一个子节点，parentNode为null时，追加到根
 *  removeNode(data) 删除节点
 *  selectNode(key) 通过nodeKey选中节点
 *  setData(data) 重新设置tree数据
 *  getNode(key?):{node,data} 获取指定node或者当前选中node
 *  getCheckedNodes() 获取所有复选节点
 *  getCheckedKeys() 获取所有复选节点key（根据nodeKey)
 * @events
 *  nodeclick({node,data}) 点击节点时触发
 *  select({node,data}) 选中节点时触发，包含使用API选中
 *  nodecontextmenu({node,data,event}) 在节点上右键时触发，规则见 ContextMenu 组件
 *  check({node,data,checked}) 节点选中状态变化时触发
 * @slots
 *  default(data) 节点内容
 *
 * @author holyhigh2
 */
@tag("l-tree")
export class Tree extends CompElem {
  __formatter: Function;
  //////////////////////////////////// props
  @prop({ type: Array, required: true, sync: true }) data: Array<Record<string, any>>;
  @prop highlight = true;
  @prop showIndentLine = false;
  @prop nodeKey = "id";
  @prop labelKey = "label";
  @prop childrenKey = "children";
  @prop indent = 14;
  @prop defaultExpandAll = true;
  @prop transition = true;
  @prop round = true;
  @prop contextmenu = true;
  @prop({ type: String }) defaultNode: string;
  @prop({ type: Function }) getChildren: (node: TreeNode) => Promise<any>;
  @prop expandOnClick = false;
  @prop hover = true;
  @prop clickType = "node";
  @prop showCheck = false;
  @prop checkType = CheckType.Cascade;

  @prop showDrag = false;
  @prop accordion = false;

  @state key = 0;
  @state draggingNodeId = '';
  checkedNodes: Set<TreeNode> = new Set()

  currentNodeId: string
  activeNode: TreeNode;
  //所有treeNode的map
  nodeMap: Record<string, TreeNode> = {};
  //上次拖动进入的节点
  lastDragEnterNode: HTMLElement

  @query('.drag-bar')
  dragBar: HTMLElement

  static get autoSlot() {
    return false;
  }

  /////////////////////////////////// styles
  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  @watch("dataList", { immediate: false, deep: true })
  function(nv: any, ov: any, sourceName: string) {
    console.log('treeechange...', nv)
  }

  //////////////////////////////////// lifecycles
  render(): Template {
    return html`
    <div class="c-tree" @contextmenu="${this.onContextMenu}" >
      <div class="all-nodes">
      ${forEach(this.data, (node: any) => html`
        <l-tree-node key="${this._getNodeId(node)}" part="node"
        node-key="${this._getNodeId(node)}" 
        .hover="${this.clickType}" 
        .round="${this.round}"
        .indent-line="${this.showIndentLine}"
        .transition="${this.transition}"
        .node="${node}" .level="${0}">
          ${this.slotHooks.default ? slot(this.slotHooks.default) : html`<slot slot-props></slot>`}
        </l-tree-node>`
    )}
      </div>
      <div class="drag-bar" ?round="${this.round}" @dragenter="${this.onDragEnter}" @dragover.prevent @drop="${this.onDrop}">
        <div name="drag-di" action="insertBefore" style="min-width: 20%;"><l-icon .svg="${ArrowUpLine}"></l-icon></div>
        <div name="drag-di" action="append" style="flex:1"><l-icon .svg="${MoveIn}"></l-icon></div>
        <div name="drag-di" action="insertAfter" style="min-width: 20%;"><l-icon .svg="${ArrowDownLine}"></l-icon></div>
      </div>
    </div>
    `;
  }

  shouldUpdate(changed: Record<string, any>): boolean {
    // if (changed.data && changed.data.chain.length > 2) return false;
    return true;
  }

  //////////////////////////////////// methods
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
  _toggleCheckNode(node: TreeNode, checked: boolean) {
    if (checked) {
      this.checkedNodes.add(node)
    } else {
      this.checkedNodes.delete(node)
    }

    //级联
    if (this.checkType === CheckType.Cascade) {
      node.childTreeNodes && walkTree(node.childTreeNodes, (c: TreeNode) => {
        let treeNode = this.nodeMap[c.id]
        treeNode.toggleCheck(checked)
      }, { childrenKey: 'children' })

      if (checked) {
        closest(node.parentComponent!, (p: TreeNode) => {
          if (p instanceof Tree) return true;
          if (every(p.childTreeNodes, c => this.nodeMap[c.id].isChecked())) {
            p.toggleCheck(true)
            p.setIndeterminate(false)
          } else {
            p.setIndeterminate(true)
          }
          return false;
        }, 'parentComponent')
      } else {
        closest(node.parentComponent!, (p: TreeNode) => {
          if (p instanceof Tree) return true;

          if (every(p.childTreeNodes, c => !this.nodeMap[c.id].isChecked())) {
            p.toggleCheck(false)
            p.setIndeterminate(false)
          } else {
            p.setIndeterminate(true)
          }

          return false;
        }, 'parentComponent')
      }
    }

    let id = node.dataset.nodeKey;
    let data = findTreeNode(this.data, (node) => node[this.nodeKey] == id);
    this.emit("check", {
      node,
      data,
      checkedNodes: toArray(this.checkedNodes)
    });
  }
  onContextMenu(treeNode: TreeNode, t: HTMLElement, isCaret: boolean, e: Event) {
    if (!this.contextmenu) return;
    if (treeNode instanceof Event) return;

    let clickType = this.clickType;
    let node: HTMLElement | null = null;
    if (clickType === "label") {
      if (isCaret || t.classList.contains("--label") || t.closest(".--label")) {
        node = t.closest(".c-tree-node");
      }
    } else if (
      t.classList.contains("c-tree-node-content") ||
      t.closest(".c-tree-node-content")
    ) {
      node = t.closest(".c-tree-node");
    }
    if (!node) return;

    let id = node.dataset.nodeKey;
    let data = findTreeNode(this.data, (node) => node[this.nodeKey] == id);
    this.#selectNode(treeNode, data);

    this.emit("nodecontextmenu", {
      node,
      data
    }, e);
  }
  onClick(treeNode: TreeNode, t: HTMLElement, isCaret: boolean, e: Event) {
    let node: HTMLElement | null = null;
    let clickType = this.clickType;

    if (clickType === "label") {
      if (isCaret || t.classList.contains("--label") || t.closest(".--label")) {
        node = t.closest(".c-tree-node");
      }
    } else if (
      t.classList.contains("c-tree-node-content") ||
      t.closest(".c-tree-node-content")
    ) {
      node = t.closest(".c-tree-node");
    }
    if (!node) return;

    if (!isCaret) {
      let id = node.dataset.nodeKey;
      let data = findTreeNode(
        this.data,
        (node) => node[this.nodeKey] == id
      );

      this.emit("nodeclick", { node, data }, { event: e });
      this.#selectNode(treeNode, data);
    }

    if (isCaret || this.expandOnClick) {
      if (node.classList.contains(CLASS_EXPAND)) {
        node.classList.remove(CLASS_EXPAND);
      } else {
        node.classList.add(CLASS_EXPAND);
      }
    }
    if (!isCaret && clickType === 'node') {
      treeNode.toggleCheck()
    }
    if (this.activeNode) {
      this.activeNode.renderRoot.classList.remove(CLASS_ACTIVE);
    }
    this.activeNode = treeNode;
    treeNode.renderRoot.classList.add(CLASS_ACTIVE);
  }
  #selectNode(treeNode: TreeNode, data: any) {
    if (this.activeNode) {
      this.activeNode.renderRoot.classList.remove(CLASS_ACTIVE);
    }
    this.activeNode = treeNode;
    treeNode.renderRoot.classList.add(CLASS_ACTIVE);
    this.currentNodeId = this._getNodeId(treeNode.node)

    this.emit("select", { node: treeNode, data });
  }

  selectNode(key: string) {
    let node = this.nodeMap[key]
    if (node) {
      let data = findTreeNode(
        this.data,
        (node) => node[this.nodeKey] == key
      );
      this.#selectNode(node as TreeNode, data);
    }
  }
  removeNode(key: string | HTMLElement) {
    let node =
      key instanceof HTMLElement
        ? key
        : this.renderRoot.querySelector(`.c-tree-node[data-node-key="${key}"]`);
    if (node) {
      node.parentNode?.removeChild(node);
    }
  }

  getNode(key?: string) {
    let k = key || this.currentNodeId
    let node = this.nodeMap[k]
    if (node) {
      let data = findTreeNode(
        this.data,
        (node) => node[this.nodeKey] == k
      );
      return { node: node, data: clone(data!) }
    }
    return null
  }

  setFormatter(formatter: Function) {
    this.__formatter = formatter
  }
  onDragEnter(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = 'move'

    let t = e.target as HTMLElement

    if (this.__lastDragDi) {
      this.__lastDragDi.classList.remove('__selected')
    }

    let treeNode = t
    if (treeNode) {
      treeNode.classList.add('__selected')
      this.__lastDragDi = treeNode
    }
  }
  onDrop(e: DragEvent) {
    let t = e.target as HTMLElement
    let action = t.getAttribute('action')
    let nodeId = this.lastDragEnterNode.dataset.nodeId
    //插入指定节点
    let draggingParent: Record<string, any> = {};
    let draggingData: Record<string, any> = {};
    let targetData: Record<string, any> = {};
    let targetParent: Record<string, any> = {};
    findTreeNode(this.data, (c, p) => {
      if (c.id === this.draggingNodeId) {
        draggingParent = p
        draggingData = cloneDeep(c)
      }
      if (c.id === nodeId) {
        targetData = c
        targetParent = p
      }
      return false;
    })
    //del
    remove(draggingParent?.children ?? this.data, (c: Record<string, any>) => c.id === this.draggingNodeId)
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
    //refresh
    // this.nodeMap[targetParent.id!].forceUpdate()

    console.log(this.data)
  }
  hideDragBar() {
    if (this.__lastDragDi) {
      this.__lastDragDi.classList.remove('__selected')
    }
    this.dragBar.style.top = "-1rem"
    this.dragBar.style.height = "0"
  }
}
