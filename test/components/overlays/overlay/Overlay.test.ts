import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Overlay } from '@/components/overlays/overlay/Overlay'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-overlay'

describe('ce-overlay', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Overlay)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).visible).toBe(false)
    expect((el as any).placement).toBe('')
    expect((el as any).contained).toBe(false)
    expect((el as any).follow).toBe(true)
    expect((el as any).backdrop).toBe(false)
    expect((el as any).color).toBe('rgba(0, 0, 0)')
    expect((el as any).opacity).toBe(0.25)
    expect((el as any).esc).toBe(false)
    expect((el as any).closeOnClick).toBe(false)
    expect((el as any).trigger).toBe('')
    expect((el as any).openDelay).toBe(0)
    expect((el as any).autoActive).toBe(false)
  })

  it('属性响应：visible', async () => {
    const el = await mount(TAG, { attrs: { 'visible': true } })
    expect((el as any).visible).toBe(true)
  })
})
