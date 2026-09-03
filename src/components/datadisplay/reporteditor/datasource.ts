/**
 * 报表数据源：类型定义 + demo mock 执行器
 *
 * 安全边界（重要）：
 * - 本组件库**不直连任何数据库**，也不内置"把用户 SQL 发送到后端执行"的能力。
 * - 真实 SQL/表查询由宿主通过 `dataSourceLoader` 回调或监听 `datasourcerequest` 事件完成。
 * - `mockExecuteDataSource` 仅在浏览器内存中按样例数据模拟查询结果，供 demo / 本地联调用，
 *   不触达真实数据库，可放心在页面使用。
 */
import type { ReportDataSource } from './model';

export type { ReportDataSource };

export interface DataSourceResult {
  /** 查询结果行 */
  rows: Record<string, any>[];
  /** 结果字段列表 */
  fields: string[];
}

/** 内置样例数据集（key 为表名；mock 查询的取数来源） */
const SAMPLE_SETS: Record<string, Record<string, any>[]> = {
  orders: [
    { code: 'A001', name: '苹果', qty: 100, price: 5.5, amount: 550, category: '水果', orderDate: '2026-08-01', note: '红' },
    { code: 'A002', name: '香蕉', qty: 200, price: 3.0, amount: 600, category: '水果', orderDate: '2026-08-02', note: '蓝' },
    { code: 'A003', name: '橘子', qty: 150, price: 4.2, amount: 630, category: '水果', orderDate: '2026-08-03', note: '绿' },
    { code: 'A004', name: '白菜', qty: 80, price: 2.8, amount: 224, category: '蔬菜', orderDate: '2026-08-04', note: '黄' },
    { code: 'A005', name: '土豆', qty: 300, price: 1.6, amount: 480, category: '蔬菜', orderDate: '2026-08-05', note: '紫' },
    { code: 'A006', name: '牛肉', qty: 60, price: 42.0, amount: 2520, category: '肉类', orderDate: '2026-08-06', note: '鲜' },
    { code: 'A007', name: '鸡蛋', qty: 500, price: 0.9, amount: 450, category: '禽蛋', orderDate: '2026-08-07', note: '盒' },
    { code: 'A008', name: '牛奶', qty: 120, price: 12.0, amount: 1440, category: '乳品', orderDate: '2026-08-08', note: '箱' },
  ],
  products: [
    { id: 1, name: '机械键盘', category: '外设', price: 399, stock: 120 },
    { id: 2, name: '无线鼠标', category: '外设', price: 129, stock: 300 },
    { id: 3, name: '显示器 27"', category: '显示', price: 1299, stock: 45 },
    { id: 4, name: '笔记本支架', category: '配件', price: 89, stock: 210 },
    { id: 5, name: '降噪耳机', category: '音频', price: 699, stock: 88 },
  ],
  users: [
    { id: 1, name: '张伟', dept: '研发部', salary: 18000 },
    { id: 2, name: '李娜', dept: '产品部', salary: 16000 },
    { id: 3, name: '王强', dept: '研发部', salary: 20000 },
    { id: 4, name: '赵敏', dept: '市场部', salary: 14000 },
    { id: 5, name: '刘洋', dept: '设计部', salary: 15000 },
  ],
};

/** 根据字段名推断示例值类型（未知表通用生成） */
function inferValue(field: string, i: number): any {
  const f = field.toLowerCase();
  if (/(qty|count|num|price|amount|salary|stock|total|id|sn|no$|number)/.test(f)) {
    if (/price|amount|salary/.test(f)) return Number((i + 1) * 3.7).toFixed(2);
    return (i + 1) * 10;
  }
  if (/date|time/.test(f)) return `2026-08-${String((i % 28) + 1).padStart(2, '0')}`;
  if (/name|title|label|desc|note|code/.test(f)) return `示例${f}${i + 1}`;
  return `值${i + 1}`;
}

/** 按字段列表生成通用样例数据 */
function genRows(fields: string[], count: number): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  for (let i = 0; i < count; i++) {
    const r: Record<string, any> = {};
    fields.forEach((f) => { r[f] = inferValue(f, i); });
    rows.push(r);
  }
  return rows;
}

/** 极简 SQL 解析：SELECT f1,f2 [AS 别名] FROM table [WHERE col op val (AND ...)] [LIMIT n] */
export interface ParsedSql {
  table: string;
  fields: string[];
  limit: number | null;
  where: Array<{ field: string; op: string; value: any }>;
}

