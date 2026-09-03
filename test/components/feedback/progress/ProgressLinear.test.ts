import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { ProgressLinear } from '@/components/feedback/progress/ProgressLinear'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-progress-linear'

describe('ce-progress-linear', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(ProgressLinear)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).height).toBe(5)
    expect((el as any).indeterminate).toBe(false)
    expect((el as any).rounded).toBe(true)
    expect((el as any).active).toBe(false)
  })

  it('属性响应：indeterminate', async () => {
    const el = await mount(TAG, { attrs: { 'indeterminate': true } })
    expect((el as any).indeterminate).toBe(true)
  })
})
