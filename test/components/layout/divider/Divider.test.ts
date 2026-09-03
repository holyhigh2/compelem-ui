import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Divider } from '@/components/layout/divider/Divider'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-divider'

describe('ce-divider', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Divider)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).color).toBe('lightgray')
    expect((el as any).vertical).toBe(false)
    expect((el as any).thickness).toBe(1)
    expect((el as any).type).toBe('solid')
    expect((el as any).inset).toBe(false)
  })

  it('属性响应：vertical', async () => {
    const el = await mount(TAG, { attrs: { 'vertical': true } })
    expect((el as any).vertical).toBe(true)
  })
})
