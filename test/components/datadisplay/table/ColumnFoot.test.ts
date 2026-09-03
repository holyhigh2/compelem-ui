import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { ColumnFoot } from '@/components/datadisplay/table/ColumnFoot'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-column-foot'

describe('ce-column-foot', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(ColumnFoot)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).prop).toBe('')
    expect((el as any).hoverSelection).toBe(true)
    expect((el as any).stats).toBe(false)
  })

  it('属性响应：stats', async () => {
    const el = await mount(TAG, { attrs: { 'stats': true } })
    expect((el as any).stats).toBe(true)
  })
})
