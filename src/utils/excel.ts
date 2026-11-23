import { alphaLabel, concat, each, fill, findKey, get, groupBy, isArray, isEmpty, join, reject, upperCase } from "myfx";
import type { Table } from "../components/datadisplay/table/Table";

/**
 * 导出表格为 Excel 文件（基于 **exceljs**）。
 *
 * ⚠️ `exceljs` 是**可选运行时依赖**：仅在真正导出时才通过动态 `import()` 加载，
 * 不再进入库主入口的静态依赖图。`import()` 在包缺失（CDN / 未安装）时会**拒绝**，
 * 被下方 `catch` 接住 —— 此时**不抛错**，仅 `console.warn` 提示一次并安全退出。
 * 导出动作是 fire-and-forget，失败不影响调用方主流程。
 *
 * 为什么是 exceljs 而不是 xlsx-js-style：
 * - xlsx-js-style 是**样式专用 fork**，既不写原生图表、也不支持图片。
 * - exceljs 支持：单元格样式 / 合并 / 列宽行高 / 数字·日期格式 / 批注 / **图片嵌入**
 *   （图表以 echarts 渲染成的 PNG 按设计坐标 `addImage` 进同一张 sheet）。
 *   原生可编辑图表 exceljs 标准版同样不支持（需 SheetJS Pro），故本期图表 = 图片。
 */

/**
 * 动态加载 exceljs（可选运行时依赖），失败/缺失时 `console.warn` 一次并返回 `null`。
 */
async function ensureExceljs(): Promise<any> {
  let ExcelJS: any;
  try {
    // exceljs 是「可选运行时依赖」，仅在真正导出时按需加载；缺失时由下方 catch 兜底
    // （console.warn 一次并安全退出），不应阻断 dev server 启动。
    // 关键点：Vite 的 import-analysis 会**静态解析字面量裸模块名** `import("exceljs")`，
    // 找不到即报 "Failed to resolve import"。即便加 `/* @vite-ignore */`，字面量仍会被解析。
    // 故用**拼接出的变量**持有 specifier（Vite 官方推荐的规避写法），使分析器无法静态解析，
    // 构建期不再报错；运行时若未安装 exceljs，浏览器原生 import 失败 → 被下方 catch 接住。
    const exceljsSpec = "excel" + "js";
    const mod: any = await import(/* @vite-ignore */ exceljsSpec);
    ExcelJS = mod.default ?? mod;
  } catch (e) {
    console.warn(
      "[exportExcel] 未找到可选依赖 exceljs，已跳过 Excel 导出。",
      "如需导出请安装：npm i exceljs",
      (e as Error)?.message ?? e
    );
    return null;
  }
  if (!ExcelJS || !ExcelJS.Workbook) {
    console.warn("[exportExcel] 可选依赖 exceljs 不可用，已跳过 Excel 导出。如需导出请安装：npm i exceljs");
    return null;
  }
  return ExcelJS;
}

/**
 * DrawingML 长度单位 EMU：1 CSS 像素 @96dpi = 9525 EMU。
 * 图表锚点偏移（`nativeColOff/nativeRowOff`）与图片尺寸（`ext`）都靠它把页面像素换算进去。
 */
const EMU_PER_PIXEL = 9525;

