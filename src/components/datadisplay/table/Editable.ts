import {
  assign,
  cloneDeep,
  closest,
  compact,
  concat,
  each,
  every,
  except,
  filter,
  findIndex,
  first,
  flat,
  flatMap,
  formatDate,
  formatNumber,
  get,
  includes,
  isBlank,
  isDefined,
  isEmpty,
  isNumber,
  isObject,
  isString,
  isUndefined,
  last,
  lowerCase,
  map,
  padStart,
  range,
  set,
  size,
  some,
  sort,
  split,
  startsWith,
  take,
  toArray,
  trim,
  union,
  upperCase
} from "myfx";
import { getBox } from "uiik";

import { CompElem, computed, csscope, Csscope, debounced, emits, event, h, prop, query, QueryCache, state, tag, Template, watch } from "compelem";
import { DataType } from "../../../constants";
import { attr, escapeHtml, showError } from "../../../utils/utils";
import { Message } from "../../feedback/message/Message";
import { ContextMenu } from "../../nav/contextmenu/ContextMenu";
import { MenuPane } from "../../nav/menupane/MenuPane";
import { Alert } from "../../overlays/modals/Alert";
import { useToast } from "../../overlays/toast/toast";
import { Column } from "./Column";
import { ColumnFoot } from "./ColumnFoot";
import { getMenuItems } from "./contextmenu";
import editableStyle from "./editableStyle.scss?tmpl";
import { tableStyleSheet } from "./styleSheets";
import { AVAILABLE_ROW_TAG, PRIV_COL_PREF, SCROLLER_COL_PROP, Table } from "./Table";
import { CellBox, CellPos, ColumnMeta, ColumnType, DataSelectionOption, SelectorMeta } from "./types";
const MultiSelectionDivider = " ";
const FormulaTag = "=";
const SelectorOffset = 2;
const BaseCode = 65;
const SnProp = '__sn'
const THRESHOLD = 5
//.selected-cell-bottom.selected-cell-right::after
const SELECTOR_OP_SIZE = 4
enum IndicatorAttrName {
  RowSn = 'data-row-sn',
  ColSn = 'data-col-sn'
}

export const CELL_CLASS_SELECTED_FILLER = 'ce-table-selected-filler-cell'
export const CELL_CLASS_SELECTED_FILLER_TOP = 'ce-table-selected-filler-cell-top'
export const CELL_CLASS_SELECTED_FILLER_BOTTOM = 'ce-table-selected-filler-cell-bottom'
export const CELL_CLASS_SELECTED_FILLER_LEFT = 'ce-table-selected-filler-cell-left'
export const CELL_CLASS_SELECTED_FILLER_RIGHT = 'ce-table-selected-filler-cell-right'

const NO_EDITING_TIP = '过滤数据禁止编辑'
const Command = {
  /**
   * 设置单元格内容
   * cells[{cell,oldValue,newValue}]
   */
  setCells: "setCells",
};
enum ChangeType {
  Input = 'input',
  Fill = 'fill',
  Paste = 'paste',
  Select = 'select',
  Delete = 'delete',
  Remove = 'remove',
  Insert = 'insert'
}
enum IndicatorType {
  Row = 'row',
  Column = 'column'
}
/**
 * 可编辑表格组件
 * 鼠标操作
 *  1. 左键点击 选中激活单元格
 *  2. 按住拖动 框选单元格
 *  3. 右键点击 编辑菜单
 *  4. 左键点击[按住shift] 与激活单元格构成新的选框
 *  5. 左键点击[按住ctrl] 复选单元格
 *  6. 直接输入可编辑内容
 * 键盘操作
 *  1. ctrl + C/V 复制/粘贴
 *  2. delete 删除内容
 *  3. backspace 清空输入框
 *  4. tab 跳转当前激活单元格
 *  5. 直接输入可编辑内容
 * 
 * 
 * @props
 *  height {number} table height,default 500px
 *  row-height {number} default 30px
 *  data {array} data list
 *  contextmenu {boolean} 是否支持右键菜单，默认true
 *  default-insert-size {number} 默认插入行数，默认5
 *  showRange {boolean} 显示范围输入框
 *  showIndicator {boolean | string} 显示行列标识，默认false。如果为row/column 则为对应行/列标识。复合表头会导致列标识显示异常
 *  trackIndicator {boolean} 在标识列/行上实时显示当前光标所在位置，默认true
 *  indicatorStyle {string|object} 列标识样式，支持css样式或对象
 *  edit-option {object} 编辑选项 dragselect 是否可以拖动多选，默认true；fillable 是否可填充数据（光标），默认true；pastable 是否可粘贴到表格，默认true；copyable 是否可复制，默认true; deletable 清除单元格，默认true
 * @events
 *  beforecellactive({cell,row,column,rowIndex,colIndex, value, cancel()}) 打开单元格编辑窗口前触发，可阻止激活
 *  cellactive({cell,row,column,rowIndex,colIndex, value}) 打开单元格编辑窗口时触发
 *  cellchange({cell,row,column,rowIndex,colIndex, value, prevValue}) 退出单元格编辑窗口后且内容发生变更时触发
 *  celldeactive({cell,row,column,rowIndex,colIndex, value, prevValue}) 退出单元格编辑窗口后触发
 *  beforecelldeactive({cell,row,column,rowIndex,colIndex, value, prevValue, cancel()}) 退出单元格编辑窗口前触发
 * 
 *  contextmenu({items,cells,rows,cancel()}) 打开右键菜单时触发，可编辑菜单项
 *  contextmenuselect({item}) 右键菜单选中某项后触发
 *  contextmenuinsert({data}) 右键菜单插入时触发，可以定制插入行的内容。data函数接收一个返回数据数组的函数，签名为(rowCount,props)=>[]
 *  
 *  change({type:input/fill/paste/select/delete/insert/remove,cells:[{cell,row,column,rowIndex,colIndex, value, prevValue}]}) 1-n个单元格内容变更后触发。cell可能为空，当type为insert/remove时，cells为null
 *  focuschange({cell,row,column,rowIndex,colIndex,toggleSelection(enabled,{dataSelection,dataSelectionOption}}) 焦点单元格变更时触发，可以控制单元格的数据选项
 *  select({cells}) 框选单元格结束后触发
 *  
 * @methods
 *  setNote(cellPos,msg) 设置单元格批注。msg为undefined时取消note
 *  getColumnIndex(propName) 通过列属性名获取列索引
 *  updateData()
 *
 * @author holyhigh2
 */
@emits('beforecellactive', 'cellactive', 'cellchange', 'celldeactive', 'beforecelldeactive', 'contextmenu', 'contextmenuinsert', 'change', 'select')
@tag("ce-editable")
export class Editable extends Table {

  //选框
  #el_selector: HTMLElement;
  #el_selector_caret: SVGElement;
  @query('ce-menu-pane')
  el_input_options: MenuPane;
  @query('ce-context-menu')
  el_context_menu: ContextMenu;
  #el_warning_msg: Message;
  @query('ce-alert')
  alert: Alert;
  @query('.ce-table-header')
  tableHeader: HTMLElement;
  @query('.ce-table-cell-input__text')
  inputCell: HTMLTextAreaElement
  @query('.ce-table-head ce-column[all]', QueryCache.ONCE)
  headColAll!: Column

  //编辑中
  activeCell: HTMLElement | null;
  focusCell: HTMLElement | null;
  focusCellPos: CellPos
  #startCell: HTMLElement | null;
  #endCell: HTMLElement | null;
  selectedCellsPos: Array<Array<CellPos>> | null;
  commandStack: Array<{ command: string; data: Record<string, any> }> = [];

  //用于selector操作
  #selectorMeta: Partial<SelectorMeta> = {}
  checkedCells: Array<CellPos> = []

  menuItems: Array<Record<string, any> | string | null> = getMenuItems(this);
  cellSelectionMap = new Map<string, []>
  cellSelectionOptionMap = new Map<string, DataSelectionOption>

  //计算公式
  formulaMap: Map<string, string> = new Map

  //当前锁定的单元格位置映射
  lockedPosMap: Record<string, string> = {}

  toast = useToast()

