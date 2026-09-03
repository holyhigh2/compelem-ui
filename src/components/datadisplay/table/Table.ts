import { classes, CompElem, computed, css, csscope, Csscope, CssHelper, debounced, emits, forEach, h, html, ifElse, ifTrue, onced, prop, query, QueryCache, state, tag, Template, watch } from "compelem";
import { camelCase, clone, cloneDeep, closest, debounce, each, eachRight, filter, find, findIndex, flatDeep, flatMap, formatDate, formatNumber, fval, get, groupBy, isArray, isBlank, isDefined, isEmpty, isNil, isNumeric, isObject, isString, isUndefined, kebabCase, keys, last, map, padStart, randi, range, set, size, some, sortTree, startsWith, take, takeRight, test, upperCase, walkTree } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { DataType, EMPTY_TAG_LABEL_COLOR, RandomColors, SortType } from "../../../constants";
import { FieldContainer, FieldContainerEvents } from "../../../mixins/FieldContainer";
import { CLASS_EXPAND, TreeStructured } from "../../../mixins/TreeStructured";
import { Virtualized } from "../../../mixins/Virtualized";
import { ColorHelper } from "../../../utils/color";
import { attr, isVisible, makeStoppable } from "../../../utils/utils";
import { Checkbox } from "../../form/checkbox/Checkbox";
import { ContextMenu } from "../../nav/contextmenu/ContextMenu";
import { Overlay } from "../../overlays/overlay/Overlay";
import { Edge, Scroller } from "../scroller/Scroller";
import { Column } from "./Column";
import { ColumnConfigPane } from "./ColumnConfigPane";
import { ColumnFoot } from "./ColumnFoot";
import { tableStyleSheet } from "./styleSheets";
import { TableBar } from "./TableBar";
import { NOTE_ATTR, TableExtensionCellNote } from "./TableExtensionCellNote";
import { TableExtensionConfig } from "./TableExtensionConfig";
import { TableExtensionFillColor } from "./TableExtensionFillColor";
import { TableExtensionFx } from "./TableExtensionFx";
import { TableExtensionOperation } from "./TableExtensionOperation";
import { TableExtensionSpan } from "./TableExtensionSpan";
import { TableExtensionStats } from "./TableExtensionStats";
import { ColumnProp, ColumnType, ConfigType, RowHeightType, StyleType, TableEvents } from "./types";
export const EDGE_COL = 'edge-column'
const GROUP_STATS = 'group-stats'

export const SCROLLER_COL_PROP = '__scroller'
export const PRIV_COL_PREF = '__'
export const MAX_SORT_COUNT = 3
export const MAX_GROUP_COUNT = 3
export const BASE_CHAR_CODE = 65;

export type TreeProps = { childrenKey: string, defaultExpandAll: boolean }


export const AVAILABLE_ROW_TAG = 'available'
/**
 * 虚拟表格
 * 特性
 * 1. 通过slot实现table列无需单独解析及计算，大幅提升首屏渲染速度及更新速度
 * 2. 固定列及表头位置无需在滚动时进行实时计算，节省大量算力
 * 3. 通过动态全局样式控制行高，无需对每个dom进行逐个计算
 * 4. 虚拟算法，滚动时计算量大幅降低
 * 
 * 表头样式控制 —— 通过对 ce-column 元素应用样式进行控制
 * 表尾样式控制 —— 通过对 ce-column-foot 元素应用样式进行控制
 * 
 * 单元格公式
 *  使用=号开头后接计算表达式，行号从1开始，列字符从A开始，如
 *  `=a1+b2`
 *  支持内置函数 SUM/AVG/MAX/MIN
 *  `SUM(A1:F10)` / `AVG(A1,B2,C4,D5)`
 *  数据范围支持冒号/逗号
 * 
 * @props
 *  data {Array<Record<string, any>>} 数据
 *  extStatsFunctions {Record<string, string>} 自定义统计函数描述，格式 {函数标识:统计项描述}
 *  hoverShowColor {string} 悬停高亮色，默认 #fff
 *  highlightColor {string} 悬停高亮色，默认 #f5f5f5
 *  highlight {boolean} 悬浮高亮行}
 *  striped {boolean} 是否开启条纹背景，默认false
 *  stripeColor {string} 条纹色
 *  columnLine {boolean} 是否开启垂直线，默认true
 *  borderColor {string} 内边框色，默认 #ebebeb
 *  rowHeight {number} 行高，默认为字体大小*2
 *  headerHeight {number} 表头行高，默认40
 *  footerHeight {number} 表尾行高，默认32
 *  fit {boolean} 开启后，当总列宽小于table视口宽度时，自动均分未设置宽度的列
 *  fixedStyle {string|object} 固定列样式
 *  showHeader {boolean} 是否显示表头，默认true
 *  showFooter {boolean} 是否显示表尾，默认false
 *  loading {boolean} 是否显示加载中，默认false
 *  rowKey {string} 行唯一标识。默认 id
 *  childrenKey {string} 用于获取子节点的key。默认 children
 *  defaultExpandAll {boolean} 默认展开全部节点。默认 true
 *  tree {boolean} 是否开启树形表格，默认false
 *  indent {string|number} 树节点缩进距离，值为数字时单位像素。默认 1em
 *  singleSort {boolean} 是否单一排序，默认true
 *  highlightCurrentRow {boolean} 是否高亮当前行
 *  enableFx {boolean} 是否启用公式，默认false
 *  clickView {boolean} 是否启用点击查看隐藏信息，默认 true
 * @methods
 *  setData(data: Array<Record<string, any>>) 设置数据
 *  getData() 获取数据
 *  refreshView() 刷新当前视图数据
 *  relayout() 刷新高度/滚动条等
 *  setNote(rowIndex: number, prop: string, message: string) 设置单元格注释
 *  removeNote(rowIndex: number, prop: string) 移除单元格注释
 *  removeNoteAll() 移除所有单元格注释
 *  setStats(fn(colProp,colData,data)=>html string) 设置统计计算器，设置后所有可统计列都会使用该计算器进行计算
 *  updateColumnCells(prop: string, values: any[] | Record<string, any>) 更新指定列单元格值，仅更新视图
 *  updateCell(prop: string, rowIndex: number, value: string | number) 更新指定单元格值，仅更新视图
 *  setCellStyle(style: string | Record<string, any>, rowIndex: number, colProp: string) 设置单元格样式
 *  setColumnStyle(style: string | Record<string, any>, colProp: string | string[]) 设置列样式
 *  setRowStyle(style: string | Record<string, any>, rowIndex: number | number[]) 设置行样式
 *  clearStyle(type?: number) 清除样式 type: 1 行，2 列，3 单元格。为空时全部清除
 *  getStats() 获取统计行的列/值映射
 *  hideColumns(colProps: string | string[]) 设置隐藏列
 *  moveColumnTo(colProp: string, toProp: string) 移动列到指定列之后
 *  fixColumns(leftCount: number, rightCount?: number) 固定列，leftCount为左侧固定列数，rightCount为右侧固定列数
 *  getConfig() 获取当前表格配置，包括排序、分组、字段控制、筛选、冻结、行高
 *  setConfig(config: Record<string, any>) 可使用getConfig()导出的配置信息设置表格配置
 *  setGroup(columns: Array<{ prop: string, condition?: string }>) 设置分组
 *  clearGroup() 清除分组
 *  getRowSelection() 获取选中记录数组
 *  toggleRowSelection(rowKeyValue: string | number | Array<string | number>, checked?: boolean) 选中/取消行 
 *  toggleRowSelectionAll(checkedAll?: boolean) 选中/取消 所有行
 *  setCurrentRow(rowKey?:string) 设置当前选中行，如果rowKey为空则取消选中行 
 *  getColumnIndex(prop: string) 获取列索引号
 *  getColumnCharByIndex(index: number) 通过列索引号获取索引字母
 *  getColumnPropByChar(char: string) 通过列索引字母获取列属性名
 * @events
 *  ready() 表格内部DOM构建完成并填充数据后触发
 *  firstfilled() 内容首次填充完成后触发
 *  cellclick({ row, prop, rowIndex, colIndex}) 点击单元格触发
 *  celldblclick({ row, prop, rowIndex, colIndex}) 双击单元格触发
 *  rowclick({ row, rowIndex}) 点击行时触发
 *  rowdblclick({ row, rowIndex}) 双击行时触发
 *  beforedostats({fns,setter}) 弹出统计面板前事件，可通过setter定义统计项显示列表，格式与fns相同 —— {name,value} name:统计项描述, value:内置函数名或自定义函数标识
 *  doextstats({data,setter(v)}) 执行自定义统计项时触发，可通过setter设置统计结果
 *  afterdostats({setLabelValue(prop: string, label: string, value: any), setValue(prop: string, value: any)}) 完成统计后，显示结果前触发。可通过setLabelValue/setValue 修改显示结果
 *  span({columns, data, setSpan(spanObj)}) 每当data变更时触发。setSpan设置页面合并信息。spanObj 格式为 {prop:{rowIndex,colSpan,rowSpan}}
 *  expandchange({row,expanded}) 行展开状态变更时触发，row为当前行数据，expanded为当前行展开状态
 *  selectionchange({selection}) 复选状态变更时出发，参数为rowKey对应的唯一数组
 *  scrolledge() 页面滚动到底部/顶部时触发
 *  scrollend() 页面停止滚动时触发
 *  sortchange({orders,cancel}) 排序状态变更时触发，orders为当前排序状态组。如果需要实现自定义排序可调用cancel函数取消自动排序
 *  fixedchange({left,right}) 列固定变更后触发。left/right分别为冻结的列prop
 *  filterchange({filters,cancel}) 过滤状态变更时触发，filters为当前过滤条件组。如果需要实现自定义过滤可调用cancel函数取消自动过滤
 *  columnhide({columns}) 列隐藏状态变更时触发
 *  groupchange({grouped}) 分组状态变更时触发，grouped为分组顺序列表。*目前仅支持单列分组
 *  configchange({type}) 当sort/fixed/filter/hide/group/align操作变更时触发该事件
 *  currentchange({newKey,oldKey}) 开启高亮行后，当前行变更时触发
 *  alignchange({prop,align}) 列对齐方式变更时触发
 *  rowhtypechange({type}) 行高类型变更时触发
 *  sort({sort,sortOrders}) 排序时触发，如果调用sort函数可实现自定义排序
 *  detailclick({ row, rowIndex}) 点击展开按钮时触发
 *  cellslot({target,slotData}) 当插槽元素首次/重新渲染时触发，slotData是在元素上注册的回调参数，@see Column组件
 *  setfilterlist({ type, prop, list, setter }) 当列类型为Tag/User时，每次打开筛选列表时触发。可自定义筛选项
 * @slots
 *  - 默认插槽，支持 ce-column
 * @extends
 *  onMouseDown
 *  onClickBody
 *  onDblClickBody
 *  onColumnResize
 *  onScroll
 *  onScrollEnd
 *  onResize
 *  onColumnChange
 *  onColumnMove
 *  onColumnVisibleChange
 *  onCellNumber
 *  onOutside
 *  onSelectorChange
 * @author holyhigh2
 */
@emits(TableEvents.Span, TableEvents.ScrollEdge, TableEvents.ScrollEnd, TableEvents.RowDblClick, TableEvents.CellDblClick, TableEvents.CellClick, TableEvents.RowClick,
  TableEvents.CurrentChange, TableEvents.ColumnChange, TableEvents.FirstFilled, TableEvents.CellSlot, TableEvents.CurrentChange, TableEvents.FilterChange, TableEvents.FixedChange,
  FieldContainerEvents.Ready, TableEvents.SelectionChange, TableEvents.RowHeightChange, TableEvents.Hide,

  TableEvents.BeforeDoStats, TableEvents.DoExtStats, TableEvents.AfterDoStats,
  TableEvents.ConfigChange, TableEvents.AlignChange,
  'contextmenuselect', 'contextmenu', TableEvents.Detailclick, TableEvents.CellsChange,
  TableEvents.SortChange, TableEvents.GroupChange, TableEvents.SetFilterList)
