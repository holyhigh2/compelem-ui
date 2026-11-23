import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest 从项目根目录运行
const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const entries = readdirSync(join(root, 'src/entries'))
  .filter(file => file.endsWith('.ts'))
  .map(file => file.replace(/\.ts$/, ''))

describe('package contract', () => {
  it('每个组件入口都有对应的 exports 子路径', () => {
    for (const tag of entries) {
      expect(pkg.exports[`./${tag}`], `缺少 ${tag} 的 exports`).toBeDefined()
      expect(pkg.exports[`./${tag}`].types).toBe(`./dist/entries/${tag}.d.ts`)
      expect(pkg.exports[`./${tag}`].import).toBe(`./dist/${tag}.es.js`)
    }
  })

  it('主题与语言包是独立入口', () => {
    expect(pkg.exports['./index.css']).toBe('./dist/index.css')
    expect(pkg.exports['./locale'].import).toBe('./dist/locale.es.js')
  })

  it('运行时依赖全部走 peerDependencies', () => {
    expect(pkg.dependencies ?? {}).toEqual({})
    expect(pkg.peerDependencies.compelem).toBeTruthy()
    expect(pkg.peerDependencies.myfx).toBeTruthy()
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
