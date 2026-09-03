/// <reference types="vite/client" />

// SCSS 以 `?inline` 方式导入时返回编译后的 CSS 字符串（用于注入 Shadow DOM）
declare module '*.scss?inline' {
  const css: string
  export default css
}

// 普通（不带 ?inline / ?tmpl）的 SCSS/CSS 导入：
// Vite 编译后会把编译后的 CSS 字符串作为 default 导出（用于构造 CSSStyleSheet / replaceSync）。
declare module '*.scss' {
  const css: string
  export default css
}
declare module '*.sass' {
  const css: string
  export default css
}
declare module '*.css' {
  const css: string
  export default css
}

// 返回的是 compelem 的 CssTemplate，可直接用于 `static get css()` 返回数组。
declare module '*.scss?tmpl' {
  import type { CssTemplate } from 'compelem'
  const css: CssTemplate
  export default css
}
declare module '*.sass?tmpl' {
  import type { CssTemplate } from 'compelem'
  const css: CssTemplate
  export default css
}
declare module '*.css?tmpl' {
  import type { CssTemplate } from 'compelem'
  const css: CssTemplate
  export default css
}

// xlsx-js-style（运行时通过 CDN / 手写入包，仅在 utils/excel.ts 中按需 import）
declare module 'xlsx-js-style' {
  const XLSX: any
  export default XLSX
}

// 表格扩展配置中读取的构建期环境变量
declare const process: {
  env: Record<string, string | undefined>
}
