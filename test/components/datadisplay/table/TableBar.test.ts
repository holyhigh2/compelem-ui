import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { TableBar } from '@/components/datadisplay/table/TableBar'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-table-bar'
// 最小必要数据：缺少时组件初始化会中断
const FIXTURE = { attrs: { 'target': 'ce-table' } }

describe('ce-table-bar', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(TableBar)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG, FIXTURE)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })
})