@tag('ce-table')
export class Table extends TableExtensionFillColor(TableExtensionFx(TableExtensionSpan(TableExtensionConfig(TableExtensionStats(TableExtensionCellNote(TableExtensionOperation(FieldContainer(TreeStructured(Virtualized(AppearanceElem)))))))))) {
  minWidth = 80
  //单元格垂直边框
  @prop columnLine = true;
  @prop extStatsFunctions: Record<string, string> = {}
  @prop({ type: Number, model: true }) rowHeight = 0;
  @prop headerHeight = 40;
  @prop footerHeight = 32;
  @prop showHeader = true;
  @prop showFooter = false;
  @prop scrollerWidth = 10;
  @prop striped = false
  @prop stripeColor = 'rgb(249 250 251)'
  @prop highlight = true;
  @prop enableFx = false;
  @prop highlightColor = '#f5f5f5'
  @prop highlightCurrentRow = false
  @prop hoverShowColor = '#fff'
  @prop borderColor = '#ebebeb'
  @prop({ type: Boolean }) loading = false;
  @prop fit = false;
  @prop singleSort = true
  @prop scrollerSize = 10
  @prop({ type: [String, Object] }) fixedStyle: string | Record<string, any> = ''
  @prop({
    type: Array, shallow: true, hasChanged(this: Table, newValue: Array<Record<string, any>>, oldValue: Array<Record<string, any>>, subChain, nv, ov) {
      //非compelem环境触发
      if (!isArray(newValue)) return true
      if (size(subChain) > 1 && nv !== ov) return true

      let newSize = size(newValue)
      let hasChanged = false
      if (newSize !== this._lastDataSize) hasChanged = true
      if (newValue != oldValue) {
        hasChanged = true
      }

      this._lastDataSize = size(newValue)

      if (this.rowKey && hasChanged) {
        this.__traceMap.clear()
        newValue.forEach((v, i) => {
          let k = v[this.rowKey]
          this.__traceMap.set(k, i)
        })
      }

      return hasChanged
    }
  }) data: Array<Record<string, any>> = [];
  @prop clickView = true

  @prop rowKey = "id";
  @prop childrenKey = "children";
  @prop defaultExpandAll = true;
  @prop tree = false;
  @prop({ type: [String, Number] }) indent: string | number = '1em'
  @prop extended = true

  @state({ prop: 'rowHeight' }) vRowHeight = 0
  @state({ prop: 'data', shallow: true }) innerData: Array<Record<string, any>> = []

  //左侧固定列宽度
  @state paddingLeft = 0;
  @state paddingRight = 0;

  //通过setAlign设置的列对齐方式
  @state columnAlign: Record<string, string | null> = {};
  @state columnLinkStyle: Record<string, Record<string, string>> = {};
  @state vScrollWidth: number = 0
  @state vScrollHeight: number = 0

  //虚拟化
  @state vCachedRows = 0;

  //tree
  @state({ prop: 'rowKey' }) nodeKey = this.rowKey
  @state expandedIdMap: Record<string, boolean> = {}
  @state treeData: Record<string, any>[] = []
  @state filterTreeData: typeof this.treeData | undefined = undefined
  @state refreshRenderSeed = 0

  //分组
  @state groupOrders: Array<{ prop: string, condition?: string, name?: string }> = [] //分组状态
  @state({ shallow: true }) groupedData: Record<string, any>[] | undefined = undefined
  @state grouping = false

  //分组后的tree列
  @state groupRootColProp = ''
  groupedRootIds: string[] = []

  //由列组件修改
  @state headerRows = 1;
  //数据展示列
  @state({ shallow: true }) fixedLeftColumns: Record<string, any>[] = []
  @state({ shallow: true }) fixedRightColumns: Record<string, any>[] = []
  @state({ shallow: true }) scrollColumns: Record<string, any>[] = []
  @state invisibleFields: string[] = [];
  @state lastScrollColumnProp = ''

  @state scrolledV = false;
  @state scrolledEndV = false;
  cellStyle: Record<string, string> = {}
  cellKeyStyle: Record<string, string> = {}
  @state colStyle: Record<string, string> = {}
  @state rowStyle: Record<string, string> = {}
  @state rowKeyStyle: Record<string, string> = {}

  @state({ shallow: true }) filterData: typeof this.data | undefined = undefined
  @state sortOrders: Array<{ prop: string, sort: string }> = [] //排序状态
  @state headerRowHeight = this.headerHeight * this.headerRows
  @state currentRowIndex = -1
  @state startSelectedCellCss = ''

  @state msgDescr = ''

  declare _fieldMap: Map<string, Column>

  @query('.ce-table-head', QueryCache.ONCE)
  tableHead!: HTMLElement;
  @query('.ce-table-head .ce-table-column-scroll')
  tableHeadScroll!: HTMLElement;
  @query('.ce-table-body', QueryCache.ONCE)
  tableBody!: HTMLElement;
  @query('main .ce-table-body-container', QueryCache.ONCE)
  bodyCon!: HTMLElement;
  @query('.ce-table-head .ce-table-column-fixed.is-left')
  fixedLeftConHead!: HTMLElement;
  @query('.ce-table-head .ce-table-column-fixed.is-right')
  fixedRightConHead!: HTMLElement;
  @query('.ce-table-foot .ce-table-column-fixed.is-left')
  fixedLeftConFoot!: HTMLElement;
  @query('.ce-table-foot .ce-table-column-fixed.is-right')
  fixedRightConFoot!: HTMLElement;

  @query('#msgoverlay')
  msgOverlay!: Overlay
  @query('ce-scroller', QueryCache.ONCE)
  scroller!: Scroller;
  @query('.ce-table-foot', QueryCache.ONCE)
  tableFoot!: HTMLElement;
  @query('ce-column[prop="__sn"]')
  snColumn!: Column;
  @query('ce-context-menu')
  contextMenu!: ContextMenu;
  @query('[name="loading"]')
  loadingOverlay!: Overlay

  //虚拟化
  @query('#vpillar')
  declare vPillar: HTMLElement

  __selectedList: Set<string> = new Set() //被选中的rowKey
  _calcFn!: (colProp: string, colData: Array<string | number>, data: Record<string, any>[]) => string | Template;
  __styler!: (scope: Record<string, any>) => string | Record<string, any>;
  __scrollerCol!: Column
  __fontSize = 0

  __dataInited = false


  TableConfigPane!: ColumnConfigPane;


  //用于追踪数据index
  __traceMap = new Map<string, number>()

  @csscope(Csscope.INNER)
  static get css() {
    return [tableStyleSheet];
  }
  get cssVars() {
    return {
      tableHeight: isUndefined(this.height) ? undefined as any : isNumeric(this.height) ? this.height + 'px' : this.height,
      tableRowHeight: `${this.vRowHeight}px`,
      tableBodyHeight: `${this.tableBody?.offsetHeight ?? 0}px`,
      tableHeaderRowHeight: `${this.headerRowHeight}px`,
      tableFooterHeight: `${this.footerHeight}px`,
      tableHeaderRowWidth: this.vScrollWidth ? this.vScrollWidth + 'px' : '100%',
      tableColumnScrollPaddingLeft: `translateX(${this.paddingLeft}px)`,
      tableBodyContainerPadding: `${this.scrollerSize}px`,
      tableLastScrollColumnProp: this.lastScrollColumnProp,
      tableBodyContainerWrapperPaddingRight: `${this.paddingRight}px`,
      tableColumnBorderRight: this.columnLine ? 'thin solid var(--table-color-border)' : 'initial'
    }

  }

  _columnMetaMap = new Map<string, Record<string, any>>()
  _columnFootMap = new Map<string, ColumnFoot>()

  ////////////////////////////// tree相关
  treeCol!: Record<string, any>;

  /////////////////////////////////// computed
  @computed
  get treeProps() {
    return !isEmpty(this.slots.header) || !!this.header
  }
  // __renderData: Record<string, any>[]
  @computed
  get renderList() {
    //刷新种子
    let x = this.refreshRenderSeed;
    if (this.tree || this.grouping) {
      let data = this.filterTreeData ?? this.groupedData ?? this.innerData

      if (this.sortOrders && this.sortOrders.length > 0) {
        data = clone<Record<string, any>[]>(data)
        this.sortOrders.forEach(s => {
          let dt = this._fieldMap.get(s.prop)?.dataType
          let isDateTime = dt === DataType.Date || dt === DataType.DateTime
          let isNumber = dt === DataType.Number
          sortTree(data, (a, b) => {
            let va = a[s.prop]
            let vb = b[s.prop]

            if (isDateTime) {
              va = Date.parse(va) || 0
              vb = Date.parse(vb) || 0
            } else if (isNumber) {
              va = +va || 0
              vb = +vb || 0
            }
            if (va === vb) return 0;
            if (isNil(va)) return -1;
            if (isNil(vb)) return 1;
            if (s.sort === SortType.Asc) {
              return va < vb ? -1 : 1
            } else {
              return va > vb ? -1 : 1
            }
          })
        })
      }

      data = data.length < 1 ? data : this.flattenTreeData(data)
      return data
    }
    let data = this.filterData || this.innerData
    if (this.sortOrders && this.sortOrders.length > 0) {
      data = this._sortFields(data)
    }
    //分组
    if (size(this.groupOrders) > 0) {
      //针对每个分组创建组根节点
      const firstColProp = filter(this.allColumns, c => !startsWith(c.prop, PRIV_COL_PREF))[0].prop

      let groupedData: typeof this.innerData = this.__groupList(this.innerData, clone(this.groupOrders), firstColProp)

      this.groupRootColProp = firstColProp
      this.groupedData = groupedData
      this.grouping = true
      data = data.length < 1 ? groupedData : this.flattenTreeData(groupedData)
    }

    this.nextTick(() => {
      this.renderRoot?.classList.toggle('__empty', isEmpty(data))
    })

    if (this._isReady) {
      let spanObj: Record<string, any> | null = null
      this.emit(TableEvents.Span, {
        columns: this.allColumns, data, setSpan: (obj: Record<string, any>) => {
          spanObj = obj
        }
      })
      this.__spanObj = spanObj
      this.__spanCells(spanObj)
      this.__clearSelector()
    }

    return data
  }
  /////////////////////////////////// watches
  @watch('indent', { immediate: true })
  watchIndent(nv: string | number) {
    if (isNumeric(nv)) {
      nv = nv + 'px'
    }
    this.style.setProperty('--table-tree-indent', nv)
  }
  @watch(['rowHeight', 'vRowHeight'])
  watchRowHeight(v: number) {
    this.nextTick(() => {
      this.resetVirtualList()
    })
  }
  @watch('treeData')
  watchTreeData(v: any) {
    this.nextTick(() => {
      this.resetVirtualList()
    })
  }
  _lastDataSize = 0
  @watch('data')
  watchData(v: any) {
    this.__dataInited = true
    this.innerData = v
  }
  @watch('innerData')
  watchInnerdata(v: any) {
    this.nextTick(() => {
      this.resetVirtualList()
    })

    if (this.tree || this.grouping) {
      if (this.defaultExpandAll) {
        this.expandToLevel(9999)
      }
    }

    if (this.onDataChange) this.onDataChange(this._lastDataSize !== size(v))

    this._lastDataSize = size(v)
  }
  @watch('headerHeight', { immediate: true })
  watchHeaderH(v: number) {
    setTimeout(() => {
      if (!this.getAllValidCols().some(c => c.parentComponent instanceof Column))
        this.getAllValidCols().forEach(c => c.headerHeight = this.headerHeight + '')
    }, 100);

    if (this.tableHead)
      this.headerRowHeight = this.tableHead.clientHeight
  }
  @watch('showIndicator')
  watchWhowIndicator(v: number) {
    this.nextTick(() => {
      this.headerRowHeight = this.tableHead.clientHeight
    })
  }
  @watch('paddingLeft')
  watchPadding(v: number) {
    this._updateScrollWidth()
  }
  @watch("stripeColor", { immediate: true })
  __watchColor(nv: any, ov: any) {
    ColorHelper.setColor(nv, this.style, '--table-color-stripe')
  }
  @watch("highlightColor", { immediate: true })
  __watchHoverColor(nv: any, ov: any) {
    ColorHelper.setColor(nv, this.style, '--table-color-highlight', false)
  }
  @watch("borderColor", { immediate: true })
  __watchBorderColor(nv: any, ov: any,) {
    ColorHelper.setColor(nv, this.style, '--table-color-border')
  }
  @watch("hoverShowColor", { immediate: true })
  __watchHoverShowColor(nv: any, ov: any) {
    ColorHelper.setColor(nv, this.style, '--table-color-hover-show')
  }
  @watch('invisibleFields', { deep: true })
  __watchInvisibleFields(nv: string[]) {
    this.getAllValidCols().forEach(c => {
      if (nv.includes(c.prop)) {
        c.style.display = 'none'
      } else {
        c.style.display = ''
      }
    })
    this.nextTick(() => {
      this._updateColumnResize()
    })
    this.onColumnVisibleChange && this.onColumnVisibleChange()
  }
  @state _isReady = false
  @state _firstFilled = false
  @watch(['fixedRightColumns', 'fixedLeftColumns', 'scrollColumns'])
  __watchSlotColumnMove(nv: Array<any>, ov: Array<any>, propName: string) {
    //todo 检测列中是否有slot变化
    if (!this._isReady) return

    let nvStr = map(nv, c => c.prop).join()
    let ovStr = map(ov, c => c.prop).join()
    if (nvStr === ovStr) return

    let cellSlotCols = filter(nv, c => c.hasCellSlot)
    if (isEmpty(cellSlotCols)) return

    if (propName === 'scrollColumns') {
      this.#updateLastColProp()
    }
    this.nextTick(() => {
      this.vList.forEach((row, i) => {
        //初始化模板组件
        cellSlotCols.forEach(c => {
          let colEl = this._fieldMap.get(c.prop)
          let cellTmpls = colEl?.slots.cell!
          if (isEmpty(cellTmpls)) return

          let content = row.querySelector('.ce-table-cell[column="' + c.prop + '"] .ce-table-cell-content')!
          if (!content) return
          content.textContent = ''

          let existNames = map(content.querySelectorAll('[slot="cell"]'), n => n.tagName)

          let fragment = document.createDocumentFragment()
          let added = false
          each(cellTmpls!, (el: Element) => {
            if (existNames.includes(el.tagName)) return
            added = true
            let copy = el.cloneNode(true)
            fragment.appendChild(copy)
          })

          if (added) {
            content.appendChild(fragment)
          }
        })
      })
    })
  }
  ///////////////////////////////////////////////// update css
  @watch(['colStyle', 'rowStyle', 'rowKeyStyle'], { deep: true })
  updateRowStyle() {
    this.__updatableStyleRow?.replaceSync(this.getRowStyle(this.colStyle, this.rowStyle, this.rowKeyStyle))
  }
  @watch(['invisibleFields'])
  updateInvisibleFields() {
    this.__updatableStyleInvisible?.replaceSync(this.getInvisibleStyle(this.invisibleFields))
  }
  @watch(['lastScrollColumnProp'])
  updateLastScrollColumnProp() {
    this.__updatableStyleScrollColumn?.replaceSync(`
        ::slotted(ce-column[prop="${this.lastScrollColumnProp}"]),
        .ce-table-foot ::slotted(ce-column-foot[prop="${this.lastScrollColumnProp}"]),
        .v-wrapper .ce-table-column-scroll .ce-table-cell[column="${this.lastScrollColumnProp}"]{
          border-right: 0 !important;
        }
      `)
  }
  @watch(['currentRowIndex', 'highlightCurrentRow', 'startSelectedCellCss'])
  updateSelected() {
    this.__updatableStyleSelected?.replaceSync(
      `.ce-table-body-container .ce-table-row[data-row-index="${this.currentRowIndex}"] .ce-table-column-scroll .ce-table-cell,
        .ce-table-body-container .ce-table-row[data-row-index="${this.currentRowIndex}"] .ce-table-column-fixed .ce-table-cell{
          ${this.highlightCurrentRow ? 'background-color: var(--table-color-highlight) !important;' : ''}
        }
        ${this.startSelectedCellCss}
      `
    )
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super()
    this._updateColumnStyleD = debounce(this._updateColumnStyle.bind(this), 50)
  }

