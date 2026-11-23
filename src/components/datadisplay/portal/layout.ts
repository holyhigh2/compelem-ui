/**
 * 门户布局模型（组件库内部唯一真源）
 *
 * 与旧实现的关键差异：
 *  - 布局是**纯数据**（列/行/宽/高），不依赖 DOM 测量，也不依赖 window.innerHeight；
 *    因此嵌入任意高度的容器都成立，并且可以序列化/回填。
 *  - 所有外部输入都过 `normalizeLayout()`：非法 id 重排、尺寸夹取；**不做重力压缩**
 *   （所见即所得，drop 位置即最终位置；compactItems 保留导出供需要收紧布局的场合使用）。
 *  - 像素坐标只用于拖拽命中计算（`PortalEditor.__cellFromPoint`），不写回模型。
 */

import { clamp } from "myfx"

export const LAYOUT_VERSION = 1
/** 行数上限：只用于防止脏数据里的超大 row 把网格撑爆 */
export const MAX_ROWS = 400

export interface LayoutItem {
  id: string
  type: string
  /**
   * 挂件实例标题（空 = 用挂件类型的标题）。
   *
   * 必须挂在 item 上而不是从类型推导：同一个 `tpl-list` 可以既是「我的待办」
   * 又是「消息列表」，靠类型名两张卡都叫「列表挂件」，用户没法区分。
   *
   * 编辑器新增卡片时只在出现重名时才写入这里（`列表挂件 2`），
   * 不重名就留空 —— 空值能跟着挂件库的标题改名走，快照不能。
   */
  title?: string
  /**
   * 不显示标题栏（纯内容卡片，如欢迎卡片）。
   *
   * 和 `title` 空串不同：空串仍会回落到挂件类型名，这里则是明确不画标题栏。
   * 编辑态的卡片外框仍保留操作按钮。
   */
  hideTitle?: boolean
  /** 0-based 列起点 */
  col: number
  /** 0-based 行起点 */
  row: number
  /** 横跨列数 >= 1 */
  w: number
  /** 横跨行数 >= 1 */
  h: number
  config?: Record<string, any>
}

export interface PortalLayout {
  version?: number
  columns?: number
  items: LayoutItem[]
}

export interface WidgetSize {
  w: number
  h: number
}

let SEED = 0

export function makePortalItemId(): string {
  SEED += 1
  return `pi${Date.now().toString(36)}${SEED.toString(36)}`
}

export function clampInt(value: any, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isFinite(n)) return fallback
  return clamp(Math.floor(n), min, max)
}

export function overlaps(a: LayoutItem, b: LayoutItem): boolean {
  return a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h
}

/** 向上重力压缩：按 (row, col) 稳定排序后逐个"能多高就多高" */
export function compactItems(items: LayoutItem[], columns: number): LayoutItem[] {
  const sorted = [...items].sort((a, b) => a.row - b.row || a.col - b.col)
  const placed: LayoutItem[] = []
  for (const it of sorted) {
    const w = clampInt(it.w, 1, columns, 1)
    let row = 0
    let candidate: LayoutItem = { ...it, w, col: clampInt(it.col, 0, columns - w, 0), row }
    while (row < MAX_ROWS && placed.some((p) => overlaps(candidate, p))) {
      row += 1
      candidate = { ...candidate, row }
    }
    placed.push(candidate)
  }
  return placed
}

/** 第一个能放下 w×h 的空位（自上而下、自左而右） */
export function findFreeCell(items: LayoutItem[], w: number, h: number, columns: number): { col: number; row: number } {
  for (let row = 0; row <= MAX_ROWS; row += 1) {
    for (let col = 0; col <= columns - w; col += 1) {
      const probe: LayoutItem = { id: '__probe', type: '', col, row, w, h }
      if (!items.some((it) => overlaps(it, probe))) return { col, row }
    }
  }
  return { col: 0, row: MAX_ROWS }
}

/** 挂件声明里的尺寸是 `行-列`（如 '1-2' 表示 1 行 2 列） */
export function parseWidgetSize(size: any): WidgetSize {
  if (typeof size === 'object' && size) {
    return { w: clampInt(size.w, 1, 48, 1), h: clampInt(size.h, 1, MAX_ROWS, 1) }
  }
  const parts = String(size ?? '').split(/[-x×]/).map((s) => parseInt(s.trim(), 10))
  return {
    w: clampInt(parts[1], 1, 48, 2),
    h: clampInt(parts[0], 1, MAX_ROWS, 2),
  }
}

/** 挂件声明的唯一键：优先 id，其次 title */
export function widgetKey(def: any): string {
  return String(def?.id ?? def?.title ?? '')
}

/**
 * 只有挂件清单、没有显式布局时使用：按声明顺序自动铺满网格。
 * 用于 `ce-portal` 的向后兼容（旧用法只传 widgets）。
 */