  @csscope(Csscope.INNER)
  static get css() {
    return [tableStyleSheet, editableStyle];
  }
  get cssVars() {
    return assign(super.cssVars, {
      '--editable-row-indicator-width': `${this.showRowIndicator ? this.rowIndicatorWidth : 0}px`
    })
  }
  /////////////////////////////////// computed
  @computed
  get showRowIndicator() {
    let rs = this.showIndicator === true || this.showIndicator === IndicatorType.Row
    return rs
  }
  @computed
  get showColumnIndicator() {
    let rs = this.showIndicator === true || this.showIndicator === IndicatorType.Column
    return rs
  }
  /////////////////////////////////// watches
  @watch('showIndicator')
  watchShowIndicator(v: number) {
    this.nextTick(() => {
      let headerExtCol = this.renderRoot?.querySelector<Column>('.ce-table-head ce-column[all]')
      if (headerExtCol) {
        headerExtCol.style.height = this.tableHead.clientHeight + 'px'
      }

      this.__toggleIndicatorClasses()
    })
  }
  @watch('showHeader')
  watchShowHeader() {
    this.__toggleIndicatorClasses()
  }
  @watch('trackIndicator')
  watchTrackIndicator(v: boolean) {
    if (!this.renderRoot) return
    this.renderRoot.classList.toggle('ce-table-track-indicator', v)
  }
  /** 指示器/表头状态类与 editableStyle.scss 选择器保持一致（is-show-row/column-indicator、is-header-hidden） */
  __toggleIndicatorClasses() {
    const root = this.renderRoot
    if (!root) return
    root.classList.toggle('is-show-row-indicator', this.showRowIndicator)
    root.classList.toggle('is-show-column-indicator', this.showColumnIndicator)
    // 隐藏表头但开启列标识时，保留一条窄列标栏用于显示 A/B/C 列标（见 editableStyle 的 .is-header-hidden）
    root.classList.toggle('is-header-hidden', !this.showHeader && this.showColumnIndicator)
  }
  //////////////////////////////////// props
  @prop contextmenu = true;
  @prop defaultInsertSize = 5;
  @prop showRange = true;
  @prop trackIndicator = true;
  @prop({ type: [Boolean, String] }) showIndicator: boolean | string = false;
  @prop({ type: [Object, String] }) indicatorStyle: string | Record<string, any>
  @prop({ type: Object }) editOption = { dragselect: true, fillable: true, pastable: true, copyable: true, deletable: true }

  @state rowIndicatorWidth = 30
  @state trackIndicatorProp = ''

  //////////////////////////////////// lifecycles
  render(): Template {
    const superTmpl = super.render();

    let selectorTmpl = h`
      <div class="ce-table-selector-caret" @click="${this.onClickCaret}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
          <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
        </svg>
      </div>
      <textarea class="ce-table-cell-input__text" @input="${this.onInput}"></textarea>
      <div class="ce-table-selector-filler"></div>
      <ce-message class="ce-table-tipmsg" id="warningmsg" closable type="warning" descr="输入内容与限制选项不符" @close="${this.onCloseTip}"></ce-message>
    `
    superTmpl.insert(22, selectorTmpl)

    let tmpl = h`
      <ce-menu-pane round="false" items="[]" theme="light" @select="${this.onSelectOption}"></ce-menu-pane>
      <ce-alert></ce-alert>
      </div>
    `

    if (this.showRowIndicator) {
      superTmpl.strings[8] = superTmpl.strings[8].replace(/(<div class="ce-table-column-fixed is-left"\s+part="fixed-column">)/, `
        <ce-column fixed prop="${SnProp}" all resizable="false" width="${this.rowIndicatorWidth}" silent min-width="30"></ce-column>
        $1`)

      superTmpl.strings[27] = superTmpl.strings[27].replace(/(<div class="ce-table-column-fixed is-left"\s+part="fixed-column">)/, `
        <ce-column-foot fixed ext-column prop="${SnProp}" foot resizable="false" width="${this.rowIndicatorWidth}" min-width="30"></ce-column-foot>
        $1`)
    }


    superTmpl.strings[superTmpl.strings.length - 1] = "";
    return superTmpl.append(tmpl)
  }
  constructor() {
    super();
  }
  connectedCallback() {
    super.connectedCallback();

    this.#el_selector_caret = this.renderRoot!.querySelector(".ce-table-selector-caret"
    )!;
    this.#el_warning_msg = this.renderRoot!.querySelector("#warningmsg")!;