  render(): Template {
    return h`
    <div role="table" class="ce-table" ${classes({
      "is-highlight": this.highlight,
      "is-show-footer": this.showFooter,
      "is-show-header": this.showHeader,
      "is-show-column-line": this.columnLine,
      "is-fixed-right": this.fixedRightColumns.length > 0,
      "is-fixed-left": this.fixedLeftColumns.length > 0,
      "is-first-filled": this._firstFilled,
      "is-ready": this._isReady
    })} tabindex="0" @contextmenu="${this.onContextMenu}" @resize.debounce:50="${this.onResize}" @outside.mousedown="${this.onOutside}" >
      <header part="header" role="rowgroup" @resize.once="${this.onHeaderFirstResize}" class="ce-table-head" ${classes({
      "ce-table-shadow": this.scrolledV
    })} @mousedown="${this.onMouseDownHeader}" @click="${this.onClickTableHead}">
        <div role="row" class="ce-table-row">
          <div class="ce-table-column-fixed is-left"  part="fixed-column">
            <slot name="--fixed-left"></slot>
          </div>
          <div class="ce-table-column-scroll">
            <slot></slot>
          </div>
          <div class="ce-table-column-fixed is-right"  part="fixed-column">
            <slot name="--fixed-right"></slot>
          </div>
        </div>
      </header>
      <main role="rowgroup" class="ce-table-body" ${classes({
      "is-striped": this.striped,
      "is-grouping": this.grouping
    })}>
        <ce-scroller style="height:100%" size="${this.scrollerSize}" @scrollchange="${this.onScrollChange}" @scroll="${this.onScroll}" @scrollend="${this.onScrollEnd}" wheel-step="80" .s-width="${this.vScrollWidth}">
          <div class="ce-table-body-container" ${classes({
      ['row-height-type-' + this.__rowHeightType]: true
    })} @scroll="${this.fixScrollLeft}}" virtualized @click="${this.onClickBody}" @dblclick="${this.onDblClickBody}" @mousedown="${this.onMouseDown}" @mutate.child.debounce:100="${this.onListReady}" @mouseenter.capture="${this.onMouseEnterNoteContainer}" @mouseleave.capture="${this.onMouseLeaveNoteContainer}">
            <div id="vpillar"></div>
            ${forEach(range(this.vCachedRows), (row, i) => i, (row, i) => h`
            <div class="ce-table-v-wrapper" data-row-index="${i}">
              <div role="row" class="ce-table-row" data-row-index="${i}" data-row-sn="${i + 1}">
                <div class="ce-table-column-fixed is-left"  part="fixed-column">
                  ${forEach(this.fixedLeftColumns, c => c.prop, (c, ci) => h`
                    <div role="cell" class="ce-table-cell" ${classes({ "is-expandable": c.indexButton, "ce-table-tree-cell": (c.tree && this.tree) || (this.grouping && this.groupRootColProp === c.prop) })} column="${c.prop}">
                      ${ifTrue((c.tree && this.tree) || (this.grouping && this.groupRootColProp === c.prop), () => h`<span class="ce-table-caret"><ce-icon style="visibility: hidden;" svg="c-svg-chevron-right" size="md"></ce-icon></span>`)}
                      <div class="ce-table-cell-content" style="${c.type === ColumnType.Selection || c.type === ColumnType.Index ? 'overflow:visible;display:flex;justify-content: center;align-items:center;' : ''}">
                        ${ifTrue(c.type === ColumnType.Selection, () => h`
                          ${ifElse(c.hoverSelection, () => h`
                            <span name="selectlabel"></span><ce-checkbox name="selectbox" style="display:none;"></ce-checkbox>
                          `, () => h`
                            <ce-checkbox name="selectbox"></ce-checkbox>
                          `)}
                        `)}
                        <span name="text"></span>
                        ${ifTrue(c.type === ColumnType.Index, () => h`<span name="selectlabel"></span>`)}
                        ${ifTrue(c.indexButton && (c.type === ColumnType.Selection || c.type === ColumnType.Index), () => h`<ce-icon title="展开详情" class="ce-table-expand" size="md" ?icon="${isString(c.indexButton) ? c.indexButton : ''}" svg="${isString(c.indexButton) ? c.indexButton : 'c-svg-expand-diagonal'}"></ce-icon>`)}
                        
                        ${ifTrue(c.dataType === DataType.Tag || this.groupRootColProp == c.prop, () => h`<div name="tags"></div>`)}
                        ${ifTrue(c.dataType === DataType.User || this.groupRootColProp == c.prop, () => h`<div name="users"></div>`)}
                        ${ifTrue(c.dataType === DataType.Image || this.groupRootColProp == c.prop, () => h`<div name="imgs"></div>`)}
                      </div>
                    </div>
                  `)}
                </div>
                <div class="ce-table-column-scroll">
                  ${forEach(this.scrollColumns, c => c.prop, (c, ci) => h`
                    <div role="cell" class="ce-table-cell" ${classes({ "is-expandable": c.indexButton, "ce-table-tree-cell": (c.tree && this.tree) || (this.grouping && this.groupRootColProp === c.prop) })} column="${c.prop}">
                      ${ifTrue((c.tree && this.tree) || (this.grouping && this.groupRootColProp === c.prop), () => h`<span class="ce-table-caret"><ce-icon style="visibility: hidden;" svg="c-svg-chevron-right" size="md"></ce-icon></span>`)}
                      <div class="ce-table-cell-content" style="${c.type === ColumnType.Selection || c.type === ColumnType.Index ? 'overflow:visible;display:flex;justify-content: center;align-items:center;' : ''}">
                        ${ifTrue(c.type === ColumnType.Selection, () => h`
                            ${ifElse(c.hoverSelection, () => h`
                              <span name="selectlabel"></span><ce-checkbox name="selectbox" style="display:none;"></ce-checkbox>
                            `, () => h`
                              <ce-checkbox name="selectbox"></ce-checkbox>
                            `)}
                          `)}
                        <span name="text"></span>
                        ${ifTrue(c.type === ColumnType.Index, () => h`<span name="selectlabel"></span>`)}
                        ${ifTrue(c.indexButton && (c.type === ColumnType.Selection || c.type === ColumnType.Index), () => h`<ce-icon title="展开详情" class="ce-table-expand" size="md" ?icon="${isString(c.indexButton) ? c.indexButton : ''}" svg="${isString(c.indexButton) ? c.indexButton : 'c-svg-expand-diagonal'}"></ce-icon>`)}
                        
                        ${ifTrue(c.dataType === DataType.Tag || this.groupRootColProp == c.prop, () => h`<div name="tags"></div>`)}
                        ${ifTrue(c.dataType === DataType.User || this.groupRootColProp == c.prop, () => h`<div name="users"></div>`)}
                        ${ifTrue(c.dataType === DataType.Image || this.groupRootColProp == c.prop, () => h`<div name="imgs"></div>`)}
                      </div>
                    </div>
                  `)}
                </div>
                <div class="ce-table-column-fixed is-right" part="fixed-column">
                  ${forEach(this.fixedRightColumns, c => c.prop, (c, ci) => h`
                    <div role="cell" class="ce-table-cell" column="${c.prop}">
                      <div class="ce-table-cell-content" >
                        <span name="text"></span>
                        
                        ${ifTrue(c.dataType === DataType.Tag || this.groupRootColProp == c.prop, () => h`<div name="tags"></div>`)}
                        ${ifTrue(c.dataType === DataType.User || this.groupRootColProp == c.prop, () => h`<div name="users"></div>`)}
                        ${ifTrue(c.dataType === DataType.Image || this.groupRootColProp == c.prop, () => h`<div name="imgs"></div>`)}
                      </div>
                    </div>
                  `)}
                </div>
              </div>
            </div>
            `)}
          </div>
          <ce-overlay contained id="msgoverlay" placement="bottom-end" close-on-click>
            <ce-message shadowed style="pointer-events: none;width: 300px;z-index: 1;" type="warning" .descr="${this.msgDescr}" html></ce-message>
          </ce-overlay>
        </ce-scroller>
        <ce-empty class="is-empty" title="暂无数据"></ce-empty>
      </main>
      <footer part="footer" role="rowgroup" class="ce-table-foot" ${classes({
      "ce-table-shadow": !this.scrolledEndV
    })} @click="${this.onClickTableFoot}">
        <div role="row" class="ce-table-row">
          <div class="ce-table-column-fixed is-left" part="fixed-column">
            <slot name="--foot-fixed-left"></slot>
          </div>
          <div class="ce-table-column-scroll">
            <slot name="--foot"></slot>
          </div>
          <div class="ce-table-column-fixed is-right" part="fixed-column">
            <slot name="--foot-fixed-right"></slot>
          </div>
        </div>
      </footer>
      <ce-overlay contained backdrop opacity="0.25" .visible="${this.loading}" name="loading">
        <ce-progress-circular r="36" .indeterminate="${this.loading}" color="#fff" style="font-size: var(--ce-font-sm);">
        加载中...
        </ce-progress-circular>
      </ce-overlay>
      <ce-context-menu @select="${this.onContextMenuSelect}" theme="light" items="[]"></ce-context-menu>
      ${''}
    </div>
    `;
  }
  shouldUpdate(changed: Record<string, any>): boolean {
    if (changed.fixedLeftColumns && !changed.fixedLeftColumns.end) {
      if (last(changed.fixedLeftColumns.chain) === 'width') return false
    }
    if (changed.vCachedRows && size(this.scrollColumns) < 1) {
      return false
    }
    return true
  }
  updated(changed: Record<string, any>): void {
    if (changed.innerData && changed.innerData.value && this.vAllRows !== changed.innerData.value.length) {
      this.watchData(changed.innerData.value)
      return
    }

    if (this.#updateView && this.vList) {
      this.#updateView = false
      setTimeout(() => {
        // this.scroller.calcBounding()
        (this.scroller as any).calcBounding_$__()

        //1. 滚动到指定位置
        this.scrollV(this.scroller.y, (rowEl, rowIndex) => {
          if (rowIndex < 0 || rowIndex >= this.renderList.length) return;
          rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')
          rowEl.firstElementChild?.setAttribute('data-row-sn', rowIndex + 1 + '')

          //填充行数据
          this._fillRow(rowEl as any, rowIndex)
        })
        //2. 刷新数据，不更新位置
        this.__fillCells()
        //3. scrolledV更新
        if (this.renderList.length <= this.vViewRows) {
          this.scrolledV = this.scrolledEndV = false
        } else {
          this.scrolledV = this.scroller.y > 0;
          this.scrolledEndV = this.scroller.y < this.scroller.totalLen
        }

        //4. 更新汇总
        if (this.showFooter)
          this.TableConfigPane.onStat(this)
      }, 0)
    }
  }
  __updatableStyleColumn!: CSSStyleSheet | null;
  __updatableStyleRow!: CSSStyleSheet | null;
  __updatableStyleInvisible!: CSSStyleSheet | null;
  __updatableStyleScrollColumn!: CSSStyleSheet | null;
  __updatableStyleSelected!: CSSStyleSheet | null;
  __updatableFullView!: CSSStyleSheet | null;
  __updatableFillColor!: CSSStyleSheet | null;
  beforeMount(): void {
    //不更新
    this.insertStyleSheet(css`
      .ce-table-body .ce-table-column-fixed,
      .ce-table-head .ce-table-column-fixed{
        ${CssHelper.getCssText(this.fixedStyle)}
      }
    `)
    this.insertStyleSheet(this.getColumnLinkStyle(this.columnLinkStyle))
    //更新
    this.__updatableStyleRow = this.insertStyleSheet(css`${this.getRowStyle(this.colStyle, this.rowStyle, this.rowKeyStyle)}`)
    this.__updatableStyleInvisible = this.insertStyleSheet(css`${this.getInvisibleStyle(this.invisibleFields)}`)
    this.__updatableStyleScrollColumn = this.insertStyleSheet(
      css`
        ::slotted(ce-column[prop="${this.lastScrollColumnProp}"]),
        .ce-table-foot ::slotted(ce-column-foot[prop="${this.lastScrollColumnProp}"]),
        .v-wrapper .ce-table-column-scroll .ce-table-cell[column="${this.lastScrollColumnProp}"]{
          border-right: 0 !important;
        }
      `
    )
    this.__updatableStyleSelected = this.insertStyleSheet(
      css`.ce-table-body-container .ce-table-row[data-row-index="${this.currentRowIndex}"] .ce-table-column-scroll .ce-table-cell,
        .ce-table-body-container .ce-table-row[data-row-index="${this.currentRowIndex}"] .ce-table-column-fixed .ce-table-cell{
          ${this.highlightCurrentRow ? 'background-color: var(--table-color-highlight) !important;' : ''}
        }
        ${this.startSelectedCellCss}
      `
    )
    this.__updatableStyleSpan = this.insertStyleSheet(css`${this.__getSpanCellStyle()}`)
    this.__updatableFullView = this.insertStyleSheet(css`${this.getFullViewStyle('', -1)}`)
    this.__updatableFillColor = this.insertStyleSheet(css`${this.__getFillColorStyle()}`)

    //scroller track
    const scrollerCol = this.__scrollerCol = new Column({ prop: '__scroller', resizable: false, fixed: "right", width: this.scrollerWidth, minWidth: this.scrollerWidth, lastColumn: true })
    this.appendChild(scrollerCol)
  }
  onHeaderFirstResize() {
    this.updateV(size(this.renderList), this.tableBody.offsetHeight, false, true)
  }
  mounted(): void {
    let fontSize = parseFloat(window.getComputedStyle(this).fontSize)
    this.__fontSize = fontSize
    this._setRowHeightType(RowHeightType.Compact)

    this.onkeydown = this.onGlobalKeydown.bind(this)
    if (!this.TableConfigPane) {
      this.TableConfigPane = new ColumnConfigPane()
      document.body.appendChild(this.TableConfigPane)
    }
  }
  @debounced(100)
  slotChange(slot: HTMLSlotElement, name: string): void {
    if (!name) {
      this._appendColumn()
    }
  }
  //////////////////////////////////// hooks
  onResize() {
    if (!isVisible(this)) return
    if (!this.vList) return
    if (!this._isReady) return

    if (this.fit) {
      this._fitWidth()
    }

    let oh = this.tableBody.offsetHeight
    if (Math.abs(oh - this.__lastHeight) > 5) {
      this.resetVirtualList()
    }

    this.__lastHeight = oh

    setTimeout(() => {
      this._updateScrollWidth()
    }, 400);
  }
  onOutside(obj: Record<string, any>) {
  }
  __lastYTo = -1
  __lastXTo = -1
  _scrolled = false
  onScroll(obj: Record<string, any>) {
    let { to, direction, edge, preventDefault, el, event } = obj
    this._scrolled = false

    switch (edge) {
      case Edge.Bottom: case Edge.Top: case Edge.Left: case Edge.Right:
        this.emit(TableEvents.ScrollEdge, { edge })
    }

    if (direction === 'h') {
      if (to === this.__lastXTo) {
        return;
      }

      this._scrolled = true
      this.__lastXTo = to

      //preventDefault()
      this.bodyCon.scrollLeft = 0
      this.tableHead.scrollLeft = to

      let corrected = this.tableHead.scrollLeft >> 0

      this.tableFoot.scrollLeft = corrected

      this.__vRowScrollElList && this.__vRowScrollElList.forEach(rowEl => {
        rowEl.style!.transform = `translateX(${this.paddingLeft - corrected}px)`
      })

    } else {
      if (to === this.__lastYTo) return;
      if (el) {
        let contentEl = el.closest('.ce-table-cell-content')
        if (contentEl && contentEl.scrollHeight !== contentEl.offsetHeight) {
          if (contentEl.closest('.ce-table-selected-cell')) {
            preventDefault()
            return
          }
          // preventDefault()
          // return
        }
      }

      if (event) event.preventDefault()

      if (to > 0) {
        this.scrolledV = true;
      } else {
        this.scrolledV = false;
      }

      this.scrolledEndV = edge === Edge.Bottom

      this._scrolled = true
      this.__lastYTo = to;
      this.scrollV(to, (rowEl, rowIndex) => {
        if (rowIndex < 0 || rowIndex >= this.renderList.length) return;
        rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')
        rowEl.firstElementChild?.setAttribute('data-row-sn', rowIndex + 1 + '')

        //填充行数据
        this._fillRow(rowEl as any, rowIndex)
      })
    }
  }
  onScrollEnd(obj: Record<string, any>) {
    this.emit(TableEvents.ScrollEnd)
  }
  onScrollChange(obj: Record<string, any>) {
    let { maxX, maxY } = obj

    if (maxY > this.scroller.offsetHeight) {
      this.scrolledEndV = false
    }
  }
  __vRowScrollElList!: HTMLElement[];
  onListReady() {
    if (!this.isMounted) return;

    (this.scroller as any).calcBounding_$__()

    let vList = Array.from<HTMLElement>(this.bodyCon.querySelectorAll('.ce-table-v-wrapper'))
    if (this.vList && this.vCachedRows != this.vList.length && this.vCachedRows != vList.length) {
      vList = Array.from<HTMLElement>(this.bodyCon.querySelectorAll('.ce-table-v-wrapper[' + AVAILABLE_ROW_TAG + ']'))
    }
    let corrected = this.tableHead.scrollLeft >> 0
    this.__vRowScrollElList = map(vList, el => {
      let sel = el.querySelector('.ce-table-column-scroll')
      sel.style!.transform = `translateX(${this.paddingLeft - corrected}px)`
      return sel
    })

    if (!this._isReady) {
      this._isReady = true
      this.__onReady()
    }

    this.initV(vList, this.scroller.y, (row, rowIndex) => {
      let rowChild = row.firstElementChild as HTMLElement

      //初始化模板组件
      this.allColumns.forEach(c => {
        if (c.type === ColumnType.Index || c.type === ColumnType.Selection) return
        if (c.dataType === DataType.Tag) return
        if (c.dataType === DataType.User) return
        if (c.dataType === DataType.Image) return
        let colEl = this._fieldMap.get(c.prop)
        let cellTmpls = colEl?.slots.cell!
        if (!isEmpty(cellTmpls)) {
          let content = row.querySelector('.ce-table-cell[column="' + c.prop + '"] .ce-table-cell-content')
          if (!content) return

          content.innerHTML = ''

          let existNames = map(content.querySelectorAll('[slot="cell"]'), n => n.tagName)

          let fragment = document.createDocumentFragment()
          let added = false
          each(cellTmpls!, (el: Element) => {
            if (existNames.includes(el.tagName)) return
            added = true
            let copy = el.cloneNode(true)
            fragment.appendChild(copy)
          })

          if (added) {
            content.appendChild(fragment)
          }
        }
      })

      rowChild.dataset.rowIndex = rowIndex + ''
      rowChild.dataset.rowSn = rowIndex + 1 + ''
    })

    this.nextTick(() => {
      this.vPillar.style.height = this.vScrollHeight + 'px'
      this.scroller.reposition()
    })

    this.headerRowHeight = this.tableHead.clientHeight

    if (this.showFooter)
      this.TableConfigPane.onStat(this)

    this.#updateLastColProp()
  }
  //------------------ 可继承接口
  onMouseDownHeader(e: MouseEvent) {
  }
  onMouseDown(e: MouseEvent) {
    this.onStartSelect(e)
  }
  onDblClickBody(e: Event) {
    let t = e.target as Element;
    let rowIndex = -1;
    let tr = closest(t, (node) => node.classList && node.classList.contains("ce-table-row"), "parentNode");
    if (tr) {
      rowIndex = parseInt(tr.dataset.rowIndex!);
      let row = cloneDeep(this.renderList[rowIndex])
      this.emit(TableEvents.RowDblClick, { row, rowIndex }, e)
    }
    let td = closest<HTMLElement>(
      t,
      (node) => {
        const el = node as HTMLElement
        return attr(el, 'role') == "cell" && el.classList.contains("ce-table-cell")
      },
      "parentNode"
    );
    if (td) {
      let rowIndex = this.getRowIndex(td as any);
      let colIndex = this.getColIndex(td as any);
      let prop = td.getAttribute('column')
      let row = cloneDeep(this.renderList[rowIndex])

      this.emit(TableEvents.CellDblClick, { row, prop, rowIndex, colIndex }, e)
    }
  }
  onClickBody(e: Event) {
    let t = e.target as Element;
    let cancelBubble = false
    makeStoppable(e, () => {
      cancelBubble = true
    })
    let rowIndex = -1;
    let row
    let tr = closest(t, (node) => node && node.classList && node.classList.contains("ce-table-row"), "parentNode");
    if (tr) {
      rowIndex = parseInt(tr.dataset.rowIndex!);
      row = cloneDeep(this.renderList[rowIndex])
      this.emit(TableEvents.RowClick, { row, rowIndex }, e)
    }

    if (t.closest('.ce-table-expand')) {
      this.emit(TableEvents.Detailclick, { row, rowIndex }, e)
      if (cancelBubble) return
    }
    let caret
    if ((caret = t.closest('.ce-table-caret'))) {
      this.toggleExpand(caret)
      return
    }
    let td = closest<HTMLElement>(
      t,
      (node) => {
        const el = node as HTMLElement
        return attr(el, 'role') == "cell" && el.classList.contains("ce-table-cell")
      },
      "parentNode"
    );

    if (td) {
      let isGroupRow = tr?.parentElement.classList.contains('group-stats')
      rowIndex = this.getRowIndex(td as any);
      let colIndex = this.getColIndex(td as any);
      let prop = td.getAttribute('column')
      let row = cloneDeep(this.renderList[rowIndex])

      let cancelBubble = false
      makeStoppable(e, () => {
        cancelBubble = true
      })
      if (prop === ColumnProp.Selection && t instanceof Checkbox) {
        let checked = !(t as Checkbox).isChecked()
        const rowData = this.renderList[rowIndex];
        let rowId = rowData ? String(rowData[this.rowKey]) : null
        let contentEl = t.closest('.ce-table-cell-content')
        if (checked) {
          this.__selectedList.add(rowId!)
          contentEl?.toggleAttribute('checked', true)
        } else {
          this.__selectedList.delete(rowId!)
          contentEl?.toggleAttribute('checked', false)
        }
        let col = this._fieldMap.get(ColumnProp.Selection)
        let cba = col?.renderRoot?.querySelector('ce-checkbox') as Checkbox
        // cba?.toggleAttribute('checked', this.__selectedList.size === this.renderList.length)
        cba.updateProps({ checked: this.__selectedList.size === this.renderList.length }, true)
        // cba.toggleCheck(this.__selectedList.size === this.renderList.length)
        // cba.__checked = this.__selectedList.size === this.renderList.length

        this.__onSelectionChange(Array.from(this.__selectedList), e)
      }

      if (!isGroupRow)
        this.emit(TableEvents.CellClick, { row, prop, rowIndex, colIndex }, e)

      if (!isGroupRow && !cancelBubble) {
        let lastRowIndex = this.currentRowIndex
        this.currentRowIndex = rowIndex
        if (this.currentRowIndex !== lastRowIndex) {
          this.emit(TableEvents.CurrentChange, { newKey: this.renderList[rowIndex][this.rowKey], oldKey: this.renderList[lastRowIndex] ? this.renderList[lastRowIndex][this.rowKey] : '' })
        }
      }

      if (this.clickView) {
        let contentEl = td.querySelector('.ce-table-cell-content')!
        let afterContent = window.getComputedStyle(contentEl, ':after').content
        if (test(afterContent, '#@#')) {
          return
        }
        if (contentEl && contentEl.clientWidth !== contentEl.scrollWidth) {
          this.__updatableFullView?.replaceSync(this.getFullViewStyle(prop!, rowIndex))
        } else {
          this.__updatableFullView?.replaceSync(this.getFullViewStyle('', -1))
        }
      }
    }
  }
  //////////////////////////////////// css
  getColumnWidthCss() {
    let colStyles = ''
    this.allColumns.forEach(c => {
      let co = this._fieldMap.get(c.prop)
      if (co) {
        // min-width:var(--column-min-width-${kebabCase(c.prop.replaceAll('.', '-'))});
        colStyles+= `
        .ce-table-cell[column="${c.prop}"]{
          width:var(--column-width-${kebabCase(c.prop.replaceAll('.', '-'))});
        }
        .ce-table-cell[column="${c.prop}"] .ce-table-cell-content{
          text-align: var(--column-align-${kebabCase(c.prop.replaceAll('.', '-'))});
          [name="tags"]{
            justify-content: var(--column-align-justify-${kebabCase(c.prop.replaceAll('.', '-'))});
          }
        }
        `
      }
    })

    return colStyles
  }
  getColumnLinkStyle(columnLinkStyle: typeof this.columnLinkStyle) {
    let colLinkStyles = ''
    each(columnLinkStyle, (v, k) => {
      colLinkStyles+= `.ce-table-cell[column="${k}"]{
        color: blue;
        color:${v.color};
      }
      `
    })

    return css`${colLinkStyles}`
  }
  getRowStyle(colStyle: typeof this.colStyle, rowStyle: typeof this.rowStyle, rowKeyStyle: typeof this.rowKeyStyle) {
    let styles = ''
    each(colStyle, (style, prop) => {
      styles+= `.ce-table-row .ce-table-cell[column="${prop}"] {
          ${style}
        }
      `
    })
    each(rowStyle, (style, rowIndex) => {
      styles+= `.ce-table-row[data-row-index="${rowIndex}"] .ce-table-cell{
            ${style}
          }
        `
    })
    each(rowKeyStyle, (style, rowKey) => {
      styles+= `.v-wrapper[data-row-key="${rowKey}"] .ce-table-row .ce-table-cell{
            ${style}
          }
        `
    })
    return styles
  }
  getFullViewStyle(prop: string, rowIndex: number) {
    let styles= `
    .ce-table-body-container .ce-table-v-wrapper[data-row-index="${rowIndex}"]{
      z-index: 9;
    }
    .ce-table-body-container .ce-table-v-wrapper[data-row-index="${rowIndex}"] .ce-table-cell[column="${prop}"]{
      overflow: visible;
      border-left:0 !important;
      border-top:0 !important;
      user-select:auto;
    }
    .ce-table-body-container .ce-table-v-wrapper[data-row-index="${rowIndex}"] .ce-table-cell[column="${prop}"] .ce-table-cell-content{
      overflow: auto;
      height: initial;
      line-height: normal;
      position: absolute;
      word-break: break-all;
      white-space: normal;
      background: #fff;
      padding: var(--ce-spacing-sm);
      border: 2px solid var(--ce-color-primary) !important;
      z-index: 9;
      background-color: #fff;
      max-height: calc(var(--table-body-height) / 2);
      user-select:auto;
      &:after{
        content:'#@#';
        position:absolute;
        width:0;
        height:0;
        left:-9999px;
        overflow:hidden;
      }
    }
    `
    return styles
  }
  getInvisibleStyle(invisibleFields: typeof this.invisibleFields) {
    let invisibleColStyles = ''
    each(invisibleFields, (k) => {
      invisibleColStyles+= `
        .v-wrapper .ce-table-cell[column="${k}"],
        .ce-table-foot ::slotted(ce-column-foot[prop="${k}"]){
          display:none !important;
        }
      `
    })
    return invisibleColStyles
  }
  //////////////////////////////////// methods
  @debounced(50)
  _updateScrollWidth() {
    if (!this._isReady) return

    this.paddingLeft = this.fixedLeftConHead.clientWidth + this.fixedLeftConHead.offsetLeft
    this.paddingRight = this.fixedRightConHead.clientWidth
    this.vScrollWidth = Math.floor(this.tableHeadScroll.offsetWidth) + this.paddingLeft + this.paddingRight - (this.fixedLeftConHead.clientWidth > 0 || this.fixedRightConHead.clientWidth > 0 ? 1 : 0)

    // let tx = window.getComputedStyle(this.tableHeadScroll).transform.split(',')[4]
    this.__vRowScrollElList && this.__vRowScrollElList.forEach(rowEl => {
      rowEl.style!.transform = `translateX(${this.paddingLeft - this.tableHead.scrollLeft}px)`
    })
  }
  #updateView = false
  __lastHeight = 0
  @debounced(50)
  resetVirtualList() {
    let oh = this.tableBody.offsetHeight
    let newVCachedRows = this.updateV(size(this.renderList), oh, this._isReady ? true : false, true)

    //填充行数据
    this.#updateView = true

    if (this.vList) {
      if (newVCachedRows < this.vCachedRows) {
        let validSize = size(this.bodyCon.querySelectorAll('.ce-table-v-wrapper[available]'))
        let vcr = validSize - newVCachedRows
        if (vcr > 0) {
          while (vcr--) {
            this.vList[vcr].removeAttribute('available')
          }
        } else {
          let invalidList = this.bodyCon.querySelectorAll('.ce-table-v-wrapper:not([available])')
          while (vcr++) {
            invalidList[-vcr].toggleAttribute('available', true)
          }
        }

        this.vList = Array.from<HTMLElement>(this.bodyCon.querySelectorAll('.ce-table-v-wrapper[available]'))
      }
      if (newVCachedRows <= this.vList.length) {
        this.onListReady()
      }
    }

  }

