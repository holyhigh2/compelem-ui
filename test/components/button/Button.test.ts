import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Button } from '@/components/button/Button'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-button'

describe('ce-button', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Button)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).shadowed).toBe(false)
    expect((el as any).bordered).toBe(false)
    expect((el as any).rounded).toBe(true)
    expect((el as any).appearance).toBe('flat')
    expect((el as any).hoverable).toBe(true)
    expect((el as any).active).toBe(false)
    expect((el as any).block).toBe(false)
    expect((el as any).circle).toBe(false)
    expect((el as any).type).toBe('button')
    expect((el as any).icon).toBe('')
    expect((el as any).appendIcon).toBe('')
    expect((el as any).iconSize).toBe('')
  })

  it('属性响应：shadowed', async () => {
    const el = await mount(TAG, { attrs: { 'shadowed': true } })
    expect((el as any).shadowed).toBe(true)
  })
})
