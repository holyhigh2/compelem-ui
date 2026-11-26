import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest 从项目根目录运行
const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const entries = readdirSync(join(root, '.generated/entries'))
  .filter(file => file.endsWith('.ts'))
  .map(file => file.replace(/\.ts$/, ''))

describe('package contract', () => {
  it('每个组件入口都匹配通配 exports 的 JS 与类型目标', () => {
    const componentExport = pkg.exports['./ce-*']
    expect(componentExport).toEqual({
      types: './dist/entries/ce-*.d.ts',
      import: './dist/ce-*.es.js'
    })
    for (const tag of entries) {
      const suffix = tag.replace(/^ce-/, '')
      expect(componentExport.types.replace('*', suffix)).toBe(`./dist/entries/${tag}.d.ts`)
      expect(componentExport.import.replace('*', suffix)).toBe(`./dist/${tag}.es.js`)
    }
  })

  it('主题与语言包是独立入口', () => {
    expect(pkg.exports['./index.css']).toBe('./dist/index.css')
    expect(pkg.exports['./locale'].import).toBe('./dist/locale.es.js')
  })

  it('运行时依赖全部走 peerDependencies', () => {
    expect(pkg.dependencies ?? {}).toEqual({})
    expect(pkg.peerDependencies.compelem).toBeTruthy()
    expect(pkg.peerDependencies.myfx).toBe('>=2.0.0')
    expect(pkg.peerDependencies.uiik).toBeTruthy()
  })

  it('核心包不声明可选能力依赖（导出插件是独立项目）', () => {
    expect(pkg.peerDependencies).not.toHaveProperty('exceljs')
    expect(pkg.peerDependenciesMeta ?? {}).not.toHaveProperty('exceljs')
    expect(pkg.devDependencies).not.toHaveProperty('exceljs')
    expect(pkg.exports).not.toHaveProperty('./table-excel')
  })

  it('发布目录包含 dist 且声明的类型文件不被源码泄漏', () => {
    expect(pkg.files).toContain('dist')
    const targets = Object.values(pkg.exports)
      .flatMap(value => typeof value === 'string' ? [value] : Object.values(value as Record<string, string>))
      .filter(target => !target.includes('*') && target !== './package.json')
    for (const target of targets) {
      expect(target.endsWith('.d.ts') || target.endsWith('.js') || target.endsWith('.css')).toBe(true)
    }
  })
})
