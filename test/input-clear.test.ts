import { afterEach, describe, expect, it } from 'vitest'
import '../.generated/entries/ce-input'
import '../.generated/entries/ce-icon'
import '../.generated/entries/ce-input-mask'
import '../.generated/entries/ce-input-number'
import '../.generated/entries/ce-input-number-range'
import '../.generated/entries/ce-input-otp'
import '../.generated/entries/ce-input-time'
import '../.generated/entries/ce-input-date'
// 时间面板内的 ce-row 必须注册：未升级的行元素没有 calcColWidth，
// @mutate.child 的延迟回调会抛 TypeError
import '../.generated/entries/ce-row'
import '../.generated/entries/ce-col'
import '../.generated/entries/ce-card'
import '../.generated/entries/ce-divider'
import '../.generated/entries/ce-button'
import '../.generated/entries/ce-loop-list'
import { nextFrame } from './helpers'

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) await nextFrame()
}

function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.firstElementChild as any
}

/** emit-native：compelem 默认把事件交给包装组件，纯 DOM 监听需要走原生通道 */
const native = (html: string) => mount(html.replace(/^<([a-z-]+)/, '<$1 emit-native'))

/** 递归下钻 shadowRoot：清空图标在最内层 ce-input 的 shadow 里 */
function deepQuery(root: any, sel: string): any {
  if (!root) return null
  const direct = root.querySelector?.(sel)
  if (direct) return direct
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const found = deepQuery(el.shadowRoot, sel)
      if (found) return found
    }
  }
  return null
}

/**
 * 内层 ce-input 清空后会补发一次「没有原生事件」的 input。
 * 包装层若直接读 obj.event / obj.event.inputType 会抛 TypeError，
 * 因此各包装组件必须容忍空事件。
 */
describe('清空链路：无原生事件的 input', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('ce-input-mask.onInput 收到空事件不抛错', async () => {
    const el = mount(`<ce-input-mask mask="00:00"></ce-input-mask>`)
    await flush()
    expect(() => el.onInput({ value: '' })).not.toThrow()
  })

  it('ce-input-otp.onInput 收到空事件不抛错', async () => {
    const el = mount(`<ce-input-otp></ce-input-otp>`)
    await flush()
    expect(() => el.onInput({ value: '' })).not.toThrow()
  })

  it('ce-input-number.onInput 收到空事件不把 NaN 写进 model', async () => {
    const el = mount(`<ce-input-number value="3"></ce-input-number>`)
    await flush()
    expect(() => el.onInput({ value: '' })).not.toThrow()
    expect(el.value).toBe(3)
  })

  it('ce-input-time 清空按 input → clear 派发，不重复也不抛错', async () => {
    const el = native(`<ce-input-time clearable value="12:30:00"></ce-input-time>`)
    await flush()
    const seq: string[] = []
    el.addEventListener('input', (e: any) => seq.push('input:' + e.detail.value))
    el.addEventListener('clear', () => seq.push('clear'))
    const close = deepQuery(el.shadowRoot, '.ce-input-close')
    expect(close).toBeTruthy()
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(seq).toEqual(['input:', 'clear'])
  })

  it('ce-input-date 清空后 value 归空并按 input → clear 派发', async () => {
    const el = native(`<ce-input-date clearable value="2025-06-15"></ce-input-date>`)
    await flush()
    const seq: string[] = []
    el.addEventListener('input', (e: any) => seq.push('input:' + e.detail.value))
    el.addEventListener('clear', () => seq.push('clear'))
    const close = deepQuery(el.shadowRoot, '.ce-input-close')
    expect(close).toBeTruthy()
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(seq).toEqual(['input:', 'clear'])
    expect(el.value).toBe('')
  })

  /** 掩码层的 input 只做透传：时间值由面板点选或失焦提交 */
  it('ce-input-time 透传内层 mask 的 input', async () => {
    const el = native(`<ce-input-time></ce-input-time>`)
    await flush()
    const values: any[] = []
    el.addEventListener('input', (e: any) => values.push(e.detail.value))
    el.onInput({ value: '12:3' })
    expect(values).toEqual(['12:3'])
  })

  /**
   * 数字的清空必须是 undefined：'' 会让 `'' == 0` 成立、把 number 契约变成 string；
   * NaN 会让宿主的变更检测（NaN !== NaN）和算术链路全部失效。
   */
  it('ce-input-number 清空后 value 归 undefined，按 update:value → input → clear 派发', async () => {
    const el = native(`<ce-input-number clearable value="3"></ce-input-number>`)
    await flush()
    const seq: string[] = []
    el.addEventListener('update:value', (e: any) => seq.push('update:' + e.detail.value))
    el.addEventListener('input', (e: any) => seq.push('input:' + e.detail.value))
    el.addEventListener('clear', (e: any) => seq.push('clear:' + e.detail.value))
    const close = deepQuery(el.shadowRoot, '.ce-input-close')
    expect(close).toBeTruthy()
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(seq).toEqual(['update:undefined', 'input:undefined', 'clear:undefined'])
    expect(el.value).toBeUndefined()
  })

  it('ce-input-number 清空后再次输入不回退到清空前的旧值', async () => {
    const el = native(`<ce-input-number clearable value="3"></ce-input-number>`)
    await flush()
    el.onClear()
    await flush()
    expect(el.value).toBeUndefined()
    // 清空后输入 '-'（合法中间态）不能把 3 捡回来
    el.onInput({ value: '-', event: new Event('input') })
    expect(el.value).toBeUndefined()
  })

  it('ce-input-number 输入阶段不改 model，提交后才写入（含 0 与小数）', async () => {
    const el = native(`<ce-input-number value="0"></ce-input-number>`)
    await flush()
    expect(el.value).toBe(0)
    el.onInput({ value: '0.5', event: new Event('input') })
    // 输入不限制：原文只做显示镜像，model 在失焦（提交）时更新
    expect(el.value).toBe(0)
    el.onBlur({ value: '0.5', event: new Event('change') })
    await flush()
    expect(el.value).toBe(0.5)
    el.onClear()
    await flush()
    expect(el.value).toBeUndefined()
  })

  it('ce-input-number-range 清空一端后该端是 undefined，另一端保持数字', async () => {
    const el = native(`<ce-input-number-range clearable></ce-input-number-range>`)
    await flush()
    el.value = [1, 9]
    await flush()
    const cleared: any[] = []
    el.addEventListener('clear', (e: any) => cleared.push(e.detail.value))
    const min = deepQuery(el.shadowRoot, 'ce-input-number[name="min-input"]')
    expect(min).toBeTruthy()
    min.clear()
    await flush()
    expect(el.value[0]).toBeUndefined()
    expect(el.value[1]).toBe(9)
    expect(cleared.at(-1)).toEqual([undefined, 9])
  })

  it('ce-input-number-range 全清后两端都是 undefined，change 载荷同步归一', async () => {
    const el = native(`<ce-input-number-range clearable></ce-input-number-range>`)
    await flush()
    el.value = [1, 9]
    await flush()
    const changes: any[] = []
    // 桥接 change 与原生 change 都不带 detail（只表示"变了"），载荷只走组件事件通道
    el.addEventListener('change', (e: any) => { if (e.detail) changes.push(e.detail.value) })
    el.clear()
    await flush()
    expect(el.value).toEqual([undefined, undefined])
    expect(changes.at(-1)).toEqual([undefined, undefined])
  })
})
