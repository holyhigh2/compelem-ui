import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsRoot = join(process.cwd(), 'src/components')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') ? [path] : []
  })
}

const sources = sourceFiles(componentsRoot).map(path => ({
  path,
  source: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''),
}))

describe('组件内置图标', () => {
  it('内置图标不依赖字符串注册表', () => {
    const offenders = sources.filter(({ source }) => /["'`]c-svg-[^"'`]+["'`]/.test(source))
    expect(offenders.map(({ path }) => path)).toEqual([])
  })

  it('模板中的 svg 统一走属性绑定以支持图标工厂', () => {
    const offenders = sources.filter(({ source }) => /(?:^|\s)svg="\$\{/.test(source))
    expect(offenders.map(({ path }) => path)).toEqual([])
  })
})
