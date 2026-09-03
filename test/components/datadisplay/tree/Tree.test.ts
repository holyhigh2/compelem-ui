import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Tree } from '@/components/datadisplay/tree/Tree'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-tree'
// 最小挂载条件：缺少时组件初始化会中断
const FIXTURE = { attrs: { 'data': '[]' } }

describe('ce-tree', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Tree)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG, FIXTURE)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG, FIXTURE)
    expect((el as any).highlight).toBe(true)
    expect((el as any).showIndentLine).toBe(false)
    expect((el as any).nodeKey).toBe('id')
    expect((el as any).labelKey).toBe('label')
    expect((el as any).childrenKey).toBe('children')
    expect((el as any).indent).toBe(14)
    expect((el as any).defaultExpandAll).toBe(false)
    expect((el as any).round).toBe(true)
    expect((el as any).contextmenu).toBe(true)
    expect((el as any).expandOnClick).toBe(false)
    expect((el as any).hover).toBe(true)
    expect((el as any).clickType).toBe('node')
  })

  it('属性响应：showIndentLine', async () => {
    const el = await mount(TAG, { ...FIXTURE, attrs: { ...FIXTURE.attrs, 'show-indent-line': true } })
    expect((el as any).showIndentLine).toBe(true)
  })
})
