import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Card } from '@/components/datadisplay/card/Card'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-card'

describe('ce-card', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Card)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).shadowed).toBe(true)
    expect((el as any).bordered).toBe(false)
    expect((el as any).rounded).toBe(false)
    expect((el as any).appearance).toBe('subtle')
    expect((el as any).hoverable).toBe(false)
    expect((el as any).link).toBe(false)
    expect((el as any).target).toBe('_blank')
  })

  it('属性响应：bordered', async () => {
    const el = await mount(TAG, { attrs: { 'bordered': true } })
    expect((el as any).bordered).toBe(true)
  })
})
