import { describe, expect, it } from 'vitest'
import { defineComponents } from 'compelem'
import { mount } from '@test/helpers/mount'
import { YearMonthPanel } from '@/components/picker/datepicker/YearMonthPanel'

// @tag 默认延迟注册，需显式调用 defineComponents 完成 customElements.define
defineComponents()

const TAG = 'ce-year-month-panel'

describe('ce-year-month-panel', () => {
  it('注册为自定义元素', () => {
    expect(customElements.get(TAG)).toBe(YearMonthPanel)
  })

  it('挂载后渲染 Shadow DOM 内容', async () => {
    const el = await mount(TAG)
    expect(el.shadowRoot).toBeTruthy()
    expect(el.shadowRoot!.children.length).toBeGreaterThan(0)
  })
})
