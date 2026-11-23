import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/entries/ce-portal'
import { Portal } from '../src/components/datadisplay/portal/Portal'
import { normalizeLayout, resolveColumns } from '../src/components/datadisplay/portal/layout'

/** 应用侧实际使用的参数（见 compelem-portal-builder 的 PORTAL_MIN_COL_WIDTH） */
const APP = { minColumnWidth: 120, maxColumns: 20, gap: 10, declared: 12 }

function colsAt(width: number, patch: Partial<Parameters<typeof resolveColumns>[0]> = {}) {
  return resolveColumns({ ...APP, stored: undefined, width, ...patch })
}

describe('resolveColumns', () => {
  it('关闭自适应（minColumnWidth <= 0）时列数恒为声明值', () => {
    for (const width of [800, 1280, 1920, 2560]) {
      expect(colsAt(width, { minColumnWidth: 0 }), `width=${width}`).toBe(12)
    }
  })

  it('未测量到宽度时退回声明值', () => {
    expect(colsAt(0)).toBe(12)
    expect(colsAt(-1)).toBe(12)
  })

  it('窄屏不降：1280 及以下仍是声明列数', () => {
    expect(colsAt(1024)).toBe(12)
    expect(colsAt(1280)).toBe(12)
    expect(colsAt(1440)).toBe(12)
    expect(colsAt(1560)).toBe(12)
  })

  it('宽屏按最小列宽提升：1920 得 14 列、2560 得 19 列', () => {
    expect(colsAt(1700)).toBe(13)
    expect(colsAt(1920)).toBe(14)
    expect(colsAt(2560)).toBe(19)
  })

  it('maxColumns 封顶', () => {
    expect(colsAt(2730)).toBe(20)
    expect(colsAt(3840)).toBe(20)
    // 上限传 0 / 缺省 → 回退到 24（超宽屏兜底），不是「不限」
    expect(colsAt(3840, { maxColumns: 0 })).toBe(24)
  })

  it('存档列数优先于声明列数：窄屏读宽屏布局不会降列', () => {
    // 用户在 1920 上摆到过第 13 列 → 存档 columns=14；换到 1024 屏仍按 14 列渲染，
    // 否则那张卡片会被 normalizeLayout 夹回左边（见下方 normalizeLayout 用例）
    expect(colsAt(1024, { stored: 14 })).toBe(14)
    expect(colsAt(1024, { stored: 14, minColumnWidth: 0 })).toBe(14)
  })

  it('列数随宽度单调不减', () => {
    let prev = 0
    for (let width = 320; width <= 3840; width += 8) {
      const cur = colsAt(width)
      expect(cur, `width=${width}`).toBeGreaterThanOrEqual(prev)
      prev = cur
    }
  })

  it('gap = 0 时按纯列宽整除', () => {
    expect(colsAt(1200, { gap: 0, minColumnWidth: 120 })).toBe(12) // 1200/120 = 10 → 12
    expect(colsAt(2400, { gap: 0, minColumnWidth: 120 })).toBe(20) // 2400/120 = 20
  })
})

describe('normalizeLayout 与列数的关系', () => {
  const item = { id: 'w1', type: 'chart', col: 13, row: 0, w: 1, h: 2 }

  it('渲染列数够用时，第 13 列原样保留', () => {
    const { items } = normalizeLayout({ items: [item] }, 14, 0)
    expect(items[0].col).toBe(13)
  })

  it('渲染列数不足时会被夹回左侧 —— 这就是「只增不减」的理由', () => {
    const { items } = normalizeLayout({ items: [item] }, 12, 0)
    expect(items[0].col).toBe(11)
  })

  it('提升后的列数能让两张卡片不重叠', () => {
    const layout = {
      items: [
        { id: 'a', type: 'x', col: 0, row: 0, w: 2, h: 1 },
        { id: 'b', type: 'x', col: 12, row: 0, w: 2, h: 1 },
      ],
    }
    const wide = normalizeLayout(layout, 14, 0).items
    expect(wide.map((it) => it.col)).toEqual([0, 12])

    // 反例：按 12 列归一化，第二张被夹到 col=10，与第一张仍是并列但可用区缩水；
    // 若第一张宽到 4 列，就会出现真正的位置冲突
    const narrow = normalizeLayout(layout, 12, 0).items
    expect(narrow[1].col).toBe(10)
  })
})

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 30))
}

/** jsdom 不做布局，`getBoundingClientRect` 恒返回 0 —— 这里给网格喂一个固定宽度 */
function stubWidth(width: number) {
  const rect = {
    width,
    height: 800,
    top: 0,
    left: 0,
    right: width,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as unknown as DOMRect
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)
}

describe('ce-portal 渲染列数', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('挂载时能测到网格宽度（观测器挂得上）', async () => {
    const spy = stubWidth(1930)
    const el = document.createElement('ce-portal') as Portal
    document.body.append(el)
    await flush()

    // 测不到宽度 → 观测器 observe 不上去 → 自适应永远是死的。
    // 这条断言就是在盯 mounted 时模板是否已渲染。
    expect((el as any).__gridWidth).toBe(1930)
    expect((el as any).__colsRo).not.toBeNull()
    spy.mockRestore()
  })

  it('开自适应：宽屏提升列数，窄屏保持声明值', async () => {
    const wide = stubWidth(1930)
    const wideEl = document.createElement('ce-portal') as Portal
    wideEl.setAttribute('columns', '12')
    wideEl.setAttribute('min-column-width', '120')
    wideEl.setAttribute('max-columns', '20')
    document.body.append(wideEl)
    await flush()
    expect((wideEl as any).__effectiveCols()).toBe(14)
    expect(wideEl.style.getPropertyValue('--portal-columns').trim()).toBe('14')
    wide.mockRestore()

    document.body.innerHTML = ''
    const narrow = stubWidth(1280)
    const narrowEl = document.createElement('ce-portal') as Portal
    narrowEl.setAttribute('columns', '12')
    narrowEl.setAttribute('min-column-width', '120')
    document.body.append(narrowEl)
    await flush()
    expect((narrowEl as any).__effectiveCols()).toBe(12)
    narrow.mockRestore()
  })

  it('关自适应（不传 min-column-width）：列数恒为 columns', async () => {
    const spy = stubWidth(1930)
    const el = document.createElement('ce-portal') as Portal
    el.setAttribute('columns', '8')
    document.body.append(el)
    await flush()
    expect((el as any).__effectiveCols()).toBe(8)
    spy.mockRestore()
  })
})
