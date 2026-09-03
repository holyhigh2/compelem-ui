import * as path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { compelemCss } from 'vite-plugin-compelem-css'
import { stripHtmlComments } from 'vite-plugin-compelem-strip-comments'

// 开发 / 演示构建配置：
// `npm run dev`    启动本地服务并在浏览器打开测试页（index.html）
// `npm run build`  产出演示站点到 dist-demo/
//
// 演示站点与测试页共用 index.html：其通过 import map 把 compelem/myfx/uiik/compelem-router
// 指向 test/compelem-deps.js（由 vite.deps.config.ts 编译）。该文件未被 Vite 视为模块依赖、
// 不会被自动拷贝进产物，故这里用 copyDepsPlugin 把它随构建一并输出到 dist-demo/test/。
function copyDepsPlugin(): Plugin {
  return {
    name: 'compelem-ui:copy-deps',
    generateBundle() {
      const fs = require('node:fs')
      const src = path.resolve('test/compelem-deps.js')
      if (fs.existsSync(src)) {
        this.emitFile({
          type: 'asset',
          fileName: 'test/compelem-deps.js',
          source: fs.readFileSync(src, 'utf8')
        })
      }
    }
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: false
  },
  plugins: [
    stripHtmlComments(),
    compelemCss(),
    copyDepsPlugin()
  ],
  build: {
    outDir: 'dist-demo'
  }
})
