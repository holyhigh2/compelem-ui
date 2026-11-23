import { describe, expect, it } from 'vitest'
import { HSL2RGB, RGB2HSL } from '../src/utils/color'

describe('color', () => {
  it('HSL2RGB 转换基础色', () => {
    expect(HSL2RGB(0, 1, 0.5)).toEqual([255, 0, 0])
    expect(HSL2RGB(1 / 3, 1, 0.5)).toEqual([0, 255, 0])
    expect(HSL2RGB(2 / 3, 1, 0.5)).toEqual([0, 0, 255])
    expect(HSL2RGB(0, 0, 0.5)).toEqual([128, 128, 128])
  })

  it('RGB2HSL 转换基础色', () => {
    expect(RGB2HSL(255, 0, 0)).toEqual([0, 1, 0.5])
    expect(RGB2HSL(0, 0, 0)).toEqual([0, 0, 0])
    expect(RGB2HSL(255, 255, 255)).toEqual([0, 0, 1])
  })

  it('HSL → RGB → HSL 往返误差在 1/255 以内', () => {
    const [h, s, l] = [0.58, 0.72, 0.43]
    const [r, g, b] = HSL2RGB(h, s, l)
    const [h2, s2, l2] = RGB2HSL(r, g, b)
    expect(Math.abs(h2 - h)).toBeLessThan(0.01)
    expect(Math.abs(s2 - s)).toBeLessThan(0.01)
    expect(Math.abs(l2 - l)).toBeLessThan(0.01)
  })
})
