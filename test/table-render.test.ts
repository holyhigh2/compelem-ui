import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 表格大批量列的渲染开销护栏。
 *
 * jsdom 没有排版能力、`ce-table` 的列注册依赖真实 slot 时序（`Table.mounted` 里的
 * `ColumnConfigPane` 在 jsdom 下直接抛异常），所以行为验证放在浏览器探针里：
 * 100 列 / 22 行 / 2000 行数据，首屏样式+布局 161ms → 104ms，单格 JS 6.6µs → 2.8µs
 * （`SCALE` 曲线：202 列时 44.6ms → 10.9ms）。
 *
 * 这里守住会被无声改回去的三件事：跳过渲染的样式、开关的实现方式、热路径的索引查找。
 */
const root = process.cwd()
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const tableSource = stripComments(readFileSync(join(root, 'src/components/datadisplay/table/Table.ts'), 'utf8'))
const spanSource = stripComments(readFileSync(join(root, 'src/components/datadisplay/table/TableExtensionSpan.ts'), 'utf8'))
const tableScss = stripComments(readFileSync(join(root, 'src/components/datadisplay/table/style.scss'), 'utf8'))

describe('ce-table 空值占位', () => {
  it('不再提供表级 emptyValue，空值只走 Column.emptyText', () => {
    const columnSource = stripComments(readFileSync(join(root, 'src/components/datadisplay/table/Column.ts'), 'utf8'))
    const typesSource = readFileSync(join(root, 'src/components/datadisplay/table/types.ts'), 'utf8')
    expect(tableSource).not.toMatch(/emptyValue/)
    expect(tableSource).toMatch(/html === '' \|\| isNil\(html\) \|\| \(typeof html === 'number' && Number\.isNaN\(html\)\)/)
    expect(tableSource).toMatch(/html = col\.emptyText \?\? ''/)
    expect(columnSource).toMatch(/@prop\(\{ type: String \}\) emptyText = ''/)
    expect(typesSource).toMatch(/emptyText\?: string;/)
  })
})

