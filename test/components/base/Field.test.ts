import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Field } from '@/components/base/Field'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-field'

describe('ce-field', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Field)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).filterable).toBe(false)
    expect((el as any).movable).toBe(false)
    expect((el as any).sortable).toBe(false)
    expect((el as any).hidable).toBe(true)
    expect((el as any).groupable).toBe(false)
    expect((el as any).colorable).toBe(false)
  })

  it('属性响应：filterable', async () => {
    const el = await mount(TAG, { attrs: { 'filterable': true } })
    expect((el as any).filterable).toBe(true)
  })
})
