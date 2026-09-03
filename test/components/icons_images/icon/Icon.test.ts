import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Icon } from '@/components/icons_images/icon/Icon'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-icon'

describe('ce-icon', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Icon)
  })

  it('挂载为无模板组件（不创建 Shadow DOM）', async () => {
    const el = await mount(TAG)
    expect(el).toBeInstanceOf(Icon)
    expect(el.shadowRoot).toBeNull()
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).rotate).toBe(0)
    expect((el as any).spin).toBe(false)
    expect((el as any).spinSpeed).toBe('normal')
  })

  it('属性响应：spin', async () => {
    const el = await mount(TAG, { attrs: { 'spin': true } })
    expect((el as any).spin).toBe(true)
  })
})
