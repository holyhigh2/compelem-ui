import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { FormItem } from '@/components/form/FormItem'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-form-item'

describe('ce-form-item', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(FormItem)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).label).toBe('')
    expect((el as any).prop).toBe('')
    expect((el as any).required).toBe(false)
  })

  it('属性响应：required', async () => {
    const el = await mount(TAG, { attrs: { 'required': true } })
    expect((el as any).required).toBe(true)
  })
})