/** 6-hex 颜色（如 `f4f4f4`）→ 8-hex argb（exceljs 用 `argb`）；已带 `#` 则先去 `#`。 */
function argb(rgb?: string): string {
  if (!rgb) return "FF000000";
  const h = rgb.replace(/^#/, "");
  if (h.length === 8) return h;
  if (h.length === 6) return "FF" + h;
  return "FF000000";
}

let spaceBeforeMerge = -1;

/**
 * 把**一张表**构建进指定的 exceljs worksheet（含表头合并 / 数据 / 合并区 / 列宽行高 /
 * 数字·日期格式 / 批注 / 逐格样式），所有坐标按 `origin`（行/列偏移，0 基）平移 ——
 * 多块并进同一张 sheet 时，每块带自己的 `origin`（来自 `buildSheet(doc)` 的 rowStart/colStart）。
 *
 * ⚠️ 模块级 `spaceBeforeMerge` 是**共享状态**，每次构建前必须重置为 `-1`：
 *    否则连续导出多张表时，第二张及以后的表头会继承上一张的遗留值而错乱。
 */
function buildTableSheet(
  ws: any,
  vtable: any,
  options: Record<string, any> = {},
  origin: { row?: number; col?: number } = { row: 0, col: 0 }
): void {
  spaceBeforeMerge = -1;
  const r0 = origin.row ?? 0;
  const c0 = origin.col ?? 0;
  const table = vtable;
  let cols = table.getRenderColumns();
  const headerBgColor = "f4f4f4";
  const borderColor = "333333";

  const omitColumns = options.omitColumns;
  const columns = options.columns;
  const useHeader = options.header !== false;
  const tailBlank = options.tailBlank !== false;
  const cellStyleProvider = options.cellStyleProvider;

  if (columns) {
    cols = table.allColumns.filter((col: any) => columns.includes(col.prop));
  } else if (omitColumns) {
    cols = reject(cols, (col: any) => omitColumns.includes(col.prop));
  }

  // ── 表头层级（多级表头）──
  const headerAry: string[][] = [];
  cols.forEach((c: any) => {
    fillHeader(headerAry, table._fieldMap.get(c.prop)!);
  });
  headerAry.reverse();
  const mergeHeaderAry: any[] = [];
  const mergeHeaderCol = true;
  const rowSpan: Record<string, Record<string, number>> = {};
  cols.forEach((c: any, cIndex: number) => {
    let colValueSize = 0;
    headerAry.forEach((ary, rIndex) => {
      if (!ary[cIndex]) {
        ary[cIndex] = "";
      } else {
        let sp = rowSpan[rIndex];
        if (!sp) sp = rowSpan[rIndex] = {};
        const label = ary[cIndex];
        if (sp[label] && label === ary[cIndex - 1]) {
          sp[label]++;
        } else {
          sp[label] = 1;
        }
        colValueSize++;
      }
    });
    if (!mergeHeaderCol) return;
    if (colValueSize < 2) {
      headerAry[0][cIndex] = headerAry[headerAry.length - 1][cIndex];
      mergeHeaderAry.push({ s: { r: 0, c: cIndex }, e: { r: headerAry.length - 1, c: cIndex } });
    }
  });
  each(rowSpan, (obj, rIndex) => {
    each(obj, (colSize, colLabel) => {
      if (colSize > 1) {
        const cIndex = headerAry[parseInt(rIndex)].findIndex((t) => t === colLabel);
        mergeHeaderAry.push({ s: { r: parseInt(rIndex), c: cIndex }, e: { r: parseInt(rIndex), c: cIndex + colSize - 1 } });
      }
    });
  });
  const headerRows = useHeader ? headerAry.length : 0;

  // ── 数据二维数组 ──
  const exportData: any[][] = [];
  if (useHeader) exportData.push(...headerAry);
  const data = table.getData();
  each(data, (item: any, i: number) => {
    const obj: any[] = [];
    cols.forEach((c: any) => {
      let v = get(item, c.prop, "");
      if (isArray(v)) v = join(v, ",");
      if (c.prop === "__index" || c.prop === "__selection") v = i + 1;
      obj.push(v);
    });
    exportData.push(obj);
  });
  if (tailBlank) exportData.push([""]);
  if (table.showFooter) {
    exportData.push([""]);
    exportData.push([""]);
    exportData.push([""]);
  }

  // ── 写单元格（带 origin 偏移）──
  exportData.forEach((row, r) => {
    row.forEach((v, c) => {
      const cell = ws.getCell(r0 + r + 1, c0 + c + 1);
      cell.value = v;
    });
  });

  // ── 合并区（表头 + 数据 span）──
  const mergeList: any[] = concat(useHeader ? mergeHeaderAry : [], []);
  const spanObj = table.getSpanData();
  each(spanObj, (ary: Record<string, any>[], prop) => {
    const startColIndex = cols.findIndex((v: any) => v.prop === prop);
    each(ary, ({ rowIndex, rowSpan: rs, colSpan }: any) => {
      const endColIndex = colSpan > 1 ? startColIndex + colSpan - 1 : startColIndex;
      const startRowIndex = rowIndex + headerRows;
      const endRowIndex = rs > 1 ? startRowIndex + rs - 1 : startRowIndex;
      mergeList.push({ s: { r: startRowIndex, c: startColIndex }, e: { r: endRowIndex, c: endColIndex } });
    });
  });
  // ⚠️ 合并的**执行**统一放在函数末尾（见文末注释）：exceljs 的合并区共享主格的
  // style 对象（引用），先合并再逐格刷样式 ⇒ 区内后写的列会覆盖整个合并区的样式。
  // ── 列宽（px → 字符单位，近似 px/7）──
  cols.forEach((c: any, i: number) => {
    const col = ws.getColumn(c0 + i + 1);
    if (!col.width) col.width = (c.width ?? 40) / 7;
  });

  // ── 行高（px → 磅）──
  const effRowHeight = table.vRowHeight > 0 ? table.vRowHeight : table.rowHeight;
  for (let i = 0; i < headerRows; i++) {
    const row = ws.getRow(r0 + i + 1);
    if (!row.height) row.height = getPound(table.headerHeight);
  }
  each(data, (_item: any, i: number) => {
    const rIndex = i + headerRows;
    const row = ws.getRow(r0 + rIndex + 1);
    if (!row.height) row.height = getPound(effRowHeight);
  });

  // ── 单元格样式（对齐 / 数字·日期格式 / 逐格样式 / 表头样式）──
  cols.forEach((c: any, colIndex: number) => {
    const startRowIndex = 1 + headerRows; // 数据起始行（1-based）
    // 表头
    for (let i = 1; i < headerRows + 1; i++) {
      const cell = ws.getCell(r0 + i, c0 + colIndex + 1);
      if (!cell.font) cell.font = {};
      cell.font.bold = true;
      // ⚠️ exceljs 的 vertical 合法域是 top/middle/bottom（写出时由它转成 xlsx 的
      // center，见 alignment-xform.js 的 validation.vertical）。写 "center" 会被
      // 判非法并**静默丢弃** ⇒ Excel 默认 bottom（字体靠下）。
      cell.alignment = { horizontal: c.headerAlign, vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(headerBgColor) } };
      const label = headerAry[i - 1][colIndex];
      if (i === headerRows || rowSpan[i - 1][label] > 1) {
        cell.border = { bottom: { style: "thin", color: { argb: argb(borderColor) } } };
      }
    }
    // 数据
    for (let R = startRowIndex; R <= startRowIndex + data.length - 1; ++R) {
      const cell = ws.getCell(r0 + R, c0 + colIndex + 1);
      // 数据下标（0-based）：ws 行号从 r0+1 起 ⇒ 数据 i 落在 ws 行 r0+i+1。
      // ⭐⭐⭐ 这里必须 -1 —— 曾写成 `R - headerRows`（整体 +1），逐格样式全行
      // 错位一行：标题行拿到 r1 的灰底、二级表头行拿到明细行的空样式（真机
      // probe-export-style 实证）。探针要覆盖「逐格样式随行变化」才防得住。
      const di = R - headerRows - 1;
      if (cell.value === undefined || cell.value === null) {
        // 值为空：仅当调用方给了逐格样式钩子才补一个空格文本格（否则背景涂在空格上整格丢失）
        if (!cellStyleProvider || di >= data.length) continue;
        cell.value = "";
      }
      cell.alignment = { horizontal: c.align, vertical: "middle", wrapText: true };
      // ⚠️ 只有该格的值确实能当数字用时才标数字类型（避免文本列被当数字读成 NaN）
      if (c.dataType === "number" && isNumericCell(cell.value)) {
        cell.value = Number(cell.value);
        let pt = c.pattern;
        if (pt) {
          if (pt[0] === ",") pt = "#" + pt;
          pt += `;-${pt};0;`;
          cell.numFmt = pt;
        }
      } else if (c.dataType === "date" || c.dataType === "datetime") {
        cell.numFmt = c.pattern;
      }
      // 调用方逐格样式钩子（默认不传 = 行为不变）
      if (cellStyleProvider && di < data.length) {
        const prov = cellStyleProvider(di, c.prop);
        if (prov) applyStyle(cell, prov);
      }
    }
  });

  // ── 统计区 ──
  if (table.showFooter && !isEmpty((table as any).statsLabelMap)) {
    cols.forEach((c: any, colIndex: number) => {
      const statKey = (table as any).statsColLabelMap?.[c.prop];
      const groupRowStartIndex = data.length + headerRows + (tailBlank ? 2 : 1);
      const colName = c0 + colIndex + 1;
      const cellTitle = ws.getCell(r0 + groupRowStartIndex, colName);
      const cellVal = ws.getCell(r0 + groupRowStartIndex + 1, colName);
      cellTitle.value = cellTitle.value ?? "";
      cellVal.value = cellVal.value ?? "";
      if (statKey) {
        const fnName = findKey((table as any).statsLabelMap, (v: any) => v === statKey);
        cellVal.value = statKey;
        const statFn = (table as any).TableConfigPane?.statsColStatMap?.[c.prop];
        const sRow = 1 + headerRows;
        const eRow = data.length + headerRows;
        if (statFn) {
          let fn = fnName;
          if (fn === "mean") fn = "AVERAGE";
          else if (fn === "notfilled") fn = "COUNTBLANK";
          const range = `${getColLetter(colName)}${sRow}:${getColLetter(colName)}${eRow}`;
          let fStr: string;
          if (fn === "range") fStr = `MAX(${range}) - MIN(${range})`;
          else if (fn === "filled") fStr = `SUMPRODUCT(N(LEN(${range})>0))`;
          else fStr = `${upperCase(fn)}(${range})`;
          let z = c.pattern;
          if (c.dataType === "number") {
            if (z[0] === ",") z = "#" + z;
            z += `;-${z};0;`;
          }
          cellTitle.value = { formula: fStr, result: 0 };
          if (z) cellTitle.numFmt = z;
        } else {
          cellTitle.value = (table as any)._columnFootMap?.get(c.prop)?.statValue ?? "-";
        }
      }
      cellTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(headerBgColor) } };
      cellVal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(headerBgColor) } };
      cellVal.border = { top: { style: "thin", color: { argb: argb(borderColor) } } };
    });
  }

  // ── 批注 ──
  const allNotes = table.getNotes();
  const noteGroup = groupBy(allNotes, (n: any) => n[1]);
  cols.forEach((c: any, colIndex: number) => {
    const ns = noteGroup[c.prop];
    if (ns) {
      ns.forEach(([rowIndex, _prop, cmt]: any) => {
        const rIndex = parseInt(rowIndex + "") + 1 + headerRows;
        const cell = ws.getCell(r0 + rIndex, c0 + colIndex + 1);
        cell.note = cmt;
      });
    }
  });
  // ── 合并区执行（必须在**所有**单元格样式写完之后）──
  // ⭐⭐⭐ exceljs 的合并区共享主格的 style 对象（`cell.style === master.style`，
  // 同一引用）。若先合并再逐格刷样式，区内每个格的 `cell.alignment = …` 都在改
  // 同一个对象 —— **最后一列的样式覆盖整个合并区**（实测：标题行横跨 19 列、
  // 末列月份右对齐 ⇒ 整条标题变右对齐；node 最小复现 _repro_align 证实）。
  // 所以这里放到最后执行：先各写各的，再合并 ⇒ 合并后全区统一取主格样式。
  for (const m of mergeList) {
    ws.mergeCells(r0 + m.s.r + 1, c0 + m.s.c + 1, r0 + m.e.r + 1, c0 + m.e.c + 1);
  }
}

