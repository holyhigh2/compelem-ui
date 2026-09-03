import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { ListPicker } from '@/components/picker/listpicker/ListPicker'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-list-picker'

describe('ce-list-picker', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(ListPicker)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).clearable).toBe(true)
    expect((el as any).multiple).toBe(false)
    expect((el as any).filterable).toBe(false)
    expect((el as any).readonly).toBe(false)
    expect((el as any).limit).toBe(0)
  })

  it('属性响应：multiple', async () => {
    const el = await mount(TAG, { attrs: { 'multiple': true } })
    expect((el as any).multiple).toBe(true)
  })
})
