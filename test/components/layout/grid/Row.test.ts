import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Row } from '@/components/layout/grid/Row'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-row'

describe('ce-row', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Row)
  })

  it('挂载为无模板组件（不创建 Shadow DOM）', async () => {
    const el = await mount(TAG)
    expect(el).toBeInstanceOf(Row)
    expect(el.shadowRoot).toBeNull()
  })
})
