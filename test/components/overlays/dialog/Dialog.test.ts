import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Dialog } from '@/components/overlays/dialog/Dialog'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-dialog'

describe('ce-dialog', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Dialog)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).width).toBe('280px')
    expect((el as any).backdrop).toBe(true)
    expect((el as any).esc).toBe(true)
    expect((el as any).visible).toBe(false)
  })

  it('属性响应：visible', async () => {
    const el = await mount(TAG, { attrs: { 'visible': true } })
    expect((el as any).visible).toBe(true)
  })
})
