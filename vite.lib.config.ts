import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { compelemCompiler, scanKnownTags } from '@compelem/compiler'
import { compelemCss } from 'vite-plugin-compelem-css'
import dts from 'vite-plugin-dts'

// 组件源码里出现的 @tag 名。编译器预扫只覆盖 vite root，多入口构建下
// 需要显式给出，否则模板里的 slot() 一类指令会因标签未知报 E-DIRECTIVE-SCOPE。
function collectKnownTags(): string[] {
  const tags = new Set<string>()
  scanKnownTags(fileURLToPath(new URL('.', import.meta.url)), tags, {
    extensions: /\.(ts|tsx)$/
  })
  return [...tags]
}

// 组件库构建配置：
// `npm run build:lib` 将 src/ 编译为可发布的 ESM 包（多入口），
// 并把第三方运行时（compelem / myfx / uiik / compelem-router）设为外部依赖，
// 同时由 vite-plugin-dts 生成 .d.ts 类型声明。
//
// 额外把 README.md 与 package.json 一并输出到 dist/，方便直接发布。

// 额外导出一份全局样式文件 dist/index.css：
// compelem 采用 Shadow DOM，组件样式在运行时由 JS 注入到 shadow root，
// 但全局主题变量（--l-* 等，定义于 src/css/root.scss）与基础样式（src/css/index.scss）
// 需要一个可被消费方直接 import 的独立入口，用于全局主题覆盖 / 浅 DOM 场景。
// 这里在打包阶段用 sass 编译 src/css/index.scss 并作为 index.css 资源输出。
function emitIndexCssPlugin(): Plugin {
  return {
    name: 'compelem-ui:emit-index-css',
    async generateBundle() {
      const { compile } = await import('sass')
      const entry = path.resolve('src/css/index.scss')
      const result = compile(entry, {
        loadPaths: [path.dirname(entry), 'src/css'],
        style: 'expanded'
      })
      this.emitFile({
        type: 'asset',
        fileName: 'index.css',
        source: result.css
      })
    }
  }
}

// 生成入口源码位于 src 外，dts 插件不会保留其目录结构；按清单直接发出
// dist/entries/<tag>.d.ts，避免声明公共根目录从 src 扩到仓库根。
function emitEntryTypesPlugin(): Plugin {
  return {
    name: 'compelem-ui:emit-entry-types',
    generateBundle() {
      if (isDebugBuild) return
      const manifestFile = fileURLToPath(new URL('./.generated/entries/manifest.json', import.meta.url))
      if (!fs.existsSync(manifestFile)) {
        throw new Error(`[compelem-ui] 构建入口清单缺失：${manifestFile}，请运行 npm run build:lib`)
      }
      const { components } = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as {
        components: Array<{ tag: string, declaration: string }>
      }
      for (const { tag, declaration } of components) {
        this.emitFile({
          type: 'asset',
          fileName: `entries/${tag}.d.ts`,
          source: declaration
        })
      }
    }
  }
}

// 是否为 debug 构建：build:debug 通过 --outDir dist-debug 触发。
// debug 构建面向本地/独立调试，产物可被直接引入（无需消费方逐个 import 组件入口），
// 因此入口换成全量注册入口 register（见 src/register.ts）。
// 生产 build:lib 走 src/index.ts + .generated/entries/*，保持 compelem 为 external、
// 由消费方负责注册（与原行为一致）。
//
// 注意：两种构建的 rollupOptions.external 相同，compelem / myfx / uiik 一律外置，
// 因此产物并非「自包含」，独立调试页仍需能解析到这些依赖。
const __argv = (process as any).argv as string[]
const __odIdx = __argv.indexOf('--outDir')
const __outDir = __odIdx >= 0
  ? __argv[__odIdx + 1]
  : (__argv.find((a: string) => a.startsWith('--outDir='))?.split('=')[1])
const isDebugBuild = __outDir === 'dist-debug'

