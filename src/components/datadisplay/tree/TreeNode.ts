import { closest, isEmpty, isObject, map, size } from "myfx";
import { CaretRight, Drag } from "../../../icons/icons";

import { classes, CompElem, computed, forEach, html, ifTrue, prop, query, slot, state, styles, tag, Template, watch } from "compelem";
import { Checkbox } from "../../form/checkbox/Checkbox";
import style from "./style.scss";
import { CheckType, Tree } from "./Tree";

const CLASS_EXPAND = "__expanded";
/**
 * 树节点组件
 * @slots
 *  default(data) 节点内容
 *
 * @author holyhigh2
 */
@tag("l-tree-node")
export class TreeNode extends CompElem {
  tree: Tree;
  //////////////////////////////////// init
  static get styles(): string[] {
    return [style];
  }
  //////////////////////////////////// props
  @prop({ type: Object, required: true }) node: Record<string, any>;

  @prop level = 0;
  @prop indent = 14;
  @prop round = false;
  @prop hover = 'node';
  @prop indentLine = true;
  @prop transition = true;

  @state private label = '';
  @state private nodeId = '';
  @state({
    hasChanged(nv: any[], ov: any[]) {
      if (nv === ov) {
        if (isObject(nv)) {
          let lastChildKeys = map(nv, node => this.tree._getNodeId(node)).join('|');
          if (this.__lastChildKeys !== lastChildKeys) {
            this.__lastChildKeys = lastChildKeys;
            return true;
          }
          return false;
        } else {
          return false;
        }
      }
      if (nv) {
        this.__lastChildKeys = map(nv, node => this.tree._getNodeId(node)).join('|')
      }
      return true;
    }
  }) childTreeNodes: Array<Record<string, any>>;

  @state private expand = false;
  @state private showCheck = false;
  @state private checkType = '';
  @state private indeterminate = false;
  @state showDrag = false;
  @state dragstart: boolean | string = false;
  @state draggingNodeId = '';

  __lastChildKeys: string;

  @query('.--label')
  labelEl: HTMLElement;

  @query('l-checkbox')
  checkbox: Checkbox

  @query('.c-tree-node-content')
  nodeContent: HTMLElement

  /////////////////////////////////// watches
  @watch('node', { immediate: true, deep: true })
  watchNode(nv: Record<string, any>, ov: any) {
    this.label = this.tree._getLabel(nv)
    this.nodeId = this.tree._getNodeId(nv)
    this.childTreeNodes = this.tree._getNodeChildren(nv)
    this.expand = this.tree.defaultExpandAll
    this.showCheck = this.tree.showCheck
    this.checkType = this.tree.checkType
    this.showDrag = this.tree.showDrag
  }

  @watch(['tree.showCheck', 'tree.checkType', 'tree.showDrag', 'tree.draggingNodeId'])
  watchTree(nv: boolean, ov: boolean, srcName: string) {
    this[srcName] = nv
  }

  // @watch('childTreeNodes')
  // watchChildren(nv: any) {
  //   debugger
  // }

  @computed
  get showCheckbox() {
    let ct = this.checkType
    let rs = this.showCheck ? (ct === CheckType.Leaf ? isEmpty(this.childTreeNodes) : true) : false;

    return rs;
  }

