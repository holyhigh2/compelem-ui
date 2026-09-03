import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { RadioGroup } from '@/components/form/radio/RadioGroup'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-radio-group'

describe('ce-radio-group', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(RadioGroup)
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
    expect((el as any).hoverable).toBe(false)
    expect((el as any).plaintext).toBe(false)
    expect((el as any).error).toBe(false)
    expect((el as any).value).toBe('')
    expect((el as any).reverse).toBe(false)
    expect((el as any).inline).toBe(false)
  })

  it('属性响应：shadowed', async () => {
    const el = await mount(TAG, { attrs: { 'shadowed': true } })
    expect((el as any).shadowed).toBe(true)
  })
})