  #fxLCols: Record<string, any>[] = []
  #fxRCols: Record<string, any>[] = []
  #scrollCols: Record<string, any>[] = []
  allColumns: Record<string, any>[] = []

  #lastEdgeLeftColProp = ''
  #lastEdgeScrollColProp = ''

  getAllValidCols(...filterProps: string[]) {
    let cols = filter<Column>(this.children, (el => el instanceof Column))
    let allSortedcols: Column[] = []
    // let maxLevel = 1
    walkTree(cols, (node, p, c, level) => {
      if (node instanceof Column && !some(node.children, c => c instanceof Column)) {
        allSortedcols.push(node)
        // if (level > maxLevel) maxLevel = level
      }
    })
    return allSortedcols.filter(col => !(col as any).isDestroyed && (filterProps ? !filterProps.includes(col.prop) : true))
  }

  @onced()
  __initDefaultHiddenList(defaultHiddenList: string[]) {
    this._hiddenFieldList = defaultHiddenList
  }

  @debounced(100)
  __setDataColumns(cancelEmit = false) {
    this.#fxLCols = []
    this.#fxRCols = []
    this.#scrollCols = []

    let allColsExceptScroll = filter(this.getAllValidCols(), c => c.prop !== SCROLLER_COL_PROP)
    if (allColsExceptScroll.length != size(this._columnMetaMap) - 1) {
      this._appendColumn()
      return
    }
    let prevColProp = ''
    allColsExceptScroll.forEach(col => {
      let colMeta = this._columnMetaMap.get(col.prop)!
      if (!colMeta) return

      if (col.getFixed() === 'right') {
        this.#fxRCols.push(colMeta)
      } else if (!col.getFixed()) {
        this.#scrollCols.push(colMeta)
      } else {
        this.#fxLCols.push(colMeta)
      }

      //footer
      let el = this._columnFootMap.get(col.prop)
      if (this.showFooter && el) {
        if (!some(this.children, c => c instanceof ColumnFoot && c.prop === col.prop)) {
          this.appendChild(el!)
        }
        if (prevColProp && prevColProp !== (el?.previousElementSibling as any).prop) {
          let prevFootEl = find(this.children, (el => el instanceof ColumnFoot && el.prop == prevColProp))
          if (prevFootEl) el?.parentNode?.insertBefore(el, prevFootEl.nextSibling)
        }
      }
      prevColProp = col.prop
    })
    this.#fxRCols.push(this._columnMetaMap.get(SCROLLER_COL_PROP)!)
    if (this.showFooter && !some(this.children, c => c instanceof ColumnFoot && c.prop === SCROLLER_COL_PROP))
      this.appendChild(this._columnFootMap.get(SCROLLER_COL_PROP)!)

    if (this.tableHead.clientHeight > this.headerRowHeight)
      this.headerRowHeight = this.tableHead.clientHeight

    this.fixedLeftColumns = this.#fxLCols
    this.scrollColumns = this.#scrollCols
    this.fixedRightColumns = this.#fxRCols

    //clear edge tag
    if (this.showFooter) {
      this._columnFootMap.get(this.#lastEdgeLeftColProp)?.toggleAttribute(EDGE_COL, false)
      this._columnFootMap.get(this.#lastEdgeScrollColProp)?.toggleAttribute(EDGE_COL, false)
    }
    this._fieldMap.get(this.#lastEdgeLeftColProp)?.toggleAttribute(EDGE_COL, false)
    this._fieldMap.get(this.#lastEdgeScrollColProp)?.toggleAttribute(EDGE_COL, false)

    let defaultHiddenList: string[] = []
    this.fixedLeftColumns.forEach((c, i) => {
      c.colIndex = i
      this._fieldMap.get(c.prop)?.setAttribute('slot', '--fixed-left')
      this.showFooter && this._columnFootMap.get(c.prop)?.setAttribute('slot', '--foot-fixed-left')
      if (c.hidden) {
        defaultHiddenList.push(c.prop)
      }
    })
    let leftIndex = this.fixedLeftColumns.length
    this.scrollColumns.forEach((c, i) => {
      c.colIndex = i + leftIndex
      let col = this._fieldMap.get(c.prop)
      col?.removeAttribute('slot')
      col?.removeAttribute('fixed')
      if (col) {
        col.setFixed(false)
      }
      this.showFooter && this._columnFootMap.get(c.prop)?.setAttribute('slot', '--foot')
      if (c.hidden) {
        defaultHiddenList.push(c.prop)
      }
    })
    leftIndex += this.scrollColumns.length
    this.fixedRightColumns.forEach((c, i) => {
      c.colIndex = i + leftIndex
      this._fieldMap.get(c.prop)?.setAttribute('slot', '--fixed-right')
      this.showFooter && this._columnFootMap.get(c.prop)?.setAttribute('slot', '--foot-fixed-right')
      if (c.hidden) {
        defaultHiddenList.push(c.prop)
      }
    })

    if (this.#fxLCols.length > 0) {
      this.#lastEdgeLeftColProp = last(this.#fxLCols).prop
      this.showFooter && this._columnFootMap.get(this.#lastEdgeLeftColProp)?.toggleAttribute(EDGE_COL, true)
      this._fieldMap.get(this.#lastEdgeLeftColProp)?.toggleAttribute(EDGE_COL, true)
    }

    if (this.#scrollCols.length > 0) {
      this.#lastEdgeScrollColProp = last(this.#scrollCols).prop
      this.showFooter && this._columnFootMap.get(this.#lastEdgeScrollColProp)?.toggleAttribute(EDGE_COL, true)
      this._fieldMap.get(this.#lastEdgeScrollColProp)?.toggleAttribute(EDGE_COL, true)
    }
    this.__initDefaultHiddenList(defaultHiddenList)
    this.allColumns = [...this.#fxLCols, ...this.#scrollCols, ...this.#fxRCols]
    //default hide
    this.hideColumns(this._hiddenFieldList, cancelEmit)
    //fit
    if (this.fit) {
      this._fitWidth_$__()
    }

    //css
    if (this.__updatableStyleColumnWidth) {
      this.__updatableStyleColumnWidth.replaceSync(this.getColumnWidthCss())
    } else {
      this.__updatableStyleColumnWidth = this.insertStyleSheet(css`${this.getColumnWidthCss()}`)
    }

    //cell width
    let cls: typeof this.columnLinkStyle = {}
    this.allColumns.forEach(c => {
      let co = this._fieldMap.get(c.prop)
      if (co) {
        if (co.link) {
          cls[c.prop] = { color: get(co, 'linkOptions.defaultColor') }
        }
      }
    })
    this.columnLinkStyle = cls

    this.onColumnChange && this.onColumnChange()

    this.emit(TableEvents.ColumnChange)
    //update tableBar
    this.__tableBar?._onTableColumnChange()

    this.#updateLastColProp()

    if (this._firstFilled) {
      this.refreshView()
    }

  }
  @debounced(100)
  _fitWidth() {
    let allW = 0
    let nonWidthCount: Record<string, any>[] = []
    this.getAllValidCols().forEach(c => {
      if (c.childNodes && c.childNodes[0] instanceof Column) return
      if (!isVisible(c)) return

      if (isDefined(c.width) || isDefined(c.draggedWidth)) {
        allW += c.renderWidth ?? 0
        return
      }

      nonWidthCount.push(c)
    })

    let snW = this.snColumn?.offsetWidth ?? 0
    let avgW = (this.offsetWidth - allW - snW) / nonWidthCount.length >> 0

    nonWidthCount.forEach(c => {
      let w = avgW < c.minWidth ? c.minWidth : avgW
      c.renderWidth = w
      let col = this.allColumns.find(col => col.prop === c.prop)
      if (!col) return

      col.width = w
    })
  }
  //仅由列调用
  _updateColumnStyle(col?: Column) {

    this.paddingLeft = this.fixedLeftConHead.clientWidth + this.fixedLeftConHead.offsetLeft
    this.paddingRight = this.fixedRightConHead.clientWidth
    // })
  }
  @debounced(100)
  _updateColumnResize(col?: Column) {
    if (col && col.children && col.children[0] instanceof Column) {
      col = last(col.children)
    }
    if (col) {
      let cd = this.allColumns.find(c => col.prop === c.prop)!
      cd.width = col.renderWidth
    }

    if (this.fit) {
      // this.nextTick(() => {
      this._fitWidth()
      // })
    }

    // setTimeout(() => {
    this._updateScrollWidth()
    // }, 0);
    if (this.onColumnResize) this.onColumnResize(col)
  }
  //仅由列调用
  @debounced(100)
  _appendColumn(col?: Column) {
    if (col && this._fieldMap.has(col.prop)) {
      return
    }
    if (col && !isEmpty(col.slots.default)) {
      return;
    }
    if (col && this.allColumns.find(c => c.prop === col.prop)) {
      return
    }
    if (col && !isEmpty(col.children) && some(col.children, c => c instanceof Column)) return

    //reset columns
    this._fieldMap.clear()
    this._columnFootMap.clear()
    this._columnMetaMap.clear()

    let allSortedcols = this.getAllValidCols()

    allSortedcols.forEach(c => {
      let colMeta = {
        prop: c.prop,
        label: c.label,
        width: c.renderWidth,
        minWidth: c.minWidth,
        align: c.align ?? 'center',
        headerAlign: c.headerAlign ?? c.align ?? 'center',
        cellTmpl: c.slotHooks.cell,
        hasCellSlot: !isEmpty(c.slots.cell),
        type: c.type,
        dataType: c.dataType,
        pattern: c.pattern,
        hoverSelection: c.hoverSelection,
        tree: c.tree,
        hidden: c.hidden,
        avatarField: c.avatarField,
        avatarColor: c.avatarColor,
        tagAppearance: c.tagAppearance,
        multiple: c.multiple,
        link: c.link,
        indexButton: c.indexButton
      }
      if (c.tree && !this.treeCol) {
        this.treeCol = colMeta
      }
      this._columnMetaMap.set(c.prop, colMeta)
      this._fieldMap.set(c.prop, c)
      if (this.showFooter) {
        let footEl = find(this.children, (el => el instanceof ColumnFoot && el.prop == c.prop))
        if (!footEl) {
          footEl = new ColumnFoot({
            prop: c.prop,
            width: c.renderWidth,
            align: c.align ?? 'center',
            stats: c.stats,
            dataType: c.dataType,
            pattern: c.pattern
          })
          if (c.slots.footer) {
            footEl.append(...c.slots.footer)
          }
        }
        this._columnFootMap.set(c.prop, footEl as any)
      }
    })

    let foots = filter<ColumnFoot>(this.children, (el => el instanceof ColumnFoot))
    each(foots, f => {
      if (!this._columnFootMap.get(f.prop)) {
        f.remove()
        this._columnFootMap.delete(f.prop)
        // f.destroy()
      }
    })

    this.__setDataColumns()
  }
  /////////////////////////////////  仅由列调用 开始
  // _updateHeaderRows(rows: number) {
  //   if (rows > this.headerRows) {
  //     this.headerRows = rows
  //   }
  // }
  /////////////////////////////////  仅由列调用 结束
  #updateLastColProp() {
    if (!this.vList || this.vList.length < 1) return
    //last col
    let lastProp = ''
    eachRight(this.scrollColumns, col => {
      if (isVisible(this._fieldMap.get(col.prop)!)) {
        lastProp = col.prop
        return false
      }
    })
    this.lastScrollColumnProp = lastProp
  }

  @debounced(100)
  __fillCells() {
    let rowEls = this.vList.sort((a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
    let rowIndexs = rowEls.map(el => parseInt(el.dataset.rowIndex!))
    //填充行数据
    for (let r = 0; r < rowEls.length; r++) {
      const row = rowEls[r]
      const rowIndex = rowIndexs[r]
      this._fillRow(row, rowIndex)
    }
    if (!this._firstFilled && this.__dataInited) {
      this._firstFilled = true
      this.emit(TableEvents.FirstFilled)
    }
  }
  _fillRow(row: HTMLElement, rowIndex: number) {
    const rowData = this.renderList[rowIndex]
    let rowId = rowData ? String(rowData[this.rowKey]) : ''
    if (!rowData) {
      if (this.renderList.length < this.vList.length)
        row.toggleAttribute(AVAILABLE_ROW_TAG, false)
      return
    }
    row.setAttribute('data-row-key', rowId)
    row.toggleAttribute(AVAILABLE_ROW_TAG, true)
    if (row.children.length < 1) return

    this.__matchFillColor(row.firstElementChild as HTMLElement, rowData)

    //分组
    let isGroupRow = this.groupedRootIds.includes(rowId)
    if (this.grouping) {
      if (isGroupRow) {
        row.classList.add(GROUP_STATS)
      } else {
        row.classList.remove(GROUP_STATS)
      }
    } else if (row.classList.contains(GROUP_STATS)) {
      row.classList.remove(GROUP_STATS)
    }
    //填充行数据
    for (let i = 0; i < this.allColumns.length; i++) {
      const c = this.allColumns[i];
      let cellEl = row.querySelector('.ce-table-cell[column="' + c.prop + '"]') as HTMLElement
      let content = row.querySelector('.ce-table-cell[column="' + c.prop + '"] .ce-table-cell-content')!
      if (!content) continue

      let css = this.cellStyle[rowIndex + "_" + c.prop] || this.cellKeyStyle[rowId + "_" + c.prop]
      if (css && content.parentElement) {
        content.parentElement.style.cssText = css
      } else if (content.parentElement?.style.cssText) {
        content.parentElement!.style.cssText = ''
      }

      //selector
      this._renderCellSelector(cellEl, rowIndex, c.prop)

      //span style
      this.__matchSpanStyle(cellEl, rowIndex, c.prop)

      //note
      cellEl.toggleAttribute(NOTE_ATTR, false)
      let msg = this.keyNotes[rowId + '_' + c.prop] || this.notes[rowIndex + '_' + c.prop]
      if (msg) {
        cellEl.toggleAttribute(NOTE_ATTR, true)
      }

      //column type
      if (c.type === ColumnType.Index) {
        let trackIndex = this._fieldMap.get(ColumnProp.Index)?.trackIndex
        let textEl = content.firstElementChild as HTMLElement
        textEl.classList.remove('group-size')
        if (this.grouping && isGroupRow) {
          let childrenSize = size(find(this.renderList, item => item[this.rowKey] === rowId)?.children) || 0;
          textEl.textContent = childrenSize + '条';
          textEl.classList.add('group-size')
        } else {
          let rIndex = (trackIndex ? this.__traceMap.get(rowId)! : rowIndex)
          if (this.grouping) {
            rIndex = this.groupedIndexMap[rowId]
          }
          textEl.textContent = rIndex + 1 + ''
        }
        continue
      } else if (c.type === ColumnType.Selection) {
        let checked = this.__selectedList.has(rowId)
        let trackIndex = this._fieldMap.get(ColumnProp.Selection)?.trackIndex

        content.toggleAttribute('disabled', false)
        let textEl = content.firstElementChild as HTMLElement

        if (this.grouping && isGroupRow) {
          content.toggleAttribute('disabled', true);
          textEl.textContent = ''
          continue
        }
        content.toggleAttribute('checked', checked)
        if (c.hoverSelection) {
          let rIndex = (trackIndex ? this.__traceMap.get(rowId)! : rowIndex)
          if (this.grouping) {
            rIndex = this.groupedIndexMap[rowId]
          }
          textEl.textContent = rIndex + 1 + ''
        }
        content?.querySelector<Checkbox>('[name="selectbox"]')?.toggleCheck(checked)
        continue
      }

      if ((c.tree && this.tree) || (this.grouping && this.groupRootColProp === c.prop)) {
        let icon = cellEl.querySelector('.ce-table-caret ce-icon') as HTMLElement
        if (!isEmpty(rowData[this.childrenKey])) {
          icon.style.visibility = 'visible'
        } else {
          icon.style.visibility = 'hidden'
        }
        icon.parentElement?.classList.toggle(CLASS_EXPAND, this.expandedIdMap[rowId] || false)
        icon.parentElement!.dataset.level = this.levelMap[rowId] + ''
      }

      let slotProps: Record<string, any> = { row: rowData, column: c, rowIndex, columnIndex: i }

      let colProp = c.prop
      let dataType = c.dataType
      let isGroupCol = false
      if (this.groupRootColProp === c.prop) {
        isGroupCol = true
        colProp = rowData._groupCol ?? c.prop
        dataType = this._fieldMap.get(colProp)?.dataType
      }

      //slot cell
      let colEl = this._fieldMap.get(colProp)
      let cellTmpls = colEl?.slots.cell
      if (!isEmpty(cellTmpls)) {
        each(content.children, (el: HTMLElement) => {
          let slotParams: Record<string, any> = {}
          each(el.dataset, (v, k) => {
            if (startsWith(k, 'slot')) {
              let prop = camelCase(k.substring(4))
              let target = v || prop
              if (el.tagName.indexOf('-') > -1) {
                if (el instanceof CompElem) {
                  el.updateProps({ [target]: slotProps[prop] })
                } else {
                  set(el, target, slotProps[prop])
                }
              }

              slotParams[target] = slotProps[prop]
            }
          })

          if (size(slotParams) > 0) {
            this.emit(TableEvents.CellSlot, {
              slotEl: el,
              slotData: slotParams
            })
          }
        })
        continue
      }

      let val = this._getCellValue(rowIndex, c.prop)
      if (!val) return
      let [html, isHtml] = val

      let textContentEl = content.querySelector('[name="text"]')!
      if (isGroupCol) {
        textContentEl.textContent = ''
        let tagsContentEl = content.querySelector('[name="tags"]') as HTMLElement
        let usersContentEl = content.querySelector('[name="users"]') as HTMLElement
        let imgsContentEl = content.querySelector('[name="imgs"]') as HTMLElement
        tagsContentEl.style.display = usersContentEl.style.display = imgsContentEl.style.display = 'none'
      }

      //column datatype
      let dt = dataType === DataType.Tag
      if (isGroupCol && this.grouping ? isGroupRow && dt : dt) {
        let colors = this._tagColorMap.get(colProp)
        if (!colors) {
          colors = {}
          this._tagColorMap.set(colProp, colors)
          let data = map(this.innerData, d => d[colProp])
          if (c.multiple) {
            data = flatDeep(data)
          }
          let obj = groupBy(data, v => isNil(v) ? null : v)
          let tagColors = this._fieldMap.get(colProp)?.tagColors!
          let tcAry: string[] = []
          let isColorMap = false
          if (isString(tagColors)) {
            let tc
            try {
              tc = fval<Record<string, string>>(tagColors)
            } catch (error) {
              tc = tagColors
            }
            if (isString(tc)) {
              tcAry = [tc]
            } else if (isObject(tc)) {
              isColorMap = true
              colors = tc
            } else if (isArray<string>(tc)) {
              tcAry = tc
            }
          } else if (isObject(tagColors)) {
            isColorMap = true
            colors = tagColors
          } else {
            tcAry = RandomColors
          }
          if (!isColorMap) {
            let iAry = range(0, tcAry.length)
            each(keys(obj), (k: string) => {
              if (!k || k == 'null' || k == 'undefined') return

              let i = randi(iAry.length)
              let ci = iAry[i]
              colors![k] = tcAry[ci]
            })
          }
          this._tagColorMap.set(colProp, colors)
        }

        this.__fillTag(colors, html, content, c, isGroupRow, isGroupCol)
        continue
      }

      let isUser = dataType === DataType.User
      if (isGroupCol && this.grouping ? isGroupRow && isUser : isUser) {
        let wrapperEl = content.firstElementChild as HTMLElement
        let af = c.avatarField
        let ac = c.avatarColor
        if (isGroupCol && !wrapperEl) {
          let groupColMeta = this._columnMetaMap.get(colProp)
          af = groupColMeta?.avatarField
          ac = groupColMeta?.avatarColor
        }

        this.__fillUser(rowData, html, content, c, isGroupRow, isGroupCol, af, ac)
        continue
      }
      let isImg = dataType === DataType.Image
      if (isGroupCol && this.grouping ? isGroupRow && isImg : isImg) {
        this.__fillImage(html, content, c, isGroupRow, isGroupCol)
        continue
      }

      if (colEl?.link && !isGroupRow) {
        isHtml = true
        html = `<a href="${colEl.link}" target="${get(colEl, 'linkOptions.target')}">${html}</a>`
      }

      if (isHtml) {
        textContentEl.innerHTML = html
      } else {
        textContentEl.textContent = html
      }

    }
  }
  __fillTag(colors: Record<string, string>, value: any, content: Element, c: Record<string, any>, isGroupRow: boolean, isGroupCol: boolean) {
    let vals: string[]
    if (c.multiple) {
      if (isArray<string>(value)) {
        vals = value
      } else if (isString(value)) {
        vals = value.split(',')
      } else {
        vals = []
      }
    } else {
      vals = isArray<string>(value) ? [value[0]] : [value]
    }

    let tagsContainerEl = content.querySelector('[name="tags"]') as HTMLElement
    // if (isGroupCol)
    tagsContainerEl.style.display = 'flex'
    if (isGroupRow) {
      tagsContainerEl.style.display = 'none'
    }

    let tagEls = tagsContainerEl.querySelectorAll('ce-tag')
    let offset = vals.length - tagEls.length
    if (offset > 0) {
      let fragment = ''
      range(0, offset).forEach(() => {
        fragment += `<ce-tag size="md" appearance="${c.tagAppearance}" round="pill"></ce-tag>`
      })
      if (isGroupCol && isGroupRow) {
        tagsContainerEl.innerHTML = fragment
      } else {
        tagsContainerEl.insertAdjacentHTML('beforeend', fragment)
      }
    }
    each(tagsContainerEl.children, (tagEl: HTMLElement, i: number) => {
      let v = vals[i]
      if (isNil(v)) {
        tagEl.style.display = 'none'
        return
      }
      if ((isGroupRow && !isGroupCol)) {
        tagEl.style.display = 'none'
        return
      }
      tagEl.style.display = 'inline-block'
      let color = colors[v] ?? EMPTY_TAG_LABEL_COLOR
      tagEl.setAttribute('color', color)
      tagEl.toggleAttribute('empty', isBlank(v))
      tagEl.textContent = v
      // tagEl.setAttribute('title', v)
    })
  }
  __fillImage(value: any, content: Element, c: Record<string, any>, isGroupRow: boolean, isGroupCol: boolean) {
    let vals: string[]
    if (c.multiple) {
      if (isArray<string>(value)) {
        vals = value
      } else if (isString(value)) {
        vals = value.split(',')
      } else {
        vals = []
      }
    } else {
      vals = isArray<string>(value) ? [value[0]] : [value]
    }
    let imgsContainerEl = content.querySelector('[name="imgs"]') as HTMLElement
    if (isGroupCol)
      imgsContainerEl.style.display = 'flex'
    let imgEls = imgsContainerEl.querySelectorAll('ce-img')
    let offset = vals.length - imgEls.length
    if (offset > 0) {
      let fragment = ''
      range(0, offset).forEach(() => {
        fragment
        fragment += `<ce-img fit="cover" ondragstart="return false"></ce-img>`
      })
      if (isGroupCol && isGroupRow) {
        imgsContainerEl.innerHTML = fragment
      } else {
        imgsContainerEl.insertAdjacentHTML('beforeend', fragment)
      }
    }
    each(imgsContainerEl.children, (imgEl: HTMLElement, i: number) => {
      let v = vals[i]
      if (isNil(v)) {
        imgEl.style.display = 'none'
        return
      }

      if ((isGroupRow && !isGroupCol)) {
        imgEl.style.display = 'none'
        return
      }
      imgEl.style.display = 'inline-block'

      if ((imgEl as any).isMounted) {
        imgEl.setAttribute('src', v)
      } else {
        setTimeout(() => {
          imgEl.setAttribute('src', v)
        }, 20);
      }

    })
  }
  __fillUser(rowData: Record<string, any>, value: any, content: Element, c: Record<string, any>, isGroupRow: boolean, isGroupCol: boolean, avatarField: string, avatarColor: string) {
    let vals: string[]
    let imgs = get<any>(rowData, avatarField)
    if (c.multiple) {
      if (isArray<string>(value)) {
        vals = value
      } else if (isString(value)) {
        vals = value.split(',')
      } else {
        vals = []
      }
      if (isArray<string>(imgs)) {
      } else if (isString(imgs)) {
        imgs = imgs.split(',')
      } else {
        imgs = []
      }
    } else {
      vals = isArray<string>(value) ? [value[0]] : [value]
      imgs = isArray<string>(imgs) ? [imgs[0]] : [imgs]
    }
    let usersContainerEl = content.querySelector('[name="users"]') as HTMLElement
    if (isGroupCol)
      usersContainerEl.style.display = 'flex'
    let tagEls = usersContainerEl.querySelectorAll('ce-tag')
    let offset = vals.length - tagEls.length
    if (offset > 0) {
      let fragment = ''
      range(0, offset).forEach(() => {
        fragment
        fragment += `<ce-tag size="md" round="pill" class="user"><ce-avatar size="sm"></ce-avatar><span></span></ce-tag>`
      })
      if (isGroupCol && isGroupRow) {
        usersContainerEl.innerHTML = fragment
      } else {
        usersContainerEl.insertAdjacentHTML('beforeend', fragment)
      }
    }

    each(usersContainerEl.children, (el: HTMLElement, i: number) => {
      let v = vals[i]
      if (isNil(v)) {
        el.style.display = 'none'
        return
      }
      if ((isGroupRow && !isGroupCol)) {
        el.style.display = 'none'
        return
      }

      el.style.display = 'inline-block'

      el.classList.toggle('link', c.link)
      // el.setAttribute('title', v)
      let img = imgs ? imgs[i] : null
      this.nextTick(() => {
        let avatarEl = el.firstElementChild as HTMLElement
        if (avatarField) {
          avatarEl.setAttribute('image', img)
        } else {
          avatarEl.textContent = v ? v[0] : ''
          if (avatarColor) {
            avatarEl.setAttribute('color', avatarColor)
          }
        }
        let nameEl = el.lastElementChild as HTMLElement
        nameEl.textContent = v ?? ''
      })
    })
  }
  __getRenderValue(colProp: string, rowIndex: number) {
    let colEl = this._fieldMap.get(colProp)
    if (colEl?.slots.cell) return ''

    const rowData = this.renderList[rowIndex]
    let rs
    let rowId = rowData ? String(rowData[this.rowKey]) : ''
    if (colProp === ColumnProp.Index || colProp === ColumnProp.Selection) {
      let trackIndex = colEl?.trackIndex
      let rIndex = (trackIndex ? this.__traceMap.get(rowId)! : rowIndex)
      if (this.grouping) {
        rIndex = this.groupedIndexMap[rowId]
      }
      rs = rIndex + 1
    } else {
      rs = get<string>(rowData, colProp, '');
      if (colEl?.pattern) {
        switch (colEl.dataType) {
          case DataType.Number:
            rs = isNumeric(rs) ? formatNumber(rs, colEl.pattern) : ''
            break;
          case DataType.Time:
          case DataType.DateTime:
          case DataType.Date:
            rs = isNumeric(html) ? html : formatDate(rs, colEl.pattern)
            break;
        }
      }
    }
    return rs ?? ''
  }
  getRenderColumns(): Record<string, any>[] {
    return this.allColumns.filter(col => isVisible(this._fieldMap.get(col.prop)!, true) && col.prop !== SCROLLER_COL_PROP)
  }
  getColIndex(cell: HTMLElement) {
    if (!cell) return -1;

    return this.getRenderColumns().findIndex(c => c.prop === (cell.getAttribute('column') || cell.getAttribute('prop')))
  }
  getRowIndex(cell: HTMLElement) {
    if (!cell) return -1;
    let rowEl = cell?.closest('.ce-table-row') as HTMLElement
    return parseInt(rowEl.dataset.rowIndex!);
  }

  //修正右侧边界越界导致的视图空白
  fixScrollLeft() {
    this.bodyCon.scrollLeft = 0
  }
  _getValue(rowIndex: number, prop: string, cbk?: (isHtml: boolean) => void) {
    let col = this._fieldMap.get(prop)
    if (!col) return

    const rowData = this.renderList[rowIndex];
    let html = get<string>(rowData, prop, '');

    let colIndex = this.allColumns.findIndex(c => c.prop === prop)
    let isHtml = false

    let slotProps: Record<string, any> = { row: rowData, column: this.allColumns[colIndex], rowIndex, columnIndex: colIndex }
    let cellFn = col.slotHooks.cell
    if (cellFn) {
      isHtml = true
      html = (cellFn(slotProps) as Template).getHTML(this)
    } else if (this.enableFx && isString(html) && html[0] === '=') {
      let val = this._pushFxQueue(html, rowIndex, prop)
      if (val instanceof Promise) {
        html = ''
      } else {
        html = val
      }
    }
    if (cbk) cbk(isHtml)
    return html
  }
  _getCellValue(rowIndex: number, prop: string): [string, boolean] | void {
    let col = this._fieldMap.get(prop)
    if (!col) return

    const rowData = this.renderList[rowIndex];

    let isHtml = false
    let html = this._getValue(rowIndex, prop, v => { isHtml = v })!

    if (col.pattern) {
      switch (col.dataType) {
        case DataType.Number:
          html = isNumeric(html) ? formatNumber(html, col.pattern) : ''
          break;
        case DataType.Time:
        case DataType.DateTime:
        case DataType.Date:
          html = isNumeric(html) ? html : formatDate(html, col.pattern)
          break;
      }
    }
    if (this.grouping) {
      const rowId = rowData[this.rowKey]
      if (this.groupedRootIds.includes(rowId)) {
        if (prop === this.groupRootColProp) return [html, isHtml]
        let label = this.statsColLabelMap[prop] ?? ''
        return [html ? `<span class="ce-table-stats-label">${label}</span>${html}` : '', html ? true : false]
      }
    }
    return [html, isHtml]
  }

  //////////////////////////////////////////////// API
  setCurrentRow(rowKey?: string) {
    let lastRowIndex = this.currentRowIndex
    this.currentRowIndex = findIndex(this.renderList, x => x[this.rowKey] === rowKey)
    if (this.currentRowIndex !== lastRowIndex) {
      this.emit(TableEvents.CurrentChange, { newKey: this.renderList[this.currentRowIndex] ? this.renderList[this.currentRowIndex][this.rowKey] : '', oldKey: this.renderList[lastRowIndex] ? this.renderList[lastRowIndex][this.rowKey] : '' })
    }
  }
  /**
   * 更新当前视图数据，用于虚拟表格刷新
   */
  refreshView() {
    if (isEmpty(this.vList)) return;

    this.__fillCells()
    // scrolledV更新
    this.scrolledV = this.scroller.y > 0;

    // 更新汇总
    if (this.showFooter)
      this.TableConfigPane.onStat(this)
  }
  relayout() {
    if (!this.tableHead) return

    this.headerRowHeight = this.tableHead.clientHeight
    this._updateScrollWidth()
    this.loadingOverlay.relocate()
  }

  setData(data: Array<Record<string, any>>) {
    this.__dataInited = true
    this.innerData = data
    //clear config
    this._clearFilterData()
    this.emit(TableEvents.FilterChange, { filters: {}, cancel() { } })
    this.__onFilterChange()
    this._clearGroupData()

    this.__onGroupChange([])

    //refresh view
    this.refreshRenderSeed = Math.random()
    this.nextTick(() => {
      this.scroller.calcBounding()
      this.refreshView()
    })
  }
  getData() {
    return this.innerData
  }

  setCellStyle(style: string | Record<string, any>, rowIndex: number, colProp: string) {
    const css = CssHelper.getCssText(style)
    this.cellStyle[rowIndex + '_' + colProp] = css
  }
  setCellStyleByKey(style: string | Record<string, any>, rowKey: string, colProp: string) {
    const css = CssHelper.getCssText(style)
    this.cellKeyStyle[rowKey + '_' + colProp] = css
  }
  setColumnStyle(style: string | Record<string, any>, colProps: string[]): void
  setColumnStyle(style: string | Record<string, any>, colProp: string): void
  setColumnStyle(style: string | Record<string, any>, colProp: string | string[]) {
    const css = CssHelper.getCssText(style)
    if (isArray<string>(colProp)) {
      colProp.forEach(col => {
        this.colStyle[col] = css
      })
    } else {
      this.colStyle[colProp] = css
    }
  }
  setRowStyleByKey(style: string | Record<string, any>, rowKey: string): void
  setRowStyleByKey(style: string | Record<string, any>, rowKey: string[]): void
  setRowStyleByKey(style: string | Record<string, any>, rowKey: string | string[]) {
    const css = CssHelper.getCssText(style, true)

    if (isArray<string>(rowKey)) {
      rowKey.forEach(k => {
        this.rowKeyStyle[k] = css
      })
    } else {
      this.rowKeyStyle[rowKey] = css
    }
  }
  setRowStyle(style: string | Record<string, any>, rowIndex: number): void
  setRowStyle(style: string | Record<string, any>, rowIndexs: number[]): void
  setRowStyle(style: string | Record<string, any>, rowIndex: number | number[]) {
    const css = CssHelper.getCssText(style, true)

    if (isArray<string>(rowIndex)) {
      rowIndex.forEach(row => {
        this.rowStyle[row] = css
      })
    } else {
      this.rowStyle[rowIndex + ''] = css
    }
  }
  clearStyle(type?: number) {
    switch (type) {
      case StyleType.Row:
        this.rowStyle = {}
        this.rowKeyStyle = {}
        break;
      case StyleType.Col:
        this.colStyle = {}
        break;
      case StyleType.Cell:
        this.cellStyle = {}
        this.cellKeyStyle = {}
        break;
      default:
        this.rowStyle = {}
        this.rowKeyStyle = {}
        this.colStyle = {}
        this.cellStyle = {}
        this.cellKeyStyle = {}
        break;
    }
  }

  /**
   * 更新某列视图值，直接修改内容不通过响应触发提高性能
   * 适合高频更新场景
   * @param prop 
   * @param values 值数组（下标从0开始）或下标为key的对象
   * @param syncData 
   * @returns 
   */
  updateColumnCells(prop: string, values: Record<string, any>) {
    //1. 设置dom
    let colMeta = this.scrollColumns.find(col => col.prop === prop)
    if (!colMeta) {
      colMeta = this.fixedLeftColumns.find(col => col.prop === prop)
    }
    if (!colMeta) {
      colMeta = this.fixedRightColumns.find(col => col.prop === prop)
    }
    if (!colMeta) return;

    const viewRows = this.getInViewList()
    const viewCellMap: Record<string, HTMLElement> = {}
    viewRows.forEach((vr: HTMLElement) => {
      const ri = parseInt(vr.dataset.rowIndex!)
      const rowData = this.renderList[ri]
      viewCellMap[rowData[this.rowKey]] = vr.querySelector('.ce-table-cell[column="' + prop + '"] .ce-table-cell-content')!
    })

    //仅更新可视区
    each(viewCellMap, (rowEl, key) => {
      rowEl.textContent = values[key] ?? ''
    })

  }
  updateCell(prop: string, rowIndex: number, value: string | number) {
    let rowEl = this.bodyCon.querySelector('.ce-table-row[data-row-index="' + rowIndex + '"] [column="' + prop + '"] .ce-table-cell-content')
    if (!rowEl) return

    switch (this._fieldMap.get(prop)?.dataType) {
      case 'tag':
        rowEl.querySelector('[name="tags"] ce-tag')!.textContent = value + ''
        break
      case 'text':
      default:
        rowEl.querySelector('[name="text"]')!.textContent = value + ''
    }
  }

  //仅供column调用
  _fixColumn(prop: string, clear = false) {
    if (clear) {
      this.fixColumns(0, this.#fxRCols.length)
      return;
    }
    let i = findIndex(this.allColumns, x => x.prop === prop) + 1

    this.fixColumns(i, this.#fxRCols.length)
  }
  fixColumns(leftCount: number, rightCount: number = 0, cancelEmit = false) {
    if (size(this.allColumns) < 1) return

    if (leftCount < 0) leftCount = 0;
    if (rightCount < 0) rightCount = 0;
    if (this.getAllValidCols().some(c => c.prop === SCROLLER_COL_PROP) && !this.#fxRCols.some(c => c.prop === SCROLLER_COL_PROP)) {
      rightCount++
    }

    let fxLCols = leftCount > 0 ? take(this.allColumns, leftCount) : []
    let fxRCols = rightCount && rightCount > 0 ? takeRight(this.allColumns, rightCount) : []

    each(this._fieldMap, (c) => {
      c.setFixed(false)
    })

    fxLCols.forEach(c => {
      let col = this._fieldMap.get(c.prop)
      if (col) col.setFixed('left')
    })
    fxRCols.forEach(c => {
      let col = this._fieldMap.get(c.prop)
      if (col) col.setFixed('right')
    })

    this.__setDataColumns_$__(cancelEmit)

    setTimeout(() => {
      this._updateScrollWidth()
      this.refreshView()
    }, 50);

    let left = leftCount ? this.allColumns[leftCount - 1].prop : ''
    let eventObj = { left, right: rightCount ? this.allColumns[rightCount - 1].prop : '' }
    this.emit(TableEvents.FixedChange, eventObj)
    this.__onFixedChange(left)
    if (!cancelEmit) {
      this.emit(TableEvents.ConfigChange, { type: ConfigType.Fixed })
    }
    this.onColumnFix && this.onColumnFix()
  }
  toggleColumnHide(colProp: string) {
    this.toggleFieldHide(colProp)

    this.__clearSelector()

    this.nextTick(() => {
      this.#updateLastColProp()

      setTimeout(() => {
        this.scroller.calcBounding()
      }, 100);
    })
  }

  hideColumns(colProps: string | string[], cancelEmit = false) {
    this.hideFields(colProps, cancelEmit)

    this.nextTick(() => {
      this.#updateLastColProp()
    })
  }
  moveColumnTo(colProp: string, toProp: string) {
    if (colProp === toProp) return;

    let colIndex = this.allColumns.findIndex(c => c.prop === colProp)
    let toIndex = this.allColumns.findIndex(c => c.prop === toProp)
    if (toIndex < 0) return;
    if (colIndex < 0) return;
    if (colIndex - 1 === toIndex) return;

    let colMeta = this.allColumns[colIndex]

    //如果目标列在固定列中，则插入到固定列中
    let i = -1

    //从原位置删除
    if ((i = this.#fxLCols.findIndex(c => c.prop === colProp)) >= 0) {
      this.#fxLCols.splice(i, 1)
    } else if ((i = this.#fxRCols.findIndex(c => c.prop === colProp)) >= 0) {
      this.#fxRCols.splice(i, 1)
    } else if ((i = this.#scrollCols.findIndex(c => c.prop === colProp)) >= 0) {
      this.#scrollCols.splice(i, 1)
    }

    if ((i = this.#fxLCols.findIndex(c => c.prop === toProp)) >= 0) {
      this.#fxLCols.splice(i + 1, 0, colMeta)
    } else if ((i = this.#fxRCols.findIndex(c => c.prop === toProp)) >= 0) {
      this.#fxRCols.splice(i + 1, 0, colMeta)
    } else if ((i = this.#scrollCols.findIndex(c => c.prop === toProp)) >= 0) {
      this.#scrollCols.splice(i + 1, 0, colMeta)
    }

    //移动列dom
    let colEl = this._fieldMap.get(colProp)
    if (!colEl) return;
    let toColEl = this._fieldMap.get(toProp)
    if (!toColEl) return;
    toColEl.parentNode?.insertBefore(colEl, toColEl.nextSibling)

    if (this.showFooter) {
      let colEl = this._columnFootMap.get(colProp)
      if (!colEl) return;
      let toColEl = this._columnFootMap.get(toProp)
      if (!toColEl) return;
      toColEl.parentNode?.insertBefore(colEl, toColEl.nextSibling)
    }

    this.__setDataColumns_$__()

    setTimeout(() => {
      this.refreshView()
    }, 50);

    this.onColumnMove && this.onColumnMove(colProp, toProp)
  }
  toggleRowSelectionAll(checkedAll?: boolean) {
    let dataList = this.renderList
    if (this.grouping) {
      dataList = map(this.groupedData!, item => item.children).flat()
    }
    let checkboxEl = this._fieldMap.get(ColumnProp.Selection)?.renderRoot?.querySelector('ce-checkbox') as Checkbox
    checkboxEl.toggleCheck(checkedAll)
    checkedAll = isUndefined(checkedAll) ? (this.__selectedList.size !== dataList.length ? true : false) : checkedAll
    if (checkedAll) {
      this.__selectedList = new Set(flatMap<Record<string, any>, string>(dataList, d => isNil(d[this.rowKey]) ? [] : d[this.rowKey] + ''))
      this.vList.forEach((row, i) => {
        let contentEl = row.querySelector('.ce-table-cell[column="__selection"] .ce-table-cell-content:not([disabled])')
        contentEl?.toggleAttribute('checked', true)
        contentEl?.querySelector<Checkbox>('[name="selectbox"]')?.toggleCheck(true)
      })
    } else {
      this.__selectedList.clear()
      this.vList.forEach((row, i) => {
        let contentEl = row.querySelector('.ce-table-cell[column="__selection"] .ce-table-cell-content:not([disabled])')
        contentEl?.toggleAttribute('checked', false)
        contentEl?.querySelector<Checkbox>('[name="selectbox"]')?.toggleCheck(false)
      })
    }

    this.__onSelectionChange(Array.from(this.__selectedList))
  }
  toggleRowSelection(rowKeyValue: string | number | Array<string | number>, checked?: boolean) {
    let rows = isArray(rowKeyValue) ? rowKeyValue : [rowKeyValue]

    let dataList = this.renderList
    if (this.grouping) {
      dataList = map(this.groupedData!, item => item.children).flat()
    }
    rows.forEach(r => {
      let rowId = r + ''
      let rowIndex = dataList.findIndex(d => d[this.rowKey] == r)
      if (this.__selectedList.has(rowId)) {
        if (isUndefined(checked) || checked === false) {
          this.__selectedList.delete(rowId)
          let contentEl = this.tableBody.querySelector(`.ce-table-row[data-row-index="${rowIndex}"] .ce-table-cell[column="__selection"] .ce-table-cell-content:not([disabled])`)
          contentEl?.toggleAttribute('checked', false)
          let checkboxEl = contentEl?.querySelector('[name="selectbox"]') as Checkbox
          if (checkboxEl) {
            checkboxEl.checked = false
          }

        }
      } else {
        if (isUndefined(checked) || checked === true) {
          this.__selectedList.add(rowId)
          let contentEl = this.tableBody.querySelector(`.ce-table-row[data-row-index="${rowIndex}"] .ce-table-cell[column="__selection"] .ce-table-cell-content:not([disabled])`)
          contentEl?.toggleAttribute('checked', true)
          let checkboxEl = contentEl?.querySelector('[name="selectbox"]') as Checkbox
          if (checkboxEl) {
            checkboxEl.checked = true
          }
        }
      }
    })

    this.__onSelectionChange(Array.from(this.__selectedList))
  }
  getRowSelection() {
    return Array.from(this.__selectedList)
  }
  getColumnIndex(prop: string) {
    return this.allColumns.findIndex(c => c.prop === prop)
  }
  getColumnCharByIndex(index: number) {
    let numOfA = Math.floor(index / 26);
    return padStart('', numOfA, 'A') + String.fromCharCode((index % 26) + BASE_CHAR_CODE)
  }
  getColumnPropByChar(char: string) {
    let cIndex = this.__getColumnIndex(char)
    return this.getRenderColumns()[cIndex].prop
  }
  __getColumnIndex(char: string) {
    let code = 0;
    each(upperCase(char), (c: string) => {
      code += c.charCodeAt(0) - BASE_CHAR_CODE;
    })

    return code;
  }


  __tableBar!: TableBar;
  _setTableBar(bar: TableBar) {
    this.__tableBar = bar
  }
  /////////////////////////////////////////////////// fieldContainer
  __onReady() {
    this.emit(FieldContainerEvents.Ready)
    //update tableBar
    this.__tableBar?._onContainerReady()
  }
  __onSelectionChange(selection: string[], e?: Event) {
    this.emit(TableEvents.SelectionChange, { selection }, e)
    //update tableBar
    this.__tableBar?._onSelectionChange(selection)
  }
  __onSortChange(orders: { prop: string; sort: string; }[]) {
    //update column
    this._fieldMap.forEach(c => {
      if (c.sortable) {
        c._onSortChange(orders)
      }
    })
    //update tableBar
    this.__tableBar?._onSortChange(orders)
  }
  __onFilterChange(filters?: Record<string, any>) {
    //update column
    this._fieldMap.forEach(c => {
      if (c.filterable) {
        c._onFilterChange(filters)
      }
    })
    //update tableBar
    this.__tableBar?._onFilterChange(filters!)
  }
  __onFixedChange(left: string) {
    //update column
    this._fieldMap.forEach(c => {
      if (c.config) {
        c._onFixedChange(left)
      }
    })
    //update tableBar
    this.__tableBar?._onFixedChange(left)
  }
  __onGroupChange(grouped: Record<string, any>[]) {
    this.emit(TableEvents.GroupChange, { grouped })
    //update tableBar
    this.__tableBar?._onGroupChange(grouped)
  }
  __onRowHeightChange(rowHeightType: string) {
    this.emit(TableEvents.RowHeightChange, { type: rowHeightType })
    //update column

    //update tableBar
    this.__tableBar?._onRowHeightChange(rowHeightType)
  }
  __onFieldHideChange(columns: string[]) {
    //update tableBar
    this.__tableBar?._onColumnHideChange(columns)
  }
  __onFillColorChange(fillColorConditions: Record<string, any>[]) {
    this.emit(TableEvents.FillColorChange, { fillColorConditions })
    //update tableBar
    this.__tableBar?._onFillColorChange(fillColorConditions)
  }
}