/** 把归一化样式（exceljs 形状：font/fill/alignment/border）merge 到 cell 上。 */
function applyStyle(cell: any, s: Record<string, unknown> | undefined): void {
  if (!s) return;
  if (s.font) cell.font = { ...(cell.font || {}), ...(s.font as object) };
  if (s.fill) cell.fill = { ...(cell.fill || {}), ...(s.fill as object) };
  if (s.alignment) cell.alignment = { ...(cell.alignment || {}), ...(s.alignment as object) };
  if (s.border) cell.border = { ...(cell.border || {}), ...(s.border as object) };
}

/**
 * 列序号（1-based）→ 列字母（A/B/...）。
 *
 * ⚠️ 入参是 **1-based**：`getColLetter(1)` = `A`。0-based 下标请自行 `+1`
 * （设计器侧常见口径 `alphaLabel(0) = A` 等价于 `getColLetter(1)`）。
 *
 * Excel 列名是**双射 26 进制**（1→A / 26→Z / 27→AA / 52→AZ / 53→BA），
 * 没有 0 位 —— 这是它不能直接套 `toString(26)` 的原因。
 *
 * `Table#getColumnCharByIndex`（0-based）与 `Editable#_getColumnChar`（0-based）
 * 是本文件的 0-based 变体，三者结果一致，下游不要再自写第四份。
 */
