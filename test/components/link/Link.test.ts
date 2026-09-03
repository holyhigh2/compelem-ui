import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Link } from '@/components/link/Link'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-link'

describe('ce-link', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Link)
  })

  it('挂载为无模板组件（不创建 Shadow DOM）', async () => {
    const el = await mount(TAG)
    expect(el).toBeInstanceOf(Link)
    expect(el.shadowRoot).toBeNull()
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).disabled).toBe(false)
    expect((el as any).type).toBe('default')
    expect((el as any).underline).toBe('always')
  })

  it('属性响应：disabled', async () => {
    const el = await mount(TAG, { attrs: { 'disabled': true } })
    expect((el as any).disabled).toBe(true)
  })
})
