import { describe, expect, it } from 'vitest'
import { resolveSubPos } from '../src/components/nav/menu/Menu'

/**
 * 子菜单落位规则（`resolveSubPos` 是纯函数，不摸 DOM）：
 *  1. 右侧优先，右侧放不下且**左侧放得下**才翻到左侧；
 *  2. 两侧都放不下时取空间大的一侧 —— 宁可溢出视口，也不许压在父菜单上；
 *  3. 纵向只在越界时上移，上移后仍越界的贴视口顶边，不把子菜单推出去。
 *
 * 第 4 组是回归用例：inline 菜单（ce-dropdown）的包含块恰好等于菜单自身宽度，
 * 旧实现拿包含块当边界 ⇒ 右侧恒判"放不下" ⇒ 子菜单反折盖住父菜单。
 */
const VIEWPORT = { width: 1414, height: 807 }

describe('resolveSubPos 横向落位', () => {
  it('右侧放得下：贴父行右缘，不翻边', () => {
    const pos = resolveSubPos(100, 200, 160, 60, { width: 92, height: 68 }, VIEWPORT)
    expect(pos.left).toBe(160)
    expect(100 + pos.left + 92).toBeLessThanOrEqual(VIEWPORT.width)
  })

  it('右侧放不下、左侧放得下：翻到左侧', () => {
    // 宿主贴右：1200 + 160 + 92 > 1414 - 20，左侧还有 1180
    const pos = resolveSubPos(1200, 200, 160, 60, { width: 92, height: 68 }, VIEWPORT)
    expect(pos.left).toBe(-92)
    expect(1200 + pos.left).toBeGreaterThanOrEqual(0)
  })

  it('两侧都放不下：右侧空间更大时仍贴右', () => {
    // 子菜单 800 宽：右侧 734、左侧 480 都不够 ⇒ 选右侧
    const pos = resolveSubPos(500, 200, 160, 60, { width: 800, height: 68 }, VIEWPORT)
    expect(pos.left).toBe(160)
  })

  it('两侧都放不下：左侧空间更大时翻左', () => {
    // 子菜单 700 宽：右侧 534、左侧 680 都不够 ⇒ 选左侧
    const pos = resolveSubPos(700, 200, 160, 60, { width: 700, height: 68 }, VIEWPORT)
    expect(pos.left).toBe(-700)
  })

  it('inline 包含块等于菜单宽度时不再反折（回归）', () => {
    // 复现数据：宿主 367..527、视口 1414、子菜单 92 —— 右侧有 867px 空间
    const pos = resolveSubPos(367, 300, 160, 57, { width: 92, height: 68 }, VIEWPORT)
    expect(pos.left).toBe(160)
    expect(367 + pos.left).toBeGreaterThanOrEqual(527)
  })
})

describe('resolveSubPos 纵向落位', () => {
  it('不越界时保持贴父行', () => {
    const pos = resolveSubPos(100, 200, 160, 57, { width: 92, height: 68 }, VIEWPORT)
    expect(pos.top).toBe(57)
  })

  it('下侧越界：上移到视口内', () => {
    const pos = resolveSubPos(100, 700, 160, 57, { width: 92, height: 68 }, VIEWPORT)
    expect(pos.top).toBeLessThan(57)
    expect(700 + pos.top + 68).toBeLessThanOrEqual(VIEWPORT.height)
  })

  it('比视口还高：贴顶边而不是继续上移出视口', () => {
    const pos = resolveSubPos(100, 700, 160, 57, { width: 92, height: 900 }, VIEWPORT)
    expect(700 + pos.top).toBeGreaterThanOrEqual(0)
  })
})
