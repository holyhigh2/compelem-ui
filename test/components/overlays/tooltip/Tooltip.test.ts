import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Tooltip } from '@/components/overlays/tooltip/Tooltip'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-tooltip'

describe('ce-tooltip', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Tooltip)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).content).toBe('')
    expect((el as any).placement).toBe('right')
    expect((el as any).arrow).toBe(true)
    expect((el as any).disabled).toBe(false)
    expect((el as any).alwaysShow).toBe(false)
  })

  it('属性响应：disabled', async () => {
    const el = await mount(TAG, { attrs: { 'disabled': true } })
    expect((el as any).disabled).toBe(true)
  })
})
