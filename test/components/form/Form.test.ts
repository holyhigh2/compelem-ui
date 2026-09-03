import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Form } from '@/components/form/Form'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-form'

describe('ce-form', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Form)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).asterisk).toBe(true)
    expect((el as any).disabled).toBe(false)
    expect((el as any).readonly).toBe(false)
    expect((el as any).plaintext).toBe(false)
    expect((el as any).layout).toBe('vertical')
  })

  it('属性响应：disabled', async () => {
    const el = await mount(TAG, { attrs: { 'disabled': true } })
    expect((el as any).disabled).toBe(true)
  })
})