export function getColLetter(col: number): string {
  if (!(col >= 1)) return "";
  return alphaLabel(col - 1);
}

/**
 * 第 `col1`（1-based）列的实际像素宽度。与 `buildTableSheet` 的写出口径互逆：
 * 那边写 `px / 7`（字符单位），这边 × 7 还原；未设置 = Excel 默认宽 8.43 字符 ≈ 64px。
 */
function colWidthPx(ws: any, col1: number): number {
  const w = ws.getColumn(col1)?.width;
  return typeof w === "number" && w > 0 ? w * 7 : 64;
}

/**
 * 第 `row1`（1-based）行的实际像素高度。与 `buildTableSheet` 的写出口径互逆：
 * 那边写磅（`px × 72/96`），这边 × 4/3 还原；未设置 = Excel 默认 15 磅 ≈ 20px。
 */
function rowHeightPx(ws: any, row1: number): number {
  const h = ws.getRow(row1)?.height;
  return typeof h === "number" && h > 0 ? (h * 4) / 3 : 20;
}

/**
 * 把报表页像素坐标 (x, y)（原点 = A1 左上角）**归一化**为 Excel 原生锚点：
 * 沿网格逐格累加列宽/行高，得到落点所在格（0-based）与格内残余像素。
 * 这正是 Excel 自身保存文件时的序列化方式 —— Excel / WPS 都严格按此渲染。
 */
