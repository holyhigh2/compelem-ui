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

// 组件子路径统一由通配规则映射到各自独立的 JS / 声明文件。
const componentExport = pkg.exports?.['./ce-*']
if (!componentExport || typeof componentExport !== 'object' || Array.isArray(componentExport)) {
  errors.push('./ce-*: 缺少组件通配导出')
} else {
  if (componentExport.types !== './dist/entries/ce-*.d.ts') {
    errors.push('./ce-*: types 必须映射到 ./dist/entries/ce-*.d.ts')
  }
  if (componentExport.import !== './dist/ce-*.es.js') {
    errors.push('./ce-*: import 必须映射到 ./dist/ce-*.es.js')
  }
}
const explicitComponents = Object.keys(pkg.exports ?? {}).filter(k => k.startsWith('./ce-') && k !== './ce-*')
if (explicitComponents.length) {
  errors.push(`组件导出仍包含显式清单，应使用 ./ce-*: ${explicitComponents.join(', ')}`)
}

const manifestFile = join(root, '.generated/entries/manifest.json')
let componentTags = []
if (!existsSync(manifestFile)) {
  errors.push('.generated/entries/manifest.json 不存在，请先执行 npm run build:lib')
} else {
  try {
    const { components } = JSON.parse(readFileSync(manifestFile, 'utf8'))
    componentTags = components.map(c => c.tag)
    for (const tag of componentTags) {
      checkTarget(`./dist/${tag}.es.js`, tag)
      checkTarget(`./dist/entries/${tag}.d.ts`, `${tag} types`)
      const declaration = join(root, 'dist/entries', `${tag}.d.ts`)
      if (existsSync(declaration)) {
        const content = readFileSync(declaration, 'utf8')
        if (/from\s*['"][^'"]+\.ts['"]/.test(content)) {
          errors.push(`${tag}: 入口声明仍引用 .ts 源码`)
        }
      }
    }
  } catch (error) {
    errors.push(`无法读取构建入口清单: ${error.message}`)
  }
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
  if (componentTags.length && entryJs.length !== componentTags.length) {
    errors.push(`组件 JS 数量(${entryJs.length})与入口清单(${componentTags.length})不一致`)
  }
  if ((pkg.files ?? []).every(f => f !== 'dist')) errors.push('package.json 的 files 未包含 dist')

  console.log(`[verify-pkg] 子路径 JS: ${entryJs.length}，声明文件: ${dtsCount}，exports 规则: ${Object.keys(pkg.exports ?? {}).length}`)
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
