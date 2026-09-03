import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Aside } from '@/components/layout/container/Aside'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-aside'

describe('ce-aside', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Aside)
  })

  it('挂载为无模板组件（不创建 Shadow DOM）', async () => {
    const el = await mount(TAG)
    expect(el).toBeInstanceOf(Aside)
    expect(el.shadowRoot).toBeNull()
  })
})