  //////////////////////////////////// lifecycles
  shouldUpdate(changed: Record<string, any>): boolean {
    if (size(changed) < 2 && changed.draggingNodeId) {
      return false;
    }
    return true;
  }
  render(): Template {
    return html`
      <div part="node" @click="${this.onClick}" @contextmenu="${this.onContextMenu}" 
        class="c-tree-node ${classes({
      [CLASS_EXPAND]: this.expand,
      [`__hover-${this.hover}`]: this.hover,
      __round: this.round,
      __transition: this.transition,
      __dragging: !!this.draggingNodeId,
      "__indent-line": this.indentLine,
    })}"
        data-node-key="${this.nodeId}"
      >
        <div part="node-content" data-node-id="${this.nodeId}"
          draggable="${this.dragstart}" @dragstart="${this.onDragStart}" @dragend="${this.onDragEnd}" @dragenter="${this.onDragEnter}"
          class="c-tree-node-content"
          style="${styles({
      'padding-left': (this.indent * this.level) + 'px'
    })}"
        >
          <span class="--caret" part="">${ifTrue(!isEmpty(this.childTreeNodes), () => html`<l-icon .svg="${CaretRight}"></l-icon>`)}</span>
          ${ifTrue(this.showCheckbox, () => html`<span class="--checkbox"><l-checkbox .indeterminate="${this.indeterminate}" @click.stop @change="${this.onCheck}"></l-checkbox></span>`)}
          ${ifTrue(this.showDrag, () => html`<span class="--dragflag" @mousedown="${this.onDragEmit}"><l-icon .svg="${Drag}"></l-icon></span>`)}
          <span class="--label" part="node-label">
            ${this.slots.default}
            ${this.slotHooks.default ? slot(this.slotHooks.default) : this.slots.default ? html`<slot .data="${this.node}"></slot>` : this.tree.__formatter ? this.tree.__formatter(this.node) : this.label}
          </span>
          <div class="">
          </div>
        </div>
        ${ifTrue(!!this.childTreeNodes,
      () => html`<div class="c-tree-node-children">
            <div class="--wrapper">
            ${forEach(this.childTreeNodes, (node: any) => html`<l-tree-node key="${this.tree._getNodeId(node)}" node-key="${this.tree._getNodeId(node)}" 
              .hover="${this.hover}"
              .round="${this.round}"
              .indent-line="${this.indentLine}"
              .transition="${this.transition}"
              .node="${node}" .level="${this.level + 1}">
              ${this.slotHooks.default ? slot(this.slotHooks.default) : html`<slot slot-props></slot>`}
              </l-tree-node>`
      )}
            </div>
            <div
              class="--indent-line"
              style="left:${this.indent * (this.level + 1)}px"
            ></div>
          </div>`
    )}
      </div>
    `;
  }

  propsReady() {
    let tree = closest<Tree>(this.parentComponent!, (node) => node instanceof Tree, "parentComponent")
    if (!tree) {
      console.error('没有tree')
      return;
    }
    tree.nodeMap[this.node.id] = this;
    this.tree = tree;
  }

  //////////////////////////////////// methods
  onDragEmit() {
    this.dragstart = true;
  }
  onDragStart(e: DragEvent) {
    this.tree.draggingNodeId = this.node.id;
    e.stopPropagation()
    const t = e.target as HTMLElement
    if (e.dataTransfer) {
      // e.dataTransfer.effectAllowed = 'move'
      let dom = t.querySelector('.--label') as HTMLElement
      (window as any)._draggingImage = dom
      dom.style.opacity = "0.1"
      dom.style.color = "rgb(0,0,0,.2)"
      dom.style.background = 'linear-gradient(90deg, var(--hover-color) 10%, transparent)'
      e.dataTransfer.setDragImage(dom!, -10, -10);
    }
  }
  onDragEnter(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (this.tree.draggingNodeId === this.node.id) return;

    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    let t = e.target as HTMLElement

    if (this.tree.lastDragEnterNode) {
      this.tree.lastDragEnterNode.classList.remove('__dragover')
    }

    let treeNode = t.closest<HTMLElement>('.c-tree-node-content')
    if (treeNode) {
      treeNode.classList.add('__dragover')
      this.tree._dragEnter(treeNode as HTMLElement)
      this.tree.lastDragEnterNode = treeNode
    }
  }
  onDragEnd(e: DragEvent) {
    this.dragstart = 'auto'
    if (this.tree.lastDragEnterNode) {
      this.tree.lastDragEnterNode.classList.remove('__dragover')
    }

    this.tree.draggingNodeId = '';
    this.tree.hideDragBar();

    let dom = (window as any)._draggingImage
    dom.style.opacity = "unset"
    dom.style.color = "unset"
    dom.style.background = 'unset'
  }
  onContextMenu(e: Event) {
    let t = e.target as HTMLElement;
    let isCaret = t.classList.contains("--caret");

    this.tree.onContextMenu(this, t, isCaret, e);
  }
  onClick(e: MouseEvent) {
    let t = e.target as HTMLElement;
    let isCaret = t.classList.contains("--caret");

    this.tree.onClick(this, t, isCaret, e);

    e.stopPropagation();
  }
  onCheck(e: CustomEvent) {
    let checked = e.detail.checked
    this.tree._toggleCheckNode(this, checked)
  }
  getLabelEl() {
    return this.labelEl
  }
  toggleCheck(checked?: boolean) {
    this.checkbox?.toggleCheck(checked)
  }
  setIndeterminate(checked: boolean) {
    this.indeterminate = checked;
  }
  isChecked() {
    return this.checkbox.checked
  }
}