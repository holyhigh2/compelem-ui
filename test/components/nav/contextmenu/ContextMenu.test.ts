import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { ContextMenu } from '@/components/nav/contextmenu/ContextMenu'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-context-menu'
// 最小挂载条件：缺少时组件初始化会中断
const FIXTURE = { attrs: { 'items': '[]' }, wrapper: 'ce-panel' }

describe('ce-context-menu', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(ContextMenu)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG, FIXTURE)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })
})
