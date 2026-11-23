import { describe, expect, it } from 'vitest'
import { Confirm } from '../src/components/overlays/modals/Confirm'

// 直接 new 组件类要求类已在 customElements 注册（HTMLElement 构造器校验）
if (!customElements.get('ce-confirm')) customElements.define('ce-confirm', Confirm)

// Options 三个字段都是可选的：运行时本来就支持部分传参，ESC 关闭能力只能由显式的 esc:false 关掉
describe('模态框 Options', () => {
  it('只传按钮文案时保持 ESC 默认开启', () => {
    const el = new Confirm()
    el.open('消息', '标题', { confirmButtonText: '好的' })
    expect(el.esc).toBe(true)
    expect(el.confirmBtnText).toBe('好的')
  })

  it('显式 esc:false 才关闭 ESC', () => {
    const el = new Confirm()
    el.open('消息', '标题', { esc: false })
    expect(el.esc).toBe(false)
  })

  it('不传 options 时沿用内置文案与默认行为', () => {
    const el = new Confirm()
    el.open('消息')
    expect(el.esc).toBe(true)
    expect(el.visible).toBe(true)
  })
})
