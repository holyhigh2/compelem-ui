import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Editable } from '@/components/datadisplay/table/Editable'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-editable'

describe('ce-editable', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Editable)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).columnLine).toBe(true)
    expect((el as any).rowHeight).toBe(0)
    expect((el as any).headerHeight).toBe(40)
    expect((el as any).footerHeight).toBe(32)
    expect((el as any).showHeader).toBe(true)
    expect((el as any).showFooter).toBe(false)
    expect((el as any).scrollerWidth).toBe(10)
    expect((el as any).highlight).toBe(true)
    expect((el as any).enableFx).toBe(false)
    expect((el as any).loading).toBe(false)
    expect((el as any).fit).toBe(false)
    expect((el as any).rowKey).toBe('id')
  })

  it('属性响应：showFooter', async () => {
    const el = await mount(TAG, { attrs: { 'show-footer': true } })
    expect((el as any).showFooter).toBe(true)
  })
})
