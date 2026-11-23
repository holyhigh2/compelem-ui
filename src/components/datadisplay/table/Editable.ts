import {
  alphaIndex,
  alphaLabel,
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

import { CompElem, computed, csscope, Csscope, debounced, emits, event, prop, query, state, tag, watch } from "compelem";
import { DataType } from "../../../constants";
import { attr, nodesToHTML, showError } from "../../../utils/utils";
import { Message } from "../../feedback/message/Message";
import { ContextMenu } from "../../nav/contextmenu/ContextMenu";
import { Alert } from "../../overlays/modals/Alert";
import { useToast } from "../../overlays/toast/toast";
import { ScrollerEndPayload, ScrollerScrollPayload } from "../scroller/Scroller";
import { Column } from "./Column";
import { ColumnFoot } from "./ColumnFoot";
import { getMenuItems } from "./contextmenu";
import editableStyle from "./editableStyle.scss?tmpl";
import { tableStyleSheet } from "./styleSheets";
import { AVAILABLE_ROW_TAG, PRIV_COL_PREF, SCROLLER_COL_PROP, Table } from "./Table";
import {
  CellBox,
  CellPos,
  CellValue,
  ColumnLike,
  ColumnMeta,
  ColumnType,
  ContextMenuOpenPayload,
  ContextMenuSelectPayload,
  DataSelectionOption,
  DynamicMap,
  RowData,
  SelectorMeta,
  StyleObject
} from "./types";
import { Menu, MenuEntry, MenuItem } from "../../nav/menu/Menu";
const MultiSelectionDivider = " ";
const FormulaTag = "=";
const SelectorOffset = 2;
/** 行号角格列的私有 prop（仅存在于表头/footer 的外置角格，不在模型列里） */
const SnProp = '__sn'
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

/** `setCells` 命令的单个变更：`cell` 为单元格元素或格位置，`newValue` 待写回 */
type CellChange = { cell: HTMLElement | CellPos; oldValue: CellValue; newValue: CellValue }

/** `change` 事件里的单元格变更描述（富对象：携带行列引用与新旧值） */
type CellChangePayload = {
  cell: CellPos | null
  row: RowData
  column: ColumnLike
  rowIndex: number
  colIndex: number
  value: CellValue
  prevValue: CellValue
}

/** 右键菜单「插入行」的数据工厂：`props` 是插入行需要预置的列 prop 列表 */
type InsertDataGetter = (rowCount: number, props: string[]) => RowData[]

/** `doFill` 的连续性推演单元：num/tmpl 来自单元格值，step/base 为推演出的步长与基准 */
type FillStep = {
  num?: string | number
  tmpl?: string | number
  step?: number
  base?: number
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
 * @attrs
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
 *  edit-max-width {number} 单元格编辑框宽度自适应上限：最大宽度 = 列宽 × 该系数，默认2。宽度在列宽与该上限之间随内容（最长一行）伸缩，超出表体可视右缘时向内钳制；1 = 固定列宽（旧行为）
 *  keep-selection-on-outside {boolean} 点击表格外部时是否保留选区，默认false。表格类页面点外面就该取消选区；设计器类页面（活动单元格要常驻、右栏属性面板要一直跟着那一格）设 true
 * @events
 *  beforecellactive({cell,row,column,rowIndex,colIndex, value, cancel()}) 打开单元格编辑窗口前触发，可阻止激活
 *  cellactive({cell,row,column,rowIndex,colIndex, value}) 打开单元格编辑窗口时触发
 *  cellchange({cell,row,column,rowIndex,colIndex, value, prevValue}) 退出单元格编辑窗口后且内容发生变更时触发
 *  celldeactivate({cell,row,column,rowIndex,colIndex, value, prevValue}) 退出单元格编辑窗口后触发
 *  beforecelldeactivate({cell,row,column,rowIndex,colIndex, value, prevValue, cancel()}) 退出单元格编辑窗口前触发
 * 
 *  cellpick({anchor,rect,row,column,rowIndex,colIndex,cell,value,text,setValue,close,onClose}) 点击单元格右上角选值caret时触发；picker列由调用者接管弹层，以anchor/rect定位自己的浮层。setValue(v) 回填单元格并返回 done/cancelled/invalid，close 收尾并执行 onClose 注册的回调
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
@emits('beforecellactive', 'cellactive', 'cellchange', 'celldeactivate', 'beforecelldeactivate', 'cellpick', 'contextmenu', 'contextmenuinsert', 'change', 'select')
@tag("ce-editable")
export class Editable extends Table {

  //选框
  #el_selector: HTMLElement;
  #el_selector_caret: HTMLElement;
  @query("ce-menu")
  el_input_options: Menu;
  @query('ce-context-menu')
  el_context_menu: ContextMenu;
  #el_warning_msg: Message;
  @query('ce-alert')
  alert: Alert;
  @query('.ce-table-header')
  tableHeader: HTMLElement;
  @query('.ce-table-cell-input__text')
  inputCell: HTMLTextAreaElement
  /** 打开中的单元格盒子（activeInput 时记、onInput 复用）—— 编辑框内容自适应宽度的基准 */
  #activeCellBox?: ReturnType<typeof getBox>
  /** 编辑框宽度测量器：与 textarea 同父（挂在 bodyCon）⇒ 字体继承链一致，见 #measureInputTextWidth */
  #inputWidthDetector?: HTMLElement
  // 不能加 QueryCache.ONCE：该模式下**首次（含 null）结果被永久缓存**，
  // 而角格列是命令式按实例插入的（见 #syncRowIndicatorGutter），首次查询往往早于插入。
  @query('.ce-table-head ce-column[all]')
  headColAll!: Column

  //编辑中
  activeCell: HTMLElement | null;
  focusCell: HTMLElement | null;
  focusCellPos: CellPos
  #startCell: HTMLElement | null;
  #endCell: HTMLElement | null;
  /** 打开中的选值会话；同一时刻只允许一个（同一格重复点击会先结束上一个） */
  #pickerSession: { pos: CellPos; closeHooks: Set<() => void> } | null = null
  /** 会话目标格；内置菜单分支的 onSelectOption 靠它取坐标 */
  #pickerPos: CellPos | null = null
  selectedCellsPos: Array<Array<CellPos>> | null;
  commandStack: Array<{ command: string; data: DynamicMap }> = [];

  //用于selector操作
  #selectorMeta: Partial<SelectorMeta> = {}
  checkedCells: Array<CellPos> = []

  menuItems: MenuEntry[] = getMenuItems(this);
  cellSelectionMap = new Map<string, Array<string | DynamicMap>>()
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
    this.#syncRowIndicatorGutter()
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
  @prop({ type: [Object, String] }) indicatorStyle: string | StyleObject
  @prop({ type: Object }) editOption = { dragselect: true, fillable: true, pastable: true, copyable: true, deletable: true }
  /**
   * 单元格编辑框的**宽度自适应上限**：最大宽度 = 列宽 × 该系数（默认 2）。
   *
   * 宽度在「列宽」与「列宽 × 系数」之间随内容伸缩（量的是当前值最长一行的像素宽），
   * 下限恒为列宽 —— 内容比列窄时不缩，避免编辑器与单元格视觉错位。
   *
   * - `1` = 固定为列宽（2026-10-19 之前的旧行为，可作回退开关）；
   * - 超出表体可视右缘时向内钳制：`.ce-table-body-container` 是 `overflow:hidden`
   *   （见 style.scss），最右列不加钳制会被直接裁掉；
   * - 该值会被夹取到 [1, 10]，防止误当成 px 绝对值传入时失控。
   */
  @prop editMaxWidth = 2;
  /**
   * 点击表格外部时**保留选区**（默认 false = 表格语义：点外面取消选区）。
   *
   * 设计器类页面需要"活动单元格常驻"：右栏属性面板一直跟着那一格，点侧栏/工具栏
   * 不该打断它。关掉本项时 `hideSelector()` 会连带清掉 `__selectedCells`，
   * 于是 `#selectionRect` 一类读选区的能力失效、方向键/复制/粘贴的快捷键入口
   * （`onGlobalKeydown` 在读 `__selectedCells` 为空时直接 return）也一并失效。
   */
  @prop keepSelectionOnOutside = false;

  @state rowIndicatorWidth = 30
  @state trackIndicatorProp = ''

  //////////////////////////////////// computed
  /**
   * 覆盖基类开关：`ce-editable` 需要 Table 骨架里的 6 个编辑态附加节点
   * （caret / textarea / filler / tipmsg 在 `.ce-table-body-container` 内 `#vpillar`
   * 之后，menu / alert 是 `.ce-table` 的最后两个子节点）。
   *
   * ⚠️ 这里**不能**再写自己的 render()：
   *   ① 编译器要求 `render()` 内主视图 `h`` 模板唯一（D7）—— 原实现
   *      `super.render()` + `h``selectorTmpl` + `h``tmpl` 是 2 个主视图模板，
   *      直接 `StaticAnalysisError`；
   *   ② 0.30 已删除 `Template.insert/append`（`Template` 只剩 `strings`/`vars`
   *      两个字段），原写法运行期就是 TypeError；
   *   ③ `${super.render()}` 在 0.30 是**文本插值**（产物为 `wText(node, nv)`），
   *      不是结构内联，拿不到基类骨架。
   *   ⇒ 改为「无 own render() + 覆盖基类开关」：该类被编译器判为 skipInjection，
   *     `Editable.__ce_static__` 以 `...Reflect.getPrototypeOf(this).__ce_static__`
   *     整体继承 Table 的视图字段（含 `buildTemplate`），附加节点由基类骨架内的
   *     两个 `ifTrue(this.showEditableExtras, …)` 分支产出 —— DOM 位置与旧实现
   *     逐字节一致，且两个分支的骨架**类级恒定**（不随实例变化），不会踩
   *     `TMPL_META_CACHE` 按 `component.constructor` 缓存结构的老坑。
   *
   * 行号角格列（__sn）仍然**命令式按实例插入**，见 `#syncRowIndicatorGutter()` ——
   * 它才是真正「按实例不同的结构」，不进模板。
   */
  @computed
  get showEditableExtras() {
    return true
  }
  //////////////////////////////////// lifecycles
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

    this.#syncRowIndicatorGutter()
  }

  /** 行号角格列：**命令式按实例**插入表头/表脚左上角的外置列（prop=__sn）。
   *
   *  为什么不用 render() 注入：compelem 的 buildView() 用 TMPL_META_CACHE 按
   *  `component.constructor` 缓存首个实例的 TemplateMeta，同类实例全部复用其**结构**，
   *  因此 render() 里任何按实例不同的结构都会变成类级共享，污染其它 ce-editable。
   *
   *  该角格不是模型列（不在 light-DOM 子节点里，进不了 getAllValidCols / fixedLeftColumns），
   *  所以 body 不会为它渲染单元格 —— 行号本身由 .ce-table-row::before 依据 data-row-sn 绘制。
   *  它只负责：① 表头左上角占位，使表头与表体在 left:var(--editable-row-indicator-width) 下对齐；
   *  ② 宽度锚点（__recalcSnWidth 写它的 style.width）；③ 点击表头全选（onMouseDownHeader 判 hasAttribute('all')）。 */
  #syncRowIndicatorGutter() {
    const root = this.renderRoot
    if (!root) return
    const headRow = root.querySelector<HTMLElement>('.ce-table-head .ce-table-row')
    const footRow = root.querySelector<HTMLElement>('.ce-table-foot .ce-table-row')
    const headCol = headRow?.querySelector<Column>(':scope > ce-column[all]') ?? null
    const footCol = footRow?.querySelector(':scope > ce-column-foot[ext-column]') ?? null

    if (!this.showRowIndicator) {
      headCol?.remove()
      footCol?.remove()
      return
    }

    if (headRow && !headCol) {
      const col = document.createElement('ce-column') as Column
      col.setAttribute('prop', SnProp)
      col.setAttribute('all', '')
      col.setAttribute('fixed', '')
      col.setAttribute('silent', '')
      col.setAttribute('resizable', 'false')
      col.setAttribute('min-width', '30')
      col.setAttribute('width', String(this.rowIndicatorWidth))
      headRow.insertBefore(col, headRow.firstElementChild)
    }

    // 表脚同理（仅 showFooter 时有节点）。脚格用 ext-column 与 editableStyle.scss 对齐。
    if (footRow && !footCol && this.showFooter) {
      const fc = document.createElement('ce-column-foot')
      fc.setAttribute('prop', SnProp)
      fc.setAttribute('ext-column', '')
      fc.setAttribute('foot', '')
      fc.setAttribute('fixed', '')
      fc.setAttribute('resizable', 'false')
      fc.setAttribute('min-width', '30')
      fc.setAttribute('width', String(this.rowIndicatorWidth))
      footRow.insertBefore(fc, footRow.firstElementChild)
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
  onContextMenuSelect(obj: ContextMenuSelectPayload) {
    super.onContextMenuSelect(obj)
    let { item, el } = obj
    this.onMenuSelect(item, el)
  }
  _onContextMenu(obj: ContextMenuOpenPayload) {
    let { items } = obj
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
      // ⚠️ 类名必须是 `is-fillable`：`editableStyle.scss` 里控制填充柄可见性的规则是
      // `&.is-fillable { … ::after { display: block } }`。此前这里加的是 `fillable`，
      // 与选择器错配 ⇒ 该规则是死规则，填充柄的 `::after` 恒 `display:none`（不可见）。
      this.renderRoot!.classList.add("is-fillable");
    }
  }
  onListReady() {
    super.onListReady()
    let headerExtCol = this.headColAll
    if (headerExtCol) {
      headerExtCol.style.height = this.tableHead.clientHeight + 'px'
    }
  }
  //////////////////////////////////// methods
  doCommand(command: string, data: DynamicMap) {
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
  onScroll(obj: ScrollerScrollPayload) {
    super.onScroll(obj)
    // caret 贴在单元格右上角，滚动后要按包含块内容坐标重算，否则会脱开
    this.#syncCaret()
    let { direction } = obj
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
  onScrollEnd(obj: ScrollerEndPayload) {
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

  /**
   * caret 点击：按列声明分流。
   *
   * - picker 列：只派发 cellpick，弹什么层、怎么定位、何时关闭都由调用者决定；
   * - data-selection 列：内置 ce-menu 作为默认订阅者，保持旧用法；
   * - 两者都没有：提示无可用选项。
   */
  onClickCaret(e: Event) {
    if (this.closeInput() === false) {
      return;
    }
    //过滤后禁止编辑
    if (this.__noEditingCheck()) {
      return;
    }

    // caret 只服务单选格；多选时没有明确的写回目标
    const pos = this.__selectedCells.length === 1 ? this.__selectedCells[0] : null
    if (!pos) return

    const colEl = this._fieldMap.get(pos.prop)
    if (colEl?.picker) {
      this.openCellPicker(pos)
      return
    }

    const { ds, dso } = this.#resolveSelection(pos)
    if (!isEmpty(ds)) {
      this.#openSelectionMenu(pos, ds!, dso, e)
      return
    }
    this.toast.pushMessage("无可用选项");
  }
  /**
   * 解析某格的候选：单元格级覆盖优先于列级声明。
   */
  #resolveSelection(pos: CellPos) {
    const key = this._getCellPosKey(pos)
    const colEl = this._fieldMap.get(pos.prop)
    return {
      ds: (this.cellSelectionMap.get(key) ?? colEl?.dataSelection) as Array<string | DynamicMap> | undefined,
      dso: (this.cellSelectionOptionMap.get(key) ?? colEl?.dataSelectionOption) as DataSelectionOption | undefined
    }
  }
  /**
   * data-selection 的默认实现：把候选拼成菜单项并弹出 ce-menu。
   * 候选统一按 {text, value} 归一，勾选状态与回填都以 value 为准。
   */
  #openSelectionMenu(pos: CellPos, ds: Array<string | DynamicMap>, dso: DataSelectionOption | undefined, e: Event) {
    const selection = ds.map((s) => {
      const item: DynamicMap = isObject(s) ? { ...(s as DynamicMap) } : { text: s, value: s }
      if (!isDefined(item.text)) item.text = isDefined(item.label) ? item.label : item.value
      if (!isDefined(item.value)) item.value = item.text
      item.checkMode = dso?.multiple ? "checkbox" : "radio"
      item.checkGroup = pos.prop + "_check"
      return item
    })
    const current = String(get(this.innerData[pos.rowIndex], pos.prop) ?? '')
    const checked = new Set(current.split(MultiSelectionDivider).filter(Boolean))
    each(selection, (s) => {
      s.checked = checked.has(String(s.value))
    })

    this.#beginPicker(pos)
    this.#el_selector_caret.classList.add("active")
    this.el_input_options.setItems(selection)

    //显示菜单
    //setItems 后菜单 DOM 由响应式模板在微任务 flush 中更新，
    //scrollWidth 需等 flush 后读取，否则首开时宽度为 0 导致右对齐偏移
    const list = this.el_input_options;
    const caret = this.#el_selector_caret
    list.nextTick(() => {
      const startBox = getBox(caret, this.renderRoot!);
      const positionX = startBox.x + caret.offsetWidth - list.scrollWidth;
      const positionY = startBox.y + caret.offsetHeight;

      list.open(positionX, positionY);
    });
  }
  /**
   * 打开一次外部选值会话：把坐标、当前值与回填器交给调用者，组件不创建任何弹层。
   *
   * 调用者在 cellpick 里自行打开 overlay，选中后调 setValue；表格负责锁定、公式与
   * change 事件。同一时刻只保留一个会话，新会话会先结束上一个。
   *
   * @returns false 表示目标格当前不可用（未渲染或列不存在）
   */
  openCellPicker(pos: CellPos): boolean {
    const cell = this._getCellDom(pos.rowIndex, pos.colIndex)
    const column = this.getRenderColumns()[pos.colIndex]
    if (!cell || !column) return false

    const session = this.#beginPicker(pos)
    const finish = () => this.#endPicker()
    this.emit('cellpick', {
      row: cloneDeep(this.renderList[pos.rowIndex]),
      column,
      rowIndex: pos.rowIndex,
      colIndex: pos.colIndex,
      cell,
      anchor: this.#el_selector_caret,
      rect: cell.getBoundingClientRect(),
      value: get(this.innerData[pos.rowIndex], pos.prop),
      text: this.__getRenderValue(pos.prop, pos.rowIndex),
      setValue: (v: CellValue) => {
        const result = this.commitCellValue(pos, v, ChangeType.Select)
        // 校验没过（公式自引用）时不结束会话，让调用者把面板留着改值
        if (result !== 'invalid') finish()
        return result
      },
      close: finish,
      onClose: (fn: () => void) => {
        session.closeHooks.add(fn)
      }
    })
    return true
  }
  #beginPicker(pos: CellPos) {
    this.#endPicker()
    const session = { pos, closeHooks: new Set<() => void>() }
    this.#pickerSession = session
    this.#pickerPos = pos
    return session
  }
  #endPicker() {
    const session = this.#pickerSession
    if (!session) return
    this.#pickerSession = null
    this.#pickerPos = null
    this.#el_selector_caret?.classList.remove("active")
    session.closeHooks.forEach((fn) => {
      try {
        fn()
      } catch {
        // 调用者的清理失败不能阻断表格自己的收尾
      }
    })
    this.#syncCaret()
  }
  /**
   * 把 caret 摆到当前单选格的右上角。选区变化、滚动与会话结束都会重算。
   *
   * 只有声明了弹层的列（picker 或 data-selection）才显示 —— caret 的语义是
   * 「这一格能弹层选值」，可编辑本身由双击进入文本编辑。
   */
  #syncCaret() {
    const caret = this.#el_selector_caret
    if (!caret) return
    const pos = this.__selectedCells.length === 1 ? this.__selectedCells[0] : null
    const colEl = pos ? this._fieldMap.get(pos.prop) : null
    const enabled = !!colEl && (!!colEl.picker || !isEmpty(colEl.dataSelection))
    const cell = pos && enabled && !this.activeCell
      ? this._getCellDom(pos.rowIndex, pos.colIndex)
      : null
    if (!cell) {
      caret.style.display = 'none'
      return
    }
    // ⚠️ 必须先显示再测量：caret 常态是 display:none（hideSelector 收尾时置灰），
    // 隐藏元素的 offsetParent 恒为 null —— 若此时回退到 renderRoot 量，得到的是
    // 宿主角度的坐标，而 CSS 绝对定位的包含块是 .ce-table-body-container，
    // 两者相差一个表头高度，首次点击的 caret 就会落到下一行（第二次点击时
    // caret 已显示、offsetParent 正常，故"后面又对了"）。
    caret.style.display = 'block'
    // 包含块取 offsetParent（.ce-table-body-container）；回退也必须是 bodyCon，
    // 与 CSS 定位上下文保持同一坐标系。滚动与行复用下都不会让 caret 脱开单元格。
    const cb = (caret.offsetParent as HTMLElement) || this.bodyCon || this.renderRoot!
    const box = getBox(cell, cb)
    caret.style.left = (box.x + box.w - 20) + 'px'
    caret.style.top = (box.y + 2) + 'px'
  }
  onDblClickBody(e: MouseEvent) {
    // 选值弹层开着时双击不该再起文本编辑框，否则两个编辑态叠在一起
    if (this.#pickerSession) return
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

    if (td) this.activeInput();
  }
  onMenuSelect(item: MenuItem, el: HTMLElement) {
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
      let newRows: RowData[] = [];
      const renderColumns = this.getRenderColumns()
      // 插入行需要预置的列 prop（跳过 `__` 私有列）；`col.prop` 运行时恒为 string
      const props: string[] = []
      each(renderColumns, (col) => {
        if (startsWith(col.prop, '__')) return;
        props.push(col.prop)
      })

      let dataGetter: InsertDataGetter = (rc: number, ps: string[]) => {
        let nrs: RowData[] = []
        while (rc--) {
          let newRow: RowData = {};
          each(renderColumns, (col) => {
            if (startsWith(col.prop, '__')) return;
            newRow[col.prop!] = "";
          });
          nrs.push(newRow);
        }
        return nrs;
      }
      this.emit('contextmenuinsert', {
        data: (fn: InsertDataGetter) => {
          if (fn) dataGetter = fn
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
    const target = ev.target as HTMLTextAreaElement;
    // 内容变化（如 alt+enter 换行、逐键输入）后同步宽 + 高：与 activeInput 同一尺寸
    // 逻辑（宽在 [列宽, 列宽×editMaxWidth] 间随最长一行伸缩；高 max(单元格高,
    // 内容高+边框4px)，封顶表体高度一半）。宽必须先行 —— 换行数由宽度决定。
    this.#resizeEditorBox(this.#activeCellBox)
    const rect = target.getBoundingClientRect()
    const pRect = this.renderRoot!.getBoundingClientRect()
    if (rect.y < pRect.y || rect.y > pRect.y + this.renderRoot!.offsetHeight) {
      target.blur()
    }
  }
  /**
   * 内置 `ce-menu` 订阅者的选值回调，`data-selection` 列的默认实现。
   *
   * 与文本编辑共用 `commitCellValue`：锁定、公式、`change` 事件不会再因"走弹层"而失效。
   * 单元格位置取 `#pickerPos`（单选弹层打开时的目标格），没有则回落到焦点格。
   */
  onSelectOption(obj: DynamicMap) {
    const picked = obj?.item as DynamicMap | string | number;
    // `{label, value}` 形态回填 value，纯字符串项回填自身
    const val = isObject(picked)
      ? ((picked as DynamicMap).value ?? (picked as DynamicMap).text ?? (picked as DynamicMap).label)
      : picked;
    const pos = this.#pickerPos ?? this.focusCellPos;

    if (!pos) return;

    //过滤后禁止编辑
    if (this.__noEditingCheck()) {
      return;
    }

    const colProp = pos.prop
    if (this._fieldMap.get(colProp)?.dataSelectionOption?.multiple) {
      // 多选值以空格拼接，原值可能是数字，先统一成字符串再做包含判断
      let value = String(get(this.data[pos.rowIndex], colProp) ?? '')
      const token = String(val ?? '')
      if (value.indexOf(token) < 0) {
        value += MultiSelectionDivider + token;
      } else {
        value = value.replace(token, "");
      }
      value = value.replace(/^ /, "");
      this.commitCellValue(pos, value, ChangeType.Select);
    } else {
      this.commitCellValue(pos, val, ChangeType.Select);
      this.closeList();
    }
  }
  onOutside() {
    // 会话期间「表外点击」判不准：调用者的 overlay 通常挂在 body 上，点它同样算 outside。
    // 这里让路，由调用者决定何时关闭自己的弹层
    if (this.#pickerSession) return
    if (this.keepSelectionOnOutside) {
      // 只收下拉，不动选框：编辑框自身有 blur ⇒ closeInput 提交，无需在这里处理
      if (this.el_input_options) this.closeList();
      return;
    }
    this.hideSelector()
  }
  @event('mousedown')
  onGlobalMousedown(e: MouseEvent) {
    const menu = this.el_input_options
    if (!menu) return
    // ⚠️ 菜单挂在 <ce-editable> 的 shadow 里：事件冒到宿主时 target 已被重定向成宿主自身，
    //    `contains(target)` 恒为 false ⇒ 按下的瞬间就 closeList() 把菜单挪到 left:-9999px，
    //    随后的 click 落空，选项永远点不中。必须用 composedPath 看真实的命中链路。
    const insideMenu = menu.contains(e.target as Element) || e.composedPath().includes(menu)
    if (!insideMenu) this.closeList();
  }
  @event('keydown', () => document.body)
  onGlobalKeydown(e: KeyboardEvent) {
    // ⚠️ 表外输入态（宿主页面的输入框 / textarea / contenteditable）里按键不归表格管：
    //    本监听挂在 `document.body` 上，没有这条守卫时，只要表里有选区，
    //    在 AI 助手输入框里敲 `/` 就会被下面的可打印字符分支搬走焦点
    //    （`activeInput("")`）、`Ctrl+V` 会被改成往格子粘贴。判据见
    //    `TableExtensionOperation.__isForeignEditableKey`（本站单元格编辑器豁免）。
    if (this.__isForeignEditableKey(e)) return
    super.onGlobalKeydown(e)

    // 弹层会话期间按键归调用者（它要处理搜索、方向键等），表格只保留 Escape 关闭
    if (this.#pickerSession) {
      if (lowerCase(e.key) === "escape") this.#endPicker()
      return
    }

    //没有选框的不处理
    if (this.__selectedCells.length < 1) return;

    let k = e.key
    if (/F\d+/.test(k)) return;
    if (k === 'Control') return;
    if (k === 'Alt') return;

    // Tab 不劫持，留给浏览器原生焦点流转。原实现是链条中一条空的 else-if 分支，
    // 本方法在链条之后没有语句，改成提前 return 与原来等价。
    if (lowerCase(e.key) === "tab") return;

    if (e.ctrlKey && e.key === "v") {
      if (this.activeCell) return;

      this.doPaste();
    } else if (lowerCase(e.key) == "escape") {
      this.closeCopy();
      this.closeInput(true);
      this.closeList();
    } else if (lowerCase(e.key) == "enter") {
      if (this.activeCell && e.altKey) {
        // alt+enter 换行。⚠️ textarea 是 `.ce-table-body-container` 的子节点
        // （不在单元格里，见 Table.ts 编辑态附加节点段），早年写在
        // `activeCell.querySelector(...)` 上恒为 null，`null.value += '\n'`
        // 直接抛 TypeError；且程序化改 .value 不触发 input 事件，编辑框
        // 宽高不会同步 —— 必须派发 input 走 #resizeEditorBox 统一通道。
        // preventDefault：压制 textarea 对 Enter 的默认换行，否则与下面的
        // 程序化插入叠加成双换行。
        const input = this.inputCell
        if (input) {
          e.preventDefault()
          input.value += '\n'
          input.dispatchEvent(new InputEvent("input", { bubbles: true }))
        }
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

      let changedCells: CellChangePayload[] = []
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
  onCommand(command: string, data: DynamicMap) {
    if (command === Command.setCells) {
      let updateFormulaCell = new Set<string>()
      let cells = data.cells as CellChange[];
      cells.forEach((v) => {
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
        this.updateCellView(cellDom, data, newValue, v.cell instanceof HTMLElement ? undefined : v.cell);
      })
      //更新公式
      let delCells: string[] = []
      updateFormulaCell.forEach((c) => {
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
    let rect = root.getBoundingClientRect();
    let headerHeight = this.tableHead.offsetHeight
    let scroller = this.scroller
    let startX = se.clientX + scroller.x - rect.x,
      startY = se.clientY + scroller.y - rect.y - headerHeight;
    let startRowIndex = ltRowIndex
    let endRowIndex = rbRowIndex
    let startColIndex = ltColIndex
    let endColIndex = rbColIndex

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

        let moveCell
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
            startCellPos.prop = moveCell.getAttribute('column')!;

            break;
          case "left":
            startColIndex = endCellPos.colIndex
            startRowIndex = ltRowIndex
            endColIndex = rbColIndex
            endRowIndex = rbRowIndex

            moveCell = that._getCellDom(ltRowIndex, endCellPos.colIndex)
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
    this.#endPicker();
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
    // 选区被清掉时选值会话失去目标，先收掉（调用者会收到 onClose）
    this.#endPicker()
    // 初始化顺序保护：onDataChange 可能在 connectedCallback 完成、
    // 选区相关 DOM（#el_selector_caret / inputCell）由 @query 解析出来之前触发，
    // 此时二者尚未就绪；提前返回即可（本就无选框可隐藏），避免读取 .style 抛错。
    if (!this.#el_selector_caret || !this.inputCell) return;

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
    data: RowData[],
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
        str = nodesToHTML(this.getSubViewNodes(cellFn, data[rIndex!]))
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
      // data-type="tag" 的列，内容渲染在 [name="tags"] 里的 ce-tag 上，
      // 只回写 [name="text"] 会让 tag 仍显示旧值（编辑看起来"没生效"）。
      // 走 Table 的 __fillTag 同时刷新文本与配色。
      if (col.dataType === "tag") {
        const content = cell.querySelector(".ce-table-cell-content")!;
        let colors = this._tagColorMap.get(colProp!);
        if (!colors) {
          colors = {};
          this._tagColorMap.set(colProp!, colors);
        }
        this.__fillTag(colors, str, content, col, false, false);
        const textEl = content.querySelector('[name="text"]');
        if (textEl) textEl.textContent = "";
        return;
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
    let f = this.formulaFnMap.get(lowerCase(formulaStr))
    if (f) {
      // 只求值入队，返回值这里不消费
      this._pushFxQueue(formulaStr, rIndex, cProp, true)
    }

    return true
  }

  updateCellInput(cell: HTMLElement, data: RowData[]) {
    //update input
    cell.querySelector(".ce-table-input")!.innerHTML = "";
  }
  activeInput(text?: string) {
    if (!this.__lastStartCellPos) return
    // 选值会话开着时不再进文本编辑态
    if (this.#pickerSession) return

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
    //编辑框出现时隐藏全量信息浮层(clickView)：编辑态本身可完整显示内容，浮层冗余且会遮挡输入框
    this.__updatableFullView?.replaceSync(this.getFullViewStyle("", -1))
    this.activeCell = cell;
    let input = this.inputCell

    let box = getBox(cell, this.bodyCon);
    this.#activeCellBox = box
    // 整格覆盖（不再内缩 1px）：单元格上/左网格线来自相邻格的 border-bottom/right，
    // 无法通过移除本格边框消除；让编辑框 2px 边框直接压住原网格线，避免叠出粗边框。
    input.style.left = box.x + "px"
    input.style.top = box.y + "px"
    input.style.display = "block"

    //打开input前，更新input数据
    input.value = (isDefined(text) ? text : get(this.innerData[rIndex], colProp)) ?? '';

    // 宽 + 高一次算清（宽度内容自适应，见 #resizeEditorBox）
    this.#resizeEditorBox(box)
    input.focus();
    this.closeCopy();

    let that = this;
    input.onblur = function (e: Event) {
      that.closeInput();
    };

    this.emit('cellactive', { row: rowData, column: colMeta, rowIndex: rIndex, colIndex: cIndex, cell: { colIndex: cIndex, rowIndex: rIndex, prop: colProp }, value: text })
  }
  /**
   * 编辑框尺寸（宽 + 高）的唯一计算出口（2026-10-19 宽度内容自适应）。
   *
   * **宽**：`clamp(最长一行白然宽, 列宽, 列宽 × editMaxWidth)`，再按表体可视右缘
   *   向内钳制 —— `.ce-table-body-container` 是 `overflow:hidden`（style.scss），
   *   最右列不钳会被直接裁掉。宽度必须先于高度定：换行数由宽度决定。
   * **高**：原 activeInput / onInput 两处重复的高度逻辑（内容自适应、封顶表体
   *   高度一半、border-box +4px），原样搬到这里统一。
   */
  #resizeEditorBox(box?: ReturnType<typeof getBox>) {
    if (!box) return
    const input = this.inputCell
    const colW = box.w
    // ── 宽 ──
    // 系数夹取到 [1,10]：1 = 固定列宽（旧行为）；防误把 px 绝对值当系数传入时失控
    const factor = Math.min(Math.max(Number(this.editMaxWidth) || 1, 1), 10)
    let w = Math.min(Math.max(this.#measureInputTextWidth(input.value), colW), colW * factor)
    input.style.width = w + "px"
    // 右缘钳制：只在"还夹得动"时收（avail ≤ 列宽 ⇒ 单元格本身已大半移出视口，保持列宽不恶化）。
    // 宽度没加宽（= 列宽）时不可能比单元格本身更糟，跳过这次 rect 读。
    if (w > colW) {
      const avail = this.bodyCon.getBoundingClientRect().right - input.getBoundingClientRect().left
      if (avail > colW && w > avail) {
        w = Math.floor(avail)
        input.style.width = w + "px"
      }
    }
    // ── 高（原有逻辑） ──
    const INPUT_BORDER = 4
    const cellH = this.activeCell ? this.activeCell.offsetHeight : box.h
    input.style.height = "0px"
    const contentH = input.scrollHeight
    const maxH = this.tableBodyHeight > 0 ? this.tableBodyHeight / 2 : Infinity
    input.style.height = Math.max(cellH, Math.min(contentH, maxH) + INPUT_BORDER) + "px"
  }

  /**
   * 量编辑框当前值的**最长一行**像素宽（含 textarea 自身的 padding + border）。
   *
   * 测量器是挂在 `.ce-table-body-container` 里的隐藏 inline-block（`white-space:pre`），
   * 与 textarea 同父 ⇒ 字体 / 字号继承链完全一致。各浏览器 UA 给 textarea 的默认
   * padding / border 不同，这里现读 computed style 补上，不写死数值。
   * 多行内容取最长行：宽度只由"放不下那一行"决定，与高度（总行数）各管一边。
   */
  #measureInputTextWidth(text: string): number {
    let d = this.#inputWidthDetector
    if (!d || !d.isConnected) {
      d = document.createElement("div")
      d.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;white-space:pre;display:inline-block;"
      ;(this.bodyCon || this.renderRoot!).appendChild(d)
      this.#inputWidthDetector = d
    }
    const cs = getComputedStyle(this.inputCell)
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
    const border = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0)
    let longest = ""
    for (const line of text.split("\n")) {
      if (line.length > longest.length) longest = line
    }
    d.textContent = longest
    return d.offsetWidth + pad + border
  }
  /**
   * 单元格写回的唯一出口。
   *
   * 文本编辑（`closeInput`）与外部选值弹层（`CellPickSession.setValue`）都调这里，
   * 锁定、公式、`setCells` 命令与 `celldeactivate`/`cellchange`/`change` 三条事件
   * 因此只有一份实现。绕过它直接 `updateCellView` 的写回拿不到这四项副作用。
   *
   * @param pos   目标单元格坐标；`colIndex` 是列、`rowIndex` 是行，不可互换
   * @param value 新值，按列类型原样入库（日期可存 Date 或格式化字符串）；显示侧由
   *              `updateCellView` / 表格渲染按 `pattern` 格式化
   * @returns `'done'` 已写回；`'cancelled'` 被 `beforecelldeactivate` 的 `cancel()`
   *          拦下且不写回（调用方只需收起编辑态）；`'invalid'` 校验失败（公式自引用），
   *          调用方应保持编辑态
   */
  commitCellValue(pos: CellPos, value: CellValue, changeType: ChangeType = ChangeType.Input): 'done' | 'cancelled' | 'invalid' {
    const ri = pos.rowIndex
    const ci = pos.colIndex
    const colProp = pos.prop
    const column = this.getRenderColumns()[ci]
    const old = get(this.innerData[ri], colProp)
    const rowData = cloneDeep(this.innerData[ri])

    let lockCell = false
    let cancelled = false
    this.emit('beforecelldeactivate', {
      row: rowData, column, rowIndex: ri, colIndex: ci, cell: pos, value, prevValue: old,
      lock: () => {
        lockCell = true
      },
      cancel: () => {
        cancelled = true
      }
    })
    if (cancelled) return 'cancelled'
    if (lockCell) {
      this.lockCells(this._getColumnChar(ci) + (ri + 1))
    }

    const changed = old !== value
    if (changed) {
      const cellChar = this._getColumnChar(ci) + (ri + 1)
      if (isString(value) && value[0] === FormulaTag && value.match(/=/img)?.length === 1) {
        // 自引用：公式结果会再写回本格，形成无限递归
        const checker = new RegExp(`([^a-z]|^)${cellChar}([^0-9]|$)`, 'i')
        if (checker.test(value)) {
          const box = getBox(this.#el_selector, this.bodyCon)
          this.#el_warning_msg.style.transform = `translate3d(${box.x}px, ${box.y + box.h}px,0)`
          this.#el_warning_msg.style.display = "block"
          this.#el_warning_msg.descr = '不能引用自身'
          return 'invalid'
        }
        this.formulaMap.set(cellChar, value)
        this._pushFxQueue(value, ri, colProp, true)
      } else {
        this.formulaMap.delete(cellChar)
      }

      this.doCommand(Command.setCells, {
        cells: [{ cell: pos, oldValue: old, newValue: value }],
      })

      this._updateSummary()
    }

    this.emit('celldeactivate', { row: rowData, column, rowIndex: ri, colIndex: ci, cell: pos, value, prevValue: old })
    if (changed) {
      this.emit('cellchange', { row: rowData, column, rowIndex: ri, colIndex: ci, cell: pos, value, prevValue: old })
      this.emit('change', { type: changeType, cells: [{ row: rowData, column, rowIndex: ri, colIndex: ci, cell: pos, value, prevValue: old }] })
    }
    return 'done'
  }
  closeInput(cancelText?: boolean) {
    if (!this.activeCell || !this.bodyCon.contains(this.activeCell)) return;

    //校验选择内容
    let col = this.getColumnMeta(this.activeCell);
    let colProp = this.activeCell.getAttribute('column')
    let input = this.inputCell
    // 不做 escapeHtml：编辑值按原样入库（textContent 渲染无 XSS 面，cellTmpl 列
    // 在 activeInput 已被拦截且 isHtml 分支由模板重新生成内容）。转义会污染模型，
    // 让 `{a.map(x => x.y)}` 之类的表达式变成 `{a.map(x =&gt; x.y)}` 而失效。
    let text = input.value;
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
    } else if (colProp) {
      const ri = this.getRowIndex(this.activeCell);
      const ci = this.getColIndex(this.activeCell);
      const result = this.commitCellValue({ colIndex: ci, rowIndex: ri, prop: colProp }, text);
      // `invalid`（公式自引用）保持编辑态，让用户改掉；`cancelled` 与 `done` 都走收尾
      if (result === "invalid") {
        input.select();
        input.focus();
        return false;
      }
    }

    this.#el_warning_msg.style.display = "none";

    this.activeCell?.classList.remove("active-input");
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

      let cells: CellChange[] = [];
      let changedCells: CellChangePayload[] = []
      each(range(startRowIndex, endRowIndex + 1), (rIndex, i: number) => {
        let rowData = rows[i % contentRowCount].split("\t")
        each(range(startColIndex, endColIndex + 1), (cIndex, j: number) => {
          let cellValue = rowData[j % contentColCount]
          let colMeta = this.getRenderColumns()[cIndex]
          let colProp = colMeta.prop
          let cellPos = { colIndex: cIndex, rowIndex: rIndex, prop: colProp! }
          let oldValue = this.innerData[rIndex][colProp!]
          // ⚠️ 必须与 Delete / Fill 输出**同款富对象**：消费方（如报表设计器）靠
          // `cell.prop` / `row.id` / `value` 定位单元格，只给裸 `CellPos`
          // （`{colIndex,rowIndex,prop}`，没有 `cell` 包裹也没有值）会被整段跳过 ——
          // 现象是"库明明 emit 了 change，外部却零回写"。
          changedCells.push({
            cell: cellPos,
            row: this.innerData[rIndex],
            column: colMeta,
            rowIndex: rIndex,
            colIndex: cIndex,
            value: cellValue,
            prevValue: oldValue,
          })

          cells.push({
            cell: cellPos,
            oldValue,
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
    let fillingMap = new WeakMap<CellPos, [CellValue, CellValue]>();
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
        let steps: FillStep[] = []//{num,tmpl,step,base}
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
            let base = parseFloat(String(steps[last<number>(toArray(set))].num)) - parseFloat(String(steps[first<number>(toArray(set))].num))
            let accDiff = 0;
            const seqArr = map(set, i => steps[i].num)
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
            let nNum = parseFloat(String(step.num)) + parseFloat(String(step.step)) + (parseFloat(String(base)))

            if (step.tmpl) {
              // tmpl 只由「字符串化后不含数字位」的值生成：数字里只有 Infinity 一类病态值满足，
              // 旧实现在这里同样直接调 .replace（会抛），按 string 断言以保持逐字同行为
              newValue = (step.tmpl as string).replace(FILL_TAG, String(nNum))
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
    let changedCells: CellChangePayload[] = []
    this.doCommand(Command.setCells, {
      startCell: this.#startCell,
      endCell: this.#endCell,
      focusCell: this.focusCell,
      cells: map(allCells, (cell) => {
        let [oldValue, newValue] = fillingMap.get(cell)!;

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
    let rows = new Set<number>();
    each(this.checkedCells, cellPos => {
      rows.add(cellPos.rowIndex)
    })
    //2. 计算selected行列
    each(this.__selectedCells, cellPos => {
      rows.add(cellPos.rowIndex)
    })
    //3. 删除行
    //仅删除渲染列字段为空的行
    let cols = filter(this.getRenderColumns(), c => c.prop)
    let i = 0
    let dels: typeof this.data = []
    sort(rows, (a: number, b: number) => b - a).forEach((r: number) => {
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

  /**
   * 选区重绘后同步 caret 位置。
   *
   * `__renderSelector` 是点击、拖选、键盘与清空四条路径的共同出口，在这里补一次
   * 比在每个调用点各接一次可靠。
   */
  __renderSelector() {
    super.__renderSelector()
    this.#syncCaret()
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
    // 0-based；双射 26 进制（Excel 口径），统一实现见 myfx alphaLabel
    return alphaLabel(cIndex)
  }
  _getColumnCode(cChar: string) {
    return alphaIndex(cChar)
  }
  _getColumnProp(char: string) {
    let cIndex = this._getColumnCode(char)
    return this.getRenderColumns()[cIndex]?.prop
  }
  _getCellDom(rowIndex: string | number, colIndex: string | number) {
    let colName = this.getRenderColumns()[colIndex as number].prop;
    return this.bodyCon.querySelector(
      `div[data-row-index="${rowIndex}"] div[column="${colName}"]`
    ) as HTMLElement;
  }

  /**
   * 计算单元格相对 `bodyCon` 左上角的内容坐标，供外部浮层（如循环可视化浮标）定位。
   *
   * 坐标与库内编辑框 / 选区浮层同基准（`getBox(cell, bodyCon)`），因此浮层节点作为
   * `bodyCon` 的绝对定位子节点时，`style.left = x / style.top = y` 即可对齐。
   *
   * @param rowIndex 行在视图中的索引（0-based，对应 DOM `data-row-index`）
   * @param colProp  列 prop
   * @returns `{x,y,w,h}` 相对 `bodyCon` 左上角（**内容坐标系**，与滚动位置无关）；
   *          `visible` 表示该行当前是否已渲染。虚拟滚动下不可视行没有 DOM，
   *          按行高推算 `y` 并标 `visible:false` —— 此时**拿不到列几何，`x`/`w` 恒为 0**，
   *          调用方需要列宽时应另取一个已渲染行测量（列几何全表一致）。
   */
  getCellContentRect(
    rowIndex: number,
    colProp: string
  ): { x: number; y: number; w: number; h: number; visible: boolean } {
    const cell = this.bodyCon?.querySelector(
      `div[data-row-index="${rowIndex}"] div[column="${colProp}"]`
    ) as HTMLElement | null;
    if (cell) {
      const box = getBox(cell, this.bodyCon);
      return { x: box.x, y: box.y, w: box.w, h: box.h, visible: true };
    }
    // 虚拟滚动下不可视行无 DOM：按行高推算**内容坐标**。
    // ⚠️ 这里**不能**再减 `scroller.y`。`bodyCon` 自身就在滚动子树里
    //    （真正的滚动盒是 `ce-scroller` 的 `.ce-scroller-content-wrapper`），
    //    它与单元格 rect 同步位移，所以 `getBox(cell, bodyCon)` 得到的是**内容坐标**
    //    （滚动不变）。此前减了一次滚动偏移，导致同一方法对可视行返回内容坐标、
    //    对不可视行返回视口坐标 —— 两套坐标混用。
    //    实测（220 行报表，scrollTop=960）：可视行 row=37 → y=1332（= 37*36，内容坐标）；
    //    不可视行 row=0 → y=-960（= 0*36 - 960，视口坐标），同一坐标系下差 960。
    const y = this.vRowHeight * rowIndex;
    return { x: 0, y, w: 0, h: this.vRowHeight, visible: false };
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
    if (!get(this.editOption, 'fillable', true)) return

    // ⚠️ 命中区**不能**按入参 `el`（= `e.target`）来算：选区右下角格在样式里带
    // `pointer-events: none`（只把 `.ce-table-cell-content` 和 `::after` 放行），
    // 所以鼠标压在它身上时 `e.target` 是 `.ce-table-column-scroll` **容器** ——
    // 拿容器去算"右下角 4px 命中区"会落到表格外面，鼠标永远碰不到 ⇒ 填充柄虽然
    // 画出来了却拖不动。改为直接取**当前选区右下角格本体**量测（与 Excel 一致：
    // 只有按下该格右下角那一小块才进入填充拖拽，其余位置一律照常框选）。
    // `_getCellDom` 没有越界守卫（`getRenderColumns()[-1].prop` 会抛），
    // 而两个索引在无选区时都是 -1 ⇒ 必须先挡掉。
    if (this.rightSelectedCellColIndex < 0 || this.bottomSelectedCellRowIndex < 0) return
    let rbCell = this._getCellDom(this.bottomSelectedCellRowIndex, this.rightSelectedCellColIndex)
    if (!rbCell) return

    let cellBox = rbCell.getBoundingClientRect()
    // ⚠️ 按下点必须落在**角格本体范围内**：只查 `>=`（角格右下角原点）的话，
    // 选区右下方整片区域的格子（点 E10 时 min 是 D9 的右下角）都满足条件，
    // 会被误判进填充拖拽 —— 框选被吞、选区原地不动（实测：S1 fillMode=true）。
    // 加上矩形上界后，只有按在角格上（且在右下角命中块内）才进入填充。
    if (
      e.clientX < cellBox.x ||
      e.clientX > cellBox.x + cellBox.width ||
      e.clientY < cellBox.y ||
      e.clientY > cellBox.y + cellBox.height
    ) {
      return
    }
    let { width, height } = window.getComputedStyle(rbCell, '::after')
    let minX = Math.floor(cellBox.x) + Math.floor(cellBox.width) - parseFloat(width)
    let minY = Math.floor(cellBox.y) + Math.floor(cellBox.height) - parseFloat(height)
    if (e.clientX >= minX && e.clientY >= minY) {
      return this.getFillerDragHandles(e)
    }
  }
  onClickBody(e: MouseEvent) {
    super.onClickBody(e, true)
  }
}
