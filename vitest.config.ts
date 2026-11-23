import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { compelemCompiler } from '@compelem/compiler/vite'
import { compelemCss } from 'vite-plugin-compelem-css'
import { stripHtmlComments } from 'vite-plugin-compelem-strip-comments'

// 单元测试配置：
// `npm run test`          单次运行全部用例
// `npm run test:coverage` 单次运行并生成覆盖率报告
//
// 与 dev 管线保持一致：stripHtmlComments 剥离模板内 HTML 注释（避免破坏
// compelem 模板解析）、compelemCss 处理 `.scss?tmpl` 导入。
// DOM 环境必须用 jsdom：compelem 模板编译依赖形如 "⟬Ċ⟭0" 的非 ASCII 占位符属性，
// happy-dom 的解析器会从属性名中丢弃这些字符导致插值错位。
export default defineConfig({
  resolve: {
    // 组件统一是手写 .ts，无扩展名导入按此顺序解析。
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
      // 库构建将 compelem-router 标记为 external，测试环境用替身模块
      'compelem-router': fileURLToPath(new URL('./test/stubs/compelem-router.ts', import.meta.url))
    }
  },
  // 测试同样需要模板预编译：compelem 组件的 render 模板依赖 __ce_static__ 注入，
  // 少了 compiler 插件，元素会正常 upgrade 但渲染结果为空。
  plugins: [compelemCompiler(), compelemCss(), stripHtmlComments()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/components/**'],
      reporter: ['text', 'html', 'lcov'],
      // 覆盖率棘轮：只允许向上调，不允许向下。当前基线（2026-11-23，test:coverage 实测）
      // 是 stmts/lines 28.07%、branch 67.89%、funcs 25.5%，阈值取略低一档，
      // 作用是「新增未覆盖代码不会把整体拉下去」，不是给全库设达标线。
      // 组件总数 100+，按目录单独补测试后再逐项抬这条线。
      thresholds: {
        statements: 28,
        lines: 28,
        branches: 67,
        functions: 25
      }
    }
  }
})
