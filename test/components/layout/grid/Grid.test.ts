import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Grid } from '@/components/layout/grid/Grid'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-grid'

describe('ce-grid', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Grid)
  })

  it('挂载为无模板组件（不创建 Shadow DOM）', async () => {
    const el = await mount(TAG)
    expect(el).toBeInstanceOf(Grid)
    expect(el.shadowRoot).toBeNull()
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).rows).toBe('')
  })
})