    if (this.showRowIndicator) {
      this.snWidthDetector = document.createElement('div')
      this.snWidthDetector.style.cssText = 'position:absolute;left:-100px;top:-100px;visibility: hidden;overflow:hidden;padding-inline:.5rem;width:' + this.rowIndicatorWidth + 'px'
      this.renderRoot!.appendChild(this.snWidthDetector)

      if (this.trackIndicator) {
        // this.tableBody.addEventListener('mouseover', this.onMouseOver.bind(this))
        // this.addEventListener('mouseover', this.onMouseOverColumn.bind(this))
      }
    }

  }
  onColumnVisibleChange() {

  }
  onColumnFix() {

  }
  onColumnMove(colProp: string, toProp: string) {

  }
  onColumnChange() {
    if (this.showColumnIndicator) {
      let i = 0;
      each(this.allColumns, col => {
        if (col.prop === SCROLLER_COL_PROP) return;
        let colEl = this._fieldMap.get(col.prop)
        if (colEl && !(colEl.parentComponent instanceof Column)) colEl.renderRoot!.style.height = this.headerHeight * this.headerRows + 'px'
        colEl?.setAttribute(IndicatorAttrName.ColSn, this._getColumnChar(i++))
      })

      this.watchShowIndicator(1)
    }
  }
  onContextMenuSelect(obj: Record<string, any>) {
    super.onContextMenuSelect(obj)
    let { item, el } = obj
    this.onMenuSelect(item, el)
  }
  _onContextMenu(obj: Record<string, any>) {
    let { items, cells } = obj
    if (!this.contextmenu) return

    items.push(null, ...getMenuItems(this))
  }
  mounted() {
    super.mounted()
    this.renderRoot!.classList.add("editable");
    this.renderRoot?.classList.toggle('ce-table-track-indicator', this.trackIndicator)
    this.__toggleIndicatorClasses()

    if (this.showRowIndicator) {
      this.__recalcSnWidth();
    }

    if (get(this.editOption, 'fillable', true)) {
      this.renderRoot!.classList.add("fillable");
    }
  }
  onListReady() {
    super.onListReady()
    let headerExtCol = this.headColAll
    if (headerExtCol) {
      headerExtCol.style.height = this.tableHead.clientHeight + 'px'
    }
  }
  shouldUpdate(changed: Record<string, any>): boolean {
    if (!super.shouldUpdate(changed)) return false;
    const selectionChange = every(changed, (v, k) => k.indexOf('scrollColumns') > -1)
    if (selectionChange) return false;
    return true
  }
  //////////////////////////////////// methods
  doCommand(command: string, data: Record<string, any>) {
    this.onCommand(command, data);
    this.commandStack.push({ command, data });
  }
  _getCellPosKey(cell: CellPos) {
    return `${cell.rowIndex}_${cell.colIndex}_${cell.prop}`
  }
  isEqualCell(n1: HTMLElement, n2?: HTMLElement) {
    if (!n1 || !n2) return false;
    return (
      n1.dataset.colIndex == n2.dataset.colIndex &&
      n1.closest<HTMLElement>('.ce-table-row')?.dataset.rowIndex == n2.closest<HTMLElement>('.ce-table-row')?.dataset.rowIndex
    );
  }
  onDataChange(sizeChanged: boolean) {
    if (!sizeChanged) return;

    // this.refreshView()

    this.hideSelector()
    // clear formula
    this.formulaMap.clear()
  }
  /********* layout **********/
  onResize() {
    super.onResize()
  }
  //数字个数对应宽度，用于判断是否对应正确宽度
  sizeMap = new Map()
  @debounced(50)
  __recalcSnWidth() {
    let len = size(this.snWidthDetector.textContent)
    let offset = this.snWidthDetector.scrollWidth - this.snWidthDetector.offsetWidth
    let headerExtCol = this.headColAll
    if (!headerExtCol) return;

    if (Math.abs(this.sizeMap.get(len) - parseInt(headerExtCol.style.width)) > 5) {
      offset = 1
    }
    if (offset > 0) {
      this.rowIndicatorWidth = this.snWidthDetector.scrollWidth

      headerExtCol.style.width = this.rowIndicatorWidth + 'px'

      let footExtCol = this.renderRoot!.querySelector<ColumnFoot>('ce-column-foot[ext-column]')
      if (footExtCol) footExtCol.style.width = this.rowIndicatorWidth + 'px'
    }
    if (!this.sizeMap.has(len)) {
      this.sizeMap.set(len, this.rowIndicatorWidth)
    }

    if (this.fit) {
      this._fitWidth()
    }
    this._updateScrollWidth()
  }
  onScroll(obj: Record<string, any>) {
    super.onScroll(obj)
    let { to, direction, preventDefault } = obj
    if (direction === 'h') {
      if (!this._scrolled) {
        return;
      }
      //修复右侧超出父元素的宽度撑开问题
      if (this.bodyCon.scrollLeft > 0) {
        this.bodyCon.scrollLeft = 0
      }
      // this._relocateSelector()
      // this.locateSelectorCopy()
    }
    if (this.showRowIndicator && this.vList) {
      let maxIndex = 1
      this.vList.forEach(e => {
        if (!e?.hasAttribute(AVAILABLE_ROW_TAG)) return;
        let sn = parseInt(e.firstElementChild!.getAttribute('data-row-sn') + '')
        if (sn > maxIndex) {
          maxIndex = sn
        }
      })

      this.snWidthDetector.textContent = maxIndex
      this.__recalcSnWidth()
    }

  }
  onScrollEnd(obj: Record<string, any>) {
    super.onScrollEnd(obj)
    if (this.showRowIndicator && this.vList) {
      // setTimeout(() => {
      this.__recalcSnWidth()
      // }, 50);
    }
  }
  onClickFillHandle() {
    if (!get(this.editOption, 'fillable', true)) return;

    let startCellPos = { colIndex: this.leftSelectedCellColIndex, rowIndex: this.topSelectedCellRowIndex, prop: this.getColumnPropByIndex(this.leftSelectedCellColIndex) }
    let endCellPos = { colIndex: this.rightSelectedCellColIndex, rowIndex: this.bottomSelectedCellRowIndex, prop: this.getColumnPropByIndex(this.rightSelectedCellColIndex) }

    this.doFill('bottom', startCellPos, endCellPos, this.leftSelectedCellColIndex, this.rightSelectedCellColIndex, this.innerData.length - (this.bottomSelectedCellRowIndex + 1));
    // this.locateSelector(startCellPos, endCellPos);
    this._selectedCells(startCellPos, endCellPos);
  }
  onMouseDownHeader(e: MouseEvent) {
    let t = e.target as HTMLElement;

    if (t.hasAttribute('all')) {
      let startCellPos = { colIndex: 0, rowIndex: 0, prop: this.getRenderColumns()[0].prop }
      let endCellPos = { colIndex: this.getRenderColumns().length - 1, rowIndex: this.innerData.length - 1, prop: last(this.getRenderColumns()).prop }
      this.focusCellPos = { colIndex: 0, rowIndex: 0, prop: startCellPos.prop }
      // this.locateSelector(startCellPos, endCellPos);
      return;
    }
    if (!(t instanceof Column)) return

    if (t.type === ColumnType.Selection) return;

    if (window.getComputedStyle(t.renderRoot!, ':before').content === '">!<"') return;

    // this.onMouseDown(e, t)
  }
  onMouseOver(e: MouseEvent) {
    let t = e.target as HTMLElement
    let cell = t.closest<HTMLElement>('.ce-table-cell')
    this.trackIndicatorProp = ''
    if (cell) {
      let row = cell.closest('.ce-table-row[inview]')
      if (!row) return;
      this.trackIndicatorProp = attr(cell, 'column')!
    }
  }
  onMouseOverColumn(e: MouseEvent) {
    this.trackIndicatorProp = ''
    let t = e.target as HTMLElement
    if (t instanceof CompElem) {
      if (!(t instanceof Column)) return;
      this.trackIndicatorProp = t.prop || (t.children[0] as Column).prop
    } else {
      let prop = t.closest<Column>('ce-column')?.prop
      if (prop) this.trackIndicatorProp = prop
    }
  }

  onClickCaret(e: Event) {
    if (this.closeInput() === false) {
      return;
    }
    //过滤后禁止编辑
    if (this.__noEditingCheck()) {
      return;
    }

    let t = e.target as HTMLElement;
    let startBox = getBox(t, this.renderRoot);
    let colIndex = this.focusCellPos.colIndex
    let rIndex = this.focusCellPos.rowIndex
    let col = this.getRenderColumns()[colIndex];

    let cellPos = this.focusCellPos

    let ds = this._fieldMap.get(col.prop)?.dataSelection as Array<string | Record<string, any>>;
    let dso = this._fieldMap.get(col.prop)?.dataSelectionOption as DataSelectionOption;

    let cellDs = this.cellSelectionMap.get(this._getCellPosKey(cellPos!))
    let cellDso = this.cellSelectionOptionMap.get(this._getCellPosKey(cellPos!))!
    if (cellDs) {
      ds = cellDs
      dso = cellDso
    }

    //渲染菜单
    if (!isEmpty(ds)) {
      let selection = ds.map((s) => {
        let obj;
        if (isObject(s)) {
          obj = s
        } else {
          obj = { text: s, value: s };
        }
        obj.checkMode = dso?.multiple
          ? "checkbox"
          : "radio";
        obj.checkGroup = col.prop + "_check";
        return obj;
      });
      let value = col.prop
        ? this.renderList[rIndex][col.prop]
        : this.#startCell?.innerText;
      value = value ?? ''
      value += '';
      each(selection, (s) => {
        s.checked = value == s.text;
      });
      this.el_input_options.setItems(selection);
    } else {
      this.toast.pushMessage("无可用选项");
      return
    }

    //显示菜单
    const list = this.el_input_options;
    const positionX = startBox.x + t.offsetWidth - list.scrollWidth;
    const positionY = startBox.y + t.offsetHeight;

    list.open(positionX, positionY);

    this.#el_selector_caret.classList.add("active");
  }
  onDblClickBody(e: MouseEvent) {
    let t = e.target as Element;
    let td = closest<HTMLElement>(
      t,
      (node) => {
        const el = node as HTMLElement
        return attr(el, 'role') == "cell" && el.classList && el.classList.contains("ce-table-cell")
      },
      "parentNode"
    );

    if (startsWith(td?.getAttribute('key'), PRIV_COL_PREF)) return;

    let cellBox = td?.getBoundingClientRect()
    if (cellBox) {
      let { width, height } = window.getComputedStyle(td as Element, '::after')
      let minX = Math.floor(cellBox.x) + Math.floor(cellBox.width) - parseFloat(width)
      let minY = Math.floor(cellBox.y) + Math.floor(cellBox.height) - parseFloat(height)
      if (e.clientX >= minX && e.clientY >= minY) {
        this.onClickFillHandle()
        return
      }
    }

    td && this.activeInput();
  }
  onMenuSelect(item: any, el: HTMLElement) {
    if (item.text === "清除内容") {
      let changedCells = map(this.__selectedCells, (cellPos) => {
        let rIndex = cellPos.rowIndex
        let colProp = cellPos.prop;
        let oldValue = this.data[rIndex][colProp];
        return {
          cell: cellPos,
          oldValue,
          newValue: "",
        };
      })
      this.doCommand(Command.setCells, {
        cells: changedCells,
      });
      this.emit('change', { type: ChangeType.Delete, cells: changedCells })
    } else if (item.text === "粘贴") {
      this.doPaste();
    } else if (item.insert) {
      let rowInput = el.firstElementChild!.querySelector("input");
      let rowCount = rowInput ? parseInt(rowInput.value) : 1;
      let newRows: Record<string, any>[] = [];
      const renderColumns = this.getRenderColumns()
      let props = flatMap(renderColumns, (col) => {
        if (startsWith(col.prop, '__')) return [];
        return col.prop
      })

      let dataGetter = (rc: number, ps: Record<string, any>) => {
        let nrs = []
        while (rc--) {
          let newRow: Record<string, any> = {};
          each(renderColumns, (col) => {
            if (startsWith(col.prop, '__')) return;
            newRow[col.prop!] = "";
          });
          nrs.push(newRow);
        }
        return nrs;
      }
      this.emit('contextmenuinsert', {
        data: (fn: (rc: number, ps: Record<string, any>) => Array<Record<string, any>>) => {
          if (fn) dataGetter = fn as any;
        }
      });
      newRows = dataGetter(rowCount, props)

      let startCell = first(this.__selectedCells)
      let lastCell = last(this.__selectedCells)
      if (startCell || lastCell) {
        if (item.insert === 'under') {
          this.data.splice(startCell.rowIndex + 1, 0, ...newRows)
        } else {
          this.data.splice(lastCell.rowIndex, 0, ...newRows)
        }
      } else {
        this.data.push(...newRows);
      }
      //refresh view
      this.resetVirtualList();
      this.refreshView()

      this.emit('change', { type: ChangeType.Insert, cells: null })
    } else if (item.text === "删除行") {
      this._removeRows();
      this.refreshView()
    } else if (item.text === "空白行") {
      this._removeRows(true);
      this.refreshView()
    }

  }
  onReload() {
    //隐藏selector
    this.hideSelector();
    //重置高亮侧边
    this.hideFocusbar()
    //隐藏显示中的信息
    this.hideMsg()
  }
  onInput(ev: InputEvent) {
    const target = ev.target as HTMLInputElement;
    const rect = target.getBoundingClientRect()
    const pRect = this.renderRoot!.getBoundingClientRect()
    if (rect.y < pRect.y || rect.y > pRect.y + this.renderRoot!.offsetHeight) {
      target.blur()
    }
  }
  onSelectOption(obj: Record<string, any>) {
    let item = obj.item;
    let val = item.text || item;
    let col = this.getColumnMeta(this.#startCell!);
    let rIndex = this.focusCellPos.rowIndex
    let cIndex = this.focusCellPos.colIndex

    //过滤后禁止编辑
    if (this.__noEditingCheck()) {
      return;
    }

    let value = col.prop
      ? this.data[rIndex][col.prop]
      : this.#startCell?.innerText;
    let oldValue = value;
    value = value || ''

    if (this._fieldMap.get(col.prop!)?.dataSelectionOption?.multiple) {
      if (value.indexOf(val) < 0) {
        value += MultiSelectionDivider + val;
      } else {
        value = value.replace(val, "");
      }
      value = value.replace(/^ /, "");
    } else {
      value = val;
      this.closeList();
    }

    this.updateCellView(this._getCellDom(rIndex, cIndex), this.data, value, this.focusCellPos);

    //关联公式
    let traceCell = this._getColumnChar(cIndex) + (rIndex + 1)
    let traceList = this.traceCells.get(traceCell.toLowerCase())
    if (traceList) {
      traceList?.forEach(c => {
        this._updateFormulaCell(c)
      })
    }

    let cellPos = { colIndex: rIndex, rowIndex: cIndex, prop: col.prop };
    this.emit('change', { type: ChangeType.Select, cells: [{ row: this.data[rIndex], column: col, rowIndex: rIndex, colIndex: cIndex, cell: cellPos, value: value, prevValue: oldValue }] })
  }
  onOutside() {
    this.hideSelector()
  }
  @event('mousedown')
  onGlobalMousedown(e: MouseEvent) {
    let t = e.target as Element;

    if (this.el_input_options && !this.el_input_options.contains(t)) {
      this.closeList();
    }
  }
  @event('keydown', () => document.body)
  onGlobalKeydown(e: KeyboardEvent) {
    super.onGlobalKeydown(e)

    //没有选框的不处理
    if (this.__selectedCells.length < 1) return;

    let k = e.key
    if (/F\d+/.test(k)) return;
    if (k === 'Control') return;
    if (k === 'Alt') return;

    if (e.ctrlKey && e.key === "v") {
      if (this.activeCell) return;

      this.doPaste();
    } else if (lowerCase(e.key) === "tab") {


    } else if (lowerCase(e.key) == "escape") {
      this.closeCopy();
      this.closeInput(true);
      this.closeList();
    } else if (lowerCase(e.key) == "enter") {
      if (this.activeCell && e.altKey) {
        let input = this.activeCell.querySelector(".ce-table-cell-input__text"
        ) as HTMLTextAreaElement;
        input.value += '\n'
        return;
      }
      this.closeInput();
      // this.focusNextCell(startTd, e)
      this.bodyCon.focus();
    } else if (lowerCase(e.key) == "delete") {
      if (this.activeCell) return;
      if (!get(this.editOption, 'deletable', true)) {
        this.toast.warn('禁止删除')
        return;
      }

      let changedCells: Record<string, any>[] = []
      this.doCommand(Command.setCells, {
        cells: map(this.__selectedCells, (cellPos: CellPos) => {
          let rIndex = cellPos.rowIndex;
          let colProp = cellPos.prop;
          let oldValue = this.innerData[rIndex][colProp];
          changedCells.push({ cell: cellPos, row: this.innerData[rIndex], column: this.getRenderColumns()[cellPos.colIndex], rowIndex: rIndex, colIndex: cellPos.colIndex, value: '', prevValue: oldValue })
          return {
            cell: cellPos,
            oldValue,
            newValue: "",
          };
        }),
      });

      this.emit('change', { type: ChangeType.Delete, cells: changedCells })
    } else if (lowerCase(e.key) == "backspace") {
      if (this.activeCell) return;
      if (this.focusCell) {
        this.activeInput("");
      }
    } else if (
      !this.activeCell &&
      /^[0-9a-zA-Z`~\\!@#\$%\^\&\*\(\)_+-=\[\]\\{\}\|;':",.\/\<\>\?\s]$/.test(
        e.key
      )
    ) {
      if (this.activeCell) return;
      if (this.inputCell.style.display == 'none' && (e.ctrlKey || e.shiftKey)) return
      this.activeInput("");

      // e.preventDefault();
    }
  }
  @event('blur', () => window)
  onGlobalBlur(e: Event) {
    if (document.activeElement !== this) return;

    this.closeCopy();
  }
  // @event('contextmenu', { target: function () { return this.renderRoot } })
  // onContextMenu(e: MouseEvent) {
  //   e.stopPropagation();
  //   if (!this.el_context_menu) return;
  //   if (!this.tableBody.contains(e.target as HTMLElement)) return

  //   let rows = map<CellPos[], string, Record<string, any>>(this.selectedCellsPos!, cellAry => {
  //     return this.data[cellAry[0].rowIndex]
  //   })

  //   //屏蔽删除
  //   this.el_context_menu.itemList.forEach(item => {
  //     if (item && item.cellNeed) {
  //       item.disabled = rows.length < 1;
  //     }
  //   })

  //   let showMenu = true;
  //   this.emit('contextmenu', { items: this.el_context_menu.itemList, cells: this.selectedCellsPos, rows, cancel: () => { showMenu = false } }, { event: e })
  //   if (showMenu)
  //     this.el_context_menu.open(e);
  // }
  onCommand(command: string, data: Record<string, any>) {
    if (command === Command.setCells) {
      let updateFormulaCell = new Set()
      let cells = data.cells as { cell: HTMLElement | CellPos; oldValue: any; newValue: any }[];
      cells.forEach((v: { cell: HTMLElement | CellPos; oldValue: any; newValue: any }) => {
        let newValue = v.newValue;
        let cellDom = v.cell instanceof HTMLElement ? v.cell : this._getCellDom(v.cell.rowIndex, v.cell.colIndex);

        let cIndex = cellDom ? this.getColIndex(cellDom) : (v.cell as CellPos).colIndex
        let rIndex = cellDom ? this.getRowIndex(cellDom) : (v.cell as CellPos).rowIndex
        let traceCell = this._getColumnChar(cIndex) + (rIndex + 1)
        let traceList = this.traceCells.get(traceCell.toLowerCase())
        traceList?.forEach(c => {
          updateFormulaCell.add(c)
        })

        let { dataType } = this.getRenderColumns()[cIndex]
        //转数字
        if (dataType === "number" && !isNumber(newValue)) {
          newValue = parseFloat(newValue);
          newValue = isNaN(newValue) ? undefined : newValue
        }
        newValue = isUndefined(newValue) ? '' : newValue;

        //更新formula
        if (isBlank(newValue)) {
          this.formulaMap.delete(traceCell)
        }

        //更新data
        let data = this.innerData;
        this.updateCellView(cellDom, data, newValue, v.cell as any);
      })
      //更新公式
      let delCells: string[] = []
      updateFormulaCell.forEach((c: any) => {
        if (!this._updateFormulaCell(c)) {
          delCells.push(c)
        }
      })

      delCells.forEach(dc => {
        Array.from(this.traceCells.values()).forEach(list => {
          list.delete(dc)
        })
      })
    }
  }

  getFillerDragHandles(se: MouseEvent) {
    let that = this;

    let ltColIndex = this.leftSelectedCellColIndex
    let ltRowIndex = this.topSelectedCellRowIndex
    let rbColIndex = this.rightSelectedCellColIndex
    let rbRowIndex = this.bottomSelectedCellRowIndex

    let ltCell = this._getCellDom(ltRowIndex, ltColIndex)
    let rbCell = this._getCellDom(rbRowIndex, rbColIndex)

    let startProp = this.getColumnPropByIndex(this.leftSelectedCellColIndex)
    let endProp = this.getColumnPropByIndex(this.rightSelectedCellColIndex)

    let startCellPos = { colIndex: ltColIndex, rowIndex: ltRowIndex, prop: startProp }
    let endCellPos = { colIndex: rbColIndex, rowIndex: rbRowIndex, prop: endProp }

    //topleft
    let tlCellPos: CellPos = { rowIndex: ltRowIndex, colIndex: ltColIndex, prop: startProp };
    //bottomright
    let brCellPos: CellPos = { rowIndex: rbRowIndex, colIndex: rbColIndex, prop: endProp };
    let dir = "";
    let root = this.renderRoot!;
    let startCell = ltCell
    let endCell = rbCell
    let rect = root.getBoundingClientRect();
    let headerHeight = this.tableHead.offsetHeight
    let scroller = this.scroller
    let startX = se.clientX + scroller.x - rect.x,
      startY = se.clientY + scroller.y - rect.y - headerHeight;
    let startRowIndex = ltRowIndex
    let endRowIndex = rbRowIndex
    let startColIndex = ltColIndex
    let endColIndex = rbColIndex

    let tlCellBox
    const DEG = 45
    let scs: CellPos[] = []
    return {
      mouseMove: function (
        moe: MouseEvent,
        startCellPos: CellPos,
        endCellPos: CellPos,
        moveX: number,
        moveY: number
      ) {

        //计算当前点的斜率，以便确定拖动方向
        let k = Math.atan2(moveY - startY, moveX - startX);
        let angle = k * 180 / Math.PI
        if (angle < 0) {
          angle += 360
        }

        dir = ''
        /**
         *     270
         * 180     0  
         *     90
         */
        if (angle < 270 + DEG && angle > 270 - DEG) {
          dir = "top";
        } else if (angle <= 90 + DEG && angle >= 90 - DEG) {
          dir = "bottom";
        } else if (angle < 180 + DEG && angle > 180 - DEG) {
          dir = "left";
        } else if (angle <= DEG || angle >= 360 - DEG) {
          dir = "right";
        }
        //暂不支持left/right
        if (dir == 'left' || dir == 'right') return

        let moveCell, moveCellBox, moveCellPos
        endRowIndex = endCellPos.rowIndex;
        endColIndex = endCellPos.colIndex;

        startCellPos = { rowIndex: startRowIndex, colIndex: startColIndex, prop: ltCell.getAttribute('column')! };
        switch (dir) {
          case "right":
            endRowIndex = rbRowIndex;
            break;
          case "bottom":
            endColIndex = rbColIndex;
            break;
          case "top":
            endRowIndex = rbRowIndex;
            endColIndex = rbColIndex;
            startRowIndex = endCellPos.rowIndex
            startColIndex = ltColIndex

            moveCell = that._getCellDom(startRowIndex, startColIndex)
            moveCellBox = getBox(moveCell, that.bodyCon);
            startCellPos.prop = moveCell.getAttribute('column')!;

            break;
          case "left":
            startColIndex = endCellPos.colIndex
            startRowIndex = ltRowIndex
            endColIndex = rbColIndex
            endRowIndex = rbRowIndex

            moveCell = that._getCellDom(ltRowIndex, endCellPos.colIndex)
            moveCellBox = getBox(moveCell, that.bodyCon);
            startCellPos.prop = moveCell.getAttribute('column')!;

            break;
        }

        endCellPos = { rowIndex: endRowIndex, colIndex: endColIndex, prop: endCellPos.prop };

        scs = []
        console.log(startRowIndex, startColIndex, endRowIndex, endColIndex)
        let minR = Math.min(startRowIndex, endRowIndex)
        let minC = Math.min(startColIndex, endColIndex)
        let maxR = Math.max(startRowIndex, endRowIndex)
        let maxC = Math.max(startColIndex, endColIndex)
        range(minR, maxR + 1).forEach(r => {
          range(minC, maxC + 1).forEach(c => {
            let colProp = that.getRenderColumns()[c].prop
            if (!some(that.__selectedCells, sc => sc.colIndex === c && sc.rowIndex === r)) {
              scs.push({
                rowIndex: r,
                colIndex: c,
                prop: colProp,
              })
            }
          })
        })

        that.__renderSelectorFiller(scs, minR, minC, maxR, maxC)
      },
      mouseUp: function (e: MouseEvent, checking: boolean, moved: boolean) {
        console.log('-=-=-=-=-=--')
        if (!moved) return;
        let fillLength = 0;
        //relocate selector
        switch (dir) {
          case "right":
            fillLength = endCellPos.colIndex - startCellPos.colIndex
            break;
          case "bottom":
            fillLength = endCellPos.rowIndex - startCellPos.rowIndex
            break;
          case "top":
            fillLength = endCellPos.rowIndex - startCellPos.rowIndex
            break;
          case "left":
            fillLength = endCellPos.colIndex - startCellPos.colIndex
            break;
        }
        that.doFill(dir, tlCellPos, brCellPos, startColIndex, endColIndex, fillLength);
        let sPos = { colIndex: startColIndex, rowIndex: startRowIndex, prop: startProp }
        let endPos = { colIndex: endColIndex, rowIndex: endRowIndex, prop: endProp }
        that.__renderSelectorFiller([])
        that.__locateSelector(sPos, endPos)
        that._selectedCells(startCellPos, endCellPos);
      },
    };
  }
  getSnRowDragHandles(se: MouseEvent, startRowIndex: number) {
    let lastColIndex = this.getRenderColumns().length - 1;
    let startTd = this._getCellDom(startRowIndex, 0)
    let endColProp = last(this.getRenderColumns()).prop
    // let endTd = this._getCellDom(startRowIndex, lastColIndex)
    let startCellPos: CellPos = { colIndex: 0, rowIndex: startRowIndex, prop: startTd?.getAttribute('column')! }
    let endCellPos: CellPos = { colIndex: lastColIndex, rowIndex: startRowIndex, prop: startTd?.getAttribute('column')! }
    this.focusCellPos = { colIndex: 0, rowIndex: startRowIndex, prop: startCellPos.prop }
    this.locateSelector(startCellPos, endCellPos);
    let that = this;
    return {
      mouseMove: function (
        moe: MouseEvent,
        colIndex: number,
        rowIndex: number,
        moveX: number,
        moveY: number
      ) {
        // endTd = that._getCellDom(rowIndex, lastColIndex)
        endCellPos.rowIndex = rowIndex;
        that.locateSelector(startCellPos, { colIndex: lastColIndex, rowIndex, prop: endColProp });
      },
      mouseUp: function (e: MouseEvent) {
        that.#startCell = startTd
        // that.#endCell = endTd

        that._selectedCells(startCellPos, endCellPos)
      },
    };
  }
  getSnColDragHandles(th: HTMLElement, startColIndex: number) {
    let lastRowIndex = this.data.length - 1;
    let startTd = this._getCellDom(0, startColIndex)
    let endTd = this._getCellDom(lastRowIndex, startColIndex)
    let startColProp = this.getRenderColumns()[startColIndex]
    let startCellPos = { colIndex: startColIndex, rowIndex: 0, prop: startColProp.prop }
    let endCellPos = { colIndex: startColIndex, rowIndex: lastRowIndex, prop: startColProp.prop }
    this.focusCellPos = { colIndex: startColIndex, rowIndex: 0, prop: startCellPos.prop }
    this.locateSelector(startCellPos, endCellPos);
    let that = this;
    return {
      mouseMove: function (
        moe: MouseEvent,
        colIndex: number,
        rowIndex: number,
        moveX: number,
        moveY: number
      ) {
        if (startColIndex === colIndex) return;
        endCellPos = { colIndex: colIndex, rowIndex: lastRowIndex, prop: that.getRenderColumns()[colIndex].prop }
        endTd = that._getCellDom(lastRowIndex, colIndex)

        that.locateSelector(startCellPos!, endCellPos);

      },
      mouseUp: function (e: MouseEvent) {
        that.#startCell = startTd
        that.#endCell = endTd

        that._selectedCells(startCellPos, endCellPos)
      },
    };
  }
  closeList() {
    this.el_input_options.style.left = "-9999px";
    this.#el_selector_caret.classList.remove("active");
  }
  focusNextCell(currentTd: HTMLElement, e?: Event) {
    let startRIndex = this.getRowIndex(currentTd);
    let startCIndex = this.getColIndex(currentTd);
    let maxCIndex = this.getRenderColumns().length - 1;
    let maxRIndex = this.data.length - 1
    let minRIndex = 0
    let nextCIndex = startCIndex + 1;
    let nextRIndex = startRIndex;
    if (nextCIndex > maxCIndex) {
      nextCIndex = 1;
      nextRIndex += 1;
    }
    if (nextRIndex > maxRIndex) {
      nextRIndex = minRIndex;
    }
    let nextTd = this._getCellDom(nextRIndex, nextCIndex);
    let nextCellPos = { colIndex: nextCIndex, rowIndex: nextRIndex, prop: nextTd.getAttribute('column')! }
    this.locateSelector(nextCellPos);
    this.#startCell = this.#endCell = nextTd;
  }
  __renderSelectorFiller(scs: CellPos[], minR?: number, minC?: number, maxR?: number, maxC?: number) {
    let list = this.bodyCon.querySelectorAll('.ce-table-cell.' + CELL_CLASS_SELECTED_FILLER)
    each(list, (el: Element) => {
      el.classList.remove(CELL_CLASS_SELECTED_FILLER, CELL_CLASS_SELECTED_FILLER_TOP, CELL_CLASS_SELECTED_FILLER_BOTTOM, CELL_CLASS_SELECTED_FILLER_LEFT, CELL_CLASS_SELECTED_FILLER_RIGHT)
    })
    each(scs, (cell: CellPos) => {
      let el = this.bodyCon.querySelector('.ce-table-row[data-row-index="' + cell.rowIndex + '"] .ce-table-cell[column="' + cell.prop + '"]') as HTMLElement
      if (!el) return

      el.classList.add(CELL_CLASS_SELECTED_FILLER)
      if (cell.rowIndex === minR) {
        el.classList.add(CELL_CLASS_SELECTED_FILLER_TOP)
      }
      if (cell.rowIndex === maxR) {
        el.classList.add(CELL_CLASS_SELECTED_FILLER_BOTTOM)
      }
      if (cell.colIndex === minC) {
        el.classList.add(CELL_CLASS_SELECTED_FILLER_LEFT)
      }
      if (cell.colIndex === maxC) {
        el.classList.add(CELL_CLASS_SELECTED_FILLER_RIGHT)
      }
    })
  }
  /**
   * 获取两个cell组成的矩形空间
   * @param startTd
   * @param endTd
   * @returns {x,y,w,h,ltColIndex,ltRowIndex,rbColIndex,rbRowIndex}
   */
  getCellBox(startCell: HTMLElement, endCell?: HTMLElement) {
    let isEnd =
      endCell?.classList.contains("__end") ||
      startCell?.classList.contains("__end");

    let startBox = startCell ? getBox(startCell, this.bodyCon) : this.#selectorMeta.startBox!;
    if (startBox.w < 1 || startBox.h < 1) {
      startBox = this.#selectorMeta.startBox!
    }
    let endBox = null;

    if (endCell) {
      endBox = getBox(endCell, this.bodyCon);
    } else {
      endCell = startCell;
      endBox = {
        x: startBox.x,
        y: startBox.y,
        w: startBox.w,
        h: startBox.h,
      };
    }

    let { x, y, w, h } = this.getCellRect(startBox, endBox, isEnd)

    let ltColIndex, ltRowIndex, rbColIndex, rbRowIndex;
    if (startBox.x < endBox.x) {
      ltColIndex = this.getColIndex(startCell);
      rbColIndex = this.getColIndex(endCell!);
    } else {
      ltColIndex = this.getColIndex(endCell!);
      rbColIndex = this.getColIndex(startCell);
    }

    if (startBox.y < endBox.y) {
      ltRowIndex = this.getRowIndex(startCell);
      rbRowIndex = this.getRowIndex(endCell!);
    } else {
      ltRowIndex = this.getRowIndex(endCell!);
      rbRowIndex = this.getRowIndex(startCell);
    }

    return {
      x,
      y,
      w,
      h,
      ltColIndex,
      ltRowIndex,
      rbColIndex,
      rbRowIndex,
    };
  }
  getCellRect(startBox: CellBox, endBox: CellBox, isEnd: boolean) {
    let x = Math.min(startBox.x, endBox.x);
    let y = Math.min(startBox.y, endBox.y);
    let x2 = Math.max(startBox.x + startBox.w, endBox.x + endBox.w);
    let y2 = Math.max(startBox.y + startBox.h, endBox.y + endBox.h);
    let w = x2 - x;
    let h = y2 - y;

    // x = x - SelectorOffset;
    // y = y - SelectorOffset;
    if (x < 0) {
      // x = 0;
      // w -= 1;
    }
    if (y < 0) {
      // y = 0 - 1;
      // h -= 1;
    }
    if (isEnd) {
      w -= SelectorOffset;
    }

    return {
      x, y, w, h
    }
  }
  //隐藏选框，比如刷新数据后
  hideSelector() {

    this.__clearSelector()
    this.#el_selector_caret.style.display = 'none'

    this.#startCell = this.#endCell = null;

    this.closeCopy()

    this.inputCell.style.width = this.inputCell.style.height = '0'
    this.inputCell.style.display = "none";
  }
  hideFocusbar() {
  }
  hideMsg() {
    if (!this.#el_warning_msg)
      return;
    this.#el_warning_msg.style.display = "none";
  }

  //刷新视图内数据
  updateCellView(
    cell: HTMLElement,
    data: Array<Record<string, any>>,
    text: string,
    cellPos?: CellPos
  ) {
    if (!cell && !cellPos) return;

    let rIndex = cell ? this.getRowIndex(cell) : cellPos?.rowIndex;
    let cIndex = cell ? this.getColIndex(cell) : cellPos?.colIndex;
    let colProp = cell ? cell.getAttribute('column') : cellPos?.prop;
    let col = this.getRenderColumns()[cIndex!];
    //update data
    //如果有对应公式保存公式
    let f = this.formulaMap.get(this._getColumnChar(cIndex!) + (rIndex! + 1))
    set(data[rIndex!], colProp!, f || text);

    //update view
    if (cell) {
      let cellFn = col.cellTmpl

      let isHtml = false
      let str: string = text ?? f
      if (cellFn) {
        isHtml = true
        str = (cellFn(data[rIndex!]) as Template).getHTML(this)
      }

      str = isUndefined(str) ? '' : str
      if (col.pattern) {
        switch (col.dataType) {
          case DataType.Number:
            str = formatNumber(str, col.pattern)
            break;
          case DataType.Time:
          case DataType.DateTime:
          case DataType.Date:
            str = formatDate(str, col.pattern)
            break;
        }
      }
      let cellEl = cell.querySelector('.ce-table-cell-content [name="text"]')!

      if (isHtml) {
        cellEl.innerHTML = str;
      } else {
        cellEl.textContent = str;
      }

    }
  }
  //更新公式单元格
  _updateFormulaCell(c: string) {
    let cProp = this._getColumnProp(c.replace(/\d+/, ''))
    let rIndex = parseInt(c.replace(/[a-z]+/i, '')) - 1

    let formulaStr = get(this.innerData, [rIndex, cProp], '') as string
    let v
    let f = this.formulaFnMap.get(lowerCase(formulaStr))
    if (f) {
      v = this._pushFxQueue(formulaStr, rIndex, cProp, true)
    }

    return true
  }

  updateCellInput(cell: HTMLElement, data: Array<Record<string, any>>) {
    let rIndex = this.getRowIndex(cell);
    let cIndex = this.getColIndex(cell);
    let colProp = cell.dataset.columnProp!;
    let col = this.getRenderColumns()[cIndex];
    //update input
    let html = "";
    cell.querySelector(".ce-table-input")!.innerHTML = html;
  }
  activeInput(text?: string) {
    if (!this.__lastStartCellPos) return

    let cIndex = this.__lastStartCellPos.colIndex
    let colMeta = this.getRenderColumns()[cIndex]
    if (colMeta.hasCellSlot || colMeta.cellTmpl) return;

    // if (this.activeCell && this.isEqualCell(this.activeCell, cell)) return;
    if (window.getComputedStyle(this.#el_warning_msg).display !== "none") return;

    let colProp = colMeta.prop;
    let rIndex = this.__lastStartCellPos.rowIndex;
    if (this.lockedPosMap[cIndex + ":" + rIndex]) {
      return;
    }
    let rowData = cloneDeep(this.innerData[rIndex]);

    let toBreak = false;
    this.emit('beforecellactive', {
      row: rowData, column: colMeta, rowIndex: rIndex, colIndex: cIndex, cell: { colIndex: cIndex, rowIndex: rIndex, prop: colProp }, value: text, cancel: () => {
        toBreak = true;
      }
    })
    if (toBreak) return;
    let cell = this._getCellDom(rIndex, cIndex)
    cell.classList.add("active-input");
    this.renderRoot?.classList.add("__in-input");
    this.activeCell = cell;
    let input = this.inputCell

    let box = getBox(cell, this.bodyCon);
    input.style.left = box.x + 1 + "px"
    input.style.top = box.y + 1 + "px"
    input.style.width = box.w - 2 + "px"
    input.style.height = box.h - 2 + "px"
    input.style.display = "block"
    input.focus();

    //打开input前，更新input数据
    input.value = (isDefined(text) ? text : get(this.innerData[rIndex], colProp)) ?? '';
    this.closeCopy();

    let that = this;
    input.onblur = function (e: Event) {
      that.closeInput();
    };

    this.emit('cellActive', { row: rowData, column: colMeta, rowIndex: rIndex, colIndex: cIndex, cell: { colIndex: cIndex, rowIndex: rIndex, prop: colProp }, value: text })
  }
  closeInput(cancelText?: boolean) {
    if (!this.activeCell || !this.bodyCon.contains(this.activeCell)) return;

    //校验选择内容
    let col = this.getColumnMeta(this.activeCell);
    let colProp = this.activeCell.getAttribute('column')
    let input = this.inputCell
    let text = escapeHtml(input.value);
    const column = this._fieldMap.get(col.prop!)
    let isMulti = column?.dataSelectionOption?.multiple;
    let hasSelector = this.__selectedCells.length > 0
    if (column?.dataSelection && column?.dataSelectionOption?.constraint && !cancelText && trim(text) && hasSelector) {
      let dsValues = column?.dataSelection?.map(s => isString(s) ? s : s.value)
      if (
        (!isMulti && !includes(dsValues!, trim(text))) ||
        (isMulti &&
          !isEmpty(
            except(
              union(
                split(trim(text), MultiSelectionDivider),
                dsValues,
                (a: string) => a + ''
              ),
              dsValues,
              (a: string) => a + ''
            )
          ))
      ) {
        let box = getBox(this.activeCell, this.bodyCon)
        this.#el_warning_msg.style.transform = `translate3d(${box.x}px, ${box.y + box.h}px,0)`
        this.#el_warning_msg.style.display = "block";
        // this.#el_warning_msg.open()

        input.select();
        input.focus();
        return false;
      }
    }
    if (cancelText) {
      input.onblur = null;
    } else {
      if (colProp) {
        let ri = this.getRowIndex(this.activeCell);
        let ci = this.getColIndex(this.activeCell);

        let old = get(this.innerData[ri], colProp)
        let rowData = cloneDeep(this.innerData[ri])

        let cellPos = { colIndex: ci, rowIndex: ri, prop: colProp };

        let lockCell = false;
        let cancelDeactiveMsgOptions: Record<string, any> = { type: 'warning' }
        let activedCell = this.activeCell
        this.emit('beforecelldeactive', {
          row: rowData, column: this.getRenderColumns()[ci], rowIndex: ri, colIndex: ci, cell: cellPos, value: text, prevValue: old, lock: () => {
            lockCell = true;
          }, cancel: () => {
            if (!this.activeCell || this.activeCell !== activedCell) return;
            this.#el_warning_msg.style.display = "none";

            this.activeCell && this.activeCell.classList.remove("active-input");
            this.activeCell = null;
            this.renderRoot?.classList.remove("__in-input");
          }
        })
        if (lockCell) {
          this.lockCells(this._getColumnChar(ci) + (ri + 1))
        }

        //同步调用cancel后会出现
        if (!this.activeCell) return;
        if (old !== text) {
          //处理公式
          let cellChar = this._getColumnChar(ci) + (ri + 1)
          if (text[0] === FormulaTag && text.match(/=/img)?.length === 1) {
            //0. 检测自引用
            let checker = new RegExp(`([^a-z]|^)${cellChar}([^0-9]|$)`, 'i')
            if (checker.test(text)) {
              let box = getBox(this.#el_selector, this.bodyCon)
              this.#el_warning_msg.style.transform = `translate3d(${box.x}px, ${box.y + box.h}px,0)`
              this.#el_warning_msg.style.display = "block";
              this.#el_warning_msg.descr = '不能引用自身'
              // this.#el_warning_msg.open()

              input.select();
              input.focus();
              return false;
            }
            //1. 保存
            this.formulaMap.set(cellChar, text)
            //2. 计算
            let v = this._pushFxQueue(text, ri, colProp, true)//this._calcFormula(text, cellChar)
            //3. rewrite
            // text = v
          } else {
            //如果存在公式，删除
            this.formulaMap.delete(cellChar)
          }

          this.doCommand(Command.setCells, {
            startCell: this.#startCell,
            endCell: this.#endCell,
            focusCell: this.focusCell,
            cells: [
              {
                cell: this.activeCell,
                oldValue: old,
                newValue: text,
              },
            ],
          });

          // 更新汇总
          this._updateSummary()
        }

        this.emit('celldeactive', { row: rowData, column: this.getRenderColumns()[ci], rowIndex: ri, colIndex: ci, cell: cellPos, value: text, prevValue: old })
        if (text !== old) {
          this.emit('cellchange', { row: rowData, column: this.getRenderColumns()[ci], rowIndex: ri, colIndex: ci, cell: cellPos, value: text, prevValue: old })
          this.emit('change', { type: ChangeType.Input, cells: [{ row: rowData, column: this.getRenderColumns()[ci], rowIndex: ri, colIndex: ci, cell: cellPos, value: text, prevValue: old }] })
        }
      }
    }

    this.#el_warning_msg.style.display = "none";

    this.activeCell && this.activeCell.classList.remove("active-input");
    this.activeCell = null;
    this.renderRoot?.classList.remove("__in-input");

    input.style.width = input.style.height = '0'
    input.style.display = "none";
  }
  _updateSummary() {
    // 更新汇总
    if (this.showFooter) {
      this.onStat()
    }
  }
  onCloseTip(e: PointerEvent) {
    this.closeInput(true);
    // this.#el_warning_msg.removeAttribute("showing");
  }
  closeCopy() {
    // this.#el_selector_copy.style.left = "-9999px";
    // this.#el_selector_copy.style.width = this.#el_selector_copy.style.height =
    //   "0";
    // this.#copyStartCell = this.#copyEndCell = null;
    // if (this.#copyStartCell) {
    //   navigator.clipboard.writeText("");
    // }
  }
  insertAbove() {
    return `在上方插入<input type="text" value="${this.defaultInsertSize}" style="width: 2rem;margin:0 .1rem" onclick="event.stopPropagation()" maxlength="4" onkeydown="event.stopPropagation()"/>行`;
  }
  insertUnder() {
    return `在下方插入<input type="text" value="${this.defaultInsertSize}" style="width: 2rem;margin:0 .1rem" onclick="event.stopPropagation()" maxlength="4" onkeydown="event.stopPropagation()"/>行`;
  }
  doCopy(withHeader?: boolean) {
    if (!get(this.editOption, 'copyable', true)) {
      this.toast.warn('禁止复制')
      return;
    }
    super.doCopy(withHeader)
  }
  doPaste() {
    if (!get(this.editOption, 'pastable', true)) {
      this.toast.warn('禁止粘贴')
      return;
    }

    let firstCell = first(this.__selectedCells)
    let lastCell = last(this.__selectedCells)
    if (!navigator.clipboard) {
      showError('Cannot read navigator.clipboard, it is available only in HTTPS')
      return
    }
    //粘贴统一从剪切板获取 \t用于分列，\r\n用于换行
    navigator.clipboard.readText().then((rs) => {
      //格式check
      let content = rs;
      if (!content) return;

      let selectionRange = this.getSelectionRange()
      let startRowIndex = selectionRange.topLeft.rowIndex
      let startColIndex = selectionRange.topLeft.colIndex
      let endRowIndex = selectionRange.bottomRight.rowIndex
      let endColIndex = selectionRange.bottomRight.colIndex

      let rows = content.split(/\r\n|\n/gim);
      if (isEmpty(last(rows))) {
        rows = take(rows, rows.length - 1);
      }

      let targetRowCount = selectionRange.bottomRight.rowIndex - startRowIndex + 1;
      let targetColCount = selectionRange.bottomRight.colIndex - startColIndex + 1;
      let contentRowCount = rows.length;
      let contentColCount = rows[0].split("\t").length;
      //解析行列
      if (contentRowCount < 2) {
        endRowIndex = selectionRange.bottomRight.rowIndex
        endColIndex = selectionRange.bottomRight.colIndex
      } else {
        if (targetRowCount % contentRowCount) {
          endRowIndex = startRowIndex + contentRowCount - 1
        }
        if (targetColCount % contentColCount) {
          endColIndex = startColIndex + contentColCount - 1
        }
      }

      if (endRowIndex > this.innerData.length - 1) {
        endRowIndex = this.innerData.length - 1;
      }
      if (endColIndex > this.getRenderColumns().length - 1) {
        endColIndex = this.getRenderColumns().length - 1;
      }
      let needRelocate = targetRowCount % contentRowCount || targetColCount % contentColCount;

      if (needRelocate) {
        //重新定位selector
        let startCellPos = { colIndex: startColIndex, rowIndex: startRowIndex, prop: selectionRange.topLeft.prop }
        let endCellPos = { colIndex: endColIndex, rowIndex: endRowIndex, prop: selectionRange.bottomRight.prop }
        this.__locateSelector(startCellPos, endCellPos);
      }

      let cells: Array<Record<string, any>> = [];
      let changedCells: CellPos[] = []
      each(range(startRowIndex, endRowIndex + 1), (rIndex, i: number) => {
        let rowData = rows[i % contentRowCount].split("\t")
        each(range(startColIndex, endColIndex + 1), (cIndex, j: number) => {
          let cellValue = rowData[j % contentColCount]
          let colProp = this.getRenderColumns()[cIndex].prop
          let cellPos = { colIndex: cIndex, rowIndex: rIndex, prop: colProp! }
          changedCells.push(cellPos)

          cells.push({
            cell: cellPos,
            oldValue: this.innerData[rIndex][colProp!],
            newValue: cellValue,
          });
        })
      });

      this.doCommand(Command.setCells, {
        focusCell: this.focusCell,
        cells,
      });

      this._updateSummary()

      this.emit('change', { type: ChangeType.Paste, cells: changedCells })
    });
  }
  doFill(
    dir: string,
    ltCellPos: CellPos,
    rbCellPos: CellPos,
    startColIndex: number,
    endColIndex: number,
    fillLength: number
  ) {
    if (!get(this.editOption, 'fillable', true)) {
      this.toast.warn('禁止填充')
      return;
    }
    let fillingMap = new WeakMap();
    let allCells: CellPos[] = [];
    let FILL_TAG = '_\$*$\_';
    //1. 计算列
    each(
      range(
        startColIndex,
        endColIndex + 1
      ),
      (col) => {
        let prop = this.getRenderColumns()[col].prop;
        if (!prop) return;
        let fillingCells: CellPos[] = [];
        let sequence: number[] = [];
        let defaultStep = 1;
        switch (dir) {
          case "bottom":
            fillingCells = map<CellPos>(
              range(rbCellPos.rowIndex + 1, rbCellPos.rowIndex + fillLength + 1),
              (row: string) => ({ colIndex: col, rowIndex: row, prop })
            );
            sequence = map(
              range(
                ltCellPos.rowIndex,
                rbCellPos.rowIndex + 1
              ),
              (row) => get(this.innerData[row], prop)
            );
            defaultStep = 1;
            break;
          case "top":
            fillingCells = map(
              range(ltCellPos.rowIndex - 1, ltCellPos.rowIndex - 1 - fillLength),
              (row) => ({ colIndex: col, rowIndex: row, prop })
            );
            sequence = map(
              range(
                ltCellPos.rowIndex,
                rbCellPos.rowIndex + 1
              ),
              (row) => get<number>(this.innerData[row], prop)
            ).reverse();
            defaultStep = -1;
            break;
          default:
            break;
        }
        allCells = concat(allCells, fillingCells);

        //1.如果都是数字，计算插值
        //2.如果是数字 + 字符，最后一段数字为模板
        //3.如果只有数字，但是无差值，复制
        // 对连续相似数据进行分组，
        // 如果都是数组则一组；如果tmpl相同则一组
        // 每一组都设置base和step
        let steps: Record<string, any>[] = []//{num,tmpl,step,base}
        let seqGroup: Record<string, Set<number>> = {}
        sequence.forEach((seq, i) => {
          let prevIndex = i - 1
          let prevStep = steps[prevIndex] || null;
          let seqStr = seq + ''
          let lastDigitPos = last([...seqStr.matchAll(/\d+/g)])
          if (lastDigitPos) {
            let preAry = null;
            if (isNaN(seq)) {
              let tmpl = seqStr.substring(0, lastDigitPos.index) + FILL_TAG + seqStr.substring(lastDigitPos.index + lastDigitPos[0].length)
              if (prevStep) {
                if (tmpl === prevStep.tmpl) {
                  seqGroup[prevIndex].add(i)
                  preAry = seqGroup[prevIndex]
                }
              }
              steps.push({ num: lastDigitPos[0], tmpl, step: defaultStep })
            } else {
              if (prevStep && !prevStep.tmpl) {
                seqGroup[prevIndex].add(i)
                preAry = seqGroup[prevIndex]
              }
              steps.push({ num: seq, step: defaultStep })
            }
            if (!seqGroup[i]) seqGroup[i] = preAry || new Set()
            seqGroup[i].add(i)
          } else {
            steps.push({ tmpl: seq })
          }
        })

        each(seqGroup, set => {
          let setSize = size(set)
          if (setSize > 1) {
            let base = parseFloat(steps[last<number>(toArray(set))].num) - parseFloat(steps[first<number>(toArray(set))].num)
            let accDiff = 0;
            const seqArr = map(set, i => steps[i].num) as number[]
            for (let i = 0; i < seqArr.length; i++) {
              let next = seqArr[i + 1];
              if (next) {
                accDiff += parseFloat(next + "") - parseFloat(seqArr[i] + "");
              }
            }
            let step = accDiff / (setSize - 1)
            set.forEach(i => {
              steps[i].base = base
              steps[i].step = step
            })
          }
        })
        let cols = this.getRenderColumns()
        each(fillingCells, (cell, i: number) => {
          let row = cell.rowIndex
          let step = steps[i % steps.length];
          let oldValue = get(this.innerData[row], prop)
          let newValue = step.tmpl
          if (isDefined(step.num)) {
            let base = step.base || 0;
            let nNum = parseFloat(step.num) + parseFloat(step.step) + (parseFloat(base))

            if (step.tmpl) {
              newValue = step.tmpl.replace(FILL_TAG, nNum)
            } else {
              newValue = nNum
            }
            step.num = nNum
          }
          if (!cols[cell.colIndex].dataType || cols[cell.colIndex].dataType === DataType.Text) {
            newValue = newValue + ''
          }
          fillingMap.set(cell, [oldValue, newValue]);
        });
      }
    );
    //2. 执行
    let changedCells: Record<string, any>[] = []
    this.doCommand(Command.setCells, {
      startCell: this.#startCell,
      endCell: this.#endCell,
      focusCell: this.focusCell,
      cells: map(allCells, (cell) => {
        let [oldValue, newValue] = fillingMap.get(cell);

        let rowData = this.innerData[cell.rowIndex]
        if (oldValue !== newValue)
          changedCells.push({ row: rowData, column: this.getRenderColumns()[cell.colIndex], rowIndex: cell.rowIndex, colIndex: cell.colIndex, cell: null, value: newValue, prevValue: oldValue })
        return {
          cell,
          oldValue,
          newValue,
        };
      }),
    });

    this._updateSummary()

    this.emit('change', { type: ChangeType.Fill, cells: changedCells })
  }
  _removeRows(onlyBlank: boolean = false) {
    let startCell = first(this.__selectedCells)
    let startRow = startCell.rowIndex
    if (startRow < 0 && this.checkedCells.length < 1) return;

    //1. 计算checked行列
    let rows = new Set(), cells = new Set();
    each(this.checkedCells, cellPos => {
      rows.add(cellPos.rowIndex)
      cells.add(cellPos.colIndex)
    })
    //2. 计算selected行列
    each(this.__selectedCells, cellPos => {
      rows.add(cellPos.rowIndex)
      cells.add(cellPos.colIndex)
    })
    //3. 删除行
    //仅删除渲染列字段为空的行
    let cols = filter(this.getRenderColumns(), c => c.prop)
    let i = 0
    let dels: typeof this.data = []
    sort(rows as any, (a: number, b: number) => b - a).forEach((r: number) => {
      let rowData = this.data[r]
      let isEmptyRow = every(cols, col => !trim(rowData[col.prop!]));
      if ((onlyBlank && isEmptyRow) || !onlyBlank) {
        // this.data.splice(r, 1);
        dels.push(rowData)
        i++
      }
    })

    this.data = filter(this.data, (r) => !dels.includes(r))

    this.hideFocusbar();

    if (i > 0)
      this.emit('change', { type: ChangeType.Remove, cells: null })
  }

  _selectedCells(startPos?: CellPos, endPos?: CellPos) {
    if (isEmpty(this.data)) return;

    let startColIndex = startPos ? startPos.colIndex : this.getColumnIndex(this.#startCell?.getAttribute('column')!)
    let startRowIndex = startPos ? startPos.rowIndex : this.getRowIndex(this.#startCell!)
    let endColIndex = endPos ? endPos.colIndex : this.getColumnIndex(this.#endCell?.getAttribute('column')!)
    let endRowIndex = endPos ? endPos.rowIndex : this.getRowIndex(this.#endCell!)

    let rowCells = this.selectedCellsPos = this.__getCellsPosOfRange(startColIndex, endColIndex, startRowIndex, endRowIndex);

    this.emit('select', { cellsPos: rowCells })
  }
  _getColumnChar(cIndex: number) {
    let numOfA = Math.floor(cIndex / 26);
    return padStart('', numOfA, 'A') + String.fromCharCode((cIndex % 26) + BaseCode)
  }
  _getColumnCode(cChar: string) {
    let code = 0;
    each(upperCase(cChar), (c: string) => {
      code += c.charCodeAt(0) - BaseCode;
    })

    return code;
  }
  _getColumnProp(char: string) {
    let cIndex = this._getColumnCode(char)
    return this.getRenderColumns()[cIndex].prop
  }
  _getCellDom(rowIndex: string | number, colIndex: string | number) {
    let colName = this.getRenderColumns()[colIndex as number].prop;
    return this.bodyCon.querySelector(
      `div[data-row-index="${rowIndex}"] div[column="${colName}"]`
    ) as HTMLElement;
  }
  __noEditingCheck() {
    if (size(this.filterMap) > 0) {
      this.toast.warn(NO_EDITING_TIP);
      return true;
    }
    return false
  }
  /********* data **********/
  //通过对角位置确定一个范围并返回，如D3,C6
  __getRange(startCellPos: string, endCellPos?: string) {
    let startColChar = ''
    //校验数据列及行是否存在
    let startRowIndex = parseInt(startCellPos.replace(/\D+/, (c) => { startColChar = c; return '' })) - 1
    let startColIndex = this._getColumnCode(startColChar)
    let endColIndex = startColIndex
    let endRowIndex = startRowIndex

    if (endCellPos) {
      let endColChar = ''
      endRowIndex = parseInt(endCellPos.replace(/\D+/, (c) => { endColChar = c; return '' })) - 1
      endColIndex = this._getColumnCode(endColChar)
    }

    return { startColIndex, endColIndex, startRowIndex, endRowIndex }
  }
  //获取指定区域单元格位置列表
  __getCellsPosOfRange(startColIndex: number | string, endColIndex: number | string, startRowIndex: number | string, endRowIndex: number | string) {

    let minCol = Math.min(parseInt(startColIndex + ""), parseInt(endColIndex + ""))
    let minRow = Math.min(parseInt(startRowIndex + ""), parseInt(endRowIndex + ""))
    let maxCol = Math.max(parseInt(startColIndex + ""), parseInt(endColIndex + ""))
    let maxRow = Math.max(parseInt(startRowIndex + ""), parseInt(endRowIndex + ""))

    if (minCol < 0 || maxCol > (this.getRenderColumns().length - 1) || minRow < 0 || maxRow > (this.data.length)) {
      throw new Error('cell index is out of range')
    }
    let rowCells = [];
    let data = this.getRenderColumns();
    for (let rIndex = minRow; rIndex <= maxRow; rIndex++) {
      let colCells: CellPos[] = [];
      for (let cIndex = minCol; cIndex <= maxCol; cIndex++) {
        let prop = data[cIndex].prop!
        colCells.push({ colIndex: cIndex, rowIndex: rIndex, prop });
      }
      rowCells.push(colCells);
    }
    return compact(rowCells);
  }
  //锁定区域单元格
  lockCells(startCellPos: string, endCellPos?: string) {
    let range = this.__getRange(startCellPos, endCellPos)
    let cellsPos = this.__getCellsPosOfRange(range.startColIndex, range.endColIndex, range.startRowIndex, range.endRowIndex)
    each<CellPos>(flat(cellsPos), pos => {
      this.lockedPosMap[pos.rowIndex + ":" + pos.colIndex] = '1'
      let td = this._getCellDom(pos.rowIndex, pos.colIndex);
      if (td) {
        td.classList.add('cell-locked')
      }
    })
  }
  getColumnIndex(prop: string) {
    let i = findIndex(this.getRenderColumns(), col => col.prop === prop)
    return i
  }
  getColumnPropByIndex(colIndex: number) {
    return this.getRenderColumns()[colIndex].prop
  }
  getColumnMeta(cell: HTMLElement): ColumnMeta {
    return this.getRenderColumns()[this.getColIndex(cell)] as ColumnMeta;
  }
  onBeforeSelect(el: HTMLElement, e: MouseEvent) {
    if (el === this.inputCell) return true

    let cellBox = el?.getBoundingClientRect()
    if (cellBox) {
      let { width, height } = window.getComputedStyle(el as Element, '::after')
      let minX = Math.floor(cellBox.x) + Math.floor(cellBox.width) - parseFloat(width)
      let minY = Math.floor(cellBox.y) + Math.floor(cellBox.height) - parseFloat(height)
      if (e.clientX >= minX && e.clientY >= minY) {
        return this.getFillerDragHandles(e)
      }
    }
  }
}
