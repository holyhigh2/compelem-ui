#!/usr/bin/env node
/**
 * 组件产物生成器：entries / types 两个生成步骤的统一入口。
 *
 * 用法：
 *   node scripts/gen.mjs [entries|types|all] [--check]
 *   - 默认 all
 *   - 不带 --check：写入缺失/过期的产物
 *   - 带 --check：只校验，不一致时退出码 1
 *   - 可一次传多个目标：node scripts/gen.mjs entries types
 *
 * 各步骤的规则、忽略项与输出信息与合并前的独立脚本保持一致：
 *   entries —— 由组件源码的 @tag("ce-xxx") 生成 .generated/entries/ce-xxx.ts 自注册入口
 *   types   —— 由 @tag / @emits 生成 src/types/components.ts
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isEntrySource, isSource, walkFiles } from './lib/files.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 读取文本并统一为 LF 行尾，供产物一致性比较使用 */
const readNormalized = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

///////////////////////////////////////// entries

/** 由组件源码生成 .generated/entries/ce-*.ts；返回退出码 */
function genEntries(checkOnly) {
  const componentsDir = join(root, 'src/components')
  const entriesDir = join(root, '.generated/entries')
  const manifestFile = join(entriesDir, 'manifest.json')

  /** @type {{ tag: string, className: string, source: string, file: string }[]} */
  const components = []

  for (const file of walkFiles(componentsDir, isEntrySource)) {
    const source = readFileSync(file, 'utf8')
    // 第二个参数 immediate（如 @tag('ce-column', true)）也要识别：自动注册的组件同样是入口
    const tags = [...source.matchAll(/@tag\(\s*['"](ce-[\w-]+)['"](?:\s*,\s*(?:true|false))?\s*\)/g)].map(m => m[1])
    if (!tags.length) continue

    const classMatch = source.match(/(?:export\s+)?class\s+(\w+)/)
    if (!classMatch) {
      console.warn(`[gen-entries] 跳过（未找到类声明）: ${relative(root, file)}`)
      continue
    }
    if (tags.length > 1) {
      console.warn(`[gen-entries] 跳过（一个文件声明了多个 tag）: ${relative(root, file)} → ${tags.join(', ')}`)
      continue
    }

    components.push({
      tag: tags[0],
      className: classMatch[1],
      // 导入说明符不带扩展名：镜像生成的 dist/entries/*.d.ts 若引用 `.ts`，
      // 发布包内（files 只含 dist）消费方将解析失败。
      // 组件源码统一为 .ts；无扩展名导入交给各 vite 配置的 resolve.extensions。
      source: relative(entriesDir, file).replace(/\\/g, '/').replace(/\.ts$/, ''),
      file: relative(root, file).replace(/\\/g, '/')
    })
  }

  if (!components.length) {
    console.error('[gen-entries] 没有找到任何带 @tag 的组件')
    return 1
  }

  components.sort((a, b) => a.tag.localeCompare(b.tag, 'en'))

  const entryFile = ({ tag, className, source }) => `// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { ${className} } from "${source}";

// 自注册入口：import 'compelem-ui/${tag}' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("${tag}")) {
  customElements.define("${tag}", ${className});
}

declare global {
  interface HTMLElementTagNameMap {
    "${tag}": ${className};
  }
}

export { ${className} };
export default ${className};
`

  const entryDeclaration = ({ tag, className, file }) => {
    const source = file.replace(/^src\//, '').replace(/\.ts$/, '')
    return `import { ${className} } from '../${source}';

declare global {
  interface HTMLElementTagNameMap {
    '${tag}': ${className};
  }
}

export { ${className} };
export default ${className};
`
  }

  const manifest = `${JSON.stringify({
    components: components.map(component => ({
      tag: component.tag,
      declaration: entryDeclaration(component)
    }))
  }, null, 2)}\n`
  const stale = []
  const generatedTags = new Set(components.map(c => c.tag))

  for (const component of components) {
    const target = join(entriesDir, `${component.tag}.ts`)
    const content = entryFile(component)
    if (!existsSync(target) || readNormalized(target) !== content) {
      stale.push({ target, content, tag: component.tag })
    }
  }
  if (!existsSync(manifestFile) || readNormalized(manifestFile) !== manifest) {
    stale.push({ target: manifestFile, content: manifest, tag: 'manifest' })
  }

  // 构建目录可能残留已删除组件的入口，不能让它继续进入 Vite 多入口。
  const orphans = existsSync(entriesDir)
    ? readdirSync(entriesDir)
      .filter(name => name.endsWith('.ts'))
      .map(name => name.replace(/\.ts$/, ''))
      .filter(tag => !generatedTags.has(tag))
    : []

  if (!stale.length && !orphans.length) {
    console.log(`[gen-entries] 构建入口已是最新（${components.length} 个组件）`)
    return 0
  }

  if (checkOnly) {
    console.error('[gen-entries] 构建入口与组件源码不一致')
    if (stale.length) console.error(`  需要更新: ${stale.map(s => s.tag).join(', ')}`)
    if (orphans.length) console.error(`  需要清理: ${orphans.join(', ')}`)
    console.error('  运行 `node scripts/gen.mjs entries` 重新生成')
    return 1
  }

  rmSync(entriesDir, { recursive: true, force: true })
  mkdirSync(entriesDir, { recursive: true })
  for (const component of components) {
    writeFileSync(join(entriesDir, `${component.tag}.ts`), entryFile(component))
  }
  writeFileSync(manifestFile, manifest)

  console.log(`[gen-entries] 已生成 ${components.length} 个构建入口`)
  return 0
}

///////////////////////////////////////// types

/** 由 @tag / @emits 生成 src/types/components.ts；返回退出码 */
function genTypes(checkOnly) {
  const srcDir = join(root, 'src')
  const componentsDir = join(srcDir, 'components')
  const typesDir = join(srcDir, 'types')
  const typesFile = join(typesDir, 'components.ts')

  const walk = (dir) => walkFiles(dir, isSource)

  const balance = line => (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length

  /** 从类声明位置向上收集连续的装饰器行（支持装饰器调用跨多行） */
  function decoratorsBefore(source, classPos) {
    const lines = source.slice(0, classPos).split(/\r?\n/)
    const block = []
    let depth = 0
    for (let i = lines.length - 2; i >= 0; i--) {
      const t = lines[i].trim()
      const b = balance(lines[i])
      if (depth === 0 && t === '') continue
      // 续行判定：仍处于未闭合调用内（depth<0）、本行闭括号多于开括号（参数行结尾）、或本行是装饰器起始
      if (depth < 0 || b < 0 || t.startsWith('@')) {
        block.unshift(lines[i])
        depth += b
        continue
      }
      break
    }
    return block.join('\n')
  }

  // ---------- 全局符号表：enum 成员 / const 字符串（解析 @emits 的非字面量参数） ----------
  /** @type {Map<string, string>} */
  const stringSymbols = new Map()
  for (const file of walk(srcDir)) {
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
      for (const member of m[2].matchAll(/(\w+)\s*=\s*['"]([^'"]+)['"]/g)) {
        stringSymbols.set(`${m[1]}.${member[1]}`, member[2])
      }
    }
    for (const m of source.matchAll(/const\s+(\w+)\s*(?::[^=]+)?=\s*['"]([^'"]+)['"]/g)) {
      if (!stringSymbols.has(m[1])) stringSymbols.set(m[1], m[2])
    }
  }

  /** @typedef {{ name: string, base: string, emits: string[], tag?: string }} ClassInfo */
  /** @type {Map<string, { classes: ClassInfo[], imports: Map<string, string> }>} */
  const fileInfos = new Map()

  function resolveSpec(fromFile, spec) {
    if (!spec.startsWith('.')) return undefined
    const base = resolve(dirname(fromFile), spec.replace(/\.ts$/, ''))
    for (const cand of [`${base}.ts`, join(base, 'index.ts')]) {
      if (existsSync(cand) && statSync(cand).isFile()) return cand
    }
    return undefined
  }

  function parseFile(file) {
    const source = readFileSync(file, 'utf8')
    const imports = new Map()
    for (const m of source.matchAll(/import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const target = resolveSpec(file, m[2])
      for (const raw of m[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
        if (name && target && !imports.has(name)) imports.set(name, target)
      }
    }
    for (const m of source.matchAll(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g)) {
      const target = resolveSpec(file, m[2])
      if (target) imports.set(m[1], target)
    }

    const classes = []
    const classRe = /\bclass\s+(\w+)(?:<[^>]*>)?\s*(?:extends\s+([\w.$][^{}]*?))?\s*\{/g
    let cm
    while ((cm = classRe.exec(source))) {
      const deco = decoratorsBefore(source, cm.index)
      const emits = [...deco.matchAll(/@emits\(([\s\S]*?)\)\s*$/gm)]
        .map(x => x[1])
        .flatMap(arg => arg.split(','))
        .map(s => s.trim()).filter(Boolean)
      // 允许 @tag(name, true)：immediate 只影响注册时机，不影响组件元数据
      const tags = [...deco.matchAll(/@tag\(\s*['"](ce-[\w-]+)['"](?:\s*,\s*(?:true|false))?\s*\)/g)].map(t => t[1])
      classes.push({ name: cm[1], base: (cm[2] || '').trim(), emits, tag: tags.pop() })
    }
    fileInfos.set(file, { classes, imports })
  }

  for (const file of walk(componentsDir)) parseFile(file)
  for (const dir of ['mixins', 'base', 'interfaces', 'utils']) {
    const d = join(srcDir, dir)
    if (existsSync(d)) for (const file of walk(d)) parseFile(file)
  }

  // ---------- 事件收集：沿 extends 链合并 @emits ----------
  function findClass(file, className) {
    const info = fileInfos.get(file)
    return info ? info.classes.find(c => c.name === className) : undefined
  }

  function locateClassFile(name, fromFile) {
    if (findClass(fromFile, name)) return fromFile
    const imported = fileInfos.get(fromFile)?.imports.get(name)
    return imported && findClass(imported, name) ? imported : undefined
  }

  function collectEmits(file, className, seen) {
    const key = `${file}#${className}`
    if (seen.has(key)) return []
    seen.add(key)
    const cls = findClass(file, className)
    if (!cls) return []
    const names = [...cls.emits]
    for (const id of new Set(cls.base.match(/[A-Za-z_$][\w$]*/g) || [])) {
      const baseFile = locateClassFile(id, file)
      if (baseFile) names.push(...collectEmits(baseFile, id, seen))
    }
    return names
  }

  function resolveEventName(raw) {
    const lit = raw.match(/^['"`]([^'"`]*)['"`]$/)
    if (lit) return lit[1]
    if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/.test(raw)) {
      if (stringSymbols.has(raw)) return stringSymbols.get(raw)
      const tail = raw.split('.').pop()
      for (const [k, v] of stringSymbols) if (k.endsWith(`.${tail}`)) return v
    }
    return undefined
  }

  const kebab = name => name.replace(/[A-Z]/g, ch => '-' + ch.toLowerCase()).replace(/^-/, '')
  const toPascal = tag => tag.replace(/^ce-/, '').split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')

  const components = []
  const warnings = []

  for (const [file, info] of [...fileInfos].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const cls of info.classes) {
      if (!cls.tag) continue
      const events = []
      const unresolved = []
      for (const raw of collectEmits(file, cls.name, new Set())) {
        const name = resolveEventName(raw)
        if (name === undefined) unresolved.push(raw)
        else events.push(name)
      }
      if (unresolved.length) {
        warnings.push(`[gen-types] ${cls.tag}: 无法解析 @emits 参数 ${unresolved.join(', ')}，已跳过`)
      }
      components.push({
        tag: cls.tag,
        className: cls.name,
        file,
        events: [...new Set(events)].map(kebab).sort((a, b) => a.localeCompare(b, 'en'))
      })
    }
  }

  if (!components.length) {
    console.error('[gen-types] 没有发现任何 @tag 组件')
    return 1
  }
  components.sort((a, b) => a.tag.localeCompare(b.tag, 'en'))

  // 组件导入一律去掉扩展名，交给 tsconfig / vite 的解析。
  const relFromTypes = file => relative(typesDir, file).replace(/\\/g, '/').replace(/\.(ts|ce)$/, '')

  const importLines = components.map(c => `import type { ${c.className} as Ce${toPascal(c.tag)} } from '${relFromTypes(c.file)}';`)
  const globalLines = components.map(c => `  '${c.tag}': Ce${toPascal(c.tag)};`)
  const withEvents = components.filter(c => c.events.length)
  const eventInterfaces = withEvents.map(c => {
    const lines = []
    for (const ev of c.events) {
      if (ev === 'update:*') lines.push('  [key: `update:${string}`]: CustomEvent<Record<string, any>>;')
      else lines.push(`  '${ev}': CustomEvent<Record<string, any>>;`)
    }
    return `export interface Ce${toPascal(c.tag)}Events {\n${lines.join('\n')}\n}`
  }).join('\n\n')
  const mapLines = withEvents.map(c => `  '${c.tag}': Ce${toPascal(c.tag)}Events;`)

  const content = `// 自动生成 —— 由 scripts/gen.mjs types 维护，勿手改。
// 标签 → 类映射（HTMLElementTagNameMap）与 @emits 事件名类型。
// 由 src/index.ts 以 export * 重新导出纳入类型图；子路径消费者由 dist/entries 的同名声明提供类型。
${importLines.join('\n')}

declare global {
  interface HTMLElementTagNameMap {
${globalLines.join('\n')}
  }
}

${eventInterfaces ? `${eventInterfaces}

/** 标签 → 自定义事件映射；配合 CeEventName / CeEventPayload 使用 */
export interface CeEventsByTag {
${mapLines.join('\n')}
}

export type CeEventName<T extends keyof CeEventsByTag> = keyof CeEventsByTag[T] & string;
export type CeEventPayload<T extends keyof CeEventsByTag, K extends keyof CeEventsByTag[T]> = CeEventsByTag[T][K];
` : `export interface CeEventsByTag {
}
`}
`

  const current = existsSync(typesFile) ? readNormalized(typesFile) : ''
  if (current === content) {
    console.log(`[gen-types] 类型声明已是最新（${components.length} 个标签）`)
  } else if (checkOnly) {
    console.error('[gen-types] src/types/components.ts 与组件源码不一致，运行 `node scripts/gen.mjs types` 重新生成')
    return 1
  } else {
    mkdirSync(typesDir, { recursive: true })
    writeFileSync(typesFile, content)
    console.log(`[gen-types] 已写入 ${relative(root, typesFile)}（${components.length} 个标签，${withEvents.length} 个含事件声明）`)
  }
  for (const w of warnings) console.warn(w)
  return 0
}

///////////////////////////////////////// 主流程

const TARGETS = {
  entries: genEntries,
  types: genTypes
}

const argv = process.argv.slice(2)
const checkOnly = argv.includes('--check')
const unknownFlags = argv.filter(a => a.startsWith('-') && a !== '--check')
const rawTargets = argv.filter(a => !a.startsWith('-'))

if (unknownFlags.length) {
  console.error(`[gen] 未知参数: ${unknownFlags.join(', ')}`)
  console.error('用法: node scripts/gen.mjs [entries|types|all] [--check]')
  process.exit(1)
}

const requested = rawTargets.length ? rawTargets : ['all']
const unknownTargets = requested.filter(t => t !== 'all' && !TARGETS[t])
if (unknownTargets.length) {
  console.error(`[gen] 未知目标: ${unknownTargets.join(', ')}`)
  console.error('用法: node scripts/gen.mjs [entries|types|all] [--check]')
  process.exit(1)
}

const targets = [...new Set(requested.includes('all') ? Object.keys(TARGETS) : requested)]

let failed = 0
for (const target of targets) {
  if (TARGETS[target](checkOnly)) failed++
}

process.exit(failed ? 1 : 0)
