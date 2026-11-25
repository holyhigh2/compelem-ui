import type { CssTemplate } from "compelem";
import { classes, CompElem, computed, css, csscope, Csscope, CssHelper, debounced, emits, forEach, h, html, ifElse, ifTrue, onced, prop, query, QueryCache, state, tag, Template, watch } from "compelem";
import { alphaIndex, alphaLabel, camelCase, clone, cloneDeep, closest, debounce, each, eachRight, filter, find, findIndex, flatDeep, flatMap, formatDate, formatNumber, fval, get, groupBy, isArray, isBlank, isDefined, isEmpty, isNil, isNumeric, isObject, isString, isUndefined, kebabCase, keys, last, map, randi, range, set, size, some, sortTree, startsWith, take, takeRight, test, walkTree } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { DataType, EMPTY_TAG_LABEL_COLOR, RandomColors, SortType } from "../../../constants";
import { ChevronRight, ExpandDiagonal } from "../../../icons/icons";
import { FieldContainer, FieldContainerEvents } from "../../../mixins/FieldContainer";
import { CLASS_EXPAND, TreeStructured } from "../../../mixins/TreeStructured";
import { Virtualized } from "../../../mixins/Virtualized";
import { ColorHelper } from "../../../utils/color";
import { REUSE_ROW_ATTR } from "../../../utils/row-reuse";
import { attr, isVisible, makeStoppable, nodesToHTML } from "../../../utils/utils";
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

/**
 * 往格子写纯文本：复用已有的文本节点，值没变就不碰 DOM。
 *
 * 直接赋 `textContent` 会丢掉旧节点再建一个新的，虚拟滚动回收行时这是每一次填充
 * 的常态。这里只处理「唯一子节点就是文本」这种最常见形状，其余结构仍走
 * `textContent`。
 */
function writeText(el: Element, text: string) {
  const s = typeof text === 'string' ? text : String(text)
  const first = el.firstChild
  if (first && first === el.lastChild && first.nodeType === 3) {
    if ((first as Text).nodeValue !== s) (first as Text).nodeValue = s
    return
  }
  if (el.textContent !== s) el.textContent = s
}

/** 树形展开动画的默认时长与曲线，CSS 变量未设置时使用。 */
const TREE_ANIM_FALLBACK_MS = 300
const TREE_ANIM_FALLBACK_EASING = 'ease'
/** 快照有效期：重填迟迟没来就放弃动画，避免延迟填充误触发。 */
const TREE_ANIM_SNAPSHOT_TTL = 600

/** 解析 CSS 时间值（`0.3s` / `300ms`）为毫秒。 */
function parseCssTime(raw: string) {
  const v = parseFloat(raw)
  if (!isFinite(v)) return 0
  return raw.trim().endsWith('ms') ? v : v * 1000
}

/** 读取虚拟行的定位 Y，来自 wrapper 的 inline `translateY`。 */
function readRowY(el: HTMLElement) {
  const m = /translateY\(([-\d.]+)px\)/.exec(el.style.transform)
  return m ? parseFloat(m[1]) : 0
}

/**
 * 列窗口左右各多填的宽度（px）。
 *
 * 窗口按像素算、按列对齐，滚动位置落在半列上时边缘那列必须已在窗口内，
 * 否则会看到一条空白列。取两列左右（默认列宽 120）的余量。
 */
const COL_WINDOW_PAD = 320

/** 窗口外格子的标记类，与 `style.scss` 的 `.ce-table-cell.is-col-offscreen` 对应 */
const COL_OFFSCREEN_CLASS = 'is-col-offscreen'

/**
 * 一步滚动跨过多少行算「甩动」：超过就只重定位、不填数据，等 `scrollend` 补。
 *
 * 取 12 行 = 视口高度的一半左右。拖拇指 1px 约 2.3 行、滚轮一步 2.2 行，
 * 都远低于它；快速拖动和长距离跳转才会越线。
 */
const SNAP_FILL_ROWS = 12

/** 列区间 `[from, to)`，元素是 `scrollColumns` 的下标 */
type ColRange = [number, number]

