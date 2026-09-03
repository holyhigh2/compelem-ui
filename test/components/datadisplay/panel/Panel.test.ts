import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Panel } from '@/components/datadisplay/panel/Panel'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-panel'

describe('ce-panel', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Panel)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).shadowed).toBe(true)
    expect((el as any).bordered).toBe(false)
    expect((el as any).rounded).toBe(false)
    expect((el as any).hoverable).toBe(false)
    expect((el as any).title).toBe('')
    expect((el as any).collapsible).toBe(false)
    expect((el as any).defaultExpanded).toBe(true)
    expect((el as any).bodyStyle).toBe('')
  })

  it('属性响应：bordered', async () => {
    const el = await mount(TAG, { attrs: { 'bordered': true } })
    expect((el as any).bordered).toBe(true)
  })
})
