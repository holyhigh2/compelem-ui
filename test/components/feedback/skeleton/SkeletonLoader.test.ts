import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { SkeletonLoader } from '@/components/feedback/skeleton/SkeletonLoader'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-skeleton-loader'

describe('ce-skeleton-loader', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(SkeletonLoader)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })

  it('默认属性值', async () => {
    const el = await mount(TAG)
    expect((el as any).type).toBe('text')
    expect((el as any).loading).toBe(true)
    expect((el as any).animation).toBe('wave')
    expect((el as any).rows).toBe(3)
    expect((el as any).columns).toBe(4)
    expect((el as any).avatar).toBe(false)
  })

  it('属性响应：avatar', async () => {
    const el = await mount(TAG, { attrs: { 'avatar': true } })
    expect((el as any).avatar).toBe(true)
  })
})