function normalizePixelAnchor(
  ws: any,
  x: number,
  y: number
): { col: number; row: number; colRemainPx: number; rowRemainPx: number } {
  let col = 0;
  let remain = Math.max(0, x);
  // 安全上限：防脏数据（超大 x）导致死循环
  while (remain >= colWidthPx(ws, col + 1) && col < 1000) {
    remain -= colWidthPx(ws, col + 1);
    col++;
  }
  let row = 0;
  let rowRemain = Math.max(0, y);
  while (rowRemain >= rowHeightPx(ws, row + 1) && row < 10000) {
    rowRemain -= rowHeightPx(ws, row + 1);
    row++;
  }
  return { col, row, colRemainPx: remain, rowRemainPx: rowRemain };
}

/**
 * 把 workbook 写出：浏览器走 `writeBuffer` + Blob 触发下载；node（验证用）写盘。
 */
async function writeOut(wb: any, fileName: string): Promise<void> {
  const buf: any = await wb.xlsx.writeBuffer();
  // node 环境走写盘；浏览器（Vite）走 Blob 下载。
  // （node 22 也暴露了 `URL.createObjectURL`，故用 `process.versions.node` 判定更稳。）
  const isNode = typeof process !== "undefined" && typeof (process as any).versions?.node === "string";
  if (!isNode) {
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName + ".xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const fs = await import("fs");
    fs.writeFileSync(fileName + ".xlsx", Buffer.from(buf));
  }
}

/**
 * 单表导出（**向后兼容**，行为与原 `exportExcel` 一致）：构建一张 ws 独占一个 sheet 并写出。
 */
export async function exportExcel(
  vtable: Table,
  fileName: string = "cui-table-export",
  sheetName: string = "Sheet1",
  options: Record<string, any> = {}
): Promise<void> {
  const ExcelJS = await ensureExceljs();
  if (!ExcelJS) return;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  buildTableSheet(ws, vtable, options, { row: 0, col: 0 });
  await writeOut(wb, fileName);
}

/**
 * **多表合并导出 + 可选图表**：把多张表（可来自不同实例）按各自的 **设计坐标原点**
 * （`origin.row` / `origin.col`）合并进**同一张 sheet**，一次性写出；并可把图表
 * （已渲染好的 PNG，见 `charts`）按设计像素坐标嵌入同一 sheet。
 *
 * ⚠️ 调用方负责算原点：报表设计器用 `model/sheet.ts` 的 `buildSheet(doc)` 得到每个块的
 *    `rowStart` / `colStart`（含 `blockGap` 间隔列），那份是"设计 → 纸"的唯一真源。
 *
 * `charts` 中每张图：`{ png, x, y, w, h }` —— `png` 为 `data:image/png;base64,...`
 * （由 echarts `getDataURL` 产出），`x/y/w/h` 为图表在页面上的像素坐标
 * （原点 = 报表页左上角 = Excel A1）。图表以**图片**形式嵌入（exceljs 标准版不支持原生图表）。
 *
 * 每个表可带独立 `options`（如各自的 `cellStyleProvider` / `header` / `tailBlank`），互不干扰。
 */
