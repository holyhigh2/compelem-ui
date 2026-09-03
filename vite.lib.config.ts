import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { compelemCss } from 'vite-plugin-compelem-css'
import dts from 'vite-plugin-dts'

// 组件库构建配置：
// `npm run build:lib` 将 src/index.ts 编译为可发布的 ES / UMD 包，
// 并把第三方运行时（compelem / myfx / uiik / bootstrap-icons）设为外部依赖，
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

// 把库的元文件（README.md / package.json）复制进 dist/ 的 Vite 插件
function copyDocsPlugin(): Plugin {
  return {
    name: 'compelem-ui:copy-docs',
    generateBundle() {
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
      this.emitFile({
        type: 'asset',
        fileName: 'package.json',
        source: JSON.stringify(pkg, null, 2)
      })
      try {
        const readme = readFileSync('README.md', 'utf8')
        this.emitFile({ type: 'asset', fileName: 'README.md', source: readme })
      } catch {
        // README.md 不存在时不报错
      }
    }
  }
}

// 是否为 debug 构建：build:debug 通过 --outDir dist-debug 触发。
// debug 构建面向本地/独立调试，把框架依赖（compelem/myfx/uiik/bootstrap-icons）
// 一并打进产物，使 compelem-ui.umd.js / .es.js 可独立运行，
// 不依赖宿主应用再提供这些 external（避免 UMD 在 global.CompElem 未定义时报错）。
// 生产 build:lib 仍保持 external（库的正确发布形态，compelem 作为对等依赖由消费方提供）。
//
// 入口差异：debug 使用 src/register.ts —— 在导出全部组件的同时调用 defineComponents()，
// 把组件注册进 customElements，使打进来的 compelem 也能完成注册（否者组件全部“未注册”）。
// 生产使用 src/index.ts，保持 compelem 为 external、由消费方负责注册（与原行为一致）。
const __argv = process.argv
const __odIdx = __argv.indexOf('--outDir')
const __outDir = __odIdx >= 0
  ? __argv[__odIdx + 1]
  : (__argv.find(a => typeof a === 'string' && a.startsWith('--outDir='))?.split('=')[1])
const isDebugBuild = __outDir === 'dist-debug'
const libEntry = isDebugBuild
  ? fileURLToPath(new URL('./src/register.ts', import.meta.url))
  : fileURLToPath(new URL('./src/index.ts', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    compelemCss(),
    emitIndexCssPlugin(),
    dts({
      include: ['src', 'vite-env.d.ts'],
      insertTypesEntry: true
    }),
    copyDocsPlugin()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'CompelemUI',
      formats: ['es', 'umd'],
      fileName: (format) => `compelem-ui.${format}.js`
    },
    rollupOptions: {
      external: ['compelem', 'myfx', 'uiik', 'bootstrap-icons', 'compelem-router'],
      output: {
        globals: {
          compelem: 'CompElem',
          myfx: 'myfx',
          uiik: 'uiik'
        }
      }
    }
  }
})
