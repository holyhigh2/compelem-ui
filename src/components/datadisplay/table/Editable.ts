import {
  clone,
  cloneDeep,
  closest,
  compact,
  concat,
  each,
  eachRight,
  every,
  except,
  filter,
  findIndex,
  flat,
  flatDeep,
  flatMap,
  get,
  head,
  includes,
  isDefined,
  isEmpty,
  isNumber,
  isObject,
  isString,
  isUndefined,
  join,
  kebabCase,
  last,
  lowerCase,
  map,
  max,
  min,
  padStart,
  range,
  set,
  size,
  sort,
  split,
  startsWith,
  throttle,
  toArray,
  trim,
  union,
  upperCase
} from "myfx";
import { getBox } from "uiik";

import { event, html, ifTrue, prop, query, show, tag, Template } from "compelem";
import { Input } from "../../form/input/Input";
import { ContextMenu } from "../../nav/contextmenu/ContextMenu";
import { MenuPane } from "../../nav/menupane/MenuPane";
import { Message } from "../../notice/message/Message";
import { Alert } from "../../overlays/modals/Alert";
import styles from "./style.scss";
import { Table } from "./Table";
import "./TableColumn";
import { TableColumn } from "./TableColumn";
import { theadRender } from "./templates";
import { CellBox, CellPos, ColumnMeta, DataSelectionOption, SelectorMeta } from "./types";
const MultiSelectionDivider = " ";
const SelectorOffset = 2;
const BaseCode = 65;
const Command = {
  /**
   * 设置单元格内容
   * cells[{cell,oldValue,newValue}]
   */
  setCells: "setCells",
};
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
 * @props
 *  height {number} table height,default 500px
 *  row-height {number} default 30px
 *  data {array} data list
 *  contextmenu {boolean} 是否支持右键菜单，默认true
 *  default-insert-size {number} 默认插入行数，默认5
 *  showRange {boolean} 显示范围输入框
 *  showColumnIndicator {boolean} 显示列标识，默认true
 *  edit-option {object} 编辑选项 fillable 是否可填充数据（光标），默认true；pastable 是否可粘贴到表格，默认true；copyable 是否可复制，默认true; deletable 清除单元格，默认true
 * @events
 *  beforecellactive({cell,row,column,rowIndex,colIndex, value, cancel()}) 打开单元格编辑窗口前触发，可阻止激活
 *  cellactive({cell,row,column,rowIndex,colIndex, value}) 打开单元格编辑窗口时触发
 *  cellchange({cell,row,column,rowIndex,colIndex, value, prevValue}) 退出单元格编辑窗口后且内容发生变更时触发
 *  celldeactive({cell,row,column,rowIndex,colIndex, value, prevValue}) 退出单元格编辑窗口后触发
 *  beforecelldeactive({cell,row,column,rowIndex,colIndex, value, prevValue, cancel()}) 退出单元格编辑窗口前触发
 * 
 *  contextmenu({items,cells,rows,cancel}) 打开右键菜单时触发，可编辑菜单项
 *  contextmenuselect({item}) 右键菜单选中某项后触发
 *  contextmenuinsert({data}) 右键菜单插入时触发，可以定制插入行的内容。data函数接收一个返回数据数组的函数，签名为(rowCount,props)=>[]
 *  
 *  change({type:input/fill/paste/select/delete,cells:[{cell,row,column,rowIndex,colIndex, value, prevValue}]}) 1-n个单元格内容变更后触发。cell可能为空
 *  focuschange({cell,row,column,rowIndex,colIndex,toggleSelection(enabled,{dataSelection,dataSelectionOption}}) 焦点单元格变更时触发，可以控制单元格的数据选项
 *  select({cells}) 框选单元格结束后触发
 *  
 * @methods
 *  setStyle(cellPos,style) 设置单元格样式
 *  setNote(cellPos,msg) 设置单元格批注。msg为undefined时取消note
 *  getColumnIndex(propName) 通过列属性名获取列索引
 *  updateData()
 *
 * @author holyhigh2
 */
@tag("l-editable")
export class Editable extends Table {
  //选框
  #el_selector: HTMLElement;
  #el_selector_filler: HTMLElement;
  #el_selector_focus: HTMLElement;
  #el_selector_copy: HTMLElement;
  #el_selector_caret: SVGElement;
  @query('l-menu-pane')
  el_input_options: MenuPane;
  @query('l-context-menu')
  el_context_menu: ContextMenu;
  #el_warning_msg: Message;
  #el_custom_msg: Message;
  @query('l-alert')
  alert: Alert;
  @query('.__header_range_input')
  rangeInput: Input;
  @query('.__header_formula_input')
  textInput: Input;
  @query('.c-table-header')
  tableHeader: HTMLElement;
  #el_focusbar_v: HTMLElement;
  #el_focusbar_h: HTMLElement;

  //编辑中
  activeCell: HTMLElement | null;
  focusCell: HTMLElement | null;
  #startCell: HTMLElement | null;
  #endCell: HTMLElement | null;
  #copyStartCell: HTMLElement | null;
  #copyEndCell: HTMLElement | null;
  selectedCellsPos: Array<Array<CellPos>> | null;

  #globalBlurHook: any;
  #contextMenuHook: any;
  #closeTipHook: any;

  //用于selector操作
  #selectorMeta: Partial<SelectorMeta> = {}
  checkedCells: Array<CellPos> = []

  menuItems: Array<Record<string, any> | string | null> = [
    {
      text: "插入行",
      separate: true,
      children: [
        {
          text: this.insertAbove.bind(this),
          iconClass: "bi bi-layer-forward",
          insert: 'above',
        },
        {
          text: this.insertUnder.bind(this),
          iconClass: "bi bi-layer-backward",
          insert: 'under',
        },
      ],
      insert: 'under',
    },
    {
      text: "删除行",
      children: [
        {
          text: "删除行",
          icon: '<svg class="icon" width="16px" height="16.00px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M307.2 752.941176c0-36.141176 30.117647-60.235294 60.235294-60.235294h487.905882c24.094118 0 42.164706 18.070588 42.164706 36.141177s-12.047059 36.141176-36.141176 36.141176h-481.882353v66.258824h475.858823c18.070588 0 36.141176 12.047059 36.141177 36.141176v6.02353c0 18.070588-12.047059 36.141176-36.141177 36.141176H367.435294c-36.141176 0-66.258824-24.094118-66.258823-54.211765V752.941176zM307.2 186.729412c0-36.141176 30.117647-60.235294 60.235294-60.235294h487.905882c24.094118 0 36.141176 18.070588 36.141177 36.141176s-12.047059 36.141176-36.141177 36.141177h-481.882352v66.258823h475.858823c18.070588 0 36.141176 12.047059 36.141177 36.141177v6.023529c0 18.070588-12.047059 36.141176-36.141177 36.141176H361.411765c-36.141176 0-66.258824-24.094118-66.258824-54.211764V186.729412z" fill="#1B2231" /><path d="M90.352941 427.670588v180.705883c0 18.070588 12.047059 36.141176 36.141177 36.141176h301.17647c18.070588 0 36.141176-12.047059 36.141177-36.141176v-180.705883c0-18.070588-12.047059-36.141176-36.141177-36.141176h-301.17647c-18.070588 6.023529-36.141176 18.070588-36.141177 36.141176z m66.258824 36.141177h234.917647v114.447059H156.611765V463.811765z" fill="#FF2E2E" /><path d="M156.611765 463.811765h234.917647v114.447059H156.611765z" fill="#FCD5D5" /><path d="M789.082353 379.482353c12.047059-12.047059 36.141176-12.047059 48.188235 0 12.047059 12.047059 12.047059 30.117647 6.02353 42.164706l-6.02353 6.023529-210.823529 210.82353c-12.047059 12.047059-36.141176 12.047059-48.188235 0-6.023529-18.070588-12.047059-36.141176 0-48.188236l6.023529-6.023529 204.8-204.8z" fill="#FF2E2E" /><path d="M584.282353 379.482353c12.047059-12.047059 30.117647-12.047059 42.164706-6.023529l6.023529 6.023529L843.294118 590.305882c12.047059 12.047059 12.047059 36.141176 0 48.188236-12.047059 12.047059-30.117647 12.047059-42.164706 6.023529l-6.02353-6.023529-210.823529-210.82353c-18.070588-18.070588-18.070588-36.141176 0-48.188235z" fill="#FF2E2E" /></svg>',
        },
        {
          text: "空白行",
          icon: '<svg class="icon" width="16px" height="16.00px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M128 256h682.666667v213.333333H128V256z m700.074667 275.541333l48.256 48.256-81.408 81.365334 81.536 81.578666-48.256 48.256-81.536-81.578666-81.493334 81.578666-48.298666-48.256 81.493333-81.578666-81.365333-81.365334 48.256-48.256 81.408 81.322667 81.408-81.322667zM554.666667 554.666667v213.333333H128v-213.333333h426.666667z m-42.666667 42.666666H170.666667v128h341.333333v-128z m256-298.666666v128H170.666667V298.666667h597.333333z" fill="#333333" /></svg>',
        },
      ],
      cellNeed: true,
    },
    {
      mode: "checkbox",
      checked: true,
      cellNeed: true,
      text: "清除内容",
      hotKey: ["delete"],
      icon: '<svg t="1713889314318" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15815" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16"><path d="M159.488 256c-52.608 0-96 43.328-96 96v256c0 52.672 43.392 96 96 96h291.264c-1.216 10.624-3.2 21.056-3.2 32 0 158.72 129.28 288 288 288 158.656 0 288-129.28 288-288a288 288 0 0 0-128-239.232V352c0-52.672-43.392-96-96-96h-640z m0 64h640c18.048 0 32 14.016 32 32v113.6a284.352 284.352 0 0 0-96-17.6C610.624 448 504.96 528.512 465.152 640H159.488a31.552 31.552 0 0 1-32-32v-256c0-17.984 14.016-32 32-32z m576 192c124.16 0 224 99.904 224 224s-99.84 224-224 224a223.488 223.488 0 0 1-224-224c0-124.096 99.904-224 224-224z m-160 192v64h320v-64h-320z" fill="#E51E34" p-id="15816"></path></svg>',
    },
    null,
    {
      text: "排序",
      disabled: true,
      children: [
        {
          text: "升序",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sort-alpha-down" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371zm1.57-.785L11 2.687h-.047l-.652 2.157z"/>
  <path d="M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645zM4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L4.5 12.293z"/>
</svg>`,
        },
        {
          text: "降序",
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sort-alpha-down-alt" viewBox="0 0 16 16">
  <path d="M12.96 7H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645z"/>
  <path fill-rule="evenodd" d="M10.082 12.629 9.664 14H8.598l1.789-5.332h1.234L13.402 14h-1.12l-.419-1.371zm1.57-.785L11 9.688h-.047l-.652 2.156z"/>
  <path d="M4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L4.5 12.293z"/>
</svg>`,
        },
      ],
    },
    null,
    { text: "复制", iconClass: "bi bi-stickies", hotKey: ["ctrl", "c"], cellNeed: true },
    { text: "粘贴", iconClass: "bi bi-clipboard", hotKey: ["ctrl", "v"] },
  ];

  //当前锁定的单元格位置映射
  lockedPosMap: Record<string, string> = {}

  static checkedSheet = new CSSStyleSheet();

  static get styles(): Array<string | CSSStyleSheet> {
    return [styles, this.checkedSheet];
  }
  /////////////////////////////////// watches

  //////////////////////////////////// props
  @prop contextmenu = true;
  @prop defaultInsertSize = 5;
  @prop showRange = true;
  @prop showColumnIndicator = true;
  @prop({ type: Object }) editOption = { fillable: true, pastable: true, copyable: true, deletable: true }

  //////////////////////////////////// lifecycles
  render(): Template {

    const superTmpl = super.render();
    if (this.showRange) {
      superTmpl.strings[0] = `<div class="c-table-header-range"><l-input class="__header_range_input" round="false" tabindex="0" autoselect></l-input><l-input tabindex="0" round="false" class="__header_formula_input"></l-input></div>` + superTmpl.strings[0];
    }

    let tmpl = html`
        <div class="c-table-selector">
          <div class="c-table-selector-cover">
            <div class="--focus"></div>
          </div>
          <div class="c-table-selector-op" @dblclick="${this.onClickFillHandle}" ${show(get(this.editOption, 'fillable', true))}></div>
          <div class="c-table-selector-filler"></div>
        </div>
        <div class="c-table-focusbar-v"></div>
        
        <div class="c-table-selector-copy"><div class="content"></div></div>
        <div class="c-table-selector-caret">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
          </svg>
        </div>
        <l-message id="warningmsg" border style="position: absolute;width: 300px;display: none;" closable type="warning" descr="输入内容与限制选项不符"></l-message>
        <l-message id="custommsg" border style="position: absolute;width: 300px;display: none;" closable type="warning" descr=""></l-message>
        <l-menu-pane round="false" items="[]" theme="light" @select="${this.onSelectOption}"></l-menu-pane>
        <l-alert></l-alert>
      ${ifTrue(
      this.contextmenu,
      () => html`
          <l-context-menu
            @select="${this.onMenuSelect}"
            @hover="${this.onMenuHover}"
            .items="${this.menuItems}"
            theme="light"
          >
          </l-context-menu>
        `
    )}
      </section>
    `;
    superTmpl.strings[superTmpl.strings.length - 1] = "";
    return superTmpl.append(tmpl);
  }
  constructor() {
    super();

    this.#globalBlurHook = this.onGlobalBlur.bind(this);
    window.addEventListener("blur", this.#globalBlurHook);
  }
  connectedCallback() {
    super.connectedCallback();

    this.#contextMenuHook = this.onContextMenu.bind(this);
    this.el_table.addEventListener("contextmenu", this.#contextMenuHook);

    this.#el_focusbar_v = this.el_table.querySelector('.c-table-focusbar-v')!
    this.#el_selector = this.el_table.querySelector(".c-table-selector")!;
    this.#el_selector_focus = this.#el_selector.querySelector(".--focus")!;
    this.#el_selector_filler = this.#el_selector.querySelector(
      ".c-table-selector-filler"
    )!;
    this.#el_selector_copy = this.el_table.querySelector(
      ".c-table-selector-copy"
    )!;
    this.#el_selector_caret = this.el_table.querySelector(
      ".c-table-selector-caret"
    )!;
    this.#el_warning_msg = this.el_table.querySelector("#warningmsg")!;
    this.#el_custom_msg = this.el_table.querySelector("#custommsg")!;

    this.#closeTipHook = this.onCloseTip.bind(this);
    this.#el_warning_msg.addEventListener("close", this.#closeTipHook);
    this.#el_custom_msg.addEventListener("close", this.#closeTipHook);
  }
  mounted() {
    super.mounted()
    this.el_table.classList.add("editable");

    this.rangeInput && this.rangeInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (lowerCase(e.key) !== 'enter') return;
      let t = e.target as Input
      let v = t.inputRef.current.value;
      let matched = v.match(/(?<col>[a-z]+)(?<row>\d+)(?:[:：](?<col2>[a-z]+)(?<row2>\d+))?/i)
      if (!matched) {
        this.alert.open('无效范围')
        this.setFocusCell(this.#startCell!);
        return;
      }
      //校验数据列及行是否存在
      let startColIndex = this._getColumnCode(matched.groups!.col)
      let startRowIndex = parseInt(matched.groups!.row) - 1
      let endColIndex = startColIndex
      let endRowIndex = startRowIndex

      if (matched.groups!.col2 && matched.groups!.row2) {
        endColIndex = this._getColumnCode(matched.groups!.col2)
        endRowIndex = parseInt(matched.groups!.row2) - 1
      }

      try {
        this.__getCellsPosOfRange(startColIndex, endColIndex, startRowIndex, endRowIndex);
      } catch (error) {
        this.alert.open('超出数据行列范围')
      }

      let minRow = Math.min(startRowIndex, endRowIndex)

      // if (minCol < 1 || maxCol > (this.renderColumns.length - 1) || minRow < 0 || maxRow > (this._innerData.length - 1)) {
      //   this.alert.open('超出数据行列范围')
      // }
      this.el_table.scrollTop = minRow * this.rowHeight
      //定位行记录位置
      this.updateData()
      // debugger
      let startTd = this._getCellDom(startRowIndex, startColIndex);
      let endTd = this._getCellDom(endRowIndex, endColIndex);

      this.#startCell = startRowIndex < endRowIndex ? startTd : endTd
      this.#endCell = startRowIndex < endRowIndex ? endTd : startTd

      let startColProp = this.renderColumns[startColIndex]
      let endColProp = this.renderColumns[endColIndex]
      let endCellPos = { colIndex: endColIndex, rowIndex: endRowIndex, prop: endColProp.prop! }
      this._selectedCells({ colIndex: startColIndex, rowIndex: startRowIndex, prop: startColProp.prop! }, endCellPos)
      this.locateSelector(this.#startCell, this.#endCell, true, endCellPos);
      this.setFocusCell(this.#startCell);
      t.blur();
      this.nextTick(() => {
        this.el_table.focus();
      })
    })
    this.textInput && this.textInput.addEventListener('input', (e: CustomEvent) => {

      if (this.focusCell) {
        let rowIndex = this.getRowIndex(this.focusCell!);
        let column = this.getColumnMeta(this.focusCell!);
        let rowData = this._innerData[rowIndex];
        this.focusCell.querySelector(".view")!.textContent = rowData[column.prop!] = e.detail.value
      }
    })
  }
  disconnectedCallback() {
    super.disconnectedCallback();
  }
  //////////////////////////////////// methods
  setFocusCell(cell: HTMLElement, event?: Event) {
    if (!cell) return;
    this.focusCell = cell;
    let colIndex = this.getColIndex(cell);
    let rowIndex = this.getRowIndex(cell);
    let column = this.getColumnMeta(cell);
    let rowData = this._innerData[rowIndex];
    this.rangeInput && this.rangeInput.setValue(this._getColumnChar(colIndex - 1) + (rowIndex + 1))
    this.textInput && this.textInput.setValue(rowData[column.prop!] || '')
    let cellPos = { colIndex: colIndex, rowIndex: rowIndex, prop: column.prop };
    this.emit('focuschange', {
      cell: cellPos, row: rowData, column, rowIndex, colIndex,
      toggleSelection: (enabled: boolean, data?: { dataSelection: [], dataSelectionOption: DataSelectionOption }) => {
        cell.classList.toggle('__selection', enabled)
        if (data) {
          set(cell, '__l_editable_dataSelection', data.dataSelection)
          set(cell, '__l_editable_dataSelectionOption', data.dataSelectionOption)
        }
      }
    }, { event })
  }
  isEqualCell(n1: HTMLElement, n2?: HTMLElement) {
    if (!n1 || !n2) return false;
    return (
      n1.dataset.columnIndex == n2.dataset.columnIndex &&
      n1.dataset.rowIndex == n2.dataset.rowIndex
    );
  }
  /********* layout **********/
  onResize() {
    super.onResize();
    setTimeout(() => {
      this.locateSelector(this.#startCell!, this.#endCell!);
      this.locateSelectorCopy();
    }, 400);
  }
  onRebuild() {
    if (this.#startCell) {
      //内容刷新，需重新定位
      if (!this.el_table.contains(this.#startCell)) {
        let rIndex = this.#startCell.dataset.rowIndex;
        let cIndex = this.#startCell.dataset.columnIndex;
        let rIndexEnd = this.#endCell!.dataset.rowIndex;
        let cIndexEnd = this.#endCell!.dataset.columnIndex;
        let startCell = this._getCellDom(rIndex!, cIndex!);

        let endCell = this._getCellDom(rIndexEnd!, cIndexEnd!);

        if (
          get<number>(startCell, "offsetLeft", 0) <
          get<number>(endCell, "offsetLeft", 0)
        ) {
          this.#startCell = startCell;
          this.#endCell = endCell;
        } else {
          this.#endCell = startCell;
          this.#startCell = endCell;
        }
        this.setFocusCell(this.#startCell);
      }
      this.locateSelector(this.#startCell!, this.#endCell!);
      this.locateSelectorCopy();
    }

    let snCell = this.el_table.querySelector('th.__sn_row') as HTMLElement
    this.#el_focusbar_v.style.width = snCell.offsetWidth + 'px'

    if (this.showColumnIndicator) {
      snCell = this.el_table.querySelector('th.__sn_col_first') as HTMLElement
      this.#el_focusbar_h.style.height = snCell.offsetHeight + 'px'
    }
  }
  onColumnResize(th: HTMLElement, col: ColumnMeta, w: number) {
    setTimeout(() => {
      this.locateSelector(this.#startCell!, this.#endCell!);
      this.locateSelectorCopy();
    }, 400);
  }
  onClickHead(e: Event) {
    super.onClickHead(e);

    if (this.#el_warning_msg.style.display !== "none" || this.#el_custom_msg.style.display !== "none") return;

    let t = e.target as Element;
    let startTH = closest<HTMLElement>(
      t,
      (node) =>
        node.tagName == "TH" && node.classList.contains("__sn_row"),
      "parentNode"
    );
    if (startTH) {
      //select all
      let lastRowIndex = this._innerData.length - 1;
      let lastColIndex = this.renderColumns.length - 1;
      let startTd = this._getCellDom(0, 1)
      let endTd = this._getCellDom(lastRowIndex, lastColIndex)
      let endCellPos = { colIndex: lastColIndex, rowIndex: lastRowIndex, prop: last(this.renderColumns).prop! }
      this.locateSelector(startTd!, endTd, true, endCellPos);
    }
  }
  onClickFillHandle() {
    if (!get(this.editOption, 'fillable', true)) return;

    let { ltColIndex, ltRowIndex, rbColIndex, rbRowIndex } =
      this.getCellBox(this.#startCell!, this.#endCell!);
    let ltCellPos: CellPos = { rowIndex: ltRowIndex, colIndex: ltColIndex, prop: '' };
    let rbCellPos: CellPos = { rowIndex: rbRowIndex, colIndex: rbColIndex, prop: '' };

    let endRowIndex = this._innerData.length - 1

    this.doFill('bottom', ltCellPos, rbCellPos, ltColIndex, rbColIndex, this._innerData.length - (rbRowIndex + 1));
    let endCellPos = { colIndex: rbColIndex, rowIndex: endRowIndex, prop: this.getColumnMeta(this.#endCell || this.#startCell!).prop! }
    this.locateSelector(this.#startCell!, this.#endCell!, false, endCellPos);
  }
  onMouseDown(e: MouseEvent) {
    let t = e.target as Element;

    if (this.el_input_options.contains(t)) {
      e.stopPropagation();
    }

    let startTd = closest<HTMLElement>(
      t,
      (node) =>
        node.tagName == "TD" && node.classList.contains("c-table-cell"),
      "parentNode"
    );
    let startTH = closest<HTMLElement>(
      t,
      (node) =>
        node.tagName == "TH" && node.classList.contains("__sn_col"),
      "parentNode"
    );

    let dragSelector = false,
      dragFiller = false,
      dragSnRow = false,
      dragSnCol = false;

    if (startTd) {
      if (this.activeCell) {
        if (this.isEqualCell(this.activeCell, startTd)) {
          return;
        } else if (this.closeInput() === false) {
          return;
        }
      }
      if (startTd.classList.contains("__sn_row")) {
        dragSnRow = true;
      } else {
        dragSelector = true;
      }
    } else if (t.classList.contains("c-table-selector-op")) {
      dragFiller = true;
    } else if (startTH) {
      if (this.closeInput() === false) {
        return;
      }
      dragSnCol = true;
    }
    if (!dragSelector && !dragFiller && !dragSnRow && !dragSnCol) {
      //右键非单元格范围，选中取消
      if (e.button === 2) {
        //隐藏selector
        this.hideSelector();
        //重置高亮侧边
        this.hideFocusbar();
        this.selectedCellsPos = null;
      }
      return;
    }
    if (
      e.button === 0 &&
      this.el_context_menu &&
      this.el_context_menu.isOpen()
    )
      return;
    //右键菜单在框选范围内打开直接返回
    let cIndex = this.getColIndex(startTd!)
    let rIndex = this.getRowIndex(startTd!)

    if (e.button === 2 && (compact(flat<CellPos>(this.selectedCellsPos!)).some(pos => pos.rowIndex == rIndex && pos.colIndex == cIndex) || this.checkedCells.some(pos => pos.rowIndex == rIndex && pos.colIndex == cIndex))) {
      return;
    }

    let checking = false;
    if (e.ctrlKey) {
      checking = true;
      let lastSelected = flatDeep<CellPos>(this.selectedCellsPos || []);
      this.checkedCells.push(...lastSelected)
    } else {
      if (this.checkedCells.length > 0) {
        this.checkedCells = []
      }
    }
    this._updateCheckedStyle();

    if (dragSelector) {
      if (e.shiftKey) {
        this.#endCell = startTd;
        this.locateSelector(this.#startCell!, startTd!);
      } else {
        this.#startCell = this.#endCell = startTd;
        this.setFocusCell(startTd!, e);
        this.locateSelector(startTd!, undefined);
      }
    }

    let onMouseMove, onMouseUp: Function;
    if (dragSelector) {
      let { mouseMove, mouseUp } = this.getSelectDragHandles(e);
      onMouseMove = mouseMove;
      onMouseUp = mouseUp;
    } else if (dragFiller) {
      if (!get(this.editOption, 'fillable', true)) return;
      let { mouseMove, mouseUp } = this.getFillDragHandles(e);
      onMouseMove = mouseMove;
      onMouseUp = mouseUp;
    } else if (dragSnRow) {
      let rowIndex = this.getRowIndex(startTd!);
      let { mouseMove, mouseUp } = this.getSnRowDragHandles(e, rowIndex);
      onMouseMove = mouseMove;
      onMouseUp = mouseUp;
    } else if (dragSnCol) {
      let colIndex = this.getColIndex(startTH!);
      let { mouseMove, mouseUp } = this.getSnColDragHandles(startTH!, colIndex);
      onMouseMove = mouseMove;
      onMouseUp = mouseUp;
    }

    let moved = false;
    if (e.button === 0) {
      let root = this.el_table;
      let headHeight = this.getHeaderHeight();
      let posMap = this.columnPositionMap;
      let rowHeight = this.rowHeight;

      let throttledMove = throttle(onMouseMove!, 50);
      //1. 确定边界
      let boundary = {
        top: headHeight,
        left: this.renderColumns[0].width!,
        right: this.el_table.offsetWidth,
        bottom: this.el_table.offsetHeight,
      };
      let rect = root.getBoundingClientRect();
      let maxRowIndex = this._innerData.length
      document.onmousemove = function (e: MouseEvent) {
        let cx = e.clientX,
          cy = e.clientY;

        moved = true;

        let moveX = e.clientX + root.scrollLeft - rect.x;
        let moveY = e.clientY + root.scrollTop - headHeight - rect.y;

        let colIndex = 1,
          rowIndex = Math.ceil(moveY / rowHeight) - 1;
        if (rowIndex < 0) rowIndex = 0;
        if (rowIndex >= maxRowIndex) rowIndex = maxRowIndex - 1;

        eachRight(posMap, (v, k: number) => {
          if (moveX > k) {
            colIndex = v;
            //todo 这里需要把固定列位置加入计算，否则会出现问题
            return false;
          }
        });

        if (colIndex < 1) colIndex = 1;

        throttledMove(e, colIndex, rowIndex, moveX, moveY);

        //自动边界滚动
        if (cx > boundary.right) {
          root.scrollBy({ left: 10 });
        } else if (cx < boundary.left) {
          root.scrollBy({ left: -10 });
        } else if (cy > boundary.bottom) {
          root.scrollBy({ top: 10 });
        } else if (cy < boundary.top) {
          root.scrollBy({ top: -10 });
        }
      };
    }
    window.onblur = document.onmouseup = (moe: MouseEvent) => {
      window.onblur = document.onmousemove = document.onmouseup = null;

      onMouseUp(moe, checking, moved);
    };
  }
  onScroll(scrollV: boolean) {
    if (!this.#startCell) return;

    // let tlCell =
    //   this.getColIndex(this.#startCell) < this.getColIndex(this.#endCell!)
    //     ? this.#startCell
    //     : this.#endCell;
    //检测selector是否选定了固定列

    if (!scrollV) {
      // console.log(this.el_table.scrollLeft)
      this.#el_focusbar_v.style.left = this.el_table.scrollLeft + 'px'
    }
    //1. 检测selector左上角是否固定（无论左右）
    // let isTLFixed = this.isFixedCell(tlCell!);
    // if (isTLFixed) {
    //   this.#el_selector.style.transform = `translateX(${this.el_table.scrollLeft}px)`;
    // }

    // let isFixedLeft = this.isFixedCell(this.#startCell!, 'left') || this.isFixedCell(this.#endCell!, 'left')
  }
  onClickBody(e: Event) {
    let t = e.target as HTMLElement;
    super.onClickBody(e)

    if (t.classList.contains("c-table-selector-caret")) {
      if (this.closeInput() === false) {
        return;
      }

      let startBox = getBox(t, this.el_table);
      let colIndex = this.getColIndex(this.#startCell!);
      let rIndex = this.getRowIndex(this.#startCell!);
      let col = this.renderColumns[colIndex];
      let cell = this.#startCell

      let ds = get<Array<any>>(cell, '__l_editable_dataSelection', col.dataSelection)
      let dso = get<DataSelectionOption>(cell, '__l_editable_dataSelectionOption', col.dataSelectionOption)

      //渲染菜单
      if (!isEmpty(ds)) {
        let selection = map(ds!, (s) => {
          let obj = s;
          if (isString(s)) {
            obj = { text: s, value: s };
          }
          obj.checkMode = dso?.multiple
            ? "checkbox"
            : "radio";
          obj.checkGroup = col.prop + "_check";
          return obj;
        });
        let value = col.prop
          ? this._innerData[rIndex][col.prop]
          : this.#startCell?.innerText;
        value = value ?? ''
        value += '';
        each(selection, (s) => {
          s.checked = value.indexOf(s.text) > -1;
        });
        this.el_input_options.setItems(selection);
      }

      //显示菜单
      const list = this.el_input_options;
      const positionX = startBox.x + t.offsetWidth - list.scrollWidth;
      const positionY = startBox.y + t.offsetHeight;

      list.open(positionX, positionY);

      this.#el_selector_caret.classList.add("active");
    }
  }
  onDblClickBody(e: Event) {
    let t = e.target as Element;
    let td = closest<HTMLElement>(
      t,
      (node) =>
        node.tagName == "TD" && node.classList.contains("c-table-cell"),
      "parentNode"
    );

    td && this.activeInput(td!);
  }
  onMenuSelect(ev: CustomEvent) {
    let { item, index, el } = ev.detail;

    if (item.text === "清除内容") {
      this.doCommand(Command.setCells, {
        startCell: this.#startCell,
        endCell: this.#endCell,
        focusCell: this.focusCell,
        cells: map(flatDeep<CellPos>(this.selectedCellsPos!), (cellPos) => {
          let rIndex = cellPos.rowIndex
          let colProp = cellPos.prop;
          let oldValue = this._innerData[rIndex][colProp];
          return {
            cell: cellPos,
            oldValue,
            newValue: "",
          };
        }),
      });
    } else if (item.text === "复制") {
      this.doCopy();
    } else if (item.text === "粘贴") {
      this.doPaste();
    } else if (item.insert) {
      let rowInput = el.firstElementChild.querySelector("input");
      let rowCount = rowInput ? rowInput.value >> 0 : 1;
      let newRows: Record<string, any>[] = [];
      let props = flatMap(this.renderColumns, (col) => {
        if (startsWith(col.prop, '__')) return [];
        return col.prop
      })

      let dataGetter = (rc: number, ps: Record<string, any>) => {
        let nrs = []
        while (rc--) {
          let newRow: Record<string, any> = {};
          each(this.renderColumns, (col) => {
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

      if (this.focusCell) {
        let { ltColIndex, ltRowIndex, rbColIndex, rbRowIndex } =
          this.getCellBox(this.#startCell!, this.#endCell!);
        if (item.insert === 'under') {
          this._innerData.splice(rbRowIndex + 1, 0, ...newRows)
        } else {
          this._innerData.splice(ltRowIndex, 0, ...newRows)
        }
      } else {
        this._innerData.push(...newRows);
      }

      this.updateData();
    } else if (item.text === "删除行") {
      this._removeRows();
    } else if (item.text === "空白行") {
      this._removeRows(true);
    }

    this.emit('contextmenuselect', { item })
  }
  onReload() {
    //隐藏selector
    this.hideSelector();
    //重置高亮侧边
    this.hideFocusbar()
    //隐藏显示中的信息
    this.hideMsg()
  }
  onMenuHover(ev: CustomEvent) {
    let { item, index, el } = ev.detail;
    let input = el.querySelector("input");
    if (input) {
      input.select();
      input.focus();
    }
  }
  onSelectOption(ev: CustomEvent) {
    let item = ev.detail.item;
    let val = item.text || item;
    let col = this.getColumnMeta(this.#startCell!);
    let rIndex = this.getRowIndex(this.#startCell!);
    let cIndex = this.getColIndex(this.#startCell!);

    let value = col.prop
      ? this._innerData[rIndex][col.prop]
      : this.#startCell?.innerText;
    let oldValue = value;
    value = value || ''
    if (col.dataSelectionOption?.multiple) {
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

    this.updateCellView(this.#startCell!, this._innerData, value);

    let cellPos = { colIndex: rIndex, rowIndex: cIndex, prop: col.prop };
    this.emit('change', { type: 'select', cells: [{ row: this._innerData[rIndex], column: col, rowIndex: rIndex, colIndex: cIndex, cell: cellPos, value: value, prevValue: oldValue }] })
  }
  onGlobalMousedown(e: MouseEvent) {
    let t = e.target as Element;

    if (this.el_input_options && !this.el_input_options.contains(t)) {
      this.closeList();
    }
  }
  @event('keydown', { target: function () { return this.el_body_table } })
  onGlobalKeydown(e: KeyboardEvent) {
    let startTd = this.#startCell!;
    let endTd = this.#endCell!;

    if (e.ctrlKey && e.key == "c") {
      if (this.activeCell) return;

      this.doCopy();
    } else if (e.ctrlKey && e.key == "v") {
      if (this.activeCell) return;

      this.doPaste();
    } else if (lowerCase(e.key) == "tab") {
      e.preventDefault();
      if (this.closeInput() === false) {
        return;
      }
      let startRIndex = this.getRowIndex(startTd);
      let startCIndex = this.getColIndex(startTd);
      let maxCIndex = this.renderColumns.length - 1;
      let maxRIndex = this._innerData.length - 1
      let minRIndex = 0
      //single
      if (this.isEqualCell(startTd, endTd)) {
        this.focusNextCell(startTd, e)
      } else {
        //multi rows
        maxRIndex = Math.max(startRIndex, this.getRowIndex(endTd));
        maxCIndex = Math.max(startCIndex, this.getColIndex(endTd));
        minRIndex = Math.min(startRIndex, this.getRowIndex(endTd));
        let minCIndex = Math.min(startCIndex, this.getColIndex(endTd));
        let nextRIndex = this.getRowIndex(this.focusCell!);
        let nextCIndex = this.getColIndex(this.focusCell!) + 1;

        if (nextCIndex > maxCIndex) {
          nextCIndex = minCIndex;
          nextRIndex += 1;
        }
        if (nextRIndex > maxRIndex) {
          nextRIndex = minRIndex;
        }
        let nextTd = this._getCellDom(nextRIndex, nextCIndex);
        this.setFocusCell(nextTd!, e);
        this.locateFocus();
      }
    } else if (lowerCase(e.key) == "escape") {
      this.closeCopy();
      this.closeInput(true);
      this.closeList();
    } else if (lowerCase(e.key) == "enter") {
      if (this.activeCell && e.altKey) {
        let input = this.activeCell.querySelector(
          ".c-table-cell-input__text"
        ) as HTMLTextAreaElement;
        input.value += '\n'
        return;
      }
      this.closeInput();
      this.focusNextCell(startTd, e)
      this.el_body_table.focus();
    } else if (lowerCase(e.key) == "delete") {
      if (this.activeCell) return;
      if (!get(this.editOption, 'deletable', true)) return;

      let changedCells: Record<string, any>[] = []
      this.doCommand(Command.setCells, {
        startCell: this.#startCell,
        endCell: this.#endCell,
        focusCell: this.focusCell,
        cells: map(concat(flatDeep(this.selectedCellsPos!), this.checkedCells), (cellPos: CellPos) => {
          let rIndex = cellPos.rowIndex;
          let colProp = cellPos.prop;
          let oldValue = this._innerData[rIndex][colProp];
          changedCells.push({ cell: cellPos, row: this._innerData[rIndex], column: this.renderColumns[cellPos.colIndex], rowIndex: rIndex, colIndex: cellPos.colIndex, value: '', prevValue: oldValue })
          return {
            cell: cellPos,
            oldValue,
            newValue: "",
          };
        }),
      });

      this.emit('change', { type: 'delete', cells: changedCells })
    } else if (lowerCase(e.key) == "backspace") {
      if (this.activeCell) return;
      if (this.focusCell) {
        this.activeInput(this.focusCell, "");
      }
    } else if (
      !this.activeCell &&
      /^[0-9a-zA-Z`~\\!@#\$%\^\&\*\(\)_+-=\[\]\\{\}\|;':",.\/\<\>\?\s]$/.test(
        e.key
      )
    ) {
      if (this.activeCell) return;
      if (this.focusCell) {
        this.activeInput(this.focusCell, "");
      }
      // e.preventDefault();
    }
  }
  onGlobalBlur(e: Event) {
    if (document.activeElement !== this) return;

    this.closeCopy();
  }
  onCommand(command: string, data: Record<string, any>) {
    super.onCommand(command, data);
    if (command === Command.setCells) {
      let { cells } = data;
      each(cells, (v: { cell: HTMLElement | CellPos; oldValue: any; newValue: any }) => {
        let newValue = v.newValue;
        let cellDom = v.cell instanceof HTMLElement ? v.cell : this._getCellDom(v.cell.rowIndex, v.cell.colIndex);

        let { dataType } = this.renderColumns[cellDom ? this.getColIndex(cellDom) : (v.cell as CellPos).colIndex]
        //转数字
        if (dataType === "number" && !isNumber(newValue)) {
          newValue = parseFloat(newValue);
          newValue = isNaN(newValue) ? undefined : newValue
        }
        newValue = isUndefined(newValue) ? '' : newValue;

        if (cellDom) {
          //更新dom
          let input = cellDom.querySelector(
            ".c-table-cell-input__text"
          ) as HTMLTextAreaElement;
          if (!input) return;
          input.value = newValue
        }

        //更新data
        let data = this._innerData;
        this.updateCellView(cellDom, data, newValue, v.cell as any);
      });
    }
  }
  onBuildColumns(columns: ColumnMeta[], header: Partial<ColumnMeta>[][]) {
    super.onBuildColumns(columns, header as any)
    //增加行标识
    let width = (this._innerData.length + "").length * 10 + 10;
    width = width < 40 ? 40 : width;

    let columnSn: ColumnMeta = {
      label: "",
      prop: "__sn_row",
      colspan: 0,
      rowspan: 0,
      width: width,
      primaryWidth: width,
      type: "index",
      slots: {},
      align: "center",
      headerAlign: "center",
      hasSub: false,
      resizable: false,
      fixed: true,
      sort: false,
      cellClass: "__sn_row",
      headerClass: "__sn_row",
    };

    //增加列标识
    let colsRow: Partial<ColumnMeta>[] = []
    columns.forEach((c, i) => {
      let label = this._getColumnChar(i);

      let isFixedCol = c.fixed
      colsRow.push({
        label,
        prop: c.prop,
        colspan: 0,
        rowspan: 0,
        width: width,
        primaryWidth: width,
        headerAlign: 'center',
        resizable: true,
        fixed: isFixedCol,
        slots: {},
        headerClass: "__sn_col",
      })
    })

    columns.unshift(columnSn);
    header[0].unshift(columnSn);

    let headerHolder = clone<ColumnMeta>(columnSn)
    headerHolder.headerClass = '__sn_col __sn_col_first'
    colsRow.unshift(headerHolder)

    let theadHTML = theadRender({
      headerHeight: this.headerHeight,
      columns: this.renderColumns,
      header: [colsRow],
      maxLevel: 1,
      render: TableColumn.renderSlotHeaderCell,
    });

    if (this.showColumnIndicator) {
      this.el_thead_ext.innerHTML = '<div class="c-table-focusbar-h"></div>' + theadHTML
      this.#el_focusbar_h = this.el_thead_ext.querySelector('.c-table-focusbar-h')!
    }
  }
  onContextMenu(e: MouseEvent) {
    if (!this.el_context_menu) return;
    let startTH = closest<HTMLElement>(
      e.target!,
      (node) =>
        node.tagName == "THEAD",
      "parentNode"
    );
    if (startTH) {
      e.stopPropagation();
      e.preventDefault()
      return;
    }
    let rows = map<CellPos[], string, Record<string, any>>(this.selectedCellsPos!, cellAry => {
      return this._innerData[cellAry[0].rowIndex]
    })

    //屏蔽删除
    this.el_context_menu.itemList.forEach(item => {
      if (item && item.cellNeed) {
        item.disabled = rows.length < 1;
      }
    })

    let showMenu = true;
    this.emit('contextmenu', { items: this.el_context_menu.itemList, cells: this.selectedCellsPos, rows, cancel: () => { showMenu = false } }, { event: e })
    if (showMenu)
      this.el_context_menu.open(e);
    e.stopPropagation();
  }
  getSelectDragHandles(se: MouseEvent) {
    let that = this;
    let startTd = this.#startCell;
    let endCell: HTMLElement | null | undefined = undefined;
    let startColIndex = this.getColIndex(startTd!)
    let startRowIndex = this.getRowIndex(startTd!)
    let root = this.el_table;
    return {
      mouseMove: function (
        moe: MouseEvent,
        colIndex: number,
        rowIndex: number
      ) {
        let endTd = (endCell = that._getCellDom(rowIndex, colIndex));
        if (!endTd) return;

        //序号列
        if (endTd.classList.contains("__sn_row")) {
          let rowIndex = endTd.dataset.rowIndex;
          let td = that._getCellDom(rowIndex!, 1)
          endTd = td;
        }

        endCell = endTd;
        that.locateSelector(startTd!, endTd);
        that.rangeInput && that.rangeInput.setValue((Math.abs(rowIndex - startRowIndex) + 1) + 'R x ' + (Math.abs(colIndex - startColIndex) + 1) + 'C')
      },
      mouseUp: function (e: MouseEvent, checking: boolean) {
        if (isDefined(endCell)) {
          that.#endCell = endCell || that.#startCell;
        }
        that._selectedCells()

        if (checking) {

        }
        let fColIndex = that.getColIndex(that.focusCell!)
        let fRowIndex = that.getRowIndex(that.focusCell!)
        that.rangeInput && that.rangeInput.setValue(that._getColumnChar(fColIndex - 1) + (fRowIndex + 1))
      },
    };
  }
  getFillDragHandles(se: MouseEvent) {
    let el_selector_filler = this.#el_selector_filler;
    let fillerStyle = el_selector_filler.style;
    let that = this;
    let getCellBox = this.getCellBox.bind(this);
    let { x, y, ltColIndex, ltRowIndex, rbColIndex, rbRowIndex } =
      getCellBox(this.#startCell!, this.#endCell!);
    let ltCell = this._getCellDom(ltRowIndex, ltColIndex)
    let rbCell = this._getCellDom(rbRowIndex, rbColIndex)
    let ltCellPos: CellPos = { rowIndex: ltRowIndex, colIndex: ltColIndex, prop: '' };
    let rbCellPos: CellPos = { rowIndex: rbRowIndex, colIndex: rbColIndex, prop: '' };
    let dir = "";
    let root = this.el_table;
    let headHeight = this.getHeaderHeight();

    let rect = root.getBoundingClientRect();
    let startX = se.clientX + root.scrollLeft - rect.x,
      startY = se.clientY + root.scrollTop - headHeight - rect.y;
    let endCell, startCell;
    let startColIndex = ltColIndex
    let endColIndex = rbColIndex
    // let startRowIndex = this.getRowIndex(this.#startCell!)
    return {
      mouseMove: function (
        moe: MouseEvent,
        colIndex: number,
        rowIndex: number,
        moveX: number,
        moveY: number
      ) {
        fillerStyle.display = "block";

        //计算当前点的斜率，以便确定拖动方向
        let k = Math.atan2(moveY - startY, moveX - startX);
        let angle = (450 + (k * 180) / Math.PI) % 360;
        if (angle > 45 && angle < 135) {
          dir = "right";
        } else if (angle <= 45 || angle > 315) {
          dir = "top";
        } else if (angle >= 135 && angle < 225) {
          dir = "bottom";
        } else {
          dir = "left";
        }

        startCell = ltCell;

        switch (dir) {
          case "right":
            rowIndex = rbRowIndex;
            startCell = startCell;
            break;
          case "bottom":
            colIndex = rbColIndex;
            startCell = startCell;
            break;
          case "top":
            //TODO: top结束后，如果新的rowIndex未超过ltRowIndex，则结果是ltRowIndex到rowIndex，否则就是rowIndex到rbRowIndex
            colIndex = ltColIndex;
            startCell = rbCell;
            break;
          case "left":
            rowIndex = ltRowIndex;
            startCell = rbCell;
            break;
        }

        endCell = that._getCellDom(rowIndex, colIndex)
        let fillBox = getCellBox(startCell, endCell);

        if (dir == "right" || dir == "bottom") {
          fillerStyle.left = fillerStyle.top = "0";

          // fillLength =
        } else if (dir === "top") {
          fillerStyle.left = "0";
          fillerStyle.top = fillBox.y - y + "px";
        } else if (dir === "left") {
          fillerStyle.left = fillBox.x - x + "px";
          fillerStyle.top = "0";
        }

        fillerStyle.width = fillBox.w + "px";
        fillerStyle.height = fillBox.h + "px";
      },
      mouseUp: function (e: MouseEvent, checking: boolean, moved: boolean) {
        fillerStyle.display = "none";
        fillerStyle.width = fillerStyle.height = "0";

        if (!moved) return;

        let endRow = that.getRowIndex(endCell!);
        let endCol = that.getColIndex(endCell!);

        let fillLength = 0;
        //relocate selector
        switch (dir) {
          case "right":
            fillLength = endCol - that.getColIndex(rbCell);
            break;
          case "bottom":
            that.#startCell = startCell!;
            that.#endCell = endCell!;
            fillLength = endRow - that.getRowIndex(rbCell);
            break;
          case "top":
            fillLength = that.getRowIndex(ltCell) - endRow;
            break;
          case "left":
            that.#startCell = endCell!;
            that.#endCell = startCell!;
            fillLength = that.getColIndex(ltCell) - endCol;
            break;
        }

        that.doFill(dir, ltCellPos, rbCellPos, startColIndex, endColIndex, fillLength);
        that.locateSelector(startCell! || that.#selectorMeta.startCell, endCell!, false);

      },
    };
  }
  getSnRowDragHandles(se: MouseEvent, startRowIndex: number) {
    let lastColIndex = this.renderColumns.length - 1;
    let startTd = this._getCellDom(startRowIndex, 1)
    let endTd = this._getCellDom(startRowIndex, lastColIndex)
    this.locateSelector(startTd!, endTd);
    let that = this;
    return {
      mouseMove: function (
        moe: MouseEvent,
        colIndex: number,
        rowIndex: number,
        moveX: number,
        moveY: number
      ) {
        endTd = that._getCellDom(rowIndex, lastColIndex)

        that.locateSelector(startTd!, endTd);
      },
      mouseUp: function (e: MouseEvent) {
        that.#startCell = startTd
        that.#endCell = endTd

        that._selectedCells()
      },
    };
  }
  getSnColDragHandles(th: HTMLElement, startColIndex: number) {
    let lastRowIndex = this._innerData.length - 1;
    let startTd = this._getCellDom(0, startColIndex)
    let endTd = this._getCellDom(lastRowIndex, startColIndex)
    let startCellPos = { colIndex: startColIndex, rowIndex: 0, prop: '' }
    let endCellPos = { colIndex: startColIndex, rowIndex: lastRowIndex, prop: '' }
    this.locateSelector(startTd!, endTd, true, endCellPos, startCellPos, th);
    let that = this;
    return {
      mouseMove: function (
        moe: MouseEvent,
        colIndex: number,
        rowIndex: number,
        moveX: number,
        moveY: number
      ) {
        endTd = that._getCellDom(lastRowIndex, colIndex)
        if (endTd) {
          that.locateSelector(startTd!, endTd);
        } else {
          endCellPos = { colIndex: colIndex, rowIndex: lastRowIndex, prop: '' }
          that.locateSelector(startTd!, endTd, true, endCellPos, startCellPos);
        }

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
    let maxCIndex = this.renderColumns.length - 1;
    let maxRIndex = this._innerData.length - 1
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
    this.locateSelector(nextTd, nextTd);
    this.#startCell = this.#endCell = nextTd;
    this.setFocusCell(nextTd!, e);
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

    let startBox = startCell ? getBox(startCell, this.el_body_table) : this.#selectorMeta.startBox!;
    if (startBox.w < 1 || startBox.h < 1) {
      startBox = this.#selectorMeta.startBox!
    }
    let endBox = null;

    if (endCell) {
      endBox = getBox(endCell, this.el_body_table);
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

    x = x - SelectorOffset;
    y = y - SelectorOffset;
    if (x < 0) {
      x = 0;
      w -= 1;
    }
    let headH = this.getHeaderHeight();
    if (y < headH) {
      y = headH - 1;
      h -= 1;
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
    if (!this.#el_selector) return;

    this.#el_selector.style.transform = 'translateX(-10px)';
    this.#el_selector.style.width = this.#el_selector.style.height = '';
    this.#el_selector_copy.style.left = '-9999px';
    this.#el_selector_caret.style.left = '-9999px';
  }
  hideFocusbar() {
    if (!this.#el_focusbar_h) return;

    this.#el_focusbar_h.style.width = '0';
    this.#el_focusbar_v.style.height = '0'
  }
  hideMsg() {
    if (!this.#el_warning_msg)
      return;
    this.#el_warning_msg.style.display = "none";
    this.#el_custom_msg.style.display = "none";
  }
  //重新设置起始单元格
  locateSelector(
    startTd: HTMLElement,
    endTd?: HTMLElement,
    changeFocus: boolean = true,
    endCellPos?: CellPos,
    startCellPos?: CellPos,
    th?: HTMLElement
  ) {
    let isEnd =
      endTd?.classList.contains("__end") ||
      startTd?.classList.contains("__end");
    if (!startTd && !startCellPos) return;
    let startRowIndex = this.getRowIndex(startTd)
    if (this.#selectorMeta.startCell !== startTd) {
      this.#selectorMeta.startCell = startTd;
      this.#selectorMeta.startBox = startTd ? getBox(startTd, this.el_body_table) : undefined;
      this.#selectorMeta.startRow = startRowIndex;
      this.#selectorMeta.startColumn = this.getColIndex(startTd);
    }

    let startBox = this.#selectorMeta.startBox!;
    if (!startBox && startCellPos) {
      let h = (startCellPos.rowIndex - (this.#selectorMeta.startRow || 0)) * this.rowHeight
      let cell = this._getCellDom(startRowIndex, startCellPos.colIndex)
      let cellBox = getBox(cell || th, this.el_body_table);
      // let tmpBox = this.getCellRect(startBox, cellBox, isEnd)
      let y = this.el_thead.offsetHeight + this.el_thead_ext.offsetHeight
      startBox = {
        x: cellBox.x,
        y: y,
        w: cellBox.w,
        h
      }
    }
    let sx = startBox.x - SelectorOffset;
    let sy = startBox.y //- SelectorOffset;
    let sw = startBox.w;
    let sh = startBox.h;
    let isEndStart = (startTd || th).classList.contains("__end");

    this.#el_selector.classList.toggle("__end", isEnd);

    let selectorStyle = this.#el_selector.style;
    let focusBox = { x: startBox.x - SelectorOffset, y: startBox.y - (this.#selectorMeta.startRow! < 1 ? 0 : SelectorOffset), w: startBox.w, h: startBox.h - (this.#selectorMeta.startRow! < 1 ? SelectorOffset : 0) }

    if (sx < 0) {
      sx = 0;
      sw -= 1;
    }
    if (sy < 0) {
      sy = 0;
      sh -= 1;
    }
    if (isEndStart) {
      sw -= SelectorOffset;
      focusBox.w -= SelectorOffset;
    }

    if (endTd && endTd !== startTd) {
      let endBox = getBox(endTd, this.el_body_table);
      focusBox = this.getCellRect(startBox, endBox, isEnd)
    }
    if (endCellPos) {
      let h = (endCellPos.rowIndex - (this.#selectorMeta.startRow || 0) + 1) * this.rowHeight
      let cell = this._getCellDom(startRowIndex, endCellPos.colIndex)
      let cellBox = getBox(cell || th, this.el_body_table);
      let tmpBox = this.getCellRect(startBox, cellBox, isEnd)
      focusBox = {
        x: tmpBox.x,
        y: sy,
        w: tmpBox.w,
        h
      }
    }

    let { x, y, w, h } = focusBox;

    selectorStyle.transform = `translate3d(${x}px, ${y}px,0)`
    selectorStyle.width = w - 1 + "px";
    selectorStyle.height = h - 1 + "px";

    if (changeFocus) {
      this.#el_selector_focus.style.left = sx - x + "px";
      this.#el_selector_focus.style.top = sy - y - 2 + "px";
      this.#el_selector_focus.style.width = sw - 0 + "px";
      this.#el_selector_focus.style.height = sh - 0 + "px";
    }

    if ((startTd || th).classList.contains("__selection")) {
      this.#el_selector_caret.style.left = "9999px";
    } else {
      this.#el_selector_caret.style.left = "-99999px";
    }

    if (parseInt(this.#el_selector_caret.style.left) > 0) {
      this.#el_selector_caret.style.left =
        sx + sw - this.#el_selector_caret.clientWidth - SelectorOffset + "px";
      this.#el_selector_caret.style.top = sy + 3 + "px";
    }

    //侧边焦点条
    this.#el_focusbar_v.style.top = y + 2 + 'px'
    this.#el_focusbar_v.style.height = h + 'px'

    if (this.showColumnIndicator) {
      this.#el_focusbar_h.style.left = x + 2 + 'px'
      this.#el_focusbar_h.style.width = w + 'px'
    }

    //隐藏填充框
    let fillerStyle = this.#el_selector_filler.style;
    fillerStyle.display = "none";
    fillerStyle.width = fillerStyle.height = "0";
  }
  locateFocus() {
    // let selectorStyle = this.#el_selector.style;
    let isEnd = this.focusCell?.classList.contains("__end");
    let box = getBox(this.focusCell!);
    let transform = window.getComputedStyle(this.#el_selector).transform
    let xy = transform.split(',')
    let sx = parseFloat(xy[4]);
    let sy = parseFloat(xy[5]);
    this.#el_selector_focus.style.left = box.x - sx - 2 + "px";
    this.#el_selector_focus.style.top = box.y - sy - 0 + "px";
    this.#el_selector_focus.style.width = box.w - 1 - (isEnd ? 2 : 0) + "px";
    this.#el_selector_focus.style.height = box.h - 1 + "px";
  }
  locateSelectorCopy() {
    if (!this.#copyStartCell) return;

    let startBox = getBox(this.#copyStartCell, this.el_body_table);
    let endBox = getBox(this.#copyEndCell!, this.el_body_table);
    let copyStyle = this.#el_selector_copy.style;
    if (parseInt(copyStyle.left) > 0) {
      copyStyle.left = startBox.x + "px";
      copyStyle.top = Math.min(startBox.y, endBox.y) + "px";
      copyStyle.width = endBox.x - startBox.x + endBox.w + "px";
      copyStyle.height = Math.abs(endBox.y - startBox.y) + endBox.h + "px";
    }
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
    let colProp = cell ? cell.dataset.columnProp! : cellPos?.prop;
    let col = this.renderColumns[cIndex!];
    //update data
    set(data[rIndex!], colProp!, text);

    //update view
    if (cell) {
      let str = TableColumn.renderSlotBodyCell(
        col,
        data[rIndex!],
        rIndex!,
        cIndex!,
        this.__formatter
      );
      str = isUndefined(str) ? '' : str;
      cell.querySelector(".view")!.innerHTML = str;
    }

  }
  updateCellInput(cell: HTMLElement, data: Array<Record<string, any>>) {
    let rIndex = this.getRowIndex(cell);
    let cIndex = this.getColIndex(cell);
    let colProp = cell.dataset.columnProp!;
    let col = this.renderColumns[cIndex];
    //update input
    let html = "";
    if (col.slots.input) {
      html = TableColumn.renderSlotInputCell(col, data[rIndex], rIndex, cIndex);
    } else if (col.dataType) {
      html = TableColumn.renderInput(
        col.dataType,
        col.dataSelection!,
        col.dataSelectionOption!,
        col.dataOption!,
        data[rIndex][colProp]
      );
    }
    cell.querySelector(".input")!.innerHTML = html;
  }
  activeInput(cell: HTMLElement, text?: string) {
    if (!cell.classList.contains("__editable")) return;
    if (cell.classList.contains("__slotted")) return;
    if (this.activeCell && this.isEqualCell(this.activeCell, cell)) return;
    if (this.#el_warning_msg.style.display !== "none" || this.#el_custom_msg.style.display !== "none") return;

    let colProp = cell.dataset.columnProp!;
    let rIndex = this.getRowIndex(cell);
    let cIndex = this.getColIndex(cell);
    if (this.lockedPosMap[cIndex + ":" + rIndex]) {
      return;
    }
    let rowData = cloneDeep(this._innerData[rIndex]);
    let col = this.getColumnMeta(cell);

    let toBreak = false;
    this.emit('beforecellactive', {
      row: rowData, column: col, rowIndex: rIndex, colIndex: cIndex, cell: { colIndex: cIndex, rowIndex: rIndex, prop: colProp }, value: text, cancel: () => {
        toBreak = true;
      }
    })
    if (toBreak) return;

    cell.classList.add("active-input");
    this.renderRoot.classList.add("__in-input");
    this.activeCell = cell;
    let input = cell.querySelector(
      ".c-table-cell-input__text"
    ) as HTMLTextAreaElement;
    input.focus();

    //打开input前，更新input数据
    input.value = (isDefined(text) ? text : this._innerData[rIndex][colProp]) || '';
    this.closeCopy();

    let that = this;
    input.onblur = function (e: Event) {
      that.closeInput();
    };

    this.emit('cellActive', { row: rowData, column: col, rowIndex: rIndex, colIndex: cIndex, cell: { colIndex: cIndex, rowIndex: rIndex, prop: colProp }, value: text })
  }
  closeInput(cancelText?: boolean) {
    if (!this.activeCell || !this.el_body_table.contains(this.activeCell)) return;
    // if(this.#el_warning_msg.style.display !== "none" || this.#el_custom_msg.style.display !== "none")return false;

    //校验选择内容
    let col = this.getColumnMeta(this.activeCell);
    let colProp = this.activeCell.dataset.columnProp!;
    let input = this.activeCell.querySelector(
      ".c-table-cell-input__text"
    ) as HTMLTextAreaElement;
    let text = input.value;
    let isMulti = col.dataSelectionOption?.multiple;
    if (col.dataSelectionOption?.constraint && !cancelText && trim(text)) {
      if (
        (!isMulti && !includes(col.dataSelection!, trim(text))) ||
        (isMulti &&
          !isEmpty(
            except(
              union(
                split(trim(text), MultiSelectionDivider),
                col.dataSelection
              ),
              col.dataSelection
            )
          ))
      ) {
        let box = getBox(this.activeCell, this.el_body_table);
        this.#el_warning_msg.style.left = box.x - 2 + "px";
        this.#el_warning_msg.style.top = box.y + box.h + 2 + "px";
        this.#el_warning_msg.style.display = "block";
        this.#el_warning_msg.open()

        input.select();
        input.focus();
        return false;
      }
    }
    if (cancelText) {
      let input = this.activeCell.querySelector(
        ".c-table-cell-input__text"
      ) as HTMLTextAreaElement;
      if (input) input.onblur = null;
    } else {
      if (colProp) {

        let ri = this.getRowIndex(this.activeCell);
        let ci = this.getColIndex(this.activeCell);

        let old = this._innerData[ri][colProp];
        let rowData = cloneDeep(this._innerData[ri])


        let cellPos = { colIndex: ci, rowIndex: ri, prop: colProp };

        let lockCell = false;
        let cancelDeactiveMsgOptions: Record<string, any> = { type: 'warning' }
        let activedCell = this.activeCell
        this.emit('beforecelldeactive', {
          row: rowData, column: this.renderColumns[ci], rowIndex: ri, colIndex: ci, cell: cellPos, value: text, prevValue: old, lock: () => {
            lockCell = true;
          }, cancel: () => {
            if (!this.activeCell || this.activeCell !== activedCell) return;
            this.#el_warning_msg.style.display = "none";
            this.#el_custom_msg.style.display = "none";

            this.activeCell && this.activeCell.classList.remove("active-input");
            this.activeCell = null;
            this.renderRoot.classList.remove("__in-input");
          }
        })
        if (lockCell) {
          this.lockCells(this._getColumnChar(ci - 1) + (ri + 1))
        }

        //同步调用cancel后会出现
        if (!this.activeCell) return;

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

        this.emit('celldeactive', { row: rowData, column: this.renderColumns[ci], rowIndex: ri, colIndex: ci, cell: cellPos, value: text, prevValue: old })
        if (text !== old) {
          this.emit('cellchange', { row: rowData, column: this.renderColumns[ci], rowIndex: ri, colIndex: ci, cell: cellPos, value: text, prevValue: old })
          this.emit('change', { type: 'input', cells: [{ row: rowData, column: this.renderColumns[ci], rowIndex: ri, colIndex: ci, cell: cellPos, value: text, prevValue: old }] })
        }
      }
    }

    this.#el_warning_msg.style.display = "none";
    this.#el_custom_msg.style.display = "none";

    this.activeCell && this.activeCell.classList.remove("active-input");
    this.activeCell = null;
    this.renderRoot.classList.remove("__in-input");

  }
  onCloseTip() {
    this.closeInput(true);
    // this.#el_warning_msg.removeAttribute("showing");
  }
  closeCopy() {
    this.#el_selector_copy.style.left = "-9999px";
    this.#el_selector_copy.style.width = this.#el_selector_copy.style.height =
      "0";
    this.#copyStartCell = this.#copyEndCell = null;
    if (this.#copyStartCell) {
      navigator.clipboard.writeText("");
    }
  }
  insertAbove() {
    return `在上方插入<input type="text" value="${this.defaultInsertSize}" style="width: 2rem;margin:0 .1rem" onclick="event.stopPropagation()" maxlength="4" onkeydown="event.stopPropagation()"/>行`;
  }
  insertUnder() {
    return `在下方插入<input type="text" value="${this.defaultInsertSize}" style="width: 2rem;margin:0 .1rem" onclick="event.stopPropagation()" maxlength="4" onkeydown="event.stopPropagation()"/>行`;
  }
  doCopy() {
    if (!get(this.editOption, 'copyable', true)) return;

    let text = "";
    let table = this.el_body_table;
    let data = this._innerData;
    each(this.selectedCellsPos!, (cellsPos) => {
      let rowText = "";
      each(cellsPos, (cellPos) => {
        let td = this._getCellDom(cellPos.rowIndex, cellPos.colIndex)
        if (td) {
          rowText += "\t" + td.innerText;
        } else {
          rowText += "\t" + get(data, [cellPos.rowIndex, cellPos.prop]);
        }
      });
      text += "\r\n" + rowText.replace(/^\t/, '');
    });

    navigator.clipboard.writeText(text.replace(/^\r\n/, ""));

    if (
      get<number>(this.#startCell, "offsetLeft", 0) <
      get<number>(this.#endCell, "offsetLeft", 0)
    ) {
      this.#copyStartCell = this.#startCell;
      this.#copyEndCell = this.#endCell;
    } else {
      this.#copyStartCell = this.#endCell;
      this.#copyEndCell = this.#startCell;
    }

    let style = this.#el_selector_copy.style;
    let style2 = this.#el_selector.style;
    let transform = window.getComputedStyle(this.#el_selector).transform
    let xy = transform.split(',')
    style.left = parseFloat(xy[4]) + 'px';
    style.top = parseFloat(xy[5]) + 'px';
    style.width = parseInt(style2.width) + 4 + "px";
    style.height = parseInt(style2.height) + 4 + "px";
  }
  doPaste() {
    if (!get(this.editOption, 'pastable', true)) return;
    let startTd = this.#startCell!;
    let endTd = this.#endCell!;
    //粘贴统一从剪切板获取 \t用于分列，\r\n用于换行
    navigator.clipboard.readText().then((rs) => {
      //格式check
      let content = rs;
      if (!content) return;

      let rows = content.split(/\r\n|\n/gim);
      let targetRowCount = this.getRowIndex(endTd) - this.getRowIndex(startTd) + 1;
      let contentRowCount = rows.length;
      let contentColCount = rows[0].split("\t").length;
      //解析行列
      let endRIndex = this.getRowIndex(startTd) + contentRowCount - 1;
      if (endRIndex > this._innerData.length - 1) {
        endRIndex = this._innerData.length - 1;
      }
      let endCIndex = this.getColIndex(startTd) + contentColCount - 1;
      if (endCIndex > this.renderColumns.length - 1) {
        endCIndex = this.renderColumns.length - 1;
      }
      let needRelocate = targetRowCount % contentRowCount;

      if (needRelocate) {
        //重新定位selector
        endTd = this._getCellDom(endRIndex, endCIndex)
        let endCellPos = { colIndex: endCIndex, rowIndex: endRIndex, prop: '' }
        this.locateSelector(startTd, endTd, false, endCellPos);
      }

      let sri = this.getRowIndex(startTd);
      let sci = this.getColIndex(startTd);
      let eri = endRIndex//this.getRowIndex(endTd);
      let eci = endCIndex//this.getColIndex(endTd);
      let body = this.el_body_table;
      let cells: Array<Record<string, any>> = [];
      let changedCells: CellPos[] = []
      each(range(sri, eri + 1), (rIndex, i: number) => {
        let rowData = rows[i % contentRowCount].split("\t")
        each(range(sci, eci + 1), (cIndex, j: number) => {
          let cellValue = rowData[j % contentColCount]
          let colProp = this.renderColumns[cIndex].prop
          let cellPos = { colIndex: cIndex, rowIndex: rIndex, prop: colProp! }
          changedCells.push(cellPos)

          cells.push({
            cell: cellPos,
            oldValue: this._innerData[rIndex][colProp!],
            newValue: cellValue,
          });
        })
      });

      this.doCommand(Command.setCells, {
        startCell: startTd,
        endCell: endTd,
        focusCell: this.focusCell,
        cells,
      });

      this.emit('change', { type: 'paste', cells: changedCells })
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
        let prop = this.renderColumns[col].prop;
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
              (row) => this._innerData[row][prop]
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
              (row) => this._innerData[row][prop]
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
            let base = parseFloat(steps[last<number>(toArray(set))].num) - parseFloat(steps[head<number>(toArray(set))].num)
            let accDiff = 0;
            each(map(set, i => steps[i].num), (v, i: number, seq: number[]) => {
              let next = seq[i + 1];
              if (next) {
                accDiff += parseFloat(next + "") - parseFloat(v + "");
              }
            });
            let step = accDiff / (setSize - 1)
            set.forEach(i => {
              steps[i].base = base
              steps[i].step = step
            })
          }
        })

        each(fillingCells, (cell, i: number) => {
          let row = cell.rowIndex
          let step = steps[i % steps.length];
          let oldValue = this._innerData[row][prop];
          let newValue = step.tmpl
          if (isDefined(step.num)) {
            let base = step.base || 0;
            let nNum = parseInt(step.num) + parseInt(step.step) + (parseInt(base))

            if (step.tmpl) {
              newValue = step.tmpl.replace(FILL_TAG, nNum)
            } else {
              newValue = nNum
            }
            step.num = nNum
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

        let rowData = this._innerData[cell.rowIndex]
        if (oldValue !== newValue)
          changedCells.push({ row: rowData, column: this.renderColumns[cell.colIndex], rowIndex: cell.rowIndex, colIndex: cell.colIndex, cell: null, value: newValue, prevValue: oldValue })
        return {
          cell,
          oldValue,
          newValue,
        };
      }),
    });

    this.emit('change', { type: 'fill', cells: changedCells })
  }
  _removeRows(onlyBlank: boolean = false) {
    let startRow = this.getRowIndex(this.#startCell!)
    if (startRow < 0 && this.checkedCells.length < 1) return;

    //1. 计算checked行列
    let rows = new Set(), cells = new Set();
    each(this.checkedCells, cellPos => {
      rows.add(cellPos.rowIndex)
      cells.add(cellPos.colIndex)
    })
    //2. 计算selected行列
    each(flatDeep<CellPos>(this.selectedCellsPos || []), cellPos => {
      rows.add(cellPos.rowIndex)
      cells.add(cellPos.colIndex)
    })
    //3. 删除行
    //仅删除渲染列字段为空的行
    let cols = filter(this.renderColumns, c => c.prop)
    sort(rows, (a: number, b: number) => b - a).forEach((r: number) => {
      let rowData = this._innerData[r]
      let isEmptyRow = every(cols, col => !trim(rowData[col.prop!]));
      if ((onlyBlank && isEmptyRow) || !onlyBlank)
        this._innerData.splice(r, 1);
    })
    this.updateData();
    //4. 重新定位selector
    this._relocateSelector();
    this.hideFocusbar();
  }
  _relocateSelector() {
    if (!this.selectedCellsPos) return;
    let selectedRows = map(flat(this.selectedCellsPos), cell => cell.rowIndex)
    let dataRow = this._innerData.length
    let minRow = min(selectedRows)
    let maxRow = max(selectedRows)

    if (minRow > dataRow || maxRow > dataRow) {
      this.hideSelector()
    }
  }
  _updateCheckedStyle() {
    let selectors = map(this.checkedCells, cellPos => {
      return `.c-table-cell[data-column-index="${cellPos.colIndex}"][data-row-index="${cellPos.rowIndex}"] .c-table-cell-wrapper::before`
    }).join(',');
    // console.log(selectors)
    Editable.checkedSheet.replaceSync(
      selectors +
      `{
        position: absolute;
        width: calc(100% - 2px);
        height: calc(100% - 2px);
        padding: 0;
        left: 1px;
        top: 1px;
        content: "";
        background: rgba(0, 0, 0, 0.1);
      }`
    );
  }
  _selectedCells(startPos?: CellPos, endPos?: CellPos) {
    if (isEmpty(this._innerData)) return;
    let sdataset = this.#startCell?.dataset!;
    let edataset = this.#endCell?.dataset || sdataset;

    let startColIndex = startPos ? startPos.colIndex : sdataset.columnIndex!
    let startRowIndex = startPos ? startPos.rowIndex : sdataset.rowIndex!
    let endColIndex = endPos ? endPos.colIndex : edataset.columnIndex!
    let endRowIndex = endPos ? endPos.rowIndex : edataset.rowIndex!

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

    return code + 1;
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

    if (minCol < 1 || maxCol > (this.renderColumns.length - 1) || minRow < 0 || maxRow > (this._innerData.length - 1)) {
      throw new Error('cell index is out of range')
    }
    let rowCells = [];
    let data = this.renderColumns;
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
  setStyle(cell: string | CellPos, style: string | Record<string, string>) {
    let cssText: string = style + '';
    if (isObject(style)) {
      cssText = join(map(styles, (v, k: string) => kebabCase(k) + ":" + v), ';')
    }
    let rIndex: number = -1, cIndex: number = -1;
    if (isString(cell)) {
      let range = this.__getRange(cell)
      rIndex = range.startRowIndex
      cIndex = range.startColIndex
    } else if (cell.colIndex) {
      rIndex = cell.rowIndex
      cIndex = cell.colIndex
    }
    this.cellStyleMap[rIndex + ":" + cIndex] = cssText
    //update dom
    let td = this._getCellDom(rIndex, cIndex);
    if (td) {
      td.style.cssText += ';' + cssText
    }
  }
  setNote(cell: string | CellPos, message: string) {
    let rIndex: number = -1, cIndex: number = -1;
    if (isString(cell)) {
      let range = this.__getRange(cell)
      rIndex = range.startRowIndex
      cIndex = range.startColIndex
    } else if (cell.colIndex) {
      rIndex = cell.rowIndex
      cIndex = cell.colIndex
    }
    this.cellNoteMap[rIndex + ":" + cIndex] = message
    //update dom
    let td = this._getCellDom(rIndex, cIndex);
    if (td) {
      let tip = td.querySelector('l-tooltip')
      if (message) {
        td.setAttribute('data-note', message)
        tip?.setAttribute('content', message)
        tip?.toggleAttribute('disabled', false)
      } else {
        td.removeAttribute('data-note')
        tip?.toggleAttribute('disabled', true)
      }

    }
  }
  getColumnIndex(prop: string) {
    let i = findIndex(this.renderColumns, col => col.prop === prop)
    return this._getColumnChar(i - 1)
  }
}
