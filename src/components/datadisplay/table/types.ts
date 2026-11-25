/**
 * @author holyhigh2
 */
import type { Template } from "compelem";
import type { MenuEntry, MenuItem } from "../../nav/menu/Menu";

/**
 * ---- 表格的动态边界（集中声明，别处只引用别名，不再散点写 `Record<string, any>`）
 *
 * 这几条是 `ce-table` 真正无法静态化的地方：数据由宿主给、列对象在运行时是
 * `Column` 组件实例（除声明字段外还挂着 `prop` / `renderWidth` / `slots` /
 * `isDestroyed` 等派生成员）。把它们命名一次的好处是：日后要收窄，只改这一处；
 * 而 80 处散点写法的坏处是每个调用点都得重新猜「这里的 any 到底是什么」。
 */

/** 一行用户数据：值域同 `CellValue`，键为列 prop。 */
export type RowData = Record<string, any>

/**
 * 列对象。运行时是 `Column` 组件实例，静态上只保证「可按列名取值」——
 * 注意与下方 `Column` 接口的区别：那个是**使用者可写的列声明**，
 * 这个是**内部流转的列实例**（同名会与本文件的 `Column` 冲突，故另名）。
 */
export type ColumnLike = Record<string, any>

/** 单元格值：string/number/数组/对象/null 都可能出现，fill* / 统计 / 公式路径原样透传。 */
export type CellValue = any

/** 内联样式对象：键为 CSS 属性名（camel 或 kebab 由调用点决定），值为 CSS 字面量。 */
export type StyleObject = Record<string, any>

/** 插槽作用域：`cell` / `header` / `footer` 插槽的入参（row、column、rowIndex、columnIndex…）。 */
export type SlotScope = Record<string, any>

/**
 * 形状由扩展点决定的对象袋：`span` 事件里宿主回填的合并描述、`setConfig` 的入参、
 * 筛选/分组/填色条件集合、`updateColumnCells` 的下标→值映射等。
 * 这些不是「某一个类型」，而是各处各自约定的袋，因此不假装精确；集中在这里，
 * 谁要收窄就在自己的扩展点模块里收窄，而不是在 `Table` 的签名上互相将就。
 */
export type DynamicMap = Record<string, any>

/**
 * 列统计的自定义计算函数 —— `Table._calcFn` / `setStats(calcFn)` /
 * `__calcStat(_calcFn)` 三处共用同一契约，此前各写一遍（其中两处是 `Function`）。
 */
export type StatCalcFn = (colProp: string, colData: Array<string | number>, data: RowData[]) => string | Template

/**
 * 表格公式（fx）求值函数：由 `new Function(...)` 生成（见 TableExtensionFx），
 * 入参是各列/单元格的值，返回写回单元格的内容。
 */
export type FormulaFn = (...args: CellValue[]) => CellValue

export interface Column {
  /**
   * 列名
   */
  label?: string;
  /**
   * 对应列的行数据key
   */
  prop?: string;
  /**
   * 可选列类型
   */
  type?: string;
  align?: string;
  headerAlign?: string;
  fixed?: string | boolean;
  resizable?: boolean;
  sort?: boolean;
  filters?: Array<Record<string, any> | string | null>;//{text,value}
  dataType?: string;
  selection?: Array<any>;
  selectionOption?: DataSelectionOption;
  dataOption?: Record<string, any>;
  /**
   * 列宽
   */
  width?: number;
  /**
   * 空值占位文本
   */
  emptyText?: string;
  /**
   * 列中td样式
   */
  cellClass?: string;
  /**
   * 列中th样式
   */
  headerClass?: string;
}

export interface DataSelectionOption {
  constraint?: boolean,
  multiple?: boolean
}

export interface ColumnMeta extends Column {
  /**
   * 列合并
   */
  colspan: number;
  /**
   * 行合并
   */
  rowspan: number;
  /**
   * 插槽 [default,header]
   */
  slots: Record<string, Element[]>;
  hasSub?: boolean;
  isFixedEnd?: boolean;
  primaryWidth?: number;
}

export interface SelectorMeta {
  startCell: HTMLElement,
  startBox: { x: number, y: number, w: number, h: number },
  startColumn: number,
  startRow: number
}
export interface CellSpan {
  rowIndex: number;
  rowSpan: number;
  colSpan: number;
}
export interface CellPos {
  colIndex: number,
  rowIndex: number,
  prop: string
}
export interface CellBox { x: number, y: number, w: number, h: number }

/**
 * `ce-context-menu` 的 `select` 载荷：`ContextMenu` 原样转发 `ce-menu` 的 select 事件
 * （`{target,item,index,el,path}`）。右键菜单项恒为对象项，故 `item` 收窄为 `MenuItem`。
 */
