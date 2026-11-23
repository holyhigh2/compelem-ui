#!/usr/bin/env node
/**
 * 契约与债务检查：contracts / props / fonts / colors 四个检查步骤的统一入口。
 *
 * 用法：
 *   node scripts/check.mjs [contracts|props|fonts|colors|all] [--json] [--strict] [--update]
 *   - 默认 all；all 时依次执行四项，任一失败最终退出码 1
 *   - --json   只对 props 生效（机器可读输出）
 *   - --strict 只对 colors 生效（任一文件债务高于基线即失败）
 *   - --update 只对 colors 生效（用当前扫描结果重写基线）
 *   - --all    只对 contracts 生效（连 R2/R3 一起阻断，兼容旧参数）
 *   - --verbose 只对 fonts 生效（逐条列出命中）
 *
 * 各步骤的规则、白名单与输出信息与合并前的独立脚本保持一致。
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSource, isStyleSource, walkFiles } from './lib/files.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')

///////////////////////////////////////// contracts

/**
 * 事件与模型契约静态校验。
 *
 * 校验三个方向的漂移，对应审计清单的 F-01 / F-06 / S-10：
 *
 *   R1  emit 名 ⊆ @emits 声明名        —— 实发了但没声明（文档、IDE 提示、宿主 d.ts 都取不到）
 *   R1b emit 名在全仓任何文件都无声明  —— R1 的跨文件补充：mixin 实发、消费者也没声明的场景
 *   R2  @emits 声明名 ⊆ 本文件 emit 名 —— 声明了但从没发（承诺的事件不存在）
 *   R3  model prop 必须有 update:*     —— 缺声明会让宿主显式 `@update:xxx` 绑定静默失效
 *   R4  @emits 内重复名                —— 同一类声明两遍，读 d.ts 的人无法判断哪个生效
 *
 * 已知口径（不是漏报，是静态分析的边界）：
 *   - emit 与 @emits 都按**单文件**比较。跨文件继承的事件（mixin 发、子类声明）落在
 *     R2 里，所以 R2 默认只报告不阻断。
 *   - 首参是常量成员（如 `FieldContainerEvents.Ready`）时按本仓 enum / const 字面量解析；
 *     解析不了的记为 unresolved 并单列，不算违规。
 *   - `@emits('update:*')` 是 compelem 文档明示的通配约定（`decorators/emits.ts:6`），
 *     按前缀通配匹配，不计入违规；同理 R2 里带 `*` 的声明不参与「声明了没发」的比对。
 *   - `@prop({ model: true })` 的 `update:` 只查本文件声明。基类已声明、子类复用的场景
 *     会落入 R3 报告，需人工确认继承链后再决定是否豁免。
 */
