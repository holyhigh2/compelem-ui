import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Rate } from '@/components/feedback/rate/Rate'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-rate'

describe('ce-rate', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Rate)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).active).toBe(true)
    expect((el as any).round).toBe(0)
    expect((el as any).activeColor).toBe('#FFD54F')
    expect((el as any).color).toBe('#ddd')
    expect((el as any).ratio).toBe(0.5)
    expect((el as any).size).toBe(24)
    expect((el as any).length).toBe(5)
    expect((el as any).gap).toBe(5)
    expect((el as any).value).toBe(0)
    expect((el as any).allowHalf).toBe(false)
    expect((el as any).hover).toBe(true)
    expect((el as any).filled).toBe(true)
  })

  it('属性响应：allowHalf', async () => {
    const el = await mount(TAG, { attrs: { 'allow-half': true } })
    expect((el as any).allowHalf).toBe(true)
  })
})
