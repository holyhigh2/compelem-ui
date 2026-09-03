import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { compelemCss } from 'vite-plugin-compelem-css'
import { stripHtmlComments } from 'vite-plugin-compelem-strip-comments'

// 单元测试配置：
// `npm run test`      单次运行全部用例
// `npm run test:ui`   打开 Vitest UI 面板（含覆盖率）预览测试结果
//
// 与 dev 管线保持一致：stripHtmlComments 剥离模板内 HTML 注释（避免破坏
// compelem 模板解析）、compelemCss 处理 `.scss?tmpl` 导入。
// DOM 环境必须用 jsdom：compelem 模板编译依赖形如 "⟬Ċ⟭0" 的非 ASCII 占位符属性，
// happy-dom 的解析器会从属性名中丢弃这些字符导致插值错位。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
      // 库构建将 compelem-router 标记为 external，测试环境用替身模块
      'compelem-router': fileURLToPath(new URL('./test/stubs/compelem-router.ts', import.meta.url))
    }
  },
  plugins: [stripHtmlComments(), compelemCss()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/components/**'],
      reporter: ['text', 'html', 'lcov']
    }
  }
})
