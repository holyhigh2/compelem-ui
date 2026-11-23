import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 表格的动态样式表必须逐实例自建（`__insertOwnSheet`）。
 *
 * `insertStyleSheet(css`${...}`)` 的样式表是按模板**调用点**缓存的
 * （`CssStyleSheetCacheMap` 以 `strings` 为键），同页所有 `ce-table` 实例共用一张；
 * 任一实例随后 `replaceSync` 都会改写其他实例的规则。列宽为此翻过车：
 * 表头读宿主上的 `--column-width-*`（逐实例正确），表体读共享表里的规则（只剩
 * 最后写入的那个表格的列），未命中的列退化成内容宽度，整行逐列左移。
 *
 * jsdom 无排版能力、`ce-table` 的列注册依赖真实 slot 时序，行为验证放在
 * 浏览器探针里；这里只守住"不许再退回共享表"这条契约。
 */
const root = process.cwd()
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const tableSource = stripComments(readFileSync(join(root, 'src/components/datadisplay/table/Table.ts'), 'utf8'))

describe('ce-table 动态样式表归属', () => {
  it('不直接把 css 模板交给 insertStyleSheet（会跨实例共享）', () => {
    const direct = [...tableSource.matchAll(/insertStyleSheet\(\s*css`/g)].map(m => m[0])
    expect(direct).toEqual([])
  })

  it('列宽表走 __insertOwnSheet', () => {
    expect(tableSource).toMatch(/__updatableStyleColumnWidth\s*=\s*this\.__insertOwnSheet\(this\.getColumnWidthCss\(\)\)/)
  })

  it('__insertOwnSheet 每次新建 CSSStyleSheet', () => {
    // 形参类型里含 `)`，签名段只做宽松匹配，实现体按缩进收口
    const body = tableSource.match(/__insertOwnSheet\([\s\S]{0,120}?\)\s*\{([\s\S]*?)\n  \}/)
    expect(body, '__insertOwnSheet 实现缺失').toBeTruthy()
    expect(body![1]).toContain('new CSSStyleSheet()')
    expect(body![1]).toContain('replaceSync')
  })
})