export function parseSimpleSql(sql: string): ParsedSql | null {
  const s = String(sql || '').trim();
  if (!s) return null;
  const m = /^\s*select\s+(.+?)\s+from\s+([a-zA-Z_][\w]*)(.*)$/is.exec(s);
  if (!m) return null;
  const fieldPart = m[1].trim();
  const table = m[2];
  const rest = m[3] || '';
  const fields: string[] = [];
  if (fieldPart === '*') {
    fields.push('*');
  } else {
    fieldPart.split(',').forEach((seg) => {
      const fm = /^\s*([a-zA-Z_][\w]*)(?:\s+as\s+([a-zA-Z_][\w]*))?\s*$/i.exec(seg);
      if (fm) fields.push(fm[2] || fm[1]);
    });
  }
  // WHERE / LIMIT
  const where: ParsedSql['where'] = [];
  let limit: number | null = null;
  const limitM = /limit\s+(\d+)/i.exec(rest);
  if (limitM) limit = parseInt(limitM[1], 10);
  const whereM = /where\s+(.+)$/i.exec(rest.split(/limit\s+\d+/i)[0]);
  if (whereM) {
    const conds = whereM[1].split(/\s+and\s+/i);
    conds.forEach((c) => {
      const cm = /^\s*([a-zA-Z_][\w]*)\s*(=|!=|>=|<=|>|<)\s*('([^']*)'|(\d+(?:\.\d+)?))\s*$/i.exec(c);
      if (cm) {
        where.push({ field: cm[1], op: cm[2], value: cm[4] !== undefined ? cm[4] : parseFloat(cm[5]) });
      }
    });
  }
  return { table, fields, limit, where };
}

function matchWhere(row: Record<string, any>, where: ParsedSql['where']): boolean {
  return where.every((c) => {
    const v = row[c.field];
    if (typeof c.value === 'number') {
      const n = Number(v);
      switch (c.op) {
        case '=': return n === c.value;
        case '!=': return n !== c.value;
        case '>': return n > c.value;
        case '>=': return n >= c.value;
        case '<': return n < c.value;
        case '<=': return n <= c.value;
      }
      return false;
    }
    const sv = String(v ?? '');
    return c.op === '=' ? sv === String(c.value) : sv !== String(c.value);
  });
}

/** 执行 SQL mock 查询（仅内存样例数据，不触达数据库） */
function mockSql(sql: string): DataSourceResult {
  const parsed = parseSimpleSql(sql);
  if (!parsed) {
    // 无法解析：退化为通用样例数据
    return { rows: genRows(['col1', 'col2', 'col3'], 5), fields: ['col1', 'col2', 'col3'] };
  }
  let source = SAMPLE_SETS[parsed.table];
  if (!source) {
    source = genRows(parsed.fields.includes('*') ? ['id', 'name', 'value'] : parsed.fields, 8);
  }
  let rows = source;
  if (parsed.where.length) rows = rows.filter((r) => matchWhere(r, parsed.where));
  if (parsed.limit != null) rows = rows.slice(0, parsed.limit);
  const fields = parsed.fields.includes('*')
    ? (rows.length ? Object.keys(rows[0]) : ['*'])
    : parsed.fields;
  return { rows, fields };
}

/** 执行表模式 mock 查询（按字段生成样例数据） */
function mockTable(table: string, fields: string[]): DataSourceResult {
  const source = SAMPLE_SETS[table];
  if (source) {
    const fs = fields.length ? fields : Object.keys(source[0] || {});
    return { rows: source.map((r) => { const o: Record<string, any> = {}; fs.forEach((f) => { o[f] = r[f]; }); return o; }), fields: fs };
  }
  const fs = fields.length ? fields : ['id', 'name', 'value'];
  return { rows: genRows(fs, 8), fields: fs };
}

/**
 * demo / 本地联调用 mock 执行器：按数据源配置在浏览器内存中生成样例结果。
 * 不触达任何真实数据库，安全。
 */
export async function mockExecuteDataSource(ds: ReportDataSource, _params: Record<string, any> = {}): Promise<DataSourceResult> {
  // 模拟网络延迟，便于观察加载状态
  await new Promise((r) => setTimeout(r, 120));
  if (ds.type === 'sql') return mockSql(ds.sql || '');
  return mockTable(ds.table || '', ds.fields || []);
}
