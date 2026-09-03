import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { ColorPicker } from '@/components/picker/colorpicker/ColorPicker'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-color-picker'

describe('ce-color-picker', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(ColorPicker)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).gradient).toBe(false)
  })

  it('属性响应：gradient', async () => {
    const el = await mount(TAG, { attrs: { 'gradient': true } })
    expect((el as any).gradient).toBe(true)
  })
})
