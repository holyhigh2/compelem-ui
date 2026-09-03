import type { CellSpan } from '../table/types';
import type { ReportBand, ReportCell, ReportTemplate } from './model';
import { evalReportExpr, fillFxRow } from './expr';
import type { ReportExprContext } from './expr';

export interface ExpandResult {
  /** 展开后的扁平行数据（可直接 setData 到 l-table） */
  rows: Record<string, any>[];
  /** 合并信息（l-table setSpan 格式）：{prop: [{rowIndex,rowSpan,colSpan}]} */
  spanObj: Record<string, CellSpan[]>;
  /** 含公式的单元格：展开后行号 + 列prop */
  fxCells: { rowIndex: number; prop: string }[];
  /** 列统计配置：{prop: statsType} */
  colStats: Record<string, string>;
  /** 单元格样式透传：展开后行号 + 列prop + style（供预览区样式注入） */
  cellStyles: { rowIndex: number; prop: string; style: Record<string, string> }[];
}

/**
 * 把 模板 + 数据 展开为表格可直接消费的扁平行数组。
 * 这是"区域循环"的核心：detail band 按数据集重复（band 内多行视为一个整体循环）；
 * groupBy 存在时按组输出并在组尾追加 groupfooter band；其余 band 按声明顺序静态输出。
 *
 * 已知限制：
 * - 循环区（detail band）内的跨行合并仅限 band 内行，展开时按模板行数原样应用；
 * - 静态带行打 _groupRoot 标记，使列统计只作用于明细行，避免汇总行数值被重复计入。
 */
export function expand(template: ReportTemplate, data: any[], params: Record<string, any> = {}): ExpandResult {
  const rows: Record<string, any>[] = [];
  const spanObj: Record<string, CellSpan[]> = {};
  const fxCells: { rowIndex: number; prop: string }[] = [];
  const colStats: Record<string, string> = {};
  const cellStyles: { rowIndex: number; prop: string; style: Record<string, string> }[] = [];

  template.columns.forEach((c) => {
    if (c.stats) colStats[c.prop] = c.stats;
  });

  const detailDs: any[] = Array.isArray(data) ? data : [];
  const detailBand = template.bands.find((b) => b.type === 'detail');
  const groupBy = template.groupBy ?? detailBand?.groupBy;
  const groupFooterBand = template.bands.find((b) => b.type === 'groupfooter');

  function putCell(rowIndex: number, prop: string, cell: ReportCell | undefined, ctx: ReportExprContext) {
    if (!cell) return;
    const absRow = rowIndex + 1;
    if (cell.fx) {
      rows[rowIndex][prop] = fillFxRow(cell.fx, absRow);
      fxCells.push({ rowIndex, prop });
    } else {
      // value 或 expr 统一走表达式求值：无 token 时原样返回，故静态文本不受影响
      const src = cell.expr != null && cell.expr !== '' ? cell.expr : (cell.value ?? '');
      rows[rowIndex][prop] = evalReportExpr(src, ctx);
    }
    if (cell.span && ((cell.span.rowSpan ?? 1) > 1 || (cell.span.colSpan ?? 1) > 1)) {
      if (!spanObj[prop]) spanObj[prop] = [];
      spanObj[prop].push({
        rowIndex,
        rowSpan: cell.span.rowSpan || 1,
        colSpan: cell.span.colSpan || 1,
      });
    }
    if (cell.style && Object.keys(cell.style).length) {
      cellStyles.push({ rowIndex, prop, style: cell.style });
    }
  }

  /** 静态输出一个 band（title/header/groupfooter/footer/summary/normal） */
  function emitStatic(band: ReportBand, ctx: ReportExprContext) {
    band.rows.forEach((row) => {
      const rowIndex = rows.length;
      // 静态带标记 _groupRoot：TableExtensionStats._setStat 用 !d._groupRoot 过滤，
      // 避免把汇总行自身的合计值再计入列统计导致翻倍
      rows.push({ _groupRoot: true });
      for (const prop in row.cols) putCell(rowIndex, prop, row.cols[prop], ctx);
    });
  }

  /** 输出一条明细记录（detail band 内多行共享同一记录上下文） */
  function emitDetail(rec: any, group: any[] | undefined, rownum: number) {
    if (!detailBand) return;
    const ctx: ReportExprContext = { row: rec, params, dataset: detailDs, group, rownum, page: 1 };
    detailBand.rows.forEach((row) => {
      const rowIndex = rows.length;
      rows.push({});
      for (const prop in row.cols) putCell(rowIndex, prop, row.cols[prop], ctx);
    });
  }

  // 按 bands 声明顺序输出；detail 循环展开，groupfooter 在分组场景下由 detail 分支消费
  let rownum = 0;
  for (const band of template.bands) {
    if (band.type === 'detail') {
      if (groupBy) {
        const map = new Map<string, any[]>();
        for (const rec of detailDs) {
          const k = String(rec[groupBy] ?? '');
          if (!map.has(k)) map.set(k, []);
          map.get(k)!.push(rec);
        }
        for (const [, recs] of map) {
          for (const rec of recs) {
            rownum++;
            emitDetail(rec, recs, rownum);
          }
          if (groupFooterBand) emitStatic(groupFooterBand, { row: undefined, params, dataset: detailDs, group: recs, rownum: 0, page: 1 });
        }
      } else {
        for (const rec of detailDs) {
          rownum++;
          emitDetail(rec, undefined, rownum);
        }
      }
    } else if (band.type === 'groupfooter' && groupBy) {
      // 分组场景下组尾已随 detail 分支输出，跳过避免重复
      continue;
    } else {
      emitStatic(band, { row: undefined, params, dataset: detailDs, group: undefined, rownum: 0, page: 1 });
    }
  }

  return { rows, spanObj, fxCells, colStats, cellStyles };
}