function runContracts({ blockAll = false } = {}) {
  ///////////////////////////////////////// 采集

  /** 去掉注释，避免 JSDoc 里提到的 emit 名被当成调用 */
  function stripComments(s) {
    return s
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
  }

  /** 从 openIdx 处的 '(' 开始，返回配对 ')' 的下标；找不到返回 -1 */
  function matchParen(src, openIdx) {
    let depth = 0
    let quote = ''
    for (let i = openIdx; i < src.length; i++) {
      const c = src[i]
      if (quote) {
        if (c === '\\') i++
        else if (c === quote) quote = ''
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '(') depth++
      else if (c === ')') { depth--; if (!depth) return i }
    }
    return -1
  }

  /** 顶层逗号切分 */
  function splitArgs(s) {
    const out = []
    let depth = 0
    let quote = ''
    let cur = ''
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (quote) {
        cur += c
        if (c === '\\') { cur += s[++i] ?? ''; continue }
        if (c === quote) quote = ''
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; cur += c; continue }
      if ('([{'.includes(c)) depth++
      if (')]}'.includes(c)) depth--
      if (c === ',' && !depth) { out.push(cur); cur = ''; continue }
      cur += c
    }
    if (cur.trim()) out.push(cur)
    return out.map(x => x.trim()).filter(Boolean)
  }

  /** 收集 enum / const 对象里的字符串成员，用于解析 `A.B` 形态的 emit 名 */
  function collectConsts(files) {
    const map = new Map()
    for (const f of files) {
      const s = stripComments(readFileSync(f, 'utf8'))
      const enumRe = /export\s+(?:const\s+)?enum\s+(\w+)\s*\{([\s\S]*?)\n\}/g
      let m
      while ((m = enumRe.exec(s))) {
        const [, name, body] = m
        const members = new Map()
        const memRe = /(\w+)\s*=\s*['"`]([^'"`]*)['"`]/g
        let mm
        while ((mm = memRe.exec(body))) members.set(mm[1], mm[2])
        if (members.size) map.set(name, members)
      }
      const objRe = /export\s+const\s+(\w+)\s*(?::[^=]+)?=\s*\{([\s\S]*?)\}\s*(?:as const)?\s*;?/g
      while ((m = objRe.exec(s))) {
        const [, name, body] = m
        const members = new Map()
        const memRe = /(\w+)\s*:\s*['"`]([^'"`]*)['"`]/g
        let mm
        while ((mm = memRe.exec(body))) members.set(mm[1], mm[2])
        if (members.size && !map.has(name)) map.set(name, members)
      }
    }
    return map
  }

  /** 把一个 ast 片段解析成事件名字符串；解析不了返回 null */
  function resolveName(expr, consts) {
    const s = expr.trim()
    const lit = /^(['"`])([^'"`]*)\1$/.exec(s)
    if (lit) return lit[2]
    const mem = /^(\w+)\.(\w+)$/.exec(s)
    if (mem) return consts.get(mem[1])?.get(mem[2]) ?? null
    return null
  }

  /**
   * 声明集是否覆盖某个事件名。
   * 带 `*` 的声明按通配处理（`update:*` 覆盖 `update:value`、`update:checked`）。
   */
  function coveredBy(declSet, name) {
    if (declSet.has(name)) return true
    for (const d of declSet) {
      if (!d.includes('*')) continue
      const re = new RegExp('^' + d.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*') + '$')
      if (re.test(name)) return true
    }
    return false
  }

  ///////////////////////////////////////// 分析

  function collectEmitsDecl(src) {
    const names = []
    const unresolved = []
    const re = /@emits\s*\(/g
    let m
    while ((m = re.exec(src))) {
      const open = m.index + m[0].length - 1
      const close = matchParen(src, open)
      if (close < 0) continue
      for (const arg of splitArgs(src.slice(open + 1, close))) names.push({ raw: arg })
    }
    return { names, unresolved }
  }

  function collectEmitCalls(src) {
    const calls = []
    const re = /this\.emit\s*\(/g
    let m
    while ((m = re.exec(src))) {
      const open = m.index + m[0].length - 1
      const close = matchParen(src, open)
      if (close < 0) continue
      const [first] = splitArgs(src.slice(open + 1, close))
      if (first) calls.push({ raw: first, line: src.slice(0, m.index).split('\n').length })
    }
    return calls
  }

  function collectModelProps(src) {
    const out = []
    const re = /@prop\s*\(\s*\{[^}]*\bmodel\s*:\s*true[^}]*\}\s*\)\s*([\w$]+)/g
    let m
    while ((m = re.exec(src))) out.push({ name: m[1], line: src.slice(0, m.index).split('\n').length })
    return out
  }

  ///////////////////////////////////////// 主流程

  const files = walkFiles(srcDir, isSource)
  const consts = collectConsts(files)

  const r1 = []
  const r1b = []
  const r2 = []
  const r3 = []
  const r4 = []
  const unresolved = []
  let declaredFiles = 0

  // 第一遍：逐文件收集声明集与调用集
  const perFile = files.map(f => {
    const rel = relative(root, f).replace(/\\/g, '/')
    const src = stripComments(readFileSync(f, 'utf8'))
    const decl = collectEmitsDecl(src)
    const calls = collectEmitCalls(src)
    if (decl.names.length) declaredFiles++

    const declSet = new Set()
    const rawNames = []
    for (const d of decl.names) {
      const v = resolveName(d.raw, consts)
      if (v == null) { unresolved.push({ file: rel, kind: '@emits', raw: d.raw }); continue }
      // R4 需要看原始顺序，重复名在这里就地判定
      if (rawNames.includes(v)) r4.push({ file: rel, name: v })
      rawNames.push(v)
      declSet.add(v)
    }

    const callList = []
    for (const c of calls) {
      const v = resolveName(c.raw, consts)
      if (v == null) { unresolved.push({ file: rel, kind: 'emit', raw: c.raw, line: c.line }); continue }
      callList.push({ name: v, line: c.line })
    }

    return { rel, src, declSet, callList, hasDecl: decl.names.length > 0 }
  })

  // 第二遍：用全仓声明集补上「mixin 实发、消费者也没声明」
  const repoDeclSet = new Set(perFile.flatMap(x => [...x.declSet]))

  for (const { rel, declSet, callList, hasDecl, src } of perFile) {
    const callSet = new Set(callList.map(c => c.name))
    for (const c of callList) {
      if (hasDecl) {
        if (!coveredBy(declSet, c.name)) r1.push({ file: rel, line: c.line, name: c.name })
      } else if (!coveredBy(repoDeclSet, c.name)) {
        r1b.push({ file: rel, line: c.line, name: c.name })
      }
    }

    for (const v of declSet) {
      if (v.includes('*')) continue
      if (callList.length && !callSet.has(v)) r2.push({ file: rel, name: v })
    }

    for (const p of collectModelProps(src)) {
      if (!coveredBy(declSet, `update:${p.name}`)) r3.push({ file: rel, line: p.line, name: p.name })
    }
  }

  ///////////////////////////////////////// 输出

  const byFile = (arr) => {
    const m = new Map()
    for (const x of arr) {
      if (!m.has(x.file)) m.set(x.file, [])
      m.get(x.file).push(x)
    }
    return m
  }

  console.log(`扫描 ${files.length} 个源文件，其中 ${declaredFiles} 个有 @emits 声明\n`)

  console.log(`R1 实发事件未声明（${r1.length}）`)
  for (const [file, items] of byFile(r1)) {
    console.log(`  ${file}`)
    for (const it of items) console.log(`    :${it.line}  ${it.name}`)
  }

  console.log(`\nR1b 实发事件全仓无声明（${r1b.length}，本文件无 @emits 且消费者也没声明）`)
  for (const [file, items] of byFile(r1b)) {
    console.log(`  ${file}`)
    for (const it of items) console.log(`    :${it.line}  ${it.name}`)
  }

  console.log(`\nR2 声明事件无本文件 emit（${r2.length}，默认不阻断；含 mixin 跨文件继承）`)
  for (const [file, items] of byFile(r2)) {
    console.log(`  ${file}  ${items.map(x => x.name).join(', ')}`)
  }

  console.log(`\nR3 model prop 缺 update:* 声明（${r3.length}，需按继承链人工确认）`)
  for (const [file, items] of byFile(r3)) {
    console.log(`  ${file}  ${items.map(x => `${x.name}@${x.line}`).join(', ')}`)
  }

  console.log(`\nR4 @emits 内重复名（${r4.length}）`)
  for (const [file, items] of byFile(r4)) {
    console.log(`  ${file}  ${items.map(x => x.name).join(', ')}`)
  }

  if (unresolved.length) {
    console.log(`\n未解析的首参（${unresolved.length}，静态分析边界，不算违规）`)
    for (const u of unresolved) console.log(`  ${u.file}  ${u.kind}  ${u.raw}`)
  }

  console.log('')
  const fail = r1.length || r1b.length || r4.length || (blockAll && (r2.length || r3.length))
  console.log(fail ? 'FAIL 契约漂移存在' : 'PASS 契约一致')
  return fail ? 1 : 0
}

///////////////////////////////////////// props

/**
 * 裸类字段覆盖继承声明的校验器。
 *
 * 背景：组件里写 `rounded = true` 这类裸字段、与基类的 `@prop rounded` 同名，是**受支持**的
 * 写法 —— `CompElem.#adoptOwnFieldDefaults` 在 init 时检测「own 字段 + 原型链确有访问器」，
 * `delete this[key]` 并把字段值收编为该实例的 prop 默认值，attribute 照常反射。
 *
 * 但 `#adoptOwnFieldDefaults` 只遍历 `propDefs`，**不含 `@state`**。因此：
 *   裸字段覆盖 `@prop`  → 正常（收编），只报告，不阻断；
 *   裸字段覆盖 `@state` → own data property 会永久遮蔽 state 访问器，写入不再触发重渲染，**阻断**。
 */
function runProps({ asJson = false } = {}) {
  /** @type {string[]} */
  const files = walkFiles(srcDir, isSource)

  const rel = (f) => relative(root, f).replace(/\\/g, '/')
  /** 统一行尾：CRLF 会让带行尾注释的字段被 `$` 漏掉 */
  const read = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n')

  const parentsOf = new Map()
  const declsOf = new Map()
  const fileOf = new Map()

  for (const f of files) {
    const s = read(f)
    const cm = /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)[^{]*?extends\s+([^{]+)\{/.exec(s)
    if (!cm) continue
    // 父表达式里的标识符全收：兼容 `extends Virtualized(AppearanceElem)` 这类 mixin 包装
    parentsOf.set(cm[1], [...cm[2].matchAll(/([A-Za-z_$][\w$]*)/g)].map((x) => x[1]))
    fileOf.set(cm[1], f)
    const decls = new Map()
    const re = /@(prop|state)\s*(?:\([\s\S]*?\))?\s+([A-Za-z_$][\w$]*)/g
    let m
    while ((m = re.exec(s))) decls.set(m[2], m[1])
    declsOf.set(cm[1], decls)
  }

  const known = new Set(parentsOf.keys())

  /** 沿原型链找该 key 的声明族（prop / state） */
  function inheritedDecl(cls, key) {
    const seen = new Set([cls])
    const stack = [...(parentsOf.get(cls) || [])]
    while (stack.length) {
      const c = stack.pop()
      if (seen.has(c) || !known.has(c)) continue
      seen.add(c)
      const d = declsOf.get(c)
      if (d?.has(key)) return { kind: d.get(key), from: c }
      stack.push(...(parentsOf.get(c) || []))
    }
    return null
  }

  const props = []
  const states = []

  for (const f of files) {
    const s = read(f)
    const cm = /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)[^{]*?extends\s+([^{]+)\{/.exec(s)
    if (!cm) continue
    const cls = cm[1]
    const lines = s.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const fm = /^ {2}([A-Za-z_$][\w$]*)\s*=\s*([^;]+);?\s*(?:\/\/.*)?$/.exec(lines[i])
      if (!fm) continue
      // 上一行是纯装饰器行 ⇒ 本行是该 prop/state 自身，不算覆盖
      if (/^\s*@(prop|state)\s*(\([^)]*\))?\s*$/.test(lines[i - 1] || '')) continue
      const hit = inheritedDecl(cls, fm[1])
      if (!hit) continue
      const row = { file: rel(f), line: i + 1, cls, key: fm[1], from: hit.from, value: fm[2].trim() }
      ;(hit.kind === 'state' ? states : props).push(row)
    }
  }

  const byFile = (arr) => {
    const m = new Map()
    for (const x of arr) {
      if (!m.has(x.file)) m.set(x.file, [])
      m.get(x.file).push(x)
    }
    return m
  }

  if (asJson) {
    console.log(JSON.stringify({ props, states, scanned: files.length }, null, 2))
    return 0
  }

  console.log(`扫描 ${files.length} 个源文件\n`)

  console.log(`裸字段覆盖 @prop（${props.length} 处 / ${byFile(props).size} 个文件）—— 走 #adoptOwnFieldDefaults，正常`)
  for (const [file, items] of [...byFile(props).entries()].sort()) {
    console.log(`  ${file}`)
    for (const it of items) console.log(`    :${it.line}  ${it.key} = ${it.value}   ← ${it.from}`)
  }

  console.log(`\n裸字段覆盖 @state（${states.length} 处 / ${byFile(states).size} 个文件）—— 不会被收编，属缺陷`)
  for (const [file, items] of [...byFile(states).entries()].sort()) {
    console.log(`  ${file}`)
    for (const it of items) console.log(`    :${it.line}  ${it.key} = ${it.value}   ← ${it.from}`)
  }

  console.log('')
  const fail = states.length > 0
  console.log(fail ? `FAIL ${states.length} 处 @state 被裸字段遮蔽` : 'PASS 无 @state 遮蔽')
  return fail ? 1 : 0
}

///////////////////////////////////////// fonts

/**
 * 字号契约校验（见 src/css/root.scss「字号契约」注释块）。
 *
 * 规则：
 *   R1 font-size 引用 --ce-font-{xxs,xs,sm}-em  → error
 *      em 是「相对父级」，被当成档位写就会复合。table-bar 字段面板曾因
 *      0.875rem × 0.875 × 0.875 从 12.25px 掉到 9.4px。
 *      白名单：list/style-item.scss —— 列表主副标题必须等比跟随条目字号，
 *      属「相对自身」的合法用法（契约第 2 条）。
 *   R2 font-size 字面量 < 12px 且不为 0      → error
 *      读取型文字下限见 --ce-font-min；0 仅用于隐藏。
 *   R3 font-size 里的 max(12px, ...) 字面量   → warn
 *      下限已由 --ce-font-min 承载，请改写为 var(--ce-font-min)。
 *   R4 font-size 字面量 em（1.5em / 0.875em …）→ error
 *      em 相对父级，跨组件嵌套时会随外层字号复合。只有「跟随自身锚定字号」
 *      的合法用法才可保留（契约第 2 条），且须进白名单。
 *   R5 font-size 经自定义属性**间接**引用 em → error
 *      R1/R4 只看含 `font-size:` 的那一行，所以
 *        --x-fs: 1em;  …  font-size: var(--x-fs)
 *      这种「把 em 洗进变量」的写法原本完全不可见（btn.scss / pagination.scss 曾因此假绿）。
 *      R5 先建全仓自定义属性声明表，再把 var() 链（含 `var(--X, fallback)` 的兜底分支）
 *      展开成字面值后判 em。与 R1/R4 同行去重，不重复报。
 *
 * 豁免：行内注释 `font-allow <理由>`，用于契约第 3 条允许的徽标 / 标注类装饰文字，
 *      eg. `font-size: 11px; // font-allow 徽标`
 *
 * --ce-font-md-em 未纳入 R1：它的值是 1em，恒等于 inherit，不产生复合。
 */
function runFonts({ verbose = false } = {}) {
  /** 契约允许的相对字号用法（见 root.scss 契约第 2 条） */
  const EM_TIER_WHITELIST = ['components/layout/list/style-item.scss']
  /** 允许字面量 em 的文件：都是「跟随自身或条目锚定字号」的合法缩放 */
  const EM_LITERAL_WHITELIST = [
    'components/layout/list/style-item.scss',
    'components/datadisplay/stat/style.scss',
  ]
  /**
   * R5 专用白名单：em 经变量间接进来，但属合法用法。
   * icon —— `--ce-icon-unit` 默认 1.2em（css/_component.scss），纯图标控件覆盖为 1.35em。
   *         图标必须跟随所在控件的自身字号，正是契约第 4 条允许的「相对自身派生值」。
   * list-item —— 主副标题等比跟随条目字号，与 EM_LITERAL_WHITELIST 同理。
   */
  const EM_INDIRECT_WHITELIST = [
    'components/icons_images/icon/style.scss',
    'components/layout/list/style-item.scss',
    'components/datadisplay/stat/style.scss',
  ]
  const MIN_READING_FONT_PX = 12

  const isCommentLine = (line) => {
    const t = line.trimStart()
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
  }

  ///////////////////////////////////////// 自定义属性声明表与 var 链解析（R5）

  /** 去注释但保留换行，否则块注释被删掉后行号会整体前移 */
  const stripComments = (s) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))

  const files = walkFiles(srcDir, isStyleSource)

  /** name -> [{ value, at }]。同名多声明（各 size 档）全部保留，逐个判 */
  const decls = new Map()
  for (const f of files) {
    const rel = relative(root, f).replace(/\\/g, '/')
    const lines = stripComments(readFileSync(f, 'utf8')).split(/\r?\n/)
    lines.forEach((line, i) => {
      const re = /(--[\w-]+)\s*:\s*([^;{}]+)[;}]/g
      let m
      while ((m = re.exec(line))) {
        if (!decls.has(m[1])) decls.set(m[1], [])
        decls.get(m[1]).push({ value: m[2].trim(), at: `${rel}:${i + 1}` })
      }
    })
  }

  /** 找出 value 里所有 var(...) 调用（含 fallback），按括号配对取完整调用 */
  function parseVars(value) {
    const out = []
    const re = /var\(\s*(--[\w-]+)/g
    let m
    while ((m = re.exec(value))) {
      const open = value.indexOf('(', m.index)
      let depth = 0
      let end = -1
      for (let i = open; i < value.length; i++) {
        if (value[i] === '(') depth++
        else if (value[i] === ')') { depth--; if (!depth) { end = i; break } }
      }
      if (end < 0) continue
      const inner = value.slice(open + 1, end)
      let d = 0
      let comma = -1
      for (let i = 0; i < inner.length; i++) {
        const c = inner[i]
        if (c === '(') d++
        else if (c === ')') d--
        else if (c === ',' && !d) { comma = i; break }
      }
      out.push({
        start: m.index,
        end: end + 1,
        name: inner.slice(0, comma < 0 ? inner.length : comma).trim(),
        fallback: comma < 0 ? null : inner.slice(comma + 1).trim(),
      })
      re.lastIndex = end + 1
    }
    return out
  }

  const MAX_BRANCHES = 64
  /** 展开成不含 var() 的字面值集合；解析不了的保留原样（宿主/文档站定义的公开 token） */
  function expand(value, depth = 0, seen = new Set()) {
    if (depth > 6) return [value]
    const calls = parseVars(value)
    if (!calls.length) return [value]
    const c = calls[0]
    const before = value.slice(0, c.start)
    const after = value.slice(c.end)
    const ds = decls.get(c.name)
    const branches = ds?.length ? ds.map((d) => d.value) : c.fallback != null ? [c.fallback] : null
    const tails = expand(after, depth + 1, seen)
    const out = []
    if (!branches) {
      for (const t of tails) out.push(`${before}var(${c.name})${t}`)
    } else {
      for (const b of branches) {
        const key = `${c.name}=${b}`
        if (seen.has(key)) continue
        const s2 = new Set(seen)
        s2.add(key)
        for (const eb of expand(b, depth + 1, s2)) {
          for (const t of tails) out.push(before + eb + t)
          if (out.length >= MAX_BRANCHES) return out
        }
      }
    }
    return out.slice(0, MAX_BRANCHES)
  }

  /** 只匹配 em，不匹配 rem（`[\d.]+` 后必须紧跟 em，rem 的 r 会挡住） */
  const EM_LITERAL_RE = /[\d.]+em\b/

  const errors = []
  const warnings = []
  let scanned = 0

  for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, '/')
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)

    lines.forEach((line, i) => {
      if (!/font-size\s*:/.test(line) || isCommentLine(line)) return
      if (/font-allow\b/.test(line)) return
      scanned++
      const at = `${rel}:${i + 1}`
      const errBefore = errors.length

      // R1 档位型 em
      const emTier = line.match(/font-size\s*:[^;]*var\(\s*--ce-font-(xxs|xs|sm)-em\b/)
      if (emTier && !EM_TIER_WHITELIST.some((w) => rel.endsWith(w))) {
        errors.push(
          `R1 ${at}  font-size 使用了 em 档 --ce-font-${emTier[1]}-em，请改用 rem 档（--ce-font-${emTier[1]}）`
        )
      }

      // R2 过小字面量
      const px = line.match(/font-size\s*:\s*([\d.]+)px/)
      if (px) {
        const v = parseFloat(px[1])
        if (v > 0 && v < MIN_READING_FONT_PX) {
          errors.push(
            `R2 ${at}  font-size 字面量 ${px[1]}px 低于下限 ${MIN_READING_FONT_PX}px（--ce-font-min）`
          )
        }
      }

      // R3 max(12px, ...) 字面量
      if (/font-size\s*:[^;]*max\(\s*\d+(\.\d+)?px\s*,/.test(line)) {
        warnings.push(`R3 ${at}  建议把 max() 的 px 字面量换成 var(--ce-font-min)`)
      }

      // R4 字面量 em
      if (
        /font-size\s*:[^;]*[\d.]+em\b/.test(line) &&
        !EM_LITERAL_WHITELIST.some((w) => rel.endsWith(w))
      ) {
        errors.push(
          `R4 ${at}  font-size 使用了字面量 em，会随父级字号复合；请改用 var(--ce-font-*) 档位，` +
            `确属「跟随自身锚定字号」的用法请加入 EM_LITERAL_WHITELIST`
        )
      }

      // R11 字面量 rem
      if (/font-size\s*:[^;]*[\d.]+rem\b/.test(line) && !rel.endsWith('css/root.scss')) {
        errors.push(
          `R11 ${at}  font-size 使用了字面量 rem；档位请用 var(--ce-font-*)，` +
            `需要超出档位表的标题级字号请写 calc(var(--ce-font-base) * k)`
        )
      }

      // R5 经自定义属性间接引用 em —— R1/R4 只看本行，变量里的 em 是它们的盲区
      const fsVal = /font-size\s*:\s*([^;]+);?/.exec(line)?.[1]
      if (fsVal && /var\(\s*--/.test(fsVal) && !EM_INDIRECT_WHITELIST.some((w) => rel.endsWith(w))) {
        // 本行已被 R1/R4 判过就不重复报
        const already = errors.slice(errBefore).some((e) => e.startsWith('R1 ') || e.startsWith('R4 '))
        if (!already) {
          const emLeaves = expand(fsVal).filter((v) => EM_LITERAL_RE.test(v))
          if (emLeaves.length) {
            const chain = new Set()
            for (const m of fsVal.matchAll(/var\(\s*(--[\w-]+)/g)) {
              for (const d of decls.get(m[1]) || []) {
                if (expand(d.value).some((v) => EM_LITERAL_RE.test(v))) chain.add(`${m[1]} = ${d.value}  @ ${d.at}`)
              }
            }
            errors.push(
              `R5 ${at}  font-size 经变量间接引用 em（解析后 ${emLeaves[0].trim()}）` +
                `${chain.size ? '；' + [...chain].join(' | ') : ''}。` +
                `档位请改用 var(--ce-font-*) rem 档；确属「跟随自身锚定字号」请加入 EM_INDIRECT_WHITELIST`
            )
          }
        }
      }
    })
  }

  if (verbose) {
    for (const e of errors) console.log(e)
    for (const w of warnings) console.log(w)
  }

  for (const w of warnings) console.warn(`[check-fonts] warn  ${w}`)

  if (errors.length) {
    for (const e of errors) console.error(`[check-fonts] error ${e}`)
    console.error(
      `\n[check-fonts] ${errors.length} 处违反字号契约（共扫描 ${scanned} 条 font-size）。` +
        `\n规则与白名单见 src/css/root.scss「字号契约」与 scripts/check.mjs fonts 头部。`
    )
    return 1
  }

  console.log(
    `[check-fonts] OK — 扫描 ${scanned} 条 font-size，0 处违反契约` +
      (warnings.length ? `，${warnings.length} 条建议` : '')
  )
  return 0
}

///////////////////////////////////////// colors

/**
 * 硬编码颜色债务校验。
 *
 * 背景：暗色主题（`[data-theme="dark"]`，css/root.scss）只覆盖语义 token，
 * 组件里写死的 `#fff` / `rgba(0,0,0,.65)` 不会跟随主题 —— 暗色下文字可能直接消失。
 * 主题能做多深，取决于这层债务清到多少，而不是 token 有多少个。
 *
 * 基线按「文件 + 类别 + 数量」记录，不记录行号：行号会随编辑漂移，
 * 数量增长才是真实新增债务。
 *
 * 类别：
 *   hex     —— #fff / #ffffff / #rrggbb 等字面量（应改为 --ce-color-*）
 *   blacka  —— rgba(0,0,0,…)、rgb(0 0 0 / …)（文字场景应改 --ce-color-text-*；
 *              阴影/渐变遮罩属合理用法，用 font-allow 同款注释豁免）
 *
 * 豁免：行内 `color-allow <理由>`。
 *   例：linear-gradient(to top, rgba(0,0,0,0), rgb(0,0,0)) // color-allow 透明度标尺
 */
function runColors({ strict = false, update = false } = {}) {
  const baselinePath = join(root, 'scripts', 'color-baseline.json')

  const isCommentLine = (line) => {
    const t = line.trimStart()
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
  }

  const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g
  const BLACKA_RE = /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]|rgb\(\s*0\s+0\s+0\s*\//g

  const counts = {}
  let total = 0

  for (const file of walkFiles(srcDir, isStyleSource)) {
    const rel = relative(root, file).replace(/\\/g, '/')
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (isCommentLine(line) || /color-allow\b/.test(line)) return
      const hex = line.match(HEX_RE) || []
      const blacka = line.match(BLACKA_RE) || []
      if (!hex.length && !blacka.length) return
      const entry = (counts[rel] ||= { hex: 0, blacka: 0 })
      entry.hex += hex.length
      entry.blacka += blacka.length
      total += hex.length + blacka.length
    })
  }

  const sum = Object.values(counts).reduce(
    (a, c) => ({ hex: a.hex + c.hex, blacka: a.blacka + c.blacka }),
    { hex: 0, blacka: 0 }
  )

  if (update) {
    writeFileSync(baselinePath, JSON.stringify({ _note: '由 scripts/check.mjs colors --update 生成；数量增长即新增硬编码颜色债务', files: counts }, null, 2) + '\n')
    console.log(`[check-colors] 基线已更新：${Object.keys(counts).length} 个文件，hex ${sum.hex} / blacka ${sum.blacka}`)
    return 0
  }

  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, 'utf8')).files || {}
    : null

  const regressions = []
  for (const [file, c] of Object.entries(counts)) {
    const base = baseline?.[file] || { hex: 0, blacka: 0 }
    if (c.hex > base.hex) regressions.push(`${file}: hex ${base.hex} → ${c.hex}`)
    if (c.blacka > base.blacka) regressions.push(`${file}: blacka ${base.blacka} → ${c.blacka}`)
  }

  console.log(
    `[check-colors] 当前硬编码颜色：hex ${sum.hex}、rgba(0,0,0) ${sum.blacka}，涉及 ${Object.keys(counts).length} 个文件` +
      (baseline ? '' : '（尚无基线，运行 --update 生成）')
  )
  const top = Object.entries(counts)
    .sort((a, b) => b[1].hex + b[1].blacka - (a[1].hex + a[1].blacka))
    .slice(0, 8)
  for (const [file, c] of top) console.log(`  ${String(c.hex).padStart(3)} hex ${String(c.blacka).padStart(2)} blacka  ${file}`)

  if (regressions.length) {
    const msg = regressions.map((r) => `[check-colors] 新增债务 ${r}`)
    if (strict) {
      for (const m of msg) console.error(m)
      console.error(`[check-colors] ${regressions.length} 个文件的硬编码颜色多于基线；请改用 --ce-color-* 语义 token`)
      return 1
    }
    for (const m of msg) console.warn(m)
  }

  console.log(total ? '[check-colors] OK（未新增债务）' : '[check-colors] 无硬编码颜色')
  return 0
}

///////////////////////////////////////// 主流程

const argv = process.argv.slice(2)
const KNOWN_FLAGS = new Set(['--json', '--strict', '--update', '--all', '--verbose'])
const unknownFlags = argv.filter(a => a.startsWith('-') && !KNOWN_FLAGS.has(a))
const rawTargets = argv.filter(a => !a.startsWith('-'))

const asJson = argv.includes('--json')
const strict = argv.includes('--strict')
const update = argv.includes('--update')
const blockAll = argv.includes('--all')
const verbose = argv.includes('--verbose')

if (unknownFlags.length) {
  console.error(`[check] 未知参数: ${unknownFlags.join(', ')}`)
  console.error('用法: node scripts/check.mjs [contracts|props|fonts|colors|all] [--json] [--strict] [--update]')
  process.exit(1)
}

const requested = rawTargets.length ? rawTargets : ['all']

const CHECKS = {
  contracts: () => runContracts({ blockAll }),
  props: () => runProps({ asJson }),
  fonts: () => runFonts({ verbose }),
  colors: () => runColors({ strict, update })
}

const unknownTargets = requested.filter(t => t !== 'all' && !CHECKS[t])
if (unknownTargets.length) {
  console.error(`[check] 未知目标: ${unknownTargets.join(', ')}`)
  console.error('用法: node scripts/check.mjs [contracts|props|fonts|colors|all] [--json] [--strict] [--update]')
  process.exit(1)
}

const targets = [...new Set(requested.includes('all') ? Object.keys(CHECKS) : requested)]

let failed = 0
for (const target of targets) {
  if (CHECKS[target]()) failed++
}

process.exit(failed ? 1 : 0)
