import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Scroller } from '@/components/datadisplay/scroller/Scroller'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-scroller'

describe('ce-scroller', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Scroller)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).autoHide).toBe(true)
    expect((el as any).rounded).toBe(true)
    expect((el as any).showTrack).toBe(true)
    expect((el as any).size).toBe(10)
    expect((el as any).direction).toBe('')
  })
})
