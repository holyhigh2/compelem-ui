import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { PortalWidgetEditor } from '@/components/datadisplay/portal/PortalWidgetEditor'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-portal-widget-editor'

describe('ce-portal-widget-editor', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(PortalWidgetEditor)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).shadow).toBe('md')
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