export async function exportSheetTables(
  tables: Array<{ vtable: any; origin?: { row?: number; col?: number }; options?: Record<string, any> }>,
  fileName: string = "cui-export",
  sheetName: string = "Sheet1",
  charts?: Array<{ png: string; x?: number; y?: number; w?: number; h?: number }>
): Promise<void> {
  const ExcelJS = await ensureExceljs();
  if (!ExcelJS) return;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  for (const t of tables) {
    buildTableSheet(ws, t.vtable, t.options ?? {}, t.origin ?? { row: 0, col: 0 });
  }
  if (charts && charts.length) {
    for (const ch of charts) {
      if (!ch.png) continue;
      const imgId = wb.addImage({ base64: ch.png, extension: "png" });
      // ⭐⭐⭐ 锚点必须**归一化**：nativeCol/nativeRow = 像素坐标落点所在的格，
      //  残余部分才换算 EMU 塞进 nativeColOff/nativeRowOff。
      //  早期实现把整页偏移全部塞进 colOff/rowOff 且锚定格固定 A1 —— exceljs 写出的
      //  XML 虽然合法（_repro-anchor 实证），但 Excel/WPS 对**超出所在格宽度的
      //  colOff** 不做归一化渲染 ⇒ 所有图表全部贴回左上角。
      //  逐格累加的网格尺寸取自 buildTableSheet 的真实写出值：
      //  列宽 = 字符单位 × 7（px/7 的逆运算，未设置 = Excel 默认 8.43 ≈ 64px）；
      //  行高 = 磅 × 4/3（磅 = px × 72/96 的逆运算，未设置 = Excel 默认 15pt ≈ 20px）。
      const anchor = normalizePixelAnchor(ws, ch.x ?? 0, ch.y ?? 0);
      ws.addImage(imgId, {
        // ⭐⭐⭐ 必须写 `native*` 形式，`{col,row,colOff,rowOff}` 会被 exceljs 静默丢弃：
        //  lib/doc/anchor.js 的构造函数在 `address.col !== undefined` 时走 `set col`，
        //  只用小数部分反算偏移，`colOff/rowOff` 根本不读 ⇒ 图表永远贴在锚点上。
        // ⭐ xdr 锚点 col/row **0-based**（0 = 第1列/第1行），偏移量单位必须是 **EMU**（9525/px @96dpi）。
        tl: {
          nativeCol: anchor.col,
          nativeRow: anchor.row,
          nativeColOff: Math.round(anchor.colRemainPx * EMU_PER_PIXEL),
          nativeRowOff: Math.round(anchor.rowRemainPx * EMU_PER_PIXEL),
        },
        ext: { width: ch.w ?? 200, height: ch.h ?? 100 },
      });
    }
  }
  await writeOut(wb, fileName);
}

/**
 * 该单元格的值能否安全地标成 Excel 数字类型。
 * 判据必须是**值本身**，而不是列的 `dataType`（列级 number 但格是表头文字→NaN）。
 */
function isNumericCell(v: any): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return false;
    return Number.isFinite(Number(t.replace(/,/g, "")));
  }
  return false;
}

function getDPI() {
  const div = document.createElement("div");
  div.style.cssText = "height: 1in; left: -100%; position: absolute; top: -100%; width: 1in;";
  document.body.appendChild(div);
  const devicePixelRatio = window.devicePixelRatio || 1;
  const dpi = div.offsetWidth * devicePixelRatio;
  return dpi;
}

function getPound(pxValue: number) {
  return (pxValue * 72) / getDPI();
}

function fillHeader(headerAry: string[][], col: any, level = 0) {
  let ary = headerAry[level];
  if (!ary) {
    ary = headerAry[level] = level > 0 ? fill([], "", 0, spaceBeforeMerge) : [];
  }
  if (col.parentComponent.constructor.name === "Column") {
    if (spaceBeforeMerge < 0) {
      spaceBeforeMerge = ary.length;
    }
    fillHeader(headerAry, col.parentComponent, level + 1);
  } else if (spaceBeforeMerge > -1 && level === 0) {
    spaceBeforeMerge = -1;
  }
  ary.push(col.label ?? "");
}
