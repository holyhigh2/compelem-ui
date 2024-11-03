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
  resizable?:boolean;
  sort?: boolean;
  filters?: Array<Record<string, any> | string|null>;//{text,value}
  dataType?:string;
  dataSelection?:Array<any>;
  dataSelectionOption?:DataSelectionOption;
  dataOption?: Record<string, any>;
  /**
   * 列宽
   */
  width?: number;
  /**
   * 列中td样式
   */
  cellClass?:string;
  /**
   * 列中th样式
   */
  headerClass?: string;
}

export interface DataSelectionOption{
  constraint?:boolean,
  multiple?:boolean
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
  hasSub?:boolean;
  isFixedEnd?:boolean;
  primaryWidth?: number;
}

export interface SelectorMeta {
  startCell: HTMLElement,
  startBox: { x: number, y: number, w: number, h: number },
  startColumn: number,
  startRow: number
}

export interface CellPos {
  colIndex:number,
  rowIndex:number,
  prop:string
}
export interface CellBox { x: number, y: number, w: number, h: number }