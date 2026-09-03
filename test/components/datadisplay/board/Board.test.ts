import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Board } from '@/components/datadisplay/board/Board'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-board'
// 最小必要数据：缺少时组件初始化会中断
const FIXTURE = { attrs: { 'title-field': 'title' } }

describe('ce-board', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Board)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG, FIXTURE)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG, FIXTURE)
    expect((el as any).gap).toBe(10)
    expect((el as any).groupField).toBe('')
    expect((el as any).grouped).toBe(false)
    expect((el as any).rowKey).toBe('id')
  })

  it('属性响应：grouped', async () => {
    const el = await mount(TAG, { attrs: { ...FIXTURE.attrs, 'grouped': true } })
    expect((el as any).grouped).toBe(true)
  })
})
