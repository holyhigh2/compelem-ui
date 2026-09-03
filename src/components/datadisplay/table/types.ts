/**
 * @author holyhigh2
 */
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
