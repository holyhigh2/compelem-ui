import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Message } from '@/components/feedback/message/Message'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-message'

describe('ce-message', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Message)
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
    expect((el as any).rounded).toBe(false)
    expect((el as any).appearance).toBe('pale')
    expect((el as any).hoverable).toBe(false)
    expect((el as any).header).toBe('')
    expect((el as any).target).toBe('')
    expect((el as any).showIcon).toBe(true)
    expect((el as any).descr).toBe('')
    expect((el as any).type).toBe('info')
    expect((el as any).closable).toBe(false)
  })

  it('属性响应：shadowed', async () => {
    const el = await mount(TAG, { attrs: { 'shadowed': true } })
    expect((el as any).shadowed).toBe(true)
  })
})
