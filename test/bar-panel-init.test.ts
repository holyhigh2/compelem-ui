import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 操作条面板的「已初始化」标记必须整数组赋值更新。
 *
 * `overlayInitedList` 用 `@state` 声明，数组的 mutation（push/splice）不进入更新队列；
 * 而面板内容由 `ifTrue(this.overlayInitedList.includes(cls), ...)` 门禁控制。用 push 时
 * 门禁读到的仍是旧数组，分支永不渲染 ⇒ `.ce-overlay-content` 恒 0×0，
 * `openBy()` 走 `__revealPending` 分支后等不到内容变化，浮层永久停在不可见状态
 * （首次点击工具条按钮没有任何反应）。
 *
 * jsdom 不跑 overlay 的尺寸测量，行为验证放在浏览器探针里；这里守住代码契约。
 */
const root = process.cwd()
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const files = [
  'src/components/datadisplay/table/TableBar.ts',
  'src/components/datadisplay/table/ColumnConfigPane.ts',
  'src/base/BarActions.ts',
]

describe('操作条面板初始化标记', () => {
  for (const file of files) {
    it(`${file} 不使用原地 mutation 更新 overlayInitedList`, () => {
      const source = stripComments(readFileSync(join(root, file), 'utf8'))
      expect(source).not.toMatch(/this\.overlayInitedList\.(push|splice|unshift)\(/)
      expect(source).toMatch(/this\.overlayInitedList = \[\.\.\.this\.overlayInitedList,/)
    })
  }
})