// 收集入口：
// - 生产：主入口 src/index.ts + 每个组件的自注册入口（.generated/entries/<tag>.ts），实现按需 subpath 打包
// - debug：仅 src/register.ts（全量注册，供本地调试），不拆分 subpath
function collectEntries() {
  if (isDebugBuild) {
    const register = fileURLToPath(new URL('./src/register.ts', import.meta.url))
    if (!fs.existsSync(register)) {
      throw new Error(`[compelem-ui] debug 构建入口缺失：${register}`)
    }
    return { register }
  }
  const entries: Record<string, string> = {
    index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    // 全量注册入口：宿主不想逐个 import 子路径时使用（体积最大，按需选择）
    register: fileURLToPath(new URL('./src/register.ts', import.meta.url)),
    // 图标独立入口：图标集约 80KB，不应无条件进入任何组件的依赖图
    icons: fileURLToPath(new URL('./src/icons/icons.ts', import.meta.url)),
    // 全量图标注册入口（逃生口）：import 'compelem-ui/icons/full' 使字符串引用开箱可用
    'icons-full': fileURLToPath(new URL('./src/icons/full.ts', import.meta.url)),
    // 语言包独立入口：只引入单个组件子路径的宿主也要能配置内置文案
    locale: fileURLToPath(new URL('./src/locale/index.ts', import.meta.url))
  }
  const entriesDir = fileURLToPath(new URL('./.generated/entries', import.meta.url))
  if (!fs.existsSync(entriesDir)) {
    throw new Error(`[compelem-ui] 构建入口缺失：${entriesDir}，请运行 npm run build:lib`)
  }
  for (const f of fs.readdirSync(entriesDir)) {
    if (f.endsWith('.ts') && !f.endsWith('.bak')) {
      const name = f.replace(/\.ts$/, '')
      entries[name] = path.join(entriesDir, f)
    }
  }
  return entries
}

export default defineConfig({
  resolve: {
    // 组件源码统一是手写 .ts（`.ce` 单文件组件已废弃）。
    // 组件源码与 .generated/entries 里的导入都不带扩展名，靠这里的顺序解析。
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    // 必须与 test 用同一套编译流程。
    // 混用「编译态」与「未编译态」会静默丢 props：编译态子类通过
    // `Reflect.getPrototypeOf(X).__ce_static__` 合并基类成员，而基类若没被
    // 编译（例如 AppearanceElem），合并结果就是 undefined —— 继承来的
    // appearance / hoverable 等 prop 全部不注册，且没有任何报错。
    compelemCompiler({ knownTags: collectKnownTags() }),
    compelemCss(),
    emitIndexCssPlugin(),
    emitEntryTypesPlugin(),
    dts({
      // 多入口构建：组件源码声明与 emitEntryTypesPlugin 发出的入口声明。
      // 不能开 insertTypesEntry——它会额外再插一份入口声明，与插件自身输出叠加成重复 export。
      include: ['src', 'vite-env.d.ts'],
      entryRoot: 'src',
      strictOutput: true,
      beforeWriteFile(filePath) {
        // 仅用于补齐 ?inline 等模块类型，不随发布包发出。
        if (filePath.endsWith('/vite-env.d.ts')) return false
      },
      // 手写 .d.ts 默认被当作“输入声明”跳过而不会进 dist，这里保留兜底：
      // 将来新增手写声明仍能随包发出。
      copyDtsFiles: true
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    // 浏览器基线：Chrome/Edge 99、Firefox 97、Safari 15.4（≈2022）。
    // 依据是库内实际使用的最高要求特性：@layer（cascade 隔离，css/_component.scss）
    // → Chrome99/Safari15.4/Firefox97。此前最高的是 :has()（Firefox121+），
    // 已在 Card / PanelGroup 改为属性标记，color-mix() 已加不透明描边降级。
    // 改动这张表等于改兼容承诺，必须同步 package.json 的 browserslist 与 README。
    target: ['chrome99', 'edge99', 'firefox97', 'safari15.4'],
    lib: {
      entry: collectEntries(),
      name: 'CompelemUI',
      formats: ['es'],
      // index 保持历史文件名 compelem-ui.es.js；其余 entry 一律用自身名字，
      // register 不能复用同一文件名，否则 rollup 会产出 compelem-ui2.es.js。
      fileName: (format, entryName) =>
        entryName === 'index'
          ? `compelem-ui.${format}.js`
          : entryName === 'icons-full'
            ? `icons/full.${format}.js`
            : `${entryName}.${format}.js`
    },
    rollupOptions: {
      external: ['compelem', 'myfx', 'uiik', 'compelem-router'],
      // exceljs 是可选运行时依赖（仅在调用 exportExcel 时由宿主解析），
      // 其内部 `fs` 引用会在构建期触发 "externalized for browser compatibility" 警告。
      // 这里只过滤这一条已知噪声，其余警告照常输出，避免掩盖真正的 externalize 问题。
      onwarn(warning, warn) {
        if (typeof warning.message === 'string' && /"fs".*has been externalized/.test(warning.message)) return
        warn(warning)
      }
    }
  }
})
