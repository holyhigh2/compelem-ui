import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { MenuPane } from '@/components/nav/menupane/MenuPane'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-menu-pane'
// 最小必要数据：缺少时组件初始化会中断
const FIXTURE = { attrs: { 'items': '[]' } }

describe('ce-menu-pane', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(MenuPane)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG, FIXTURE)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })
})
