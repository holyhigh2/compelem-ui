import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { Loader } from '@/components/feedback/loader/Loader'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-loader'

describe('ce-loader', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(Loader)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).backdrop).toBe(true)
    expect((el as any).center).toBe(false)
    expect((el as any).fullscreen).toBe(false)
    expect((el as any).content).toBe('加载中...')
    expect((el as any).speed).toBe('normal')
    expect((el as any).size).toBe('md')
  })

  it('属性响应：center', async () => {
    const el = await mount(TAG, { attrs: { 'center': true } })
    expect((el as any).center).toBe(true)
  })
})
