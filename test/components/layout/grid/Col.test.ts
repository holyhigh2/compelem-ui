import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Col } from '@/components/layout/grid/Col'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-col'

describe('ce-col', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Col)
  })

  it('挂载为无模板组件（不创建 Shadow DOM）', async () => {
    const el = await mount(TAG)
    expect(el).toBeInstanceOf(Col)
    expect(el.shadowRoot).toBeNull()
  })
})
