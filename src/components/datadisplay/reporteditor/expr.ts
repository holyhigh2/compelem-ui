/**
 * 报表级表达式求值器（插值式）
 * 语法：
 *   {{field}}            当前记录字段（点路径，如 {{order.amount}}）
 *   {param.x}            报表参数
 *   {sum(field)}         对当前数据集字段聚合（sum/avg/min/max/count）
 *   {group.sum(field)}   对当前分组记录聚合
 *   {rownum}             运行行号
 *   {page}               页码占位
 *   {r}                  仅用于 cell.fx 模板，展开时替换为绝对行号(1-based)
 * 整串为单一 token 时返回原始值（保留数字类型）；混合文本时做内插替换。
 */

export interface ReportExprContext {
  row?: Record<string, any>;
  params?: Record<string, any>;
  dataset?: any[];
  group?: any[];
  rownum?: number;
  page?: number;
}

const FIELD_RE = /^\{\{([^}]+)\}\}$/;
const PARAM_RE = /^\{param\.([^}]+)\}$/i;
const AGG_RE = /^\{(sum|avg|min|max|count)\(([^)]*)\)\}$/i;
const TOKEN_RE = /\{\{([^}]+)\}\}|\{param\.([^}]+)\}|\{(sum|avg|min|max|count)\(([^)]*)\)\}|(\{rownum\})|(\{page\})/g;

function getPath(obj: any, path: string): any {
  if (obj == null) return undefined;
  return path.split('.').reduce((o: any, k: string) => (o == null ? undefined : o[k]), obj);
}
function toNum(v: any): number {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function resolveAgg(fn: string, arg: string, ctx: ReportExprContext): number {
  let source: any[] | undefined;
  let field = arg.trim();
  if (arg.startsWith('group.')) {
    source = ctx.group;
    field = arg.slice(6);
  } else if (arg.includes('.')) {
    const [ds, f] = arg.split('.');
    field = f;
    source = ds === 'row' ? [ctx.row] : ctx.dataset;
  } else {
    source = ctx.dataset;
  }
  const arr = Array.isArray(source) ? source : [];
  if (fn === 'count') return arr.length;
  const nums = arr.map((r) => getPath(r, field)).filter((v) => v !== undefined && v !== '').map(toNum);
  switch (fn) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case 'min': return nums.length ? Math.min(...nums) : 0;
    case 'max': return nums.length ? Math.max(...nums) : 0;
    default: return 0;
  }
}

/**
 * 求值报表表达式。整串为单一 token 时返回原始类型（数字保留），否则内插为字符串。
 */
export function evalReportExpr(expr: any, ctx: ReportExprContext): any {
  if (expr == null) return '';
  const s = String(expr);
  if (!s) return '';

  let matched = false;
  let singleVal: any = '';
  const out = s.replace(TOKEN_RE, (full, field?: string, param?: string, agg?: string, aggArg?: string, rownum?: string, page?: string) => {
    matched = true;
    if (field != null) {
      singleVal = getPath(ctx.row ?? {}, field);
      return singleVal == null ? '' : String(singleVal);
    }
    if (param != null) {
      singleVal = getPath(ctx.params ?? {}, param);
      return singleVal == null ? '' : String(singleVal);
    }
    if (agg != null) {
      singleVal = resolveAgg(agg.toLowerCase(), aggArg || '', ctx);
      return String(singleVal);
    }
    if (rownum) {
      singleVal = ctx.rownum ?? '';
      return String(singleVal);
    }
    if (page) {
      singleVal = ctx.page ?? '';
      return String(singleVal);
    }
    return full;
  });

  if (!matched) return s;
  // 整串为单一 token → 返回原始值（保留数字类型，便于统计/计算）
  if (FIELD_RE.test(s) || PARAM_RE.test(s) || AGG_RE.test(s) || s === '{rownum}' || s === '{page}') {
    return singleVal == null ? '' : singleVal;
  }
  return out;
}

/**
 * 将 fx 模板中的 {r} 占位符替换为绝对行号(1-based)。
 */
export function fillFxRow(fx: string, absRow1Based: number): string {
  return String(fx).replace(/\{r\}/g, String(absRow1Based));
}
