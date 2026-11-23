#!/usr/bin/env node
/**
 * 发布前产物校验：确保 package.json 声明的每一个导出目标都真实存在，
 * 且没有把 .ts 源码泄漏到包外。建议在 npm publish 前执行（npm run verify:pkg）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const errors = []
const warnings = []

function checkTarget(target, key) {
  if (typeof target !== 'string') {
    errors.push(`${key}: 导出目标必须是字符串，实际为 ${typeof target}`)
    return
  }
  // 通配导出与自引用不需要文件存在
  if (target === './package.json' || target.includes('*')) return

  if ((target.endsWith('.ts') || target.endsWith('.tsx')) && !target.endsWith('.d.ts')) {
    errors.push(`${key}: 指向 TypeScript 源码 ${target}`)
  }
  if (!existsSync(join(root, target))) {
    errors.push(`${key}: 目标不存在 ${target}`)
  }
}

function walkExports(value, key) {
  if (typeof value === 'string') {
    checkTarget(value, key)
    return
  }
  if (value && typeof value === 'object') {
    for (const [cond, target] of Object.entries(value)) {
      walkExports(target, `${key}[${cond}]`)
    }
  }
}

for (const [key, value] of Object.entries(pkg.exports ?? {})) {
  walkExports(value, key)
}

for (const field of ['main', 'module', 'types']) {
  if (pkg[field]) checkTarget(`./${pkg[field].replace(/^\.\//, '')}`, field)
}

// 子路径类型声明必须各自存在，不能全部复用 dist/index.d.ts
const subpathEntries = Object.entries(pkg.exports ?? {}).filter(([k]) => k.startsWith('./ce-'))
for (const [key, value] of subpathEntries) {
  const types = typeof value === 'object' ? value.types : undefined
  if (!types) errors.push(`${key}: 缺少 types`)
  else if (types === './dist/index.d.ts') errors.push(`${key}: types 复用了总声明 dist/index.d.ts`)
}

// 声明文件里不允许重复的 `export *`
function scanDts(dir) {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const file of readdirSync(dir)) {
    const full = join(dir, file)
    if (statSync(full).isDirectory()) {
      count += scanDts(full)
      continue
    }
    if (!file.endsWith('.d.ts')) continue
    count++
    const lines = readFileSync(full, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('export *'))
    const seen = new Set()
    for (const line of lines) {
      if (seen.has(line)) {
        errors.push(`${full.replace(root, '.')}: 重复的 ${line}`)
        break
      }
      seen.add(line)
    }
  }
  return count
}

const dtsCount = scanDts(join(root, 'dist'))

const distDir = join(root, 'dist')
if (!existsSync(distDir)) {
  errors.push('dist/ 不存在，请先执行 npm run build:lib')
} else {
  const css = join(distDir, 'index.css')
  if (!existsSync(css)) errors.push('dist/index.css 不存在（主题入口缺失）')

  const jsFiles = readdirSync(distDir).filter(f => f.endsWith('.es.js'))
  const entryJs = jsFiles.filter(f => f.startsWith('ce-'))
  if (entryJs.length === 0) errors.push('dist/ 中没有 ce-*.es.js 子路径产物')
  if ((pkg.files ?? []).every(f => f !== 'dist')) errors.push('package.json 的 files 未包含 dist')

  console.log(`[verify-pkg] 子路径 JS: ${entryJs.length}，声明文件: ${dtsCount}，exports: ${Object.keys(pkg.exports ?? {}).length}`)
}

if (warnings.length) {
  for (const w of warnings) console.warn(`[verify-pkg] 警告: ${w}`)
}

if (errors.length) {
  console.error(`[verify-pkg] 失败，共 ${errors.length} 项：`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('[verify-pkg] 通过')
