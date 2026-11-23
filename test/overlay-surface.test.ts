import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 弹出层表面的代码契约。
 *
 * overlay 只负责定位，内容元素由调用者提供；而面板类内容（配置面板、日期/时间面板、
 * 取色面板…）底色与页面底色同为背景色，没有描边/投影时边界无从辨认。
 * `surface` 属性把这层表面（背景/圆角/描边/投影）挂到 `.ce-overlay-content` 上，
 * 内容被搬进 overlay 自己的树里，所以样式也必须写在 overlay 的样式表中。
 *
 * jsdom 不做投影合成，视觉效果靠浏览器探针（CDP 量 computed box-shadow）验证；
 * 这里守住：属性 → class → 样式 三段链路，以及面板类浮层不漏开 surface。
 */
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('overlay 表面', () => {
  it('surface 属性映射为 content 上的 ce-overlay-surface class', () => {
    const source = read('src/components/overlays/overlay/Overlay.ts')
    expect(source).toMatch(/@prop surface = false/)
    expect(source).toMatch(/"ce-overlay-surface": this\.surface/)
  })

  it('ce-overlay-surface 声明背景/圆角/投影，且投影走主题 token', () => {
    const style = read('src/components/overlays/overlay/style.scss')
    const block = style.slice(style.indexOf('&.ce-overlay-surface'))
    expect(block).toMatch(/background:/)
    expect(block).toMatch(/border-radius:/)
    expect(block).toMatch(/box-shadow: var\(--ce-overlay-surface-shadow, var\(--ce-shadow-overlay\)\)/)
    const tokens = read('src/css/root.scss')
    // 描边色取主题边框色：黑色投影在深色底上不可见，边界靠这圈描边维持
    expect(tokens).toMatch(/--ce-shadow-overlay: 0 0 0 1px rgb\(var\(--ce-color-border-rgb/)
  })

  it('面板类浮层都开启 surface', () => {
    const files = [
      'src/components/datadisplay/table/TableBar.ts',
      'src/components/datadisplay/board/BoardBar.ts',
      'src/components/datadisplay/table/ColumnConfigPane.ts',
      'src/components/form/input/InputColor.ts',
      'src/components/form/input/InputDate.ts',
      'src/components/form/input/InputDateRange.ts',
      'src/components/form/input/InputTime.ts',
      'src/components/picker/datepicker/DatePicker.ts',
    ]
    for (const file of files) {
      const source = read(file)
      const panels = source.match(/<ce-overlay[^>]*class="[^"]*-panel"[^>]*>/g) ?? []
      expect(panels.length, `${file} 未找到面板类 overlay`).toBeGreaterThan(0)
      for (const tag of panels) {
        expect(tag, `${file} 的面板浮层缺少 surface`).toMatch(/<ce-overlay surface /)
      }
    }
  })
})
