import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { ButtonGroup } from '@/components/button/ButtonGroup'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-button-group'

describe('ce-button-group', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(ButtonGroup)
  })

  it('挂载为无模板组件（不创建 Shadow DOM）', async () => {
    const el = await mount(TAG)
    expect(el).toBeInstanceOf(ButtonGroup)
    expect(el.shadowRoot).toBeNull()
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).shadowed).toBe(false)
    expect((el as any).bordered).toBe(false)
    expect((el as any).rounded).toBe(false)
    expect((el as any).hoverable).toBe(false)
  })

  it('属性响应：shadowed', async () => {
    const el = await mount(TAG, { attrs: { 'shadowed': true } })
    expect((el as any).shadowed).toBe(true)
  })
})
