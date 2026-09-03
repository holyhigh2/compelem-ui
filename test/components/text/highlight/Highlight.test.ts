import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Highlight } from '@/components/text/highlight/Highlight'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-highlight'

describe('ce-highlight', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Highlight)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).color).toBe('marktext')
    expect((el as any).bgColor).toBe('mark')
    expect((el as any).keyword).toBe('')
  })
})
