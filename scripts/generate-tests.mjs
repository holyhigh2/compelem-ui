/**
 * 组件单测生成器
 *
 * 扫描 src 下所有 @tag('ce-*') 组件，沿继承链解析 @prop / 普通类字段的字面量默认值
 * （就近覆盖，如 Tag 用普通字段 rounded = true 覆盖基类 @prop rounded = false），
 * 在 test/components 下生成镜像结构的冒烟测试文件：
 *   注册 / 渲染（或无模板挂载）/ 默认属性 / 属性响应。
 *
 * 用法：node scripts/generate-tests.mjs [--force]
 * 已生成的文件不会被覆盖（避免丢失手工调整），--force 强制重写。
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import * as path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const TEST_ROOT = path.join(ROOT, 'test')
const FORCE = process.argv.includes('--force')

// 未在库入口导出、与 Panel.ts 重复注册 ce-panel 的死代码
const SKIP_FILES = new Set(['components/datadisplay/panel/PanelGroup.ts'])

// 挂载时需要最小必要数据的组件（kebab-case attributes）
const FIXTURES = {
  // 空数据树：#fillRow 对空 rowData 提前 return，避免用例结束后
  // 防抖回调访问 detached 渲染中未升级的 ce-checkbox 方法
  'ce-tree': { attrs: { data: '[]' } },
  'ce-input-mask': { attrs: { mask: '00:00' } },
  'ce-board': { attrs: { 'title-field': 'title' } },
  'ce-notification': { attrs: { descr: 'test' } },
  'ce-stat': { attrs: { title: 't', value: '1' } },
  'ce-tab': { attrs: { index: '1' } },
  'ce-list-group': { attrs: { title: 't' } },
  'ce-table-bar': { attrs: { target: 'ce-table' } },
  'ce-board-bar': { attrs: { target: 'ce-board' } },
  'ce-menu-pane': { attrs: { items: '[]' } },
  'ce-dropdown': { attrs: { items: '[]' } },
  // @event 解析器依赖 parentComponent，独立挂载到 body 会因缺少宿主而崩溃，需包裹在 ce-panel 内
  'ce-context-menu': { attrs: { items: '[]' }, wrapper: 'ce-panel' },
  // value 需匹配子 ce-tab 的 index，否则内部 ce-nav 的 activeIndex watch 找不到目标节点会崩溃
  'ce-tabs': { attrs: { value: '0' }, html: '<ce-tab index="0">A</ce-tab>' }
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) walk(full, files)
    else if (name.name.endsWith('.ts')) files.push(full)
  }
  return files
}

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function resolveImport(fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null
  for (const cand of [base + '.ts', path.join(base, 'index.ts')]) {
    if (existsSync(cand)) return cand
  }
  return null
}

function parseTag(content) {
  const m = content.match(/@tag\(\s*(['"`])([^'"`]+)\1\s*\)/)
  if (!m) return null
  const tag = m[2]
  if (!tag.startsWith('ce-')) return null
  const after = content.slice(m.index + m[0].length, m.index + m[0].length + 400)
  const cls = after.match(/export\s+(?:abstract\s+)?class\s+(\w+)/)
  if (!cls) return null
  return { tag, className: cls[1] }
}

function parseLiteral(def) {
  def = def.trim().replace(/;$/, '')
  if (def === 'true' || def === 'false') return def === 'true'
  if (/^-?\d+(\.\d+)?$/.test(def)) return Number(def)
  if (/^'([^']*)'$/.test(def)) {
    const s = def.slice(1, -1)
    return s.includes('${') ? null : s
  }
  if (/^"([^"]*)"$/.test(def)) {
    const s = def.slice(1, -1)
    return s.includes('${') ? null : s
  }
  return null
}

// 将模板字符串与注释内容替换为空格（保留换行），
// 避免 render 模板里的 HTML 属性（如 size="${this.size}"）被误判为类字段声明
function stripTemplatesAndComments(code) {
  const chars = code.split('')
  const n = chars.length
  const blank = (i) => {
    if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' '
  }
  const stack = []
  let mode = 'code'
  let braceDepth = 0
  const prev = () => stack[stack.length - 1] ?? 'code'
  for (let i = 0; i < n; i++) {
    const c = chars[i]
    const next = i + 1 < n ? chars[i + 1] : ''
    if (mode === 'code' || mode === 'expr') {
      if (c === "'") { stack.push('sq'); mode = 'sq'; continue }
      if (c === '"') { stack.push('dq'); mode = 'dq'; continue }
      if (c === '`') { blank(i); stack.push('tmpl'); mode = 'tmpl'; continue }
      if (c === '/' && next === '/') { blank(i); blank(i + 1); i++; stack.push('line'); mode = 'line'; continue }
      if (c === '/' && next === '*') { blank(i); blank(i + 1); i++; stack.push('block'); mode = 'block'; continue }
      if (mode === 'expr' && c === '{') { braceDepth++; continue }
      if (mode === 'expr' && c === '}') {
        if (braceDepth > 0) { braceDepth--; continue }
        blank(i); stack.pop(); mode = prev(); continue
      }
      continue
    }
    if (mode === 'sq' || mode === 'dq') {
      if (c === '\\') { blank(i); if (i + 1 < n) { blank(i + 1); i++ } continue }
      if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"')) { stack.pop(); mode = prev() }
      continue
    }
    if (mode === 'line') {
      if (c === '\n') { stack.pop(); mode = prev() } else blank(i)
      continue
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') { blank(i); blank(i + 1); i++; stack.pop(); mode = prev() }
      else blank(i)
      continue
    }
    // tmpl
    if (c === '\\') { blank(i); if (i + 1 < n) { blank(i + 1); i++ } continue }
    if (c === '`') { blank(i); stack.pop(); mode = prev(); continue }
    if (c === '$' && next === '{') { blank(i); blank(i + 1); i++; stack.push('expr'); braceDepth = 0; mode = 'expr'; continue }
    blank(i)
  }
  return chars.join('')
}

// @prop 声明：name / 字面量默认值 / attribute:false / required:true
function parsePropDecls(content) {
  const decls = []
  const re = /@prop\s*(?:\(\s*(\{[\s\S]*?\})\s*\))?\s*(?:@\w+\s+)*([A-Za-z_$][\w$]*)\s*(?::[^=;\n]*?)?(?:=\s*([^;\n]+?))?\s*;/g
  let m
  while ((m = re.exec(content))) {
    const [, opts, name, rawDef] = m
    if (name === 'static') continue
    decls.push({
      name,
      value: rawDef !== undefined ? parseLiteral(rawDef) : null,
      noAttr: opts ? /attribute:\s*false/.test(opts) : false,
      required: opts ? /required:\s*true/.test(opts) : false
    })
  }
  return decls
}

// 逐行花括号深度（基于已剥离模板/注释的代码，字符串内的花括号不计入）：
// 深度 1 = 类体内、方法体外；方法体内语句（switch/if 等）深度 ≥ 2
function buildDepthMap(code) {
  const depths = new Map()
  let depth = 0
  let line = 0
  let quote = null
  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    if (c === '\n') { depths.set(line++, depth); continue }
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"') { quote = c; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
  }
  depths.set(line, depth)
  return depths
}

// 普通类字段声明：仅接受花括号深度为 1（类体内、方法体外）的 "identifier = literal;" 行，
// 用于识别子类对基类 @prop 的覆盖；switch/if 等方法体内的赋值因深度 ≥ 2 被排除
function parseFieldDecls(content, depthMap) {
  const decls = []
  const re = /^[ \t]*(?:@\w+\s+)*([A-Za-z_$][\w$]*)\s*(?::[^=;\n]*?)?(?:=\s*([^;\n]+?))?\s*;?[ \t]*$/
  content.split('\n').forEach((line, i) => {
    if (depthMap.get(i) !== 1) return
    const m = line.match(re)
    if (!m) return
    const name = m[1]
    if (['return', 'let', 'const', 'if', 'for', 'while', 'switch', 'case', 'static', 'get', 'set', 'function'].includes(name)) return
    decls.push({ name, value: m[2] !== undefined ? parseLiteral(m[2]) : null })
  })
  return decls
}

function parseExtends(content) {
  const cls = content.match(/export\s+(?:abstract\s+)?class\s+\w+\s+extends\s+([\w$]+)/)
  if (!cls) return null
  const base = cls[1]
  const imports = {}
  for (const im of content.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    for (const part of im[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/)[0]
      if (n) imports[n] = im[2]
    }
  }
  return imports[base] ?? null
}

// 读取源码并统一换行符为 LF（CRLF 的 \r 会导致行尾锚定正则匹配失败）
function readSrc(file) {
  return readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
}

// 继承链（派生类在前）
function classChain(file) {
  const chain = [file]
  const seen = new Set(chain)
  let cur = file
  for (let i = 0; i < 8; i++) {
    const content = readSrc(cur)
    const spec = parseExtends(content)
    if (!spec) break
    const base = resolveImport(cur, spec)
    if (!base || seen.has(base)) break
    seen.add(base)
    chain.push(base)
    cur = base
  }
  return chain
}

// 沿链解析默认值：基类 → 派生类，普通类字段就近覆盖 @prop 声明
function resolveProps(chain) {
  const map = new Map()
  const files = [...chain].reverse() // 基类在前
  for (const file of files) {
    const raw = readSrc(file)
    const content = stripTemplatesAndComments(raw)
    for (const d of parsePropDecls(content)) {
      if (d.name.startsWith('_')) continue
      const prev = map.get(d.name)
      map.set(d.name, {
        name: d.name,
        value: d.value,
        noAttr: (prev?.noAttr ?? false) || d.noAttr,
        required: d.required || (prev?.required ?? false)
      })
    }
    for (const d of parseFieldDecls(content, buildDepthMap(content))) {
      if (d.name.startsWith('_')) continue
      if (!map.has(d.name)) continue // 普通字段只能覆盖已知 @prop，避免误收方法体语句
      const prev = map.get(d.name)
      map.set(d.name, { ...prev, value: d.value })
    }
  }
  return [...map.values()].filter((p) => p.value !== null && p.value !== undefined)
}

// render 方法检测：返回 null 表示无 Shadow DOM 内容
function resolveRender(chain) {
  for (const file of chain) {
    const content = readSrc(file)
    const m = content.match(/^[ \t]*(?:async\s+)?render\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/m)
    if (!m) continue
    const body = content.slice(m.index + m[0].length, m.index + m[0].length + 300)
    return { hasRender: true, returnsNull: /^\s*return\s+null\s*$/m.test(body) }
  }
  return { hasRender: false, returnsNull: true }
}

function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function literal(v) {
  if (typeof v === 'string') return `'${v}'`
  return String(v)
}

function attrLiteral(v) {
  if (typeof v === 'string') return `'${v}'`
  return String(v)
}

function genTest(srcFile, tag, className, props, render, fixture) {
  const rel = toPosix(path.relative(SRC, srcFile)).replace(/\.ts$/, '')
  const importPath = '@/components/' + rel.replace(/^components\//, '')
  const cap = 12
  const defaults = props.filter((p) => !p.name.startsWith('__')).slice(0, cap)
  const attrProp = props.find(
    (p) => p.value === false && !p.noAttr && !p.name.startsWith('_') && !(p.name in (fixture?.attrs ?? {}))
  )
  const fxAttrs = fixture?.attrs ?? {}
  const fxWrapper = fixture?.wrapper
  const fxHtml = fixture?.html
  const hasFixture = Object.keys(fxAttrs).length > 0 || !!fxWrapper || !!fxHtml
  const fxLines = Object.entries(fxAttrs)
    .map(([k, v]) => `'${k}': ${attrLiteral(v)}`)
    .join(', ')

  const lines = []
  lines.push(`import { describe, expect, it } from 'vitest'`)
  lines.push(`import { defineComponents } from 'compelem'`)
  lines.push(`import { mount } from '@test/helpers/mount'`)
  lines.push(`import { ${className} } from '${importPath}'`)
  lines.push('')
  lines.push(`// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define`)
  lines.push(`defineComponents()`)
  lines.push('')
  lines.push(`const TAG = '${tag}'`)
  if (hasFixture) {
    const parts = []
    if (Object.keys(fxAttrs).length) parts.push(`attrs: { ${fxLines} }`)
    if (fxWrapper) parts.push(`wrapper: '${fxWrapper}'`)
    if (fxHtml) parts.push(`html: ${JSON.stringify(fxHtml)}`)
    lines.push(`// 最小挂载条件：缺少时组件初始化会中断`)
    lines.push(`const FIXTURE = { ${parts.join(', ')} }`)
  }
  lines.push('')
  lines.push(`describe('${tag}', () => {`)
  lines.push(`  it('注册为自定义元素', () => {`)
  lines.push(`    expect(customElements.get(TAG)).toBe(${className})`)
  lines.push(`  })`)
  lines.push('')
  if (render.hasRender && !render.returnsNull) {
    lines.push(`  it('挂载后渲染 Shadow DOM 内容', async () => {`)
    lines.push(`    const el = await mount(TAG${hasFixture ? ', FIXTURE' : ''})`)
    lines.push(`    expect(el.shadowRoot).toBeTruthy()`)
    lines.push(`    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)`)
    lines.push(`  })`)
  } else {
    lines.push(`  it('挂载为无模板组件（不创建 Shadow DOM）', async () => {`)
    lines.push(`    const el = await mount(TAG${hasFixture ? ', FIXTURE' : ''})`)
    lines.push(`    expect(el).toBeInstanceOf(${className})`)
    lines.push(`    expect(el.shadowRoot).toBeNull()`)
    lines.push(`  })`)
  }
  if (defaults.length) {
    lines.push('')
    lines.push(`  it('默认属性值', async () => {`)
    lines.push(`    const el = await mount(TAG${hasFixture ? ', FIXTURE' : ''})`)
    for (const p of defaults) {
      lines.push(`    expect((el as any).${p.name}).toBe(${literal(p.value)})`)
    }
    lines.push(`  })`)
  }
  if (attrProp) {
    lines.push('')
    lines.push(`  it('属性响应：${attrProp.name}', async () => {`)
    lines.push(`    const el = await mount(TAG, { ${hasFixture ? '...FIXTURE, ' : ''}attrs: { ${Object.keys(fxAttrs).length ? '...FIXTURE.attrs, ' : ''}'${kebab(attrProp.name)}': true } })`)
    lines.push(`    expect((el as any).${attrProp.name}).toBe(true)`)
    lines.push(`  })`)
  }
  lines.push(`})`)
  lines.push('')
  return lines.join('\n')
}

let generated = 0
let skipped = 0
for (const file of walk(SRC)) {
  const rel = toPosix(path.relative(SRC, file))
  if (SKIP_FILES.has(rel)) continue
  const content = readSrc(file)
  const info = parseTag(content)
  if (!info) continue
  const chain = classChain(file)
  const props = resolveProps(chain)
  const render = resolveRender(chain)
  const outDir = path.join(TEST_ROOT, path.dirname(path.relative(SRC, file)))
  const outFile = path.join(outDir, info.className + '.test.ts')
  if (existsSync(outFile) && !FORCE) {
    skipped++
    continue
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, genTest(file, info.tag, info.className, props, render, FIXTURES[info.tag]), 'utf8')
  generated++
}
console.log(`generated: ${generated}, skipped(existing): ${skipped}`)