function inRanges(ranges: ColRange[], i: number) {
  for (let k = 0; k < ranges.length; k++) {
    if (i >= ranges[k][0] && i < ranges[k][1]) return true
  }
  return false
}


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
 * @attrs
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
 *  scroll({to, direction, edge, x, y}) 表格内容滚动时触发。direction 为 'v'/'h'，
 *      x/y 为滚动后横/纵向偏移（内容坐标系），高频事件，消费方应自行节流
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
 *  overlay 插槽，支持自定义覆盖层
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
@emits(TableEvents.Span, TableEvents.Scroll, TableEvents.ScrollEdge, TableEvents.ScrollEnd, TableEvents.RowDblClick, TableEvents.CellDblClick, TableEvents.CellClick, TableEvents.RowClick,
  TableEvents.CurrentChange, TableEvents.ColumnChange, TableEvents.FirstFilled, TableEvents.CellSlot, TableEvents.FilterChange, TableEvents.FixedChange,
  FieldContainerEvents.Ready, TableEvents.SelectionChange, TableEvents.RowHeightChange, TableEvents.Hide,

  TableEvents.BeforeDoStats, TableEvents.DoExtStats, TableEvents.AfterDoStats,
  TableEvents.ConfigChange, TableEvents.AlignChange,
  'contextmenuselect', 'contextmenu', TableEvents.Detailclick, TableEvents.CellsChange,
  TableEvents.SortChange, TableEvents.GroupChange, TableEvents.SetFilterList,
  TableEvents.FillColorChange, FieldContainerEvents.Sort)
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
  @prop({ type: Array }) data: Array<Record<string, any>> = [];
  @prop clickView = true

  @prop rowKey = "id";
  @prop childrenKey = "children";
  @prop defaultExpandAll = true;
  @prop tree = false;
  @prop({ type: [String, Number] }) indent: string | number = '1em'
  @prop extended = true
  /**
   * 视口外的内容跳过渲染。
   *
   * 两件事一起做：
   *  1. `content-visibility: auto`（见 `style.scss` 的 `.ce-table-cell`）；
   *  2. 列窗口填充：纵向滚动只为**视口内那十几列**写数据，窗口外的格子打
   *     `.is-col-offscreen` 跳过渲染，横向滚动时再补上（`__syncColWindow`）。
   *
   * 置 false 后所有格子都参与渲染与填充 —— 打印、PDF 导出、整表截图这类
   * "不需要滚动就要全部内容"的场景必须关掉，否则未滚到的区域是空白。
   */
  @prop optimizeRender = true
  /**
   * `_fillRow` 走优化前的写法：逐格 `row.querySelector` 取格子、无条件 `textContent`
   * 赋值、合并格样式无条件清理。
   *
   * 仅供 `demo/table-perf.html` 做前后性能对比，生产环境保持 false。
   */
  __legacyFill = false
  /**
   * 压测开关：true 时关闭列窗口填充（每次填满整行全部列），仅 `demo` 做前后对比用。
   */
  __noWindow = false
  /**
   * 压测开关：true 时不给窗口外的格子打跳过渲染标记（用于把「少填」与「少渲染」
   * 两笔收益分开量）。
   */
  __noOffscreen = false
  /** 压测开关：true 时关闭甩动降级（每步都同步填数据）。 */
  __noSnap = false
  /** 甩动降级期间有行只重定位、没填数据，等 `scrollend` 补 */
  __snapPending = false
  /** 压测开关：true 时关闭结构虚拟化（窗口外的格子留在 DOM 里，只跳过渲染）。 */
  __noMaterialize = false

  /** 展开前的 `data-row-key → 定位Y` 快照，仅在一次树形展开周期内有效。 */
  #treeAnimSnapshot: Map<string, number> | null = null
  /** 只有整表重填期间为 true，滚动回收的单行填充不参与动画。 */
  #treeAnimActive = false
  #treeAnimDurationMs = 0
  #treeAnimEasing = ''
  #treeAnims: Animation[] = []
  #treeAnimTimer: ReturnType<typeof setTimeout> | null = null
  /** CSS 过渡门控标记的存活定时器，覆盖整段动画时长。 */
  #treeAnimClassTimer: ReturnType<typeof setTimeout> | null = null
  /** 只允许「捕获之后的第一轮整表重填」播放 FLIP。 */
  #treeAnimConsume = false
  /** 本轮展开的补填走同步路径，让内容与几何重排在同一帧完成。 */
  #treeAnimUrgent = false

  @state vRowHeight = 0
  @state innerData: Array<Record<string, any>> = this.data

  //左侧固定列宽度
  @state paddingLeft = 0;
  @state paddingRight = 0;

  //通过setAlign设置的列对齐方式
  @state columnAlign: Record<string, string | null> = {};
  @state columnLinkStyle: Record<string, Record<string, string>> = {};
  @state vScrollWidth: number = 0
  @state vScrollHeight: number = 0
  /**
   * 表体（`.ce-table-body`）实测高度，单位为 px。
   *
   * ⚠️ 必须走 `@state` 而不是在 `cssVars` 里直接读 `this.tableBody.offsetHeight`：
   * `tableBody` 是 `@query`（非信号），把它写进 `cssVars` 会让编译器生成
   * `rc.__s.tableBody.offsetHeight.value`，而 `rc.__s` 中无此键 ⇒ 运行期 `TypeError`；
   * 更严重的是它会连带让**整个 cssVars 依赖提取失败**（详见 `get cssVars()` 上方注释）。
   * 写入点：`resetVirtualList()`（那里本来就要量 `tableBody.offsetHeight`）。
   */
  @state tableBodyHeight = 0

  //虚拟化
  @state vCachedRows = 0;

  //tree
  @state nodeKey = this.rowKey
  @state expandedIdMap: Record<string, boolean> = {}
  @state treeData: Record<string, any>[] = []
  @state filterTreeData: typeof this.treeData | undefined = undefined
  @state refreshRenderSeed = 0

  //分组
  @state groupOrders: Array<{ prop: string, condition?: string, name?: string }> = [] //分组状态
  @state groupedData: Record<string, any>[] | undefined = undefined
  @state grouping = false

  //分组后的tree列
  @state groupRootColProp = ''
  groupedRootIds: string[] = []

  //由列组件修改
  @state headerRows = 1;
  //数据展示列
  @state fixedLeftColumns: Record<string, any>[] = []
  @state fixedRightColumns: Record<string, any>[] = []
  @state scrollColumns: Record<string, any>[] = []
  @state invisibleFields: string[] = [];
  @state lastScrollColumnProp = ''

  @state scrolledV = false;
  @state scrolledEndV = false;
  cellStyle: Record<string, string> = {}
  cellKeyStyle: Record<string, string> = {}
  @state colStyle: Record<string, string> = {}
  @state rowStyle: Record<string, string> = {}
  @state rowKeyStyle: Record<string, string> = {}

  @state filterData: typeof this.data | undefined = undefined
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

  /** `scrollColumns` 的 prop → 索引，与 `#colX` / `#colW` 同批建立 */
  #scrollIdx: Map<string, number> | null = null
  /** `scrollColumns` 每列在 `.ce-table-column-scroll` 内容盒内的左缘（px） */
  #colX: number[] | null = null
  #colW: number[] | null = null
  /** 几何量失败过（列还没物化），本次失效周期内不再重试 */
  #colMeasureFailed = false
  /** 已填充的列窗口 `[from, to)`；null 表示按全列填充 */
  #colWin: [number, number] | null = null
  /** 结构虚拟化已生效：`.ce-table-column-scroll` 显式定宽、格子绝对定位、窗口外格子摘出 DOM */
  #matOn = false
  /** 结构虚拟化的代次；行元素上的 `data-mat` 不等即表示该行需要重做一遍 */
  #matEpoch = 0
  /** 每行容器 → 摘出 DOM 的格子（prop → cell） */
  #cellPark = new Map<HTMLElement, Map<string, HTMLElement>>()
  /** 结构虚拟化的几何样式表（列偏移 + 宽度），只在几何变化时重写 */
  #matStyleEl: HTMLStyleElement | null = null


  TableConfigPane!: ColumnConfigPane;


  //用于追踪数据index
  __traceMap = new Map<string, number>()

  @csscope(Csscope.INNER)
  static get css(): Array<CSSStyleSheet | CssTemplate> {
    return [tableStyleSheet];
  }
  /**
   * ⚠️⚠️ **`cssVars` 的每个取值表达式都必须只引用「可静态解析的响应式字段」**
   * （自有/祖先类的 `@prop` / `@state` / `@computed`）。
   *
   * 编译器对 `get cssVars()` 做**整体**依赖提取（`extractCssDeps`）：
   * 只要有一个标识符解析不出来，就返回 `undefined`，而 `compile.ts` 的注入条件是
   * `if (cssDeps && cssDeps.length)` —— **整段 `cssEffect` 都不会生成**，
   * 于是宿主上一个 `--table-*` 变量都不会被写入（不是「某一项失效」，是**全灭**）。
   * 而且这条路径**没有运行时兜底**（`CompElem` 只在 `ceStatic.cssEffect` 存在时才挂 effect）。
   *
   * 本文件历史上踩过两次，务必不要再引入：
   *  1. `tableHeight: isUndefined(this.height) ? …` —— `Table` **没有** `height` prop
   *     （全仓 `@prop height` 只在 ProgressLinear / Drawer 上），标识符解析失败 ⇒ 全灭。
   *     已删除；`--table-height` 改由使用方直接设置在宿主内联样式上，
   *     `style.scss` 的 `height: var(--table-height, 100%)` 自带 `100%` 兜底。
   *  2. `tableBodyHeight: \`${this.tableBody?.offsetHeight ?? 0}px\`` —— `tableBody` 是
   *     `@query`，**不是信号**：提取器会把它当成依赖并生成 `rc.__s.tableBody.offsetHeight.value`，
   *     而 `rc.__s` 里根本没有该键 ⇒ 首次执行即 `TypeError`。
   *     改为读 `@state tableBodyHeight`（由 `resetVirtualList` 在测量处写入）。
   */
  get cssVars() {
    return {
      tableRowHeight: `${this.vRowHeight}px`,
      tableBodyHeight: `${this.tableBodyHeight}px`,
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
  /**
   * 骨架扩展开关：是否在基类骨架里补出「编辑态附加节点」。
   *
   * ⚠️ 这是 **0.30 编译期的骨架复用通道**，不是普通业务开关：
   *   - 编译器要求 `render()` 内有且只有 1 个主视图 `h`` 模板（D7，见
   *     `compelem-compiler/src/analyze/template-extract.ts`），而 Editable 的
   *   6 个附加节点（caret/textarea/filler/tipmsg/menu/alert）**必须留在
   *   `.ce-table` 子树内**——`editableStyle.scss` 的 4 条相关规则祖先链全是
   *   `.ce-table`，其中 caret/textarea/filler/tipmsg 还必须在
   *   `.ce-table-body-container`（滚动容器）内；且 0.30 已删除 `Template.insert/append`
   *   （`Template` 退化为纯数据类），子类无法再往父模板里插结构。
   *   ⇒ 唯一不复制 130 行骨架、又保证 DOM 逐字节等价的落点就是「基类骨架 + 子类开关」。
   *   - 必须是 **@computed**（响应式）：render() 内访问非响应式 getter 触发 D2 降级。
   *   - 必须是 **getter**（而非 prop/state）：子类 `Editable` 只需覆盖成 `true`，
   *     不必参与 `__s` 的初始值注入与家族表重声明。
   *   - 两个分支的骨架都**类级恒定**（不随实例变化），故不会踩 `TMPL_META_CACHE`
   *     按 `component.constructor` 缓存结构的老坑。
   */
  @computed
  get showEditableExtras() {
    return false
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
  /**
   * 只切根元素的 class，不进 `render` 的 `classes({...})`：把 `optimizeRender`
   * 写进 render 会让改开关触发整表重渲染（23 行 × 全部列重建 DOM，滚动位置与
   * 宿主插槽内容都会丢）。
   */
  @watch('optimizeRender', { immediate: true })
  watchOptimizeRender(nv: boolean) {
    this.nextTick(() => {
      this.renderRoot?.classList.toggle('is-no-render-opt', !nv)
      // 关掉优化后要按全列补一次：此前只填了可见窗口的列，打印/截图会看到空白列
      this.#invalidateColWindow()
      if (!nv && this._firstFilled) this.__fillCells()
    })
  }
  /**
   * 宿主显式改 `rowHeight` prop 时，把档位交回 `custom`
   */
  @watch('rowHeight')
  watchRowHeightProp() {
    if (this.__rowHeightType && this.__rowHeightType !== 'custom') {
      this.__rowHeightType = 'custom'
    }
    this.syncVRowHeight()
    this.nextTick(() => {
      this.resetVirtualList()
    })
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

    if (this.rowKey && isArray(v)) {
      const rows = v as Array<Record<string, any>>
      this.__traceMap.clear()
      rows.forEach((row, i) => {
        this.__traceMap.set(row[this.rowKey], i)
      })
    }
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
  // 原先这里有一条 `@watch('showIndicator')`，已删除：
  // `showIndicator` 并不是 `ce-table` 自己的响应式字段 —— 它声明在**子类** Editable
  // (`Editable.ts:255 @prop`)，且 Editable 已有等价的 watchShowIndicator 处理。
  // 在 Table 上监听它属于死代码（信号不存在，effect 永不触发），编译期报 E-WATCH-SOURCE。
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
      this.#scheduleUpdateLastColProp()
    }
    this.nextTick(() => {
      this.vList.forEach((row, i) => {
        //初始化模板组件
        cellSlotCols.forEach(c => {
          let colEl = this._fieldMap.get(c.prop)
          let cellTmpls = colEl?.slots?.cell!
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
            content.classList.add('has-cell-slot')
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
    })} @scroll="${this.fixScrollLeft}}" virtualized @click="${this.onClickBody}" @dblclick="${this.onDblClickBody}" @pointerdown="${this.onBodyPointerDown}" @mousedown="${this.onMouseDown}" @mutate.child.debounce:100="${this.onListReady}" @mouseenter.capture="${this.onMouseEnterNoteContainer}" @mouseleave.capture="${this.onMouseLeaveNoteContainer}">
            <div id="vpillar"></div>
            ${ifTrue(this.showEditableExtras, () => h`
              <div class="ce-table-selector-caret" @click="${this.onClickCaret}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                  <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"></path>
                </svg>
              </div>
              <textarea class="ce-table-cell-input__text" @input="${this.onInput}"></textarea>
              <div class="ce-table-selector-filler"></div>
              <ce-message class="ce-table-tipmsg" id="warningmsg" closable type="warning" descr="输入内容与限制选项不符" @close="${this.onCloseTip}"></ce-message>
            `)}
            ${forEach(range(this.vCachedRows), (row, i) => i, (row, i) => h`
            <div class="ce-table-v-wrapper" data-row-index="${i}">
              <div role="row" class="ce-table-row" data-row-index="${i}" data-row-sn="${i + 1}">
                <div class="ce-table-column-fixed is-left"  part="fixed-column">
                  ${forEach(this.fixedLeftColumns, c => c.prop, (c, ci) => h`
                    <div role="cell" class="ce-table-cell" ${classes({ "is-expandable": c.indexButton, "ce-table-tree-cell": (c.tree && this.tree) || (this.grouping && this.groupRootColProp === c.prop) })} column="${c.prop}">
                      ${ifTrue((c.tree && this.tree) || (this.grouping && this.groupRootColProp === c.prop), () => h`<span class="ce-table-caret"><ce-icon style="visibility: hidden;" .svg="${ChevronRight}" size="md"></ce-icon></span>`)}
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
                        ${ifTrue(c.indexButton && (c.type === ColumnType.Selection || c.type === ColumnType.Index), () => h`<ce-icon title="展开详情" class="ce-table-expand" size="md" ?icon="${isString(c.indexButton) ? c.indexButton : ''}" .svg="${isString(c.indexButton) ? c.indexButton : ExpandDiagonal}"></ce-icon>`)}
                        
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
                      ${ifTrue((c.tree && this.tree) || (this.grouping && this.groupRootColProp === c.prop), () => h`<span class="ce-table-caret"><ce-icon style="visibility: hidden;" .svg="${ChevronRight}" size="md"></ce-icon></span>`)}
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
                        ${ifTrue(c.indexButton && (c.type === ColumnType.Selection || c.type === ColumnType.Index), () => h`<ce-icon title="展开详情" class="ce-table-expand" size="md" ?icon="${isString(c.indexButton) ? c.indexButton : ''}" .svg="${isString(c.indexButton) ? c.indexButton : ExpandDiagonal}"></ce-icon>`)}
                        
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
          <div style="position: absolute;top:0;left:0;pointer-events:none;z-index: 1;">
            <slot name="overlay"></slot>
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
      ${ifTrue(this.showEditableExtras, () => h`
        <ce-menu round="false" items="[]" theme="light" radio-style="check" @select="${this.onSelectOption}"></ce-menu>
        <ce-alert></ce-alert>
      `)}
    </div>
    `;
  }
  /**
   * 编辑态附加节点的 4 个事件入口 —— 基类只给**不变量桩**，由 `Editable` 覆盖为真实实现。
   *
   * 为什么放在基类：这些 handler 必须写在渲染它们的那棵模板所属的类里
   * （编译器只为「本类模板」生成 fx；子模板 fx 的接收者是**运行时实例** `rc`，
   * 故 `ce-editable` 实例会解析到 `Editable` 的覆盖版本）。桩存在的意义是
   * 让 `@click`/`@input`/`@close`/`@select` 的点位在编译期可解析、
   * 且万一 `showEditableExtras` 被外部打开也不至于抛 TypeError。
   */
  onClickCaret(_e: Event) { }
  onInput(_ev: Event) { }
  onCloseTip(_e: Event) { }
  onSelectOption(_obj: Record<string, any>) { }
  /**
   * ⚠️ `shouldUpdate` / `updated` 已从 compelem 移除（0.31）。
   *
   * 原因：signal 架构下更新单位是 effect，不存在「组件更新完了」这个时刻，也没有可 diff 的
   * 依赖集可供组装 `changed` —— 两个钩子只挂在已删除的组件级 render pass 上。
   * 替代物：数据响应 `@watch('field')`；「DOM 已落盘」用 `afterUpdate()`；
   * 条件闸门把逻辑放进 `@computed`（`untrack` 掉依赖即不订阅）或用 `ifElse` 包子树。
   *
   * 本组件原两处覆盖的迁移结论（此前 2026-10-09 实测 + A/B 复现）：
   * 1. `shouldUpdate(changed)` 的两个 veto 分支依赖 `changed.fixedLeftColumns` /
   *    `changed.vCachedRows`，而 `changed` 恒为 `{}` ⇒ 两分支永不进入 ⇒ 恒 true，纯空转；
   *    且 `Editable` 的同名覆盖 `every(changed, k => k.includes('scrollColumns'))` 在 `{}`
   *    上恒 true ⇒ 恒返回 false ⇒ 它的 `forceUpdate()` 早就是永久 no-op。均随钩子删除。
   * 2. `updated()` 消费的 `#updateView` 早改成由 `resetVirtualList()` 显式调
   *    `#applyViewUpdate()` 消费（那里同时量表体高度，是天然的重置出口）；此处仅剩
   *    「被外部 `forceUpdate()` 时补做一次」的兜底，而 `forceUpdate()` 本身已无条件化，
   *    钩子移除后该兜底由 `afterUpdate()` 承担（如仍需要，可在 forceUpdate 后显式调用）。
   */
  /**
   * 虚拟列表重置后的**延迟补填**：重算滚动边界 → 重新定位并填充可见行 →
   * 刷新数据（`__fillCells` 会给行打 `available` 标）→ 更新滚动指示 → 刷新汇总。
   *
   * 调用前提：`this.vList` 已由 `onListReady() → initV()` 赋好（见 `#applyViewUpdate` 的
   * 唯一调用点 `resetVirtualList`，它紧跟在 `onListReady()` 之后）。
   */
  #applyViewUpdate(sync = false) {
    const run = () => {
      // this.scroller.calcBounding()
      (this.scroller as any).calcBounding_$__()

      //1. 滚动到指定位置
      const win = this.__currentColWindow()
      this.scrollV(this.scroller.y, (rowEl, rowIndex) => {
        if (rowIndex < 0 || rowIndex >= this.renderList.length) return;
        rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')
        rowEl.firstElementChild?.setAttribute('data-row-sn', rowIndex + 1 + '')

        //填充行数据
        this._fillRow(rowEl as any, rowIndex, win)
      })
      //2. 刷新数据，不更新位置。树展开这轮走同步填充，内容与几何重排同帧完成。
      if (this.#treeAnimUrgent) {
        this.#treeAnimUrgent = false
        this.#treeAnimConsume = true
        this.__fillCellsNow()
      } else {
        this.__fillCells()
      }
      //3. scrolledV更新
      if (this.renderList.length <= this.vViewRows) {
        this.scrolledV = this.scrolledEndV = false
      } else {
        this.scrolledV = this.scroller.y > 0;
        this.scrolledEndV = this.scroller.y < this.scroller.totalLen
      }

      //4. 更新汇总
      if (this.showFooter)
        this.TableConfigPane?.onStat(this)

      // ⭐ 修正 `--table-body-height` 恒为 0 的根因：
      // `resetVirtualList()` 在顶部量的 `tableBody.offsetHeight` 是**行填充之前**的值（填充发生在本回调
      // 的 `__fillCells()` 之后、`setTimeout(0)` 此刻已 reflow），空表体高度为 0；
      // 而基础用法 `<ce-table>` 不设高度、`--table-height` 兜底 `100%` 相对 auto 父解析成 `auto`，
      // `.ce-table-body{flex:1}` 在空内容时高度必为 0 ⇒ 首次测量恒为 0 且之后无二次测量
      // ⇒ `--table-body-height:0px` ⇒ `getFullViewStyle` 的 `max-height:calc(0/2)=0` 把点击展开框压扁。
      // 此处行已填充且已 reflow，量到的是真实表体高度，写入 state 即刷新 `--table-body-height`。
      // 固定高度示例在 `resetVirtualList` 顶部已量到真实值，这里同值不触发重复写入。
      let bh = this.tableBody?.offsetHeight ?? 0
      if (this.tableBodyHeight !== bh) this.tableBodyHeight = bh
    }
    // 树展开这轮已在调度器的超时里让出一帧，这里同帧完成，不再叠第二次超时
    if (sync) run()
    else setTimeout(run, 0)
  }
  /**
   * `#applyViewUpdate()` 的**去重调度器**。
   *
   * `onListReady()` 在首屏会被触发很多次（模板重建 wrapper 的每一批 mutate、
   * `resetVirtualList()` 的重置……实测首屏约 20 次），每次都直接排一个 `setTimeout`
   * 会白跑十几轮 `calcBounding` / `scrollV` / `onStat`。
   * 这里用一个「同一次任务循环内只排一个」的闩：
   * 重活本身（`__fillCells`）另有 `@debounced(100)` 兜底，这里只是省掉多余的定时器。
   */
  #viewUpdatePending = false
  #scheduleViewUpdate() {
    if (this.#viewUpdatePending) return
    this.#viewUpdatePending = true
    setTimeout(() => {
      this.#viewUpdatePending = false
      if (!this.vList) return
      this.#updateView = false
      // 树展开/折叠这轮：本超时已经让出了一帧（`refreshRenderSeed` 触发的模板重建
      // 与 `initV()` 都已落地），紧接着的填充与几何重排同帧完成，让 FLIP 尽快起步。
      this.#applyViewUpdate(this.#treeAnimUrgent)
    }, 0)
  }
  __updatableStyleColumn!: CSSStyleSheet | null;
  __updatableStyleRow!: CSSStyleSheet | null;
  __updatableStyleInvisible!: CSSStyleSheet | null;
  __updatableStyleScrollColumn!: CSSStyleSheet | null;
  __updatableStyleSelected!: CSSStyleSheet | null;
  __updatableFullView!: CSSStyleSheet | null;
  __updatableFillColor!: CSSStyleSheet | null;
  /**
   * 插入本实例独占的样式表。
   *
   * `insertStyleSheet(css`${...}`)` 会按模板调用点缓存同一张 `CSSStyleSheet`
   * （`CssStyleSheetCacheMap` 以 `strings` 为键），同页所有 `ce-table` 实例共用一张；
   * 任一实例随后 `replaceSync` 都会改写其他实例的规则。逐实例变化的声明（列宽、
   * 行样式、冻结列配色等）必须自建表。
   */
  __insertOwnSheet(cssText: string | { getCssText(): string }) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(typeof cssText === 'string' ? cssText : cssText.getCssText())
    return this.insertStyleSheet(sheet)
  }
  beforeMount(): void {
    //不更新
    this.__insertOwnSheet(css`
      .ce-table-body .ce-table-column-fixed,
      .ce-table-head .ce-table-column-fixed{
        ${CssHelper.getCssText(this.fixedStyle)}
      }
    `)
    this.__insertOwnSheet(this.getColumnLinkStyle(this.columnLinkStyle))
    //更新
    this.__updatableStyleRow = this.__insertOwnSheet(css`${this.getRowStyle(this.colStyle, this.rowStyle, this.rowKeyStyle)}`)
    this.__updatableStyleInvisible = this.__insertOwnSheet(css`${this.getInvisibleStyle(this.invisibleFields)}`)
    this.__updatableStyleScrollColumn = this.__insertOwnSheet(
      css`
        ::slotted(ce-column[prop="${this.lastScrollColumnProp}"]),
        .ce-table-foot ::slotted(ce-column-foot[prop="${this.lastScrollColumnProp}"]),
        .v-wrapper .ce-table-column-scroll .ce-table-cell[column="${this.lastScrollColumnProp}"]{
          border-right: 0 !important;
        }
      `
    )
    this.__updatableStyleSelected = this.__insertOwnSheet(
      css`.ce-table-body-container .ce-table-row[data-row-index="${this.currentRowIndex}"] .ce-table-column-scroll .ce-table-cell,
        .ce-table-body-container .ce-table-row[data-row-index="${this.currentRowIndex}"] .ce-table-column-fixed .ce-table-cell{
          ${this.highlightCurrentRow ? 'background-color: var(--table-color-highlight) !important;' : ''}
        }
        ${this.startSelectedCellCss}
      `
    )
    this.__updatableStyleSpan = this.__insertOwnSheet(css`${this.__getSpanCellStyle()}`)
    this.__updatableFullView = this.__insertOwnSheet(css`${this.getFullViewStyle('', -1)}`)
    this.__updatableFillColor = this.__insertOwnSheet(css`${this.__getFillColorStyle()}`)

    //scroller track
    // ⚠️ `scrollerWidth > 0` 才追加「滚动条占位列」(`__scroller`，fixed-right，
    //    背景不透明)。它只在最右侧为**纵向滚动条**预留一条 `scrollerWidth` 宽的
    //    槽位 —— 宽度恒为 `scrollerWidth`，且**覆盖**在 `.ce-table-column-scroll`
    //    之上（fixed 列）。当表格宽度恰好 = Σ列宽（如报表预览：块宽 = Σ列宽、
    //    无内部滚动）时，这条不透明的占位列会盖住最后一列右侧 `scrollerWidth`
    //    像素 ⇒ 数字被裁。
    //    故 `scrollerWidth <= 0` 时**完全不建**占位列：无 fixed-right 区域、
    //    无覆盖、无那条左边线。调用方（如只读的报表预览，永不纵向滚动）据此关闭。
    if (this.scrollerWidth > 0) {
      const scrollerCol = this.__scrollerCol = new Column({ prop: '__scroller', resizable: false, fixed: "right", width: this.scrollerWidth, minWidth: this.scrollerWidth, lastColumn: true })
      this.appendChild(scrollerCol)
    }
  }
  onHeaderFirstResize() {
    this.updateV(size(this.renderList), this.tableBody.offsetHeight, false, true)
  }
  mounted(): void {
    let fontSize = parseFloat(window.getComputedStyle(this).fontSize)
    this.__fontSize = fontSize
    // ⭐ rowHeight prop（文档写明「行高，默认为字体大小*2」）此前声明但从未被读取（装饰器债），
    //   行高只有 _setRowHeightType 的三档（Compact 会被 mounted 强制设入，36px 兜底）。
    //   现在尊重显式数值：**先走完整的 Compact 设定（保留全部副作用）**，
    //   再把 vRowHeight 覆写为显式值 —— 不能跳过 _setRowHeightType：
    //   实测跳过它会让虚拟列表首填不发生（行结构建不出来，表格永久空置，A/B 已证）。
    //   行高必须走 vRowHeight（虚拟列表按它计算），纯 CSS 改行高会造成行内容与
    //   虚拟列表定位错位。
    this._setRowHeightType(RowHeightType.Compact)
    if (this.rowHeight > 0) {
      this.__rowHeightType = 'custom'
      this.syncVRowHeight()
    }

    this.onkeydown = this.onGlobalKeydown.bind(this)
    if (!this.TableConfigPane) {
      this.TableConfigPane = new ColumnConfigPane()
      document.body.appendChild(this.TableConfigPane)
    }
  }
  /**
   * 回收 `mounted()` 挂到 body 上的配置面板。
   *
   * 面板不在 Table 的 shadow 树里，`CompElem#__finalize` 的 `DomUtil.clear(#shadow)`
   * 收不到它 ⇒ 不显式销毁就会每实例留一个（L-01：12 次 create/destroy 后残留 12 个）。
   * `__finalize` 自带 `this.remove()`，所以这里只调 `destroy()`，不要再 remove 一次。
   *
   * 用 `destroyed()` 而非 `beforeDestroyed()`：本类有 `@debounced`（`:1767`），
   * 编译器会把它的清理注入成一个**新的** `beforeDestroyed()`，手写同名方法会被整段盖掉
   * （同 `Scroller.ts:154-160` 的记录）。
   */
  destroyed(): void {
    this.TableConfigPane?.destroy()
    this.TableConfigPane = null!
  }
  /**
   * ⭐ 这里**不能**加 `@debounced`。
   *
   * 全框架只有一个槽变化入口：`CompElem#onSlotChange` → `this.slotChange(slot, name)`；
   * 而 `@debounced` 的实现是「每实例一个共享的防抖函数」（`debounced.ts` 里
   * `set(component, fieldName, debounce(guard, wait))`）⇒ **同一防抖窗口内多个槽的
   * slotchange 会被合并成一次调用，且只保留最后一次的参数**。
   *
   * 一旦最后一次来自命名槽（`overlay` / `--foot` / `--fixed-*`），下面的 `!name`
   * 守卫就会命中并把列登记整个跳过 ⇒ `_columnMetaMap` / `_fieldMap` / `allColumns`
   * 永远为空 ⇒ 表头（slot 投影）照常显示、**表体永久空白**，且不再有任何后续事件
   * 能把状态救回来。
   *
   * 实测触发条件：`<ce-editable>` / `<ce-table>` 里投影了 `slot="overlay"` 的浮层
   * （见 `Table.render()` 的 `<div style="position:absolute…"><slot name="overlay">`）。
   * 时间线：`[ce-editable] t=414ms 事件2次 槽名=[(default), overlay] ⇒ 防抖后仅保留
   * 最后参数: overlay`。
   *
   * 本方法体只是一次判空，开销可忽略；重活交给同样 `@debounced(100)` 的
   * `_appendColumn()` 去合并。
   */
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
      // 销毁迟到回调守卫：`beforeDestroyed` 会把编译期生成的防抖版
      // `_updateScrollWidth` 置 null（见 debounced 编译产物），此处 400ms 定时器
      // 可能晚于销毁触发 ⇒ 直接调用会抛 "is not a function"。
      if (this.isDestroyed) return
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

      this.emit(TableEvents.Scroll, this.__scrollPayload(to, direction, edge))

      //preventDefault()
      this.bodyCon.scrollLeft = 0
      // ⚠️⚠️ 上面那句**归零对象不对**，它自己的 `scrollLeft` 本来就是 0。
      //    真正被原生滚走的是 `ce-scroller` 内部的 `.ce-scroller-content-wrapper`
      //    （`overflow:hidden` 只挡用户，JS 写 `scrollLeft` 照样生效），而
      //    `.ce-table-body-container`（**行号槽、固定列**都在里面）正好在它内部；
      //    外边那圈 `.ce-table-column-scroll` 又做了 `translateX(paddingLeft - to)`。
      //    ⇒ 行号槽只承担"原生"那一份、数据列承担"原生 + transform"两份，相对错位 `to` px；
      //      表头/表尾在 wrapper 之外（锚在 `position:relative` 的 `.ce-table` 上）⇒ 看着反而正常。
      //    （2026-09-17 实测 to=240：行号槽左缘 270→30、首列左缘 300→-180，行号被拖出视野）
      // ⚠️ 必须**排队到微任务**再清：`Scroller.moveThumb` 是先 `emit('scroll')`（→ 走到这里）
      //    再写 `contentWrapper.scrollLeft = to`，此刻它还没被写、读到的还是旧值
      //    （首次触发时恒为 0），同步清等于没清。
      const cw = this.scroller?.contentWrapper
      if (cw) queueMicrotask(() => { if (cw.scrollLeft) cw.scrollLeft = 0 })
      // ⚠️ 表头隐藏时不能拿 `tableHead` 当同步源（见 __scrollLeft 注释）：
      //    display:none 元素的 scrollLeft 恒为 0，写进去也读不出来。
      if (this.showHeader) this.tableHead.scrollLeft = to

      let corrected = this.__scrollLeft >> 0

      this.tableFoot.scrollLeft = corrected

      this.__vRowScrollElList && this.__vRowScrollElList.forEach(rowEl => {
        rowEl.style!.transform = `translateX(${this.paddingLeft - corrected}px)`
      })

      // 横向滚进来的列要补数据（窗口外的格子留着上一轮的值）
      this.__syncColWindow()

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
      const prevYTo = this.__lastYTo
      this.__lastYTo = to;

      this.emit(TableEvents.Scroll, this.__scrollPayload(to, direction, edge))

      // 整个回收轮回用同一份窗口，避免每行重算一次
      const win = this.__currentColWindow()
      // 甩动降级：一步跨太多行时先只重定位（保结构、不露白），数据留给
      // `onScrollEnd` 补。拖动过程的帧预算被这一步的填充量决定，甩动时把填充
      // 挪出热路径，代价是停下瞬间补一次的耗时。
      const rowH = (this.vRowHeight + this.vRowGap) || 1
      const snap = this.optimizeRender && !this.__noSnap && Math.abs(to - prevYTo) > SNAP_FILL_ROWS * rowH
      if (snap) this.__snapPending = true
      this.scrollV(to, (rowEl, rowIndex) => {
        if (rowIndex < 0 || rowIndex >= this.renderList.length) return;
        rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')
        rowEl.firstElementChild?.setAttribute('data-row-sn', rowIndex + 1 + '')

        if (snap) return
        //填充行数据
        this._fillRow(rowEl as any, rowIndex, win)
      })
    }
  }
  /**
   * `scroll` 事件载荷。
   *
   * 为什么要在 Table 上补这个公开事件（而不是让宿主去监听内部 `ce-scroller`）：
   *  - `ce-scroller` 藏在 Table 的 **shadowRoot** 里，宿主只能靠 `el.shadowRoot.querySelector`
   *    或穿越 `composedPath` 才能碰到，属于内部实现细节，换实现即碎；
   *  - 已有事件里 `scrolledge` 只在触边时发一次、`scrollend` 是 200ms 防抖的"停止滚动"，
   *    都不是"滚动过程中"的连续信号；
   *  - 而 `overlay` 插槽的消费方（自定义覆盖层）与滚动内容不是同一棵子树：
   *    纵向靠 `contentWrapper` 原生滚动尚能跟随，**横向**却是
   *    `rowEl.style.transform = translateX(...)`（见上面 h 分支）——浮层不会跟着动，
   *    行回收（虚拟列表）与可视范围也会变，必须有一个"滚动中"的通知来重算。
   */
  __scrollPayload(to: number, direction: string, edge: string) {
    return {
      to,
      direction,
      edge,
      x: this.scroller?.x ?? 0,
      y: this.scroller?.y ?? 0
    }
  }
  onScrollEnd(obj: Record<string, any>) {
    if (this.__snapPending) {
      this.__snapPending = false
      // 甩动期间只有位置是对的，内容还停在上一次填充的值
      this.__fillCellsNow()
    }
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
    // 本方法由 `@mutate.child.debounce:100`（MutationObserver + 100ms 防抖）驱动，可能是
    // 销毁后才到达的迟到回调：此时 `this.allColumns` 里的 Column 代理已不可读
    // （`Reflect.get called on non-object`）。销毁落定后 isMounted 为 false；
    // 离场动画的 freeze 窗口里 isMounted 仍为 true（shadow 未拆），靠 isDestroyed 挡掉。
    if (!this.isMounted || this.isDestroyed) return;

    (this.scroller as any).calcBounding_$__()

    // `__lastHeight` 是 `onResize()` 判断"容器高度真的变了"的基线。行池就绪时
    // 布局已定，在这里同步；只靠 `onResize()` 自己写会让基线停在 0，首次 resize
    // （即使只是宽度变化，例如弹窗给 body 补 `padding-right` 收起滚动条）会被
    // 判成高度突变 >5 而整表重填一次。
    const bodyHeight = this.tableBody?.offsetHeight ?? 0
    if (bodyHeight > 0) this.__lastHeight = bodyHeight

    let vList = Array.from<HTMLElement>(this.bodyCon.querySelectorAll('.ce-table-v-wrapper'))
    if (this.vList && this.vCachedRows != this.vList.length && this.vCachedRows != vList.length) {
      vList = Array.from<HTMLElement>(this.bodyCon.querySelectorAll('.ce-table-v-wrapper[' + AVAILABLE_ROW_TAG + ']'))
    }
    let corrected = this.__scrollLeft >> 0
    this.__vRowScrollElList = map(vList, el => {
      let sel = el.querySelector('.ce-table-column-scroll')
      sel.style!.transform = `translateX(${this.paddingLeft - corrected}px)`
      return sel
    })

    if (!this._isReady) {
      this._isReady = true
      // 就绪后补一次横向宽度测量：表头隐藏时宽度只能从**表体行**量，而表体行正是
      // 此刻才建好的（此前 _updateScrollWidth 都被 `!_isReady` 早退挡掉了）。
      this._updateScrollWidth()
      this.__onReady()
    }

    this.initV(vList, this.scroller.y, (row, rowIndex) => {
      let rowChild = row.firstElementChild as HTMLElement

      //初始化模板组件
      this.allColumns.forEach(c => {
        // 缺口⑲之二：列的销毁可能**先于**表格本身（快速重建时子组件先销毁），
        // 此时读 `c.prop` 会打在已失效的代理上（Reflect.get called on non-object）。
        // 这类迟到渲染（onListReady 的 MutationObserver 防抖、样式重算）必须跳过死列。
        if (c.isDestroyed) return
        if (c.type === ColumnType.Index || c.type === ColumnType.Selection) return
        if (c.dataType === DataType.Tag) return
        if (c.dataType === DataType.User) return
        if (c.dataType === DataType.Image) return
        let colEl = this._fieldMap.get(c.prop)
        // 缺口⑲之三（实测定位）：`_fieldMap` 里可能残留**已销毁**的 `ce-column`。
        // 列的销毁先于表格、或 _fieldMap 尚未重建时，`colEl.slots` 会打在
        // 失效代理上 → `Reflect.get called on non-object`
        // （M5 换报表：8 列 → 6 列，两条被移除的列即为死列）。
        if (colEl?.isDestroyed) return
        let cellTmpls = colEl?.slots?.cell!
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
            content.classList.add('has-cell-slot')
            content.appendChild(fragment)
          }
        }
      })

      rowChild.dataset.rowIndex = rowIndex + ''
      rowChild.dataset.rowSn = rowIndex + 1 + ''
    })

    this.nextTick(() => {
      // vPillar 来自 @query('#vpillar')，**可能取不到**：该访问器会被实例上的同名
      // 自有属性遮蔽（见 mixins/Virtualized.ts 的无初始化器字段声明），且首帧 mutate
      // 早于模板插入时也解析不到。无守卫时会抛未捕获 TypeError（实测 ce-editable 4/4 必现），
      // 并且**中断后续 ready 流程**（scroller.reposition 不再执行）。这里只做「有就设」。
      if (this.vPillar) {
        this.vPillar.style.height = this.vScrollHeight + 'px'
      }
      this.scroller.reposition()
    })

    this.headerRowHeight = this.tableHead.clientHeight

    if (this.showFooter)
      this.TableConfigPane?.onStat(this)

    this.#scheduleUpdateLastColProp()

    // ⭐ 虚拟列表 DOM 就绪 ⇒ 调度补填（`__fillCells` 给行打 `available` 标）。
    //    0.31 起这一步**必须**显式驱动：`updated()` 只在 `forceUpdate()` 时触发，
    //    「置 `#updateView` 等下一次重渲染」的老路已断（详见 `updated()` 上方注释）。
    //    放在本方法末尾是因为这里是「wrapper 集合刚被 (重)建好」的唯一汇聚点：
    //    两个驱动源（`resetVirtualList()` 与 `@mutate.child.debounce:100`）都经过它，
    //    且此处的 `initV()` 已把 `this.vList` 赋好。
    this.#scheduleViewUpdate()
  }
  //------------------ 可继承接口
  onMouseDownHeader(e: MouseEvent) {
  }
  /** 最近一次按下的指针 id，选区拖拽用它建立指针捕获（`mousedown` 本身不带 pointerId） */
  __bodyPointerId = -1
  onBodyPointerDown(e: PointerEvent) {
    this.__bodyPointerId = e.pointerId
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
  /** 读取动画时长与曲线，宿主可通过 CSS 变量覆盖。 */
  __treeAnimConfig() {
    let ms = TREE_ANIM_FALLBACK_MS
    let easing = TREE_ANIM_FALLBACK_EASING
    const cs = getComputedStyle(this)
    const raw = cs.getPropertyValue('--ce-table-tree-duration').trim()
      || cs.getPropertyValue('--ce-list-transition-duration').trim()
    if (raw) ms = parseCssTime(raw)
    easing = cs.getPropertyValue('--ce-table-tree-easing').trim()
      || cs.getPropertyValue('--ce-list-transition-timing-function').trim()
      || easing
    return { ms, easing }
  }

  /** 开启本轮展开的 CSS 过渡门控，时长结束后自动撤除。 */
  __armTreeAnimClass(ms: number) {
    this.setAttribute('data-tree-anim', '')
    if (this.#treeAnimClassTimer) clearTimeout(this.#treeAnimClassTimer)
    this.#treeAnimClassTimer = setTimeout(() => {
      this.#treeAnimClassTimer = null
      this.removeAttribute('data-tree-anim')
    }, ms + 80)
    // 先让 caret 的 transition 声明进入 computed style，紧接着的类切换才会触发过渡
    const caret = this.shadowRoot?.querySelector('.ce-table-caret')
    if (caret) void getComputedStyle(caret).transitionProperty
  }

  /** 立即撤除门控：滚动回收期间不能残留过渡。 */
  __disarmTreeAnimClass() {
    if (this.#treeAnimClassTimer) {
      clearTimeout(this.#treeAnimClassTimer)
      this.#treeAnimClassTimer = null
    }
    this.removeAttribute('data-tree-anim')
  }

  /** 清掉快照与激活标记，已启动的动画保留到自然结束。 */
  __endTreeAnim() {
    this.#treeAnimActive = false
    this.#treeAnimUrgent = false
    this.#treeAnimConsume = false
    this.#treeAnimSnapshot = null
    if (this.#treeAnimTimer) {
      clearTimeout(this.#treeAnimTimer)
      this.#treeAnimTimer = null
    }
  }

  /** 取消正在进行的树形动画、放弃本轮快照并关闭过渡门控。 */
  __cancelTreeAnim() {
    const list = this.#treeAnims
    this.#treeAnims = []
    for (const a of list) {
      try { a.cancel() } catch { /* 动画可能已结束 */ }
    }
    this.__disarmTreeAnimClass()
    this.__endTreeAnim()
  }

  /** 切换展开态之前，记录当前可见行的 `data-row-key` 与定位 Y。 */
  __captureTreeAnim() {
    this.__cancelTreeAnim()
    if (!this.vList || !this.isMounted) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cfg = this.__treeAnimConfig()
    if (cfg.ms <= 0) return
    this.#treeAnimDurationMs = cfg.ms
    this.#treeAnimEasing = cfg.easing
    const snap = new Map<string, number>()
    for (const el of this.vList) {
      if (!el.hasAttribute(AVAILABLE_ROW_TAG)) continue
      const key = el.getAttribute('data-row-key')
      if (!key) continue
      snap.set(key, readRowY(el))
    }
    this.#treeAnimSnapshot = snap
    this.#treeAnimUrgent = true
    this.__armTreeAnimClass(cfg.ms)
    this.#treeAnimTimer = setTimeout(() => this.__endTreeAnim(), TREE_ANIM_SNAPSHOT_TTL)
  }

  /**
   * 重填一行时提交动画：快照里有的行按 `data-row-key` 做 FLIP 位移，
   * 快照里没有的行（展开新增的子行）淡入下滑。
   */
  __playTreeRowAnim(row: HTMLElement, rowId: string) {
    const snap = this.#treeAnimSnapshot
    if (!snap) return
    const newY = readRowY(row)
    const oldY = snap.get(rowId)
    const opts: KeyframeAnimationOptions = {
      duration: this.#treeAnimDurationMs,
      easing: this.#treeAnimEasing
    }
    let anim: Animation | null = null
    if (oldY != null && Math.abs(oldY - newY) > 0.5) {
      anim = row.animate([
        { transform: `translateY(${oldY}px)` },
        { transform: `translateY(${newY}px)` }
      ], opts)
    } else if (oldY == null) {
      const inner = row.firstElementChild as HTMLElement | null
      if (inner) anim = inner.animate([
        { opacity: 0, transform: 'translateY(-8px)' },
        { opacity: 1, transform: 'none' }
      ], opts)
    }
    if (!anim) return
    const a = anim
    this.#treeAnims = [...this.#treeAnims, a]
    const drop = () => { this.#treeAnims = this.#treeAnims.filter(x => x !== a) }
    a.onfinish = drop
    a.oncancel = drop
  }

  /**
   * caret 的图标旋转与缩进过渡，和行 FLIP 同帧启动。
   *
   * 时长与曲线复用 `#treeAnimDurationMs/#treeAnimEasing`，动画实例进同一条
   * `#treeAnims`，滚动取消时一并 `cancel()`。`from*` 是切换前读到的值：
   * 类与 `data-level` 已经写入，目标值只能从 computed style 现读。
   */
  __playCaretAnim(caret: HTMLElement, icon: HTMLElement, fromTransform: string, fromPadding: string) {
    const opts: KeyframeAnimationOptions = {
      duration: this.#treeAnimDurationMs,
      easing: this.#treeAnimEasing
    }
    const toTransform = getComputedStyle(icon).transform
    const toPadding = getComputedStyle(caret).paddingLeft
    const list: Animation[] = []
    if (fromTransform && fromTransform !== toTransform) {
      list.push(icon.animate([{ transform: fromTransform }, { transform: toTransform }], opts))
    }
    if (fromPadding && fromPadding !== toPadding) {
      list.push(caret.animate([{ paddingLeft: fromPadding }, { paddingLeft: toPadding }], opts))
    }
    for (const a of list) {
      this.#treeAnims = [...this.#treeAnims, a]
      const drop = () => { this.#treeAnims = this.#treeAnims.filter(x => x !== a) }
      a.onfinish = drop
      a.oncancel = drop
    }
  }

  /**
   * 点击 caret 的入口：先取快照，再交给 `super` 更新展开态。
   *
   * 展开态类不在这里就地切换 —— `_fillRow()` 每次填充都会按 `expandedIdMap`
   * 写回 caret 的 `is-expanded`（见树列分支），而那批填充与 FLIP 同一帧开始。
   * 抢在这里切会让图标先转完再去等行位移（实测展开领先 64ms、折叠领先 70ms）。
   * 没有动画窗口时（reduced-motion、时长为 0、行池未就绪）走原就地切换，
   * 保证点击即时响应。
   */
  toggleExpand(node: Element) {
    this.__captureTreeAnim()
    if (!this.#treeAnimSnapshot) {
      const caret = node.closest('.ce-table-caret')
      if (caret) caret.classList.toggle(CLASS_EXPAND, !caret.classList.contains(CLASS_EXPAND))
    }
    super.toggleExpand(node)
  }

  /**
   * 树展开/折叠这轮的重排入口：跳过 mixin 的 20ms 等待与 `resetVirtualList()`
   * 的 50ms 防抖，只让出一帧给 `refreshRenderSeed` 触发的模板重建。
   *
   * 那两级延迟叠起来是点击到动画起步之间的 ~90ms 空窗 —— 图标已经不再抢跑，
   * 空窗就整个落在手感上（点击后先卡一下再动）。填充与汇总由
   * `__resetVirtualListNow() → onListReady() → #applyViewUpdate()` 完成，
   * 这里不再调 `refreshView()`，省一轮重复的 `@debounced(100)` 全表填充。
   * 没有动画窗口时（快照为空）仍走默认延迟路径，与不带树的表格一致。
   */
  __scheduleExpandRefresh() {
    if (!this.#treeAnimSnapshot) {
      super.__scheduleExpandRefresh()
      return
    }
    setTimeout(() => this.__resetVirtualListNow(), 0)
  }

  /**
   * 用户滚动时撤除本轮树动画：行池复用不能沿用展开的固定 keyframes 与过渡。
   * `#treeAnimUrgent` 期间是展开/折叠引起的重排 —— vPillar 高度变化会让
   * `scroller.y` 被 clamp 或出现亚像素抖动，这次 scrollV 必须放行，否则折叠的
   * FLIP 会被整轮取消。1px 容差用于过滤 scroller.y 的浮点噪声。
   */
  scrollV(scrollTop: number, cbk: (rowEl: HTMLElement, rowIndex: number) => void) {
    const moved = Math.abs(scrollTop - this.__vLastScrollTop) > 1
    if (!this.#treeAnimUrgent && moved &&
      (this.#treeAnimSnapshot || this.#treeAnims.length || this.hasAttribute('data-tree-anim'))) {
      this.__cancelTreeAnim()
    }
    super.scrollV(scrollTop, cbk)
  }

  onClickBody(e: Event, cancelFullView = false) {
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
        if (!cancelFullView && contentEl && contentEl.clientWidth !== contentEl.scrollWidth) {
          this.#applyFullViewStyle(prop!, rowIndex)
        } else {
          this.#applyFullViewStyle('', -1)
        }
      }
    }
  }
  //////////////////////////////////// css
  getColumnWidthCss() {
    let colStyles = ''
    this.allColumns.forEach(c => {
      // 缺口⑲之二：列的销毁可能**先于**表格本身（快速重建时子组件先销毁），
      // 此时读 `c.prop` 会打在已失效的代理上（Reflect.get called on non-object）。
      // 这类迟到渲染（onListReady 的 MutationObserver 防抖、样式重算）必须跳过死列。
      if (c.isDestroyed) return
      let co = this._fieldMap.get(c.prop)
      if (co) {
        // min-width:var(--column-min-width-${kebabCase(c.prop.replaceAll('.', '-'))});
        colStyles += `
        .ce-table-cell[column="${c.prop}"]{
          width:var(--column-width-${kebabCase(c.prop.replaceAll('.', '-'))});
        }
        .ce-table-cell[column="${c.prop}"] .ce-table-cell-content{
          text-align: var(--column-align-${kebabCase(c.prop.replaceAll('.', '-'))});
          [name="tags"]{
            justify-content: var(--column-align-justify-${kebabCase(c.prop.replaceAll('.', '-'))});
          }
          [name="text"]{
            align-items: var(--column-valign-${kebabCase(c.prop.replaceAll('.', '-'))}, center);
          }
        }
        .ce-table-cell[column="${c.prop}"] .ce-table-cell-content.has-cell-slot{
          display: flex;
          align-items: center;
          justify-content: var(--column-align-flex-${kebabCase(c.prop.replaceAll('.', '-'))}, flex-start);
        }
        .ce-table-cell[column="${c.prop}"] .ce-table-cell-content.has-cell-slot > *{
          flex: 0 1 auto;
          min-width: 0;
          max-width: 100%;
        }
        `
      }
    })

    return colStyles
  }
  getColumnLinkStyle(columnLinkStyle: typeof this.columnLinkStyle) {
    let colLinkStyles = ''
    each(columnLinkStyle, (v, k) => {
      colLinkStyles += `.ce-table-cell[column="${k}"]{
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
      styles += `.ce-table-row .ce-table-cell[column="${prop}"] {
          ${style}
        }
      `
    })
    each(rowStyle, (style, rowIndex) => {
      styles += `.ce-table-row[data-row-index="${rowIndex}"] .ce-table-cell{
            ${style}
          }
        `
    })
    each(rowKeyStyle, (style, rowKey) => {
      styles += `.v-wrapper[data-row-key="${rowKey}"] .ce-table-row .ce-table-cell{
            ${style}
          }
        `
    })
    return styles
  }
  // 展开态样式重算的时序令牌：连续点击不同单元格时，旧的 rAF 重算不得覆盖新样式
  #fvStyleToken = 0
  /**
   * 应用 clickView 展开态样式（含固定列 clip-path 裁剪）。
   * 展开本身可能引发纵向滚动条 ⇒ 行宽变窄、固定列边界左移，而 getFullViewStyle 的
   * clip-path 是按调用瞬间几何算的 ⇒ 下一帧按新几何重算一次（令牌防旧帧覆盖新帧）。
   */
  #applyFullViewStyle(prop: string, rowIndex: number) {
    this.#fvStyleToken++
    const token = this.#fvStyleToken
    this.__updatableFullView?.replaceSync(this.getFullViewStyle(prop, rowIndex))
    requestAnimationFrame(() => {
      if (this.isDestroyed || token !== this.#fvStyleToken) return
      this.__updatableFullView?.replaceSync(this.getFullViewStyle(prop, rowIndex))
    })
  }
  getFullViewStyle(prop: string, rowIndex: number) {
    // 固定列场景下钳制展开框（clickView 全量展示框）不越过固定列边界：
    // 行的滚动区容器带 transform（横向滚动位移，updateScrollLeft）⇒ 独立层叠上下文（z=auto），
    // 行内 .ce-table-column-fixed（z-index:1）恒压过展开内容 —— 展开框内层 z-index:9 无效，
    // 表现为文字被自己行的固定格拦腰截断；跨行部分（v-wrapper z-index:9）又会盖住
    // 下方行的固定列区域。z-index 无法修复（上下文陷阱），只能按固定列几何对
    // 展开单元格做 clip-path 裁剪。裁剪基准取展开瞬间的滚动位置；展开态下继续
    // 横向滚动裁剪线不再跟随（原行为是整个被切花，可接受）。
    let clipCss = ''
    if (rowIndex >= 0 && prop) {
      const row = this.bodyCon?.querySelector<HTMLElement>(`.ce-table-v-wrapper[data-row-index="${rowIndex}"]`)
      const cell = row?.querySelector<HTMLElement>(`.ce-table-cell[column="${prop}"]`)
      const leftFixed = row?.querySelector<HTMLElement>('.ce-table-column-fixed.is-left')
      const rightFixed = row?.querySelector<HTMLElement>('.ce-table-column-fixed.is-right')
      if (row && cell && (leftFixed || rightFixed)) {
        // 几何基准必须用内层 .ce-table-row：v-wrapper 自带 padding-right，
        // 用它算出的右边界会偏大一个 padding，裁剪线越过固定列边界。
        const rowEl = row.querySelector<HTMLElement>('.ce-table-row') ?? row
        const rowRect = rowEl.getBoundingClientRect()
        const cellRect = cell.getBoundingClientRect()
        const winLeft = rowRect.left + (leftFixed?.offsetWidth ?? 0)
        const winRight = rowRect.right - (rightFixed?.offsetWidth ?? 0)
        const clipLeft = Math.max(0, winLeft - cellRect.left)
        const clipRight = Math.max(0, cellRect.right - winRight)
        if (clipLeft > 0 || clipRight > 0) {
          // 上边 0：以单元格顶为界；底边负 inset：允许向下延伸（全量展示的本意）
          clipCss = `clip-path: inset(0 ${clipRight}px -9999px ${clipLeft}px);`
        }
      }
    }
    let styles = `
    .ce-table-body-container .ce-table-v-wrapper[data-row-index="${rowIndex}"]{
      z-index: 9;
    }
    .ce-table-body-container .ce-table-v-wrapper[data-row-index="${rowIndex}"] .ce-table-cell[column="${prop}"]{
      overflow: visible;
      border-left:0 !important;
      border-top:0 !important;
      user-select:auto;
      ${clipCss}
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
      invisibleColStyles += `
        .ce-table-v-wrapper .ce-table-cell[column="${k}"],
        .ce-table-foot ::slotted(ce-column-foot[prop="${k}"]){
          display:none !important;
        }
      `
    })
    return invisibleColStyles
  }
  //////////////////////////////////// methods
  /**
   * 横向滚动内容宽的**测量源**。
   *
   * 原本只量表头（`.ce-table-head .ce-table-column-scroll`）。但表头隐藏时
   * （`showHeader=false`）整个表头是 `display:none` 子树，`offsetWidth` 恒为 0
   * ⇒ `vScrollWidth` 归零 ⇒ 传给 `ce-scroller` 的 `sWidth` 为 0 ⇒ Scroller 回落到
   * `contentWrapper.scrollWidth`（= 容器宽 —— 行的溢出不会算进祖先的 scrollWidth）
   * ⇒ 判定"不需要横向滚动"、横向 thumb 宽度恒为 0
   * （实测：11 列 1152px 塞进 1088px 容器，完全没有横向滚动条）。
   *
   * 此时改从**表体已渲染行**的滚动列容器量 —— 列宽几何与表头同源（都是各列
   * `flex-shrink:0` 的宽度之和）。虚拟列表未建好时取不到行，退化为 0（与旧行为一致）。
   */
  #measureScrollColWidth(): number {
    if (this.showHeader) return this.tableHeadScroll?.offsetWidth ?? 0
    const el = this.bodyCon?.querySelector<HTMLElement>('.ce-table-row .ce-table-column-scroll')
    return el?.offsetWidth ?? 0
  }
  /**
   * 当前横向滚动量。
   *
   * 库统一以**表头**为横向滚动的同步源（`tableHead.scrollLeft`）。表头隐藏时它在
   * `display:none` 子树里，赋值与读取都恒为 0 ⇒ 所有按它换算的行位移归零 ——
   * 就算放出横向滚动条，拖它内容也纹丝不动。此时改读最近一次滚动量（`__lastXTo`）。
   */
  get __scrollLeft(): number {
    if (this.showHeader) return this.tableHead?.scrollLeft ?? 0
    return this.__lastXTo > 0 ? this.__lastXTo : 0
  }
  /**
   * 固定列的横向**占位宽度**（左侧含 `offsetLeft`，右侧只算宽）。
   *
   * 为什么不能只量表头：表头隐藏时（`showHeader=false`，报表预览 / 渲染器就是这么用的）
   * 整个 `.ce-table-head` 在 `display:none` 子树里，`clientWidth` / `offsetLeft` **恒为 0**
   * ⇒ `paddingLeft` 归零 ⇒ 每个数据行的滚动容器 `translateX(0)`，滚动列整段压在
   * 左固定槽（`position:absolute; left:0`）底下。
   *
   * 症状（2026-10-21 用户报障）：预览里前 3 列冻结后，"非固定列的左侧与固定列重叠" ——
   * 表头只剩一列被盖掉一半的文字、数据列整体左移。
   *
   * 表头量不到时**按列宽求和**（不量表体行）：行内的 `.ce-table-column-fixed.is-left`
   * 宽度会被**横向合并**撑开 —— 标题行（`colSpan` 覆盖整表）那一槽实测 1190px（= 整表宽），
   * 拿来当 padding 更糟。列宽才是"固定区该占多宽"的唯一真值（`renderWidth` 就是
   * `--column-width-<prop>` 的来源），隐藏列不占位、与 `display:none` 一致。
   *
   * ⭐⭐⭐ `offsetLeft` **两个分支都要加**（2026-10-27 修）：
   * `offsetLeft` 不只是"固定列自己的位移"，它还包含**行号槽**造成的整体右移 ——
   * `Editable.#syncRowIndicatorGutter()` 插的 `ce-column[__sn]`（表头）与
   * `.ce-table-row::before`（表体）都是 `position:absolute; z-index:1`，**不占 flex 空间**，
   * 而 `editableStyle.scss` 把左固定槽设成 `left: var(--editable-row-indicator-width)` ⇒
   * 槽宽只能通过 `offsetLeft` 体现。
   * 旧实现只在 `clientWidth > 0`（有冻结列）时带它 ⇒ **一列都没冻结**时走求和分支、
   * `offsetLeft = 30` 被整个丢掉 ⇒ `paddingLeft = 0` ⇒ `.ce-table-column-scroll` 的
   * `translateX(0)` 不右移 ⇒ `show-indicator="row"` 的第一列被行号槽压住 30px
   * （报表设计器默认不冻结列，必现；有冻结列时反而正常，所以长期没暴露）。
   * 表头隐藏时 `offsetLeft` 恒为 0 ⇒ 预览 / 渲染器空转，不受影响。
   */
  #measureFixedWidth(side: 'left' | 'right'): number {
    const head = side === 'left' ? this.fixedLeftConHead : this.fixedRightConHead
    // 左侧固定槽的 `offsetLeft` 含行号槽宽度（见上），右侧没有行号槽、不参与
    const off = side === 'left' ? (head?.offsetLeft ?? 0) : 0
    if (head && head.clientWidth > 0) return head.clientWidth + off
    const list = side === 'left' ? this.fixedLeftColumns : this.fixedRightColumns
    let w = 0
    for (const c of list || []) {
      if (!c || c.hidden) continue
      // `__scroller` 占位列没有真实列元素，宽度恒 0（`renderWidth` 未定义）
      w += Number(this._fieldMap.get(c.prop)?.renderWidth ?? c.width) || 0
    }
    return Math.round(w + off)
  }
  @debounced(50)
  _updateScrollWidth() {
    if (!this._isReady) return

    this.paddingLeft = this.#measureFixedWidth('left')
    this.paddingRight = this.#measureFixedWidth('right')
    this.vScrollWidth = Math.floor(this.#measureScrollColWidth()) + this.paddingLeft + this.paddingRight - (this.paddingLeft > 0 || this.paddingRight > 0 ? 1 : 0)

    // let tx = window.getComputedStyle(this.tableHeadScroll).transform.split(',')[4]
    this.__vRowScrollElList && this.__vRowScrollElList.forEach(rowEl => {
      rowEl.style!.transform = `translateX(${this.paddingLeft - this.__scrollLeft}px)`
    })
    this.#invalidateColWindow()
    this.__syncColWindow()
  }
  /**
   * 让列窗口的**几何缓存**失效。列宽、固定列、表体宽度变化后必须调用，
   * 否则窗口会停在旧几何上，新滚到视口里的列拿不到数据。
   *
   * `#colWin` 故意保留：几何变了但算出来的窗口可能没变（例如只改了行高），
   * 留着它就能让 `__syncColWindow()` 直接跳过整轮重填。
   */
  #invalidateColWindow() {
    this.#dematerializeAll()
    this.#scrollIdx = null
    this.#colX = null
    this.#colW = null
    this.#colMeasureFailed = false
  }
  /**
   * 量一次 `scrollColumns` 的几何：每列相对 `.ce-table-column-scroll` 内容盒的左缘与宽度。
   *
   * 容器与格子的 `getBoundingClientRect()` 求差，把容器的
   * `translateX(paddingLeft - scrollLeft)` 抵消掉，得到与滚动位置无关的静态偏移，
   * 因此可以在任意滚动位置测量并长期复用（列宽变化时由 `#invalidateColWindow` 作废）。
   *
   * 只要有一列没物化出格子就整体放弃（列还没建完 / 首帧）：窗口算错会让整片格子空白，
   * 退回全列填充是安全的一侧。
   */
  #measureColX() {
    const con = this.bodyCon?.querySelector<HTMLElement>('.ce-table-row > .ce-table-column-scroll')
    const cols = this.scrollColumns
    if (!con || !cols?.length) return
    const idx = new Map<string, number>()
    cols.forEach((c, i) => idx.set(c.prop, i))
    const xs = new Array<number>(cols.length)
    const ws = new Array<number>(cols.length)
    const base = con.getBoundingClientRect().left
    each(con.querySelectorAll<HTMLElement>('.ce-table-cell'), el => {
      const i = idx.get(el.getAttribute('column') ?? '')
      if (i == null || xs[i] != null) return
      const rect = el.getBoundingClientRect()
      xs[i] = rect.left - base
      ws[i] = rect.width
    })
    for (let i = 0; i < cols.length; i++) {
      if (!(ws[i] > 0)) {
        this.#colMeasureFailed = true
        return
      }
    }
    this.#scrollIdx = idx
    this.#colX = xs
    this.#colW = ws
  }
  /**
   * 当前视口覆盖的 `scrollColumns` 窗口 `[from, to)`，两侧各留 `COL_WINDOW_PAD`。
   *
   * 返回 null 表示不做窗口化、按全列填充：`optimizeRender=false`（打印 / 导出 /
   * 整表截图需要全部格子）、`__legacyFill` / `__noWindow`（压测）、或几何还量不到。
   */
  #computeColWindow(): [number, number] | null {
    if (!this.optimizeRender || this.__legacyFill || this.__noWindow) return null
    if (!this.#colX) {
      if (this.#colMeasureFailed) return null
      this.#measureColX()
      if (!this.#colX) {
        this.#colMeasureFailed = true
        return null
      }
    }
    const xs = this.#colX!
    const ws = this.#colW!
    const viewW = this.bodyCon?.clientWidth ?? 0
    if (viewW <= 0) return null
    const n = xs.length
    const left = this.__scrollLeft - this.paddingLeft - COL_WINDOW_PAD
    const right = left + viewW + COL_WINDOW_PAD * 2
    let from = 0
    while (from < n && xs[from] + ws[from] < left) from++
    let to = from
    while (to < n && xs[to] < right) to++
    if (to <= from) to = Math.min(from + 1, n)
    return [from, to]
  }
  /** 当前窗口；未算过就算一次并缓存（null 也缓存，表示全列填充） */
  __currentColWindow(): [number, number] | null {
    // 开关每次都查：`#colWin` 可能缓存着另一套配置下算出的窗口
    if (!this.optimizeRender || this.__legacyFill || this.__noWindow) {
      this.#colWin = null
      return null
    }
    if (this.#colWin === null) this.#colWin = this.#computeColWindow()
    return this.#colWin
  }
  /**
   * 给窗口外的格子打/清 `.is-col-offscreen` 标记（`content-visibility: hidden`）。
   *
   * 只在窗口变化时整批过一遍（横向滚动一步 ~3000 次 `classList.toggle`，无变化时不产生
   * 变更记录），纵向回收行时不需要动 —— 标记是按列打的，与行的数据无关。
   *
   * `win` 为 null（窗口化关闭）时清掉全部标记。
   */
  __applyColOffscreen(win: [number, number] | null) {
    // 物化模式下窗口外的格子根本不在 DOM 里，没有要标记的对象
    if (this.#matOn) return
    const rows = this.vList
    if (!rows?.length) return
    const on = win != null && !this.__noOffscreen && this.optimizeRender
    // 要打标记就必须有 prop→索引：没有就补量一次，量不到就**保持现状**——
    // 分不出窗口内外时全清会让整表重新解冻，比不改更贵。
    if (on && !this.#scrollIdx) this.#measureColX()
    const idx = this.#scrollIdx
    if (on && !idx) return
    for (const row of rows) {
      const cells = row.querySelectorAll<HTMLElement>('.ce-table-cell')
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]
        const si = idx?.get(cell.getAttribute('column') ?? '')
        cell.classList.toggle(COL_OFFSCREEN_CLASS, on && si != null && (si < win![0] || si >= win![1]))
      }
    }
  }
  /**
   * 结构虚拟化：只让窗口内的列留在 DOM 里。
   *
   * 每行 `.ce-table-column-scroll` 改成显式总宽 + `position: relative`，格子绝对定位到
   * 自己的列偏移 —— 这样摘掉中间几列不会让后面的列往前挤。窗口外的格子挪进
   * `#cellPark`（离屏保留），窗口平移时按需插回。
   *
   * 收益在「行回收要重算整行样式」这一笔：100 列时一行 100 个格子，物化后只剩
   * 视口内那十几列。有横向合并（`__hasSpan`）时不启用 —— 合并块跨出窗口后锚格与
   * 被吞格不在同一棵树里，合并宽度和隐藏都算不出来。
   */
  __applyMaterialize(win: [number, number] | null, prev?: [number, number] | null) {
    const on = win != null && this.optimizeRender && !this.__noWindow && !this.__noMaterialize && !this.__hasSpan
    if (!on) {
      if (this.#matOn) this.#dematerializeAll()
      return
    }
    const rows = this.vList
    if (!rows?.length) return
    if (!this.#scrollIdx) {
      this.#measureColX()
      if (!this.#scrollIdx) return
    }
    const left = this.#colX
    const width = this.#colW
    if (!left || !width) return
    let total = 0
    for (let i = 0; i < left.length; i++) total = Math.max(total, left[i] + width[i])
    if (!(total > 0)) return

    this.#matOn = true
    const shifted = !prev || prev[0] !== win![0] || prev[1] !== win![1]
    const epoch = String(this.#matEpoch)
    const seen = new Set<HTMLElement>()
    let painted = false
    for (const row of rows) {
      const con = row.querySelector<HTMLElement>('.ce-table-column-scroll')
      if (!con) continue
      seen.add(con)
      if (con.dataset.matEpoch !== epoch) {
        this.#materializeRow(con, win!, total, left, width)
        painted = true
      } else if (shifted) {
        this.#syncRowCells(con, win!)
      }
    }
    if (painted || shifted) this.#writeMatSheet(win!, left, width)
    // 行被整体替换后旧容器的池子再也用不到，不清就是纯泄漏
    if (this.#cellPark.size > seen.size) {
      for (const con of Array.from(this.#cellPark.keys())) {
        if (!seen.has(con)) this.#cellPark.delete(con)
      }
    }
  }
  /**
   * 写结构虚拟化的几何样式：窗口内每列一条 `left` + `width` 规则，格子只挂 `data-ci`。
   *
   * 只写窗口内的列 —— 每条规则都要对每个格子做属性匹配，全列写会变成一百多条规则
   * 乘以「格数 × 行数」的匹配量。窗口外的格子不在 DOM 里，规则对它们没有意义。
   *
   * 不能用内联样式替代 —— 宿主 `cellStyle` 通过 `style.cssText` 整串覆盖格子样式，
   * 会把定位一起清掉（表现是整行格子叠在容器左缘）。
   */
  #writeMatSheet(win: [number, number], left: number[], width: number[]) {
    const root = this.renderRoot
    if (!root) return
    if (!this.#matStyleEl) {
      const el = document.createElement('style')
      el.dataset.matSheet = ''
      root.appendChild(el)
      this.#matStyleEl = el
    }
    const rules = [
      '.ce-table-column-scroll[data-mat]{position:relative;display:block;flex-shrink:0}',
      '.ce-table-cell[data-ci]{position:absolute;top:0;height:100%;left:0;width:auto}',
      '.ce-table-cell[data-ci]{border-right:thin solid var(--table-color-border)}'
    ]
    const end = Math.min(win[1], left.length)
    for (let i = win[0]; i < end; i++) {
      rules.push(`.ce-table-cell[data-ci="${i}"]{left:${left[i]}px;width:${width[i]}px}`)
    }
    // 真正的最后一列不留右边框（物化后 `:last-child` 可能是窗口内任意一列）
    rules.push(`.ce-table-cell[data-ci="${left.length - 1}"]{border-right:0}`)
    this.#matStyleEl.textContent = rules.join('\n')
  }
  /** 首次物化一行：定宽容器 + 逐格标列索引 + 摘掉窗口外的格子 */
  #materializeRow(con: HTMLElement, win: [number, number], total: number, left: number[], width: number[]) {
    const idx = this.#scrollIdx!
    con.style.width = total + 'px'
    con.dataset.mat = ''
    const park = new Map<string, HTMLElement>()
    const cells = Array.from(con.querySelectorAll<HTMLElement>('.ce-table-cell'))
    for (const cell of cells) {
      const prop = cell.getAttribute('column') ?? ''
      const i = idx.get(prop)
      if (i == null) continue
      cell.dataset.ci = String(i)
      if (i < win[0] || i >= win[1]) {
        park.set(prop, cell)
        cell.remove()
      }
    }
    con.dataset.matEpoch = String(this.#matEpoch)
    this.#cellPark.set(con, park)
  }
  /** 窗口平移：摘掉移出的、插回移入的。格子位置由绝对定位决定，不用管兄弟顺序 */
  #syncRowCells(con: HTMLElement, win: [number, number]) {
    const idx = this.#scrollIdx
    if (!idx) return
    const park = this.#cellPark.get(con) ?? new Map<string, HTMLElement>()
    this.#cellPark.set(con, park)
    for (const cell of Array.from(con.querySelectorAll<HTMLElement>('.ce-table-cell'))) {
      const i = idx.get(cell.getAttribute('column') ?? '')
      if (i == null) continue
      if (i < win[0] || i >= win[1]) {
        park?.set(cell.getAttribute('column')!, cell)
        cell.remove()
      }
    }
    if (!park.size) return
    park.forEach((cell, prop) => {
      const i = idx.get(prop)
      if (i == null || i < win[0] || i >= win[1]) return
      park.delete(prop)
      con.appendChild(cell)
    })
  }
  /** 结构虚拟化的内部状态快照（调试 / 探针用） */
  __debugMat() {
    return {
      matOn: this.#matOn,
      epoch: this.#matEpoch,
      colX: this.#colX ? this.#colX.slice(0, 6) : null,
      colW: this.#colW ? this.#colW.slice(0, 3) : null,
      colCount: this.#colX?.length ?? null,
      idxSize: this.#scrollIdx?.size ?? null,
      win: this.#colWin,
      failed: this.#colMeasureFailed,
      park: this.#cellPark.size
    }
  }
  /**
   * 退出结构虚拟化：格子全部插回、内联布局样式清空。
   *
   * 必须在 `#scrollIdx` 还有效时调用 —— 插回要按列序排，否则 flex 下整行错位。
   * 排序优先用格子自带的 `data-ci`，它不受几何作废影响。
   */
  #dematerializeAll() {
    if (!this.#matOn) return
    this.#matOn = false
    this.#matEpoch++
    const idx = this.#scrollIdx
    this.#cellPark.forEach((park, con) => {
      con.style.width = ''
      delete con.dataset.mat
      delete con.dataset.matEpoch
      const all = Array.from(con.querySelectorAll<HTMLElement>('.ce-table-cell'))
      park.forEach(cell => all.push(cell))
      const order = (el: HTMLElement) => {
        const i = el.dataset.ci != null ? +el.dataset.ci : idx?.get(el.getAttribute('column') ?? '')
        return i ?? 0
      }
      all.sort((a, b) => order(a) - order(b))
      for (const cell of all) {
        cell.style.position = ''
        cell.style.left = ''
        cell.style.top = ''
        cell.style.width = ''
        cell.style.height = ''
        con.appendChild(cell)
      }
    })
    this.#cellPark.clear()
    this.#matStyleEl?.remove()
    this.#matStyleEl = null
  }
  /**
   * 横向滚动后同步列窗口。
   *
   * 窗口宽度固定（视口 + 两侧缓冲），平移一步只有边缘一截列是新进来的，所以按
   * 「新增区间」补填，成本与一次滚了多远无关。窗口收缩（回去重填过）时不需要补值，
   * 只更新离屏标记。只有窗口从无到有（首帧、开关切换）才整窗填一遍。
   */
  __syncColWindow() {
    const win = this.#computeColWindow()
    if (!win) return
    const old = this.#colWin
    this.#colWin = win
    if (old && old[0] === win[0] && old[1] === win[1]) {
      // 窗口没动，但可能有新行（虚拟列表重建、模板重渲染）还是全列形态
      this.__applyMaterialize(win, old)
      return
    }
    const rows = this.vList
    if (!rows?.length) return
    // 先物化再填：这轮新进入窗口的列此刻还在池子里，`_fillRow` 找不到它们的格子
    this.__applyMaterialize(win, old)
    const ranges: ColRange[] = []
    if (old) {
      if (win[0] < old[0]) ranges.push([win[0], Math.min(win[1], old[0])])
      if (win[1] > old[1]) ranges.push([Math.max(win[0], old[1]), win[1]])
    }
    if (old && !ranges.length) {
      this.__applyColOffscreen(win)
      return
    }
    for (const row of rows) {
      const ri = parseInt(row.dataset.rowIndex ?? '')
      if (isNaN(ri)) continue
      this._fillRow(row, ri, win, ranges.length ? ranges : null)
    }
    this.__applyColOffscreen(win)
  }
  #updateView = false
  __lastHeight = 0
  @debounced(50)
  resetVirtualList() {
    this.__resetVirtualListNow()
  }
  /**
   * 同步版的虚拟列表重置。树展开/折叠这轮直接调用它，跳过 50ms 防抖 ——
   * 防抖窗口叠在 `__scheduleExpandRefresh()` 的延迟上，会让点击到动画起步
   * 多出近 70ms 的空窗（实测展开 64ms、折叠 70ms 的「先转图标后动行」）。
   */
  __resetVirtualListNow() {
    let oh = this.tableBody.offsetHeight
    // 供 `--table-body-height` 使用：`cssVars` 不能直接读 `@query` 的 tableBody
    // （非信号，会让 cssEffect 生成 `rc.__s.tableBody...` 并在运行期抛错，
    //  更会连带让整个 cssVars 依赖提取失败）。这里量到了就写进 state。
    if (this.tableBodyHeight !== oh) this.tableBodyHeight = oh
    // `__lastHeight` 是 `onResize()` 判断"容器高度真的变了"的基线。行池按当前
    // 高度重建完成时同步它，否则基线停在 0，首次 resize（即使只是宽度变化，
    // 例如弹窗给 body 补 `padding-right` 收起滚动条）会被判成高度突变而整表重填。
    if (oh > 0) this.__lastHeight = oh
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
    // `_columnMetaMap` 比 `allColsExceptScroll` 多出的那一项就是 `__scroller` 占位列的元数据；
    // 该列在 `scrollerWidth <= 0` 时不建（见 initColumns）⇒ 这里不能再固定 `- 1`，
    // 否则计数永不相等，会反复 `_appendColumn()` 并提前 return（表格永久空置）。
    if (allColsExceptScroll.length != size(this._columnMetaMap) - (this.scrollerWidth > 0 ? 1 : 0)) {
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
    // `scrollerWidth <= 0` 时不建占位列 ⇒ 无 `__scroller` 列元数据，跳过（见 initColumns）。
    const scrollerMeta = this._columnMetaMap.get(SCROLLER_COL_PROP)
    if (scrollerMeta) {
      this.#fxRCols.push(scrollerMeta)
      if (this.showFooter && !some(this.children, c => c instanceof ColumnFoot && c.prop === SCROLLER_COL_PROP))
        this.appendChild(this._columnFootMap.get(SCROLLER_COL_PROP)!)
    }

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

      ; (this as any).__refreshSpanStyle?.()
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
      this.__updatableStyleColumnWidth = this.__insertOwnSheet(this.getColumnWidthCss())
    }

    //cell width
    let cls: typeof this.columnLinkStyle = {}
    this.allColumns.forEach(c => {
      // 缺口⑲之二：列的销毁可能**先于**表格本身（快速重建时子组件先销毁），
      // 此时读 `c.prop` 会打在已失效的代理上（Reflect.get called on non-object）。
      // 这类迟到渲染（onListReady 的 MutationObserver 防抖、样式重算）必须跳过死列。
      if (c.isDestroyed) return
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

    this.#scheduleUpdateLastColProp()

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
    // 销毁/拆卸迟到回调守卫：本方法是 `debounce` 手工包装（非 @debounced），
    // 包装器没有 isDestroyed 检查 ⇒ 销毁后仍可能跑到这里，此时 fixed*ConHead 已为 null。
    if (this.isDestroyed || !this.fixedLeftConHead || !this.fixedRightConHead) return
    // 与 `_updateScrollWidth` 同口径（表头不可见/量不到时按列宽求和，见 `#measureFixedWidth`）
    this.paddingLeft = this.#measureFixedWidth('left')
    this.paddingRight = this.#measureFixedWidth('right')
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
        hasCellSlot: !isEmpty(c.slots?.cell),
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
      // 只登记活列：死列一旦进 _fieldMap，就会在各类迟到回调（onListReady 的
      // MutationObserver 防抖、样式重算）里被读到而崩溃（见缺口⑲之三）。
      if (!c.isDestroyed) this._fieldMap.set(c.prop, c)
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
  // R4 优化（2026-09-20）：#updateLastColProp() 内部逐列调用 isVisible() →
  // getBoundingClientRect()，每次都会强制一次**整表同步布局**。而 scrollColumns 在首屏
  // 会随着 <ce-column> 逐个插入反复变化（onColumnChange / #onListReady / 列 watch 各来一次），
  // 同一个任务里能被同步调用几十次 ⇒ 几十次整表回流。CPU profile 实测 isVisible 自耗占
  // 主线程 6.6%，其中最大的一块（约 328ms）就来自这里的调用链。
  // 用微任务做合并：本帧内仍取到最终值（微任务先于渲染执行），但把 N 次回流压成 1 次。
  #updateLastColPropScheduled = false
  #scheduleUpdateLastColProp() {
    if (this.#updateLastColPropScheduled) return
    this.#updateLastColPropScheduled = true
    queueMicrotask(() => {
      this.#updateLastColPropScheduled = false
      this.#updateLastColProp()
    })
  }
  #updateLastColProp() {
    // 列集合/列宽变化 ⇒ 列窗口几何与 prop→索引 都可能变
    this.#invalidateColWindow()
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
    this.__fillCellsNow()
  }
  /** 同步版本的整表填充。`onScrollEnd` 的甩动补填走这里，不要再叠一层防抖延迟。 */
  __fillCellsNow() {
    // 整表填充是「列已经建完」的时机：清掉上一次几何测量失败的记忆，让窗口能重算。
    // 首屏列是逐个插入的，`_updateScrollWidth` 很可能在列没建完时量过一次。
    this.#colMeasureFailed = false
    // 只有 `#applyViewUpdate()` 的 urgent 分支置过 consume 的这轮才播放动画。
    // 展开期间任何其它来源的填充（MutationObserver、resize、外部 forceUpdate）都会
    // 走到这里，它们拿不到新行位置，也不能把待用的快照清掉 —— 那会让紧随其后的
    // 真正这一轮失去 FLIP，只剩 CSS 门控里的缩进与 caret 过渡。
    const consuming = this.#treeAnimConsume
    this.#treeAnimConsume = false
    this.#treeAnimActive = consuming && this.#treeAnimSnapshot != null
    // ⚠️ `vList` 由 `#updateListSize`（见下方的 `.ce-table-v-wrapper[available]` 查询）
    //    在列表真正就绪**之后**才赋值；而 `__fillCells` 走 `setTimeout(...,0)` + `@debounced`
    //    调度，**可能抢在那次赋值之前执行**。实测（2026-09-17）：页面就绪后立刻 `runPreview()`
    //    会抛 `Cannot read properties of undefined (reading 'sort')`，并**中断整轮单元格填充**
    //    （既有探针都在触发前等 1.5s，所以一直没暴露）。兜底为空数组：
    //    没有可填的行就什么都不做 —— 比抛错中断安全，且不影响就绪后的正常路径。
    let rowEls = (this.vList ?? []).sort((a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
    let rowIndexs = rowEls.map(el => parseInt(el.dataset.rowIndex!))
    const win = this.__currentColWindow()
    this.__applyMaterialize(win, null)
    //填充行数据
    for (let r = 0; r < rowEls.length; r++) {
      const row = rowEls[r]
      const rowIndex = rowIndexs[r]
      this._fillRow(row, rowIndex, win)
    }
    if (consuming) this.__endTreeAnim()
    this.__applyColOffscreen(win)
    if (!this._firstFilled && this.__dataInited) {
      this._firstFilled = true
      this.emit(TableEvents.FirstFilled)
    }
  }
  /**
   * 填充一行。
   *
   * `win` 是列窗口 `[from, to)`（`scrollColumns` 索引）：给了就只写窗口内的格子，
   * 窗口外的格子保持上一次的值 —— 它们在视口外，用户看不到；等横向滚回来时由
   * `__syncColWindow()` 统一重填。省掉的是「写 DOM + 跟着重算样式」这两笔按格子数
   * 线性增长的账，100 列时约占一次滚动步长的大半。
   *
   * `ranges` 再收一层：给了就只写这些区间内的列（仍须落在 `win` 内）。横向滚动
   * 只有边缘一截进入窗口，用它把这轮成本压到「真正新增的列」而不是整个窗口。
   */
  _fillRow(row: HTMLElement, rowIndex: number, win?: ColRange | null, ranges?: ColRange[] | null) {
    const rowData = this.renderList[rowIndex]
    let rowId = rowData ? String(rowData[this.rowKey]) : ''
    if (!rowData) {
      if (this.renderList.length < this.vList.length)
        row.toggleAttribute(AVAILABLE_ROW_TAG, false)
      return
    }
    // 行 DOM 被复用到另一个数据行时，这一轮的列写入属于"换主"而不是状态变化：
    // 行上留标记，单元格组件据此跳过过渡（见 utils/row-reuse）。标记只在本轮
    // 填充内有效，微任务即撤，否则后续用户点击会读到残留标记。
    const prevRowKey = row.getAttribute('data-row-key')
    const reused = prevRowKey !== null && prevRowKey !== rowId
    row.toggleAttribute(REUSE_ROW_ATTR, reused)
    if (reused) queueMicrotask(() => row.removeAttribute(REUSE_ROW_ATTR))
    row.setAttribute('data-row-key', rowId)
    row.toggleAttribute(AVAILABLE_ROW_TAG, true)
    if (this.#treeAnimActive) this.__playTreeRowAnim(row, rowId)
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
    // 逐格 `row.querySelector('.ce-table-cell[column=…]')` 是整行线性扫描，一行 100 列
    // 就是 200 次全行查找。这里先遍历一次建索引，后面按 prop 直取。
    // `__legacyFill`（仅 demo 压测用）走回优化前的逐格查找，此时不建索引。
    const legacy = this.__legacyFill
    const cellMap = new Map<string, HTMLElement>()
    const contentMap = new Map<string, HTMLElement>()
    if (!legacy) {
      const cellEls = row.querySelectorAll<HTMLElement>('.ce-table-cell')
      for (let i = 0; i < cellEls.length; i++) {
        const el = cellEls[i]
        const prop = el.getAttribute('column')
        if (prop === null) continue
        cellMap.set(prop, el)
        const contentEl = el.querySelector<HTMLElement>('.ce-table-cell-content')
        if (contentEl) contentMap.set(prop, contentEl)
      }
    }
    for (let i = 0; i < this.allColumns.length; i++) {
      const c = this.allColumns[i];
      // 列窗口：`scrollColumns` 里落在窗口外的列整列跳过（固定列不在 `scrollColumns` 里，
      // 永远不会被跳过）
      if (win) {
        const si = this.#scrollIdx?.get(c.prop)
        if (si != null) {
          if (si < win[0] || si >= win[1]) continue
          if (ranges && !inRanges(ranges, si)) continue
        }
      }
      const cellEl = legacy
        ? (row.querySelector('.ce-table-cell[column="' + c.prop + '"]') as HTMLElement)
        : cellMap.get(c.prop)
      const content = legacy
        ? (row.querySelector('.ce-table-cell[column="' + c.prop + '"] .ce-table-cell-content') as HTMLElement)
        : contentMap.get(c.prop)
      if (!cellEl || !content) continue

      // 纵向合并块内**非锚行**（含可见的中间行）以锚行的样式为准：宿主按"格"下发样式、
      // 只写锚格，不回落就会拼成"锚行有色 + 下面几行白色"的条子，看起来根本不像合并。
      // 宿主若给该行**自己**写了样式（cellStyle 命中），以宿主为准。
      const spanTopRow = this.__spanTopRowMap?.[rowIndex + ":" + c.prop]
      let css = this.cellStyle[rowIndex + "_" + c.prop] || this.cellKeyStyle[rowId + "_" + c.prop]
      if (!css && spanTopRow != null) {
        const topRowData = this.renderList[spanTopRow]
        const topRowId = topRowData ? String(topRowData[this.rowKey]) : ''
        css =
          this.cellStyle[spanTopRow + "_" + c.prop] ||
          (topRowId ? this.cellKeyStyle[topRowId + "_" + c.prop] : '')
      }
      if (css && content.parentElement) {
        content.parentElement.style.cssText = css
      } else if (content.parentElement?.style.cssText) {
        content.parentElement!.style.cssText = ''
      }

      //selector
      this._renderCellSelector(cellEl, rowIndex, c.prop)

      //span style
      // 无合并时 `__matchSpanStyle` 只是立即返回；`legacy` 下必须真的走一遍清理。
      if (legacy || this.__hasSpan) this.__matchSpanStyle(cellEl, rowIndex, c.prop, legacy)

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
        // 展开态类只在**这次真的翻转**时补动画：重填与 FLIP 同一帧开始，
        // CSS 过渡在这个渲染上下文里不一定触发（实测同一份 class 切换，
        // 由点击事件驱动会过渡、由重填驱动则直接跳到终值），所以旋转走 WAAPI。
        const caretEl = icon.parentElement as HTMLElement
        const nextExpanded = !!this.expandedIdMap[rowId]
        const caretFlipped = caretEl.classList.contains(CLASS_EXPAND) !== nextExpanded
        let fromTransform = ''
        let fromPadding = ''
        if (caretFlipped && this.#treeAnimActive) {
          const iconStyle = getComputedStyle(icon)
          fromTransform = iconStyle.transform
          fromPadding = getComputedStyle(caretEl).paddingLeft
        }
        caretEl.classList.toggle(CLASS_EXPAND, nextExpanded)
        caretEl.dataset.level = this.levelMap[rowId] + ''
        if (caretFlipped && this.#treeAnimActive) {
          this.__playCaretAnim(caretEl, icon, fromTransform, fromPadding)
        }
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
      let cellTmpls = colEl?.slots?.cell
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

      // 纵向合并的"可见行"是块内**中间行**（库用"只在中间行渲染内容"模拟垂直居中，
      // 见 TableExtensionSpan.__getSpanCellStyle 里 mIndex 那段）。块内各行的行数据通常
      // 只写在左上角格 ⇒ 取值回落到锚行，否则合并块会整块空白。
      const valueRowIndex = spanTopRow ?? rowIndex
      let val = this._getCellValue(valueRowIndex, c.prop)
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

      if (legacy) {
        // 优化前：每次都整体重写
        if (isHtml) {
          textContentEl.innerHTML = html
        } else {
          textContentEl.textContent = html
        }
      } else if (isHtml) {
        // 比较后再写：`innerHTML` 每次赋值都会丢掉旧子树重建，格内挂着组件
        // （tag 列、操作列）时等于把组件全部重新构造一遍。
        if (textContentEl.innerHTML !== html) textContentEl.innerHTML = html
      } else {
        writeText(textContentEl, html)
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
    if (colEl?.slots?.cell) return ''

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
            // 非数字**保留原文**，不清空：格式化只负责"美化可解析的值"，
            // 把无法格式化的内容吞成空串会让"表头行文字落在 number 列上"整格消失
            // （实测示例：模板表头行的 单价/数量/金额）。
            rs = isNumeric(rs) ? formatNumber(rs, colEl.pattern) : rs
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
      // 传**回调本体**：其 DOM 结构由编译器前移到回调所属组件的 subViews，
      // getSubViewNodes 内部按 fn.__owner + fn.__subId 取用（0.28 的 Template#getHTML 替代）
      html = nodesToHTML(this.getSubViewNodes(cellFn, slotProps))
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
          // 同 __getRenderValue：非数字保留原文（表头行文字不该被吞成空）
          html = isNumeric(html) ? formatNumber(html, col.pattern) : html
          break;
        case DataType.Time:
        case DataType.DateTime:
        case DataType.Date:
          html = isNumeric(html) ? html : formatDate(html, col.pattern)
          break;
      }
    }
    // 空值归一化：NaN / null / undefined / 空串统一走列级占位，避免 writeText 的
    // String(text) 把它们写成 "NaN"/"null"/"undefined"。
    if (html === '' || isNil(html) || (typeof html === 'number' && Number.isNaN(html))) {
      html = col.emptyText ?? ''
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
      this.TableConfigPane?.onStat(this)
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
      if (!rowData) return
      const cell = vr.querySelector<HTMLElement>('.ce-table-cell[column="' + prop + '"] .ce-table-cell-content')
      if (cell) viewCellMap[rowData[this.rowKey]] = cell
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
      // 销毁迟到回调守卫：`_updateScrollWidth`（防抖版）在销毁后被置 null
      if (this.isDestroyed) return
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
        // 销毁迟到回调守卫（同 onResize）：scroller 的防抖方法销毁后为 null
        if (this.isDestroyed || !this.scroller) return
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
    // 0-based；双射 26 进制（0→A … 25→Z, 26→AA, 52→BA），统一实现见 myfx alphaLabel
    return alphaLabel(index)
  }
  getColumnPropByChar(char: string) {
    let cIndex = this.__getColumnIndex(char)
    return this.getRenderColumns()[cIndex]?.prop
  }
  __getColumnIndex(char: string) {
    // '' → 0；加权累加（AA → 26），统一实现见 myfx alphaIndex
    return alphaIndex(char)
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
