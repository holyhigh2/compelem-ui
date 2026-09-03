import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Tabs } from '@/components/nav/tabs/Tabs'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-tabs'
// 最小挂载条件：缺少时组件初始化会中断
const FIXTURE = { attrs: { 'value': '0' }, html: "<ce-tab index=\"0\">A</ce-tab>" }

describe('ce-tabs', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Tabs)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG, FIXTURE)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG, FIXTURE)
    expect((el as any).shadowed).toBe(false)
    expect((el as any).bordered).toBe(false)
    expect((el as any).rounded).toBe(false)
    expect((el as any).appearance).toBe('underlined')
    expect((el as any).hoverable).toBe(false)
    expect((el as any).closable).toBe(false)
    expect((el as any).ripple).toBe(true)
  })

  it('属性响应：shadowed', async () => {
    const el = await mount(TAG, { ...FIXTURE, attrs: { ...FIXTURE.attrs, 'shadowed': true } })
    expect((el as any).shadowed).toBe(true)
  })
})
