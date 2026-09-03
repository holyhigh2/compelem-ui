import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Drawer } from '@/components/overlays/drawer/Drawer'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-drawer'

describe('ce-drawer', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Drawer)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).width).toBe('280px')
    expect((el as any).height).toBe('100%')
    expect((el as any).placement).toBe('right')
    expect((el as any).backdrop).toBe('initial')
    expect((el as any).esc).toBe(true)
    expect((el as any).round).toBe(false)
    expect((el as any).showClose).toBe(true)
    expect((el as any).visible).toBe(false)
  })

  it('属性响应：round', async () => {
    const el = await mount(TAG, { attrs: { 'round': true } })
    expect((el as any).round).toBe(true)
  })
})
