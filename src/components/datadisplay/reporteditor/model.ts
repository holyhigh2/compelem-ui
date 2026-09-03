/**
 * 报表列定义
 */
export interface ReportColumn {
  prop: string;
  title?: string;
  width?: number | string;
  dataType?: string;
  pattern?: string;
  /** 列尾统计类型：sum/mean/max/min/median/range/filled/notfilled/filledpercent/notfilledpercent/index */
  stats?: string;
}

/**
 * 报表单元格定义
 */
export interface ReportCell {
  /** 静态文本 */
  value?: string;
  /** 报表级表达式：{{field}} / {param.x} / {sum(amount)} / {group.sum(x)} 等 */
  expr?: string;
  /** 单元格公式（复用 TableExtensionFx）：=SUM(A1:A5)，支持 {r} 行号占位符 */
  fx?: string;
  /** 合并 */
  span?: { rowSpan?: number; colSpan?: number };
  style?: Record<string, string>;
}

/**
 * 区域类型
 */
export type BandType = 'title' | 'header' | 'detail' | 'groupfooter' | 'footer' | 'summary' | 'normal';

/**
 * 报表带（band）：连续多行构成一个区域
 */
export interface ReportBand {
  type: BandType;
  /** 绑定数据集 key（detail band 必填），如 "orders" */
  loop?: string;
  /** 分组字段 */
  groupBy?: string;
  /** 每行各列内容 */
  rows: Array<{ cols: Record<string, ReportCell> }>;
}

/**
 * 报表数据源配置
 * type=sql    ：通过 SQL 语句取数（执行由宿主 dataSourceLoader / datasourcerequest 决定，组件不直连数据库）
 * type=table  ：通过表名 + 字段列表取数
 */
export interface ReportDataSource {
  type: 'sql' | 'table';
  /** SQL 模式：SQL 语句 */
  sql?: string;
  /** 表模式：表名 */
  table?: string;
  /** 结果字段列表（SQL 从 SELECT 解析 / 表模式手填，可空则取返回数据首行 key） */
  fields?: string[];
}

/**
 * 报表模板
 */
export interface ReportTemplate {
  columns: ReportColumn[];
  bands: ReportBand[];
  /** 报表级分组字段 */
  groupBy?: string;
  params?: Record<string, any>;
  /** 数据源配置（明细区数据来源） */
  dataSource?: ReportDataSource;
}

/** 区域颜色映射（设计态行着色） */
export const BAND_COLORS: Record<BandType, string> = {
  title: '#4f46e5',
  header: '#7c3aed',
  detail: 'transparent',
  groupfooter: '#f59e0b',
  footer: '#059669',
  summary: '#dc2626',
  normal: 'transparent',
};

/** 区域类型中文标签 */
export const BAND_LABELS: Record<BandType, string> = {
  title: '标题',
  header: '表头',
  detail: '明细',
  groupfooter: '分组尾',
  footer: '页脚',
  summary: '汇总',
  normal: '普通',
};

/** 统计类型选项 */
export const STATS_OPTIONS: Array<{ text: string; value: string }> = [
  { text: '无', value: '' },
  { text: '求和', value: 'sum' },
  { text: '平均值', value: 'mean' },
  { text: '最大值', value: 'max' },
  { text: '最小值', value: 'min' },
  { text: '中位数', value: 'median' },
  { text: '极差', value: 'range' },
  { text: '已填写', value: 'filled' },
  { text: '未填写', value: 'notfilled' },
];

/**
 * 创建默认模板：4 列（带标题）+ 100 行普通空白行作为设计画布。
 * 默认不预置 标题/表头/明细/汇总 区域，用户在设计态用工具栏/右键菜单标记。
 * 设计区显示 100 行，预览渲染 100 行静态内容。
 */
const DEFAULT_ROW_COUNT = 100;

export function createDefaultTemplate(): ReportTemplate {
  const columns = [
    { prop: 'col1', title: '名称', width: 150 },
    { prop: 'col2', title: '数量', width: 100, dataType: 'number' },
    { prop: 'col3', title: '单价', width: 100, dataType: 'number' },
    { prop: 'col4', title: '金额', width: 120, dataType: 'number', stats: 'sum' },
  ];
  const bands: ReportBand[] = [];
  for (let i = 0; i < DEFAULT_ROW_COUNT; i++) {
    bands.push({ type: 'normal', rows: [{ cols: {} }] });
  }
  return { columns, bands };
}

/** 默认样例数据 */
export const DEFAULT_REPORT_DATA = [
  { name: '苹果', quantity: 100, price: 5.5, amount: 550 },
  { name: '香蕉', quantity: 200, price: 3.0, amount: 600 },
  { name: '橘子', quantity: 150, price: 4.2, amount: 630 },
];
