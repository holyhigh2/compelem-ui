import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Navbar } from '@/components/nav/navbar/Navbar'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-navbar'

describe('ce-navbar', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Navbar)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).borderMode).toBe(false)
  })

  it('属性响应：borderMode', async () => {
    const el = await mount(TAG, { attrs: { 'border-mode': true } })
    expect((el as any).borderMode).toBe(true)
  })
})