export type ContextMenuSelectPayload = {
  item: MenuItem
  el: HTMLElement
  index?: string
  target?: HTMLElement
  path?: string
}

/** `_onContextMenu` 钩子的入参：扩展可在 items 上追加/调整右键菜单项 */
export type ContextMenuOpenPayload = {
  items: MenuEntry[]
  cells?: CellPos[]
}

export interface FillColorCondition {
  id: string,
  type: string,
  dataType?: string,
  color: string,
  column: string,
  operator: string,
  values: string,
  tip: string
}

export enum StyleType {
  Row = 1,
  Col = 2,
  Cell = 3
}
export enum ColumnType {
  Index = 'index',
  Selection = 'selection'
}
export enum ColumnProp {
  Index = '__index',
  Selection = '__selection'
}
export enum Operation {
  Freeze = 'freeze',
  Group = 'group',
  Hide = 'hide',
  Align = 'align',
  FillColor = 'fillcolor'
}
export enum RowHeightType {
  Compact = 'compact',
  Medium = 'medium',
  Loose = 'loose'
}
export enum ConfigType {
  Sort = 'sort',
  Group = 'group',
  Fixed = 'fixed',
  Filter = 'filter',
  Hide = 'hide',
  RowHeight = 'rowheight',
  Align = 'align'
}
export enum MetricType {
  Min = 'min',
  Max = 'max',
  Median = 'median',
  Mean = 'mean',
  Sum = 'sum',
  Range = 'range',
  None = 'none',
  Filled = 'filled',
  NotFilled = 'notfilled',
  FilledPercent = 'filledpercent',
  NotFilledPercent = 'notfilledpercent',
  Index = 'index'
}
export enum TableEvents {
  SelectionChange = 'selectionchange',
  Span = 'span',
  //打开统计面板前
  BeforeDoStats = 'beforedostats',
  //执行扩展统计计算
  DoExtStats = 'doextstats',
  //完成统计后，显示结果前
  AfterDoStats = 'afterdostats',
  CellClick = 'cellclick',
  CellDblClick = 'celldblclick',
  RowClick = 'rowclick',
  RowDblClick = 'rowdblclick',
  Scroll = 'scroll',
  ScrollEdge = 'scrolledge',
  ScrollEnd = 'scrollend',
  SortChange = 'sortchange',
  ColumnChange = 'columnchange',
  FilterChange = 'filterchange',
  FixedChange = 'fixedchange',
  Hide = 'columnhide',
  GroupChange = 'groupchange',
  FillColorChange = 'fillcolorchange',
  ConfigChange = 'configchange',
  RowHeightChange = 'rowhtypechange',
  CurrentChange = 'currentchange',
  AlignChange = 'alignchange',
  Detailclick = 'detailclick',
  CellsChange = 'cellschange',
  SetFilterList = 'setfilterlist',
  FirstFilled = 'firstfilled',
  CellSlot = 'cellslot'
}

/**
 * `cellpick` 事件载荷：把「弹什么层」交给调用者，表格只提供它自己才有的两样东西 ——
 * 目标单元格的坐标/生命周期，以及一条合法的写回路径。
 *
 * 调用者通常在事件里打开自己的 overlay（`ce-overlay` / `ce-dropdown` / 自绘面板），
 * 组件内不感知其类型；选值后调 `setValue`，表格负责锁定、公式与 `change` 事件。
 */
export interface CellPickEvent {
  /** 目标行的数据快照（深拷贝，改它不会影响表格） */
  row: RowData
  /** 目标列实例 */
  column: ColumnLike
  rowIndex: number
  colIndex: number
  /** 目标单元格元素。虚拟滚动会复用节点，不要跨帧缓存 */
  cell: HTMLElement
  /** 触发按钮（单元格右上角 caret），可直接作为 overlay 的锚点元素 */
  anchor: HTMLElement
  /** 单元格的视口坐标，给不走锚点定位的调用者 */
  rect: DOMRect
  /** 当前值，类型化原值（未经 `pattern` 格式化） */
  value: CellValue
  /** 当前显示文本（已按 `pattern` 格式化） */
  text: string
  /**
   * 回填并结束会话。值按列类型原样入库，显示格式化由表格负责。
   * `'invalid'` 表示被表格校验拦下（公式自引用），此时会话保持打开。
   */
  setValue(value: CellValue): 'done' | 'cancelled' | 'invalid'
  /** 结束会话且不写回 */
  close(): void
  /**
   * 注册「表格侧强制结束」回调：数据重载、选区清空、按 Escape 时触发。
   * 调用者应据此收起自己的 overlay，避免面板悬空。
   */
  onClose(fn: () => void): void
}