describe('ce-table 逐格跳过渲染', () => {
  it('格子按 content-visibility: auto 跳过视口外渲染', () => {
    expect(tableScss).toMatch(/\.ce-table-cell\s*\{[^}]*content-visibility:\s*auto/)
  })

  it('关闭标记把 content-visibility 还原成 visible', () => {
    expect(tableScss).toMatch(/\.ce-table\.is-no-render-opt \.ce-table-cell\s*\{[^}]*content-visibility:\s*visible/)
  })

  it('optimizeRender 默认开启', () => {
    expect(tableSource).toMatch(/@prop optimizeRender = true/)
  })

  it('改开关只切根元素 class，不走 render', () => {
    // 写进 render 的 `classes({...})` 会让改开关触发整表重渲染
    expect(tableSource).toMatch(/@watch\('optimizeRender'[\s\S]{0,600}?renderRoot\?\.classList\.toggle\('is-no-render-opt'/)
  })
})

describe('ce-table 填充热路径', () => {
  it('_fillRow 每行只建一次格子索引，逐格全行查找只留给 __legacyFill 分支', () => {
    const body = tableSource.match(/_fillRow\(row: HTMLElement, rowIndex: number[^)]*\)\s*\{([\s\S]*?)\n  \}/)
    expect(body, '_fillRow 实现缺失').toBeTruthy()
    expect(body![1]).toMatch(/const legacy = this\.__legacyFill/)
    expect(body![1]).toMatch(/const cellMap = new Map<string, HTMLElement>\(\)/)
    expect(body![1]).toMatch(/const contentMap = new Map<string, HTMLElement>\(\)/)
    // 逐格 `row.querySelector('.ce-table-cell[column=…]')` 是 O(行内格子数)，100 列时这一段最贵，
    // 默认路径必须仍走 Map 直取（旧写法只能出现在 `legacy ?` 的另一支）
    expect(body![1]).toMatch(/const cellEl = legacy\s*\?[\s\S]{0,260}?: cellMap\.get\(c\.prop\)/)
    expect(body![1]).toMatch(/const content = legacy\s*\?[\s\S]{0,260}?: contentMap\.get\(c\.prop\)/)
  })

  it('__legacyFill 默认关闭', () => {
    expect(tableSource).toMatch(/__legacyFill = false/)
  })

  it('文本写入走 writeText（复用节点、值未变不写）', () => {
    expect(tableSource).toMatch(/writeText\(textContentEl, html\)/)
  })

  it('无合并数据时 __matchSpanStyle 直接返回', () => {
    // force 只服务 __legacyFill 压测分支，默认路径仍由 __hasSpan 早退
    expect(spanSource).toMatch(/if \(!force && !this\.__hasSpan\) return/)
    expect(tableSource).toMatch(/__matchSpanStyle\(cellEl, rowIndex, c\.prop, legacy\)/)
  })

  it('合并痕迹用 SPAN_MARK 判定，不再逐格 remove 7 个 class', () => {
    expect(spanSource).toMatch(/cellEl\.hasAttribute\(SPAN_MARK\)/)
  })
})

describe('ce-table 列窗口', () => {
  it('窗口外的列在 _fillRow 里整列跳过', () => {
    expect(tableSource).toMatch(/if \(win\) \{\s*const si = this\.#scrollIdx\?\.get\(c\.prop\)/)
  })

  it('横向滚动后补当前窗口的格子', () => {
    // h 分支：行位移之后必须同步窗口，否则滚进来的列是空的
    expect(tableSource).toMatch(/rowEl\.style!\.transform = `translateX\(\$\{this\.paddingLeft - corrected\}px\)`[\s\S]{0,400}?this\.__syncColWindow\(\)/)
  })

  it('窗口化在 optimizeRender=false 时关闭（打印/导出要整表内容）', () => {
    expect(tableSource).toMatch(/#computeColWindow\(\)[^{]*\{\s*if \(!this\.optimizeRender \|\| this\.__legacyFill \|\| this\.__noWindow\) return null/)
  })

  it('窗口外的格子被标记跳过渲染，并随关闭标记还原', () => {
    expect(tableScss).toMatch(/\.ce-table-cell\.is-col-offscreen\s*\{[^}]*content-visibility:\s*hidden/)
    expect(tableScss).toMatch(/\.ce-table\.is-no-render-opt \.ce-table-cell\.is-col-offscreen\s*\{[^}]*content-visibility:\s*visible/)
  })
})

describe('ce-table 横向增量补填', () => {
  it('窗口平移只补新进入的两截列', () => {
    // 整窗重填会把 dragx 的 JS 从 0.2ms 抬到 4ms；两截区间是「滚进来多少就填多少」
    expect(tableSource).toMatch(/if \(win\[0\] < old\[0\]\) ranges\.push\(\[win\[0\], Math\.min\(win\[1\], old\[0\]\)\]\)/)
    expect(tableSource).toMatch(/if \(win\[1\] > old\[1\]\) ranges\.push\(\[Math\.max\(win\[0\], old\[1\]\), win\[1\]\]\)/)
  })

  it('窗口收缩时只更新离屏标记，不重填', () => {
    expect(tableSource).toMatch(/if \(old && !ranges\.length\) \{\s*this\.__applyColOffscreen\(win\)\s*return\s*\}/)
  })

  it('_fillRow 的第三/第四个参数仍只做跳过判定', () => {
    expect(tableSource).toMatch(/if \(ranges && !inRanges\(ranges, si\)\) continue/)
  })
})

describe('ce-table 结构虚拟化', () => {
  it('物化必须在填数据之前（新进入窗口的格子还在池子里）', () => {
    const body = tableSource.match(/__syncColWindow\(\)\s*\{([\s\S]*?)\n  \}/)
    expect(body).toBeTruthy()
    const src = body![1]
    // 两处：窗口没变的早退分支（新行补物化）+ 窗口变了的主路径
    const calls = [...src.matchAll(/this\.__applyMaterialize\(/g)].map(m => m.index!)
    expect(calls.length).toBeGreaterThanOrEqual(2)
    const fill = src.indexOf('this._fillRow(')
    expect(fill).toBeGreaterThan(-1)
    for (const at of calls) expect(at).toBeLessThan(fill)
  })

  it('定位走样式表 + data-ci，不能用内联样式', () => {
    // 宿主 cellStyle 通过 style.cssText 整串覆盖格子样式，内联定位会被清掉
    expect(tableSource).toMatch(/\.ce-table-cell\[data-ci\]\{position:absolute/)
    expect(tableSource).toMatch(/cell\.dataset\.ci = String\(i\)/)
    expect(tableSource).not.toMatch(/cell\.style\.left = (?!'')/)
  })

  it('几何规则只写窗口内的列', () => {
    expect(tableSource).toMatch(/for \(let i = win\[0\]; i < end; i\+\+\)/)
  })

  it('几何失效先退出物化（池子里的格子要按列序插回）', () => {
    const body = tableSource.match(/#invalidateColWindow\(\)\s*\{([\s\S]*?)\n  \}/)
    expect(body).toBeTruthy()
    expect(body![1].indexOf('#dematerializeAll')).toBeGreaterThan(-1)
    expect(body![1].indexOf('#dematerializeAll')).toBeLessThan(body![1].indexOf('#scrollIdx = null'))
  })

  it('有横向合并时不物化（合并块跨窗口算不出宽度）', () => {
    expect(tableSource).toMatch(/const on = win != null[\s\S]{0,160}?!this\.__hasSpan/)
  })
})

describe('ce-table 甩动降级', () => {
  it('一步跨过阈值就只重定位，数据留给 scrollend', () => {
    expect(tableSource).toMatch(/const snap = this\.optimizeRender && !this\.__noSnap && Math\.abs\(to - prevYTo\) > SNAP_FILL_ROWS \* rowH/)
    expect(tableSource).toMatch(/if \(snap\) return/)
  })

  it('scrollend 用同步填充补上，不再叠一层防抖', () => {
    expect(tableSource).toMatch(/if \(this\.__snapPending\) \{\s*this\.__snapPending = false[\s\S]{0,120}?this\.__fillCellsNow\(\)/)
  })

  it('阈值按行数算，不按像素', () => {
    expect(tableSource).toMatch(/const SNAP_FILL_ROWS = \d+/)
  })
})

describe('ce-scroller 滚动顺序', () => {
  const scrollerSource = stripComments(readFileSync(join(root, 'src/components/datadisplay/scroller/Scroller.ts'), 'utf8'))

  it('先落原生滚动位置再派发 scroll', () => {
    // 反过来写会在监听者改完大批 transform 之后强制一次 style + layout
    expect(scrollerSource).toMatch(/const prevTop = this\.contentWrapper\.scrollTop\s*this\.contentWrapper\.scrollTop = scrollTo\s*this\.emit\('scroll'/)
    expect(scrollerSource).toMatch(/if \(!doScroll\) this\.contentWrapper\.scrollTop = prevTop/)
  })
})
