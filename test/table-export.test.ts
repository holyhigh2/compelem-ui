import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Table } from '../src/components/datadisplay/table/Table'

/**
 * `ce-table` 对外的**查询 API**（导出插件只靠这几个 + 公开字段取数），
 * 以及「核心包里没有任何导出实现」这条边界。
 *
 * 用 `Table.prototype.xxx.call(伪 this)` 直接测方法体：这些方法只读 `_fieldMap` /
 * 统计映射，不需要真表格（jsdom 下 `ce-table` 的列注册依赖真实 slot 时序）。
 */

const root = process.cwd()

/** 造一个 Column 节点（层级判据是 `parentComponent.constructor.name === 'Column'`） */
const columnNode = (label: string, parent?: any) => ({
  prop: label,
  label,
  parentComponent: parent ?? { constructor: { name: 'Field' } },
  constructor: { name: 'Column' }
})

describe('Table.getColumnPath', () => {
  it('返回 [叶子, 父分组, 祖父…]，由内到外', () => {
    const top = columnNode('销售')
    const mid = columnNode('华东', top)
    const leaf = columnNode('一月', mid)
    const fake = { _fieldMap: new Map([['一月', leaf]]) }
    const path = Table.prototype.getColumnPath.call(fake as any, '一月')
    expect(path.map((n: any) => n.label)).toEqual(['一月', '华东', '销售'])
  })

  it('叶子列只有自己；未知 prop 返回空数组', () => {
    const leaf = columnNode('名称')
    const fake = { _fieldMap: new Map([['名称', leaf]]) }
    expect(Table.prototype.getColumnPath.call(fake as any, '名称')).toHaveLength(1)
    expect(Table.prototype.getColumnPath.call(fake as any, 'nope')).toEqual([])
  })
})

describe('Table.getColumnStats', () => {
  const fake = () => ({
    statsLabelMap: { sum: '合计', mean: '平均' },
    statsColLabelMap: { amount: '合计' },
    TableConfigPane: { statsColStatMap: { amount: 'sum' } },
    _columnFootMap: new Map([['amount', { statValue: 42 }]])
  })

  it('给出表尾文案 / 指标 / 统计函数 / 兜底值', () => {
    expect(Table.prototype.getColumnStats.call(fake() as any, 'amount')).toEqual({
      label: '合计',
      metric: 'sum',
      fn: 'sum',
      value: 42
    })
  })

  it('没有配置统计函数时 fn 为 null（只能用 value）', () => {
    const f: any = {
      statsLabelMap: { custom: '自定义' },
      statsColLabelMap: { other: '自定义' },
      _columnFootMap: new Map([['other', { statValue: '自定义值' }]])
    }
    expect(Table.prototype.getColumnStats.call(f, 'other')).toMatchObject({
      label: '自定义',
      metric: 'custom',
      fn: null,
      value: '自定义值'
    })
  })

  it('未开启统计的列返回 null', () => {
    expect(Table.prototype.getColumnStats.call(fake() as any, 'name')).toBeNull()
  })
})

describe('核心包不含导出实现（导出在独立插件项目）', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const full = join(dir, name)
      return statSync(full).isDirectory() ? walk(full) : [full]
    })

  it('src 下没有任何文件 import exceljs / xlsx', () => {
    const stripComments = (text: string) =>
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    const imports = /from\s*["'](exceljs|xlsx)["']|import\s*\(\s*["'](exceljs|xlsx)["']/
    const offenders = walk(join(root, 'src'))
      .filter(f => f.endsWith('.ts'))
      .filter(f => imports.test(stripComments(readFileSync(f, 'utf8'))))
      .map(f => f.replace(root, '.'))
    expect(offenders).toEqual([])
  })

  it('没有 src/plugins 目录，主入口也不导出导出相关 API', () => {
    expect(() => statSync(join(root, 'src/plugins'))).toThrow()
    const stripComments = (text: string) =>
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    const index = stripComments(readFileSync(join(root, 'src/index.ts'), 'utf8'))
    expect(index).not.toMatch(/exportExcel|exportTableExcel|utils\/excel/)
  })
})