export function layoutFromWidgets(widgets: any[], columns: number): LayoutItem[] {
  const cols = clampInt(columns, 1, 48, 12)
  const placed: LayoutItem[] = []
  const ids = new Set<string>()
  widgets?.forEach((def) => {
    const type = widgetKey(def)
    if (!type) return
    const size = parseWidgetSize(def.size)
    const w = Math.min(size.w, cols)
    const h = size.h
    const pos = findFreeCell(placed, w, h, cols)
    let id = type
    let n = 1
    while (ids.has(id)) {
      n += 1
      id = `${type}#${n}`
    }
    ids.add(id)
    placed.push({ id, type, col: pos.col, row: pos.row, w, h })
  })
  return placed
}

export interface ColumnCountOptions {
  /** prop 声明的列数 */
  declared: number
  /** 存档里的列数（`layout.columns`）：可能因宽屏摆放而被提升过 */
  stored?: number
  /** 网格实测宽度；<= 0 表示尚未测量，退回声明值 */
  width: number
  /** 单元格间距 */
  gap: number
  /** 每列最小宽度，<= 0 表示关闭自适应 */
  minColumnWidth: number
  /** 自适应列数上限 */
  maxColumns: number
}

/**
 * 渲染实际使用的列数。
 *
 * 规则：`max(声明列数, 存档列数, 按最小列宽算出的列数)`，上限 `maxColumns`。
 *
 * **「只增不减」是硬约束**：布局里存的 `col` 是绝对列索引，一旦渲染列数小于
 * 布局用到的列上界，`normalizeLayout` 就会把越界项夹回来、和同列卡片重叠。
 * 所以 `declared` 在这里是下限而不是定值。
 *
 * 第二项 `stored` 不能省：用户在宽屏摆到过第 13 列时存档列数是 14，而 prop 可能
 * 还是 12 —— 只取 prop 的话，同一份配置换到窄屏就会丢卡片。代价是窄屏读宽屏布局
 * 时列宽被压缩（挤，但位置不错乱），换来同一份布局在所有宽度下都不需要迁移。
 */
export function resolveColumns(opts: ColumnCountOptions): number {
  const declared = Math.max(1, opts.declared || 12)
  const stored = Number(opts.stored)
  const base = Math.max(declared, Number.isFinite(stored) ? Math.floor(stored) : 0)
  const cap = Math.max(base, opts.maxColumns || 24)
  const minW = opts.minColumnWidth
  if (!(minW > 0) || !(opts.width > 0)) return base
  const gap = opts.gap || 0
  const auto = Math.floor((opts.width + gap) / (minW + gap))
  return Math.max(base, Math.min(cap, auto))
}

/**
 * 把任意来源的布局洗成合法布局。
 *
 * 注：编辑器可能在挂件清单尚未下发时就拿到布局，所以这里**不丢弃未知 type**，
 * 只保证几何合法、id 唯一、项数不超限。
 */
export function normalizeLayout(raw: any, columns: number, maxWidgets: number): PortalLayout {
  const cols = clampInt(columns, 1, 48, 12)
  // 0 = 不限。不能直接 clampInt：clampInt 的最小值是 1，会把"不限"夹成只留 1 项。
  const limit = maxWidgets > 0 ? clampInt(maxWidgets, 1, 512, 0) : 0
  const rawItems: any[] = Array.isArray(raw?.items) ? raw.items : []
  const seen = new Set<string>()
  const items: LayoutItem[] = []

  for (const r of rawItems) {
    if (limit > 0 && items.length >= limit) break
    if (!r || typeof r !== 'object') continue
    const type = typeof r.type === 'string' ? r.type : ''
    if (!type) continue

    const w = clampInt(r.w, 1, cols, 2)
    const h = clampInt(r.h, 1, MAX_ROWS, 2)

    let id = typeof r.id === 'string' && r.id ? r.id : makePortalItemId()
    if (seen.has(id)) id = makePortalItemId()
    seen.add(id)

    // 标题是用户可编辑的实例数据，必须在归一化里显式保留 ——
    // 这里是白名单重建对象，漏一个字段就等于把它从存档里洗掉。
    const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim() : ''

    items.push({
      id,
      type,
      ...(title ? { title } : {}),
      ...(typeof r.hideTitle === 'boolean' ? { hideTitle: r.hideTitle } : {}),
      col: clampInt(r.col, 0, Math.max(0, cols - w), 0),
      row: clampInt(r.row, 0, MAX_ROWS, 0),
      w,
      h,
      config: r.config && typeof r.config === 'object' && !Array.isArray(r.config) ? { ...r.config } : undefined,
    })
  }

  // 不做重力压缩（compactItems）：编辑器是所见即所得 —— 拖到哪就停在哪，
  // drop 后再上浮会与 ghost 预览位置不一致（2026-10-31 按使用者反馈移除）。
  return { version: LAYOUT_VERSION, columns: cols, items }
}
