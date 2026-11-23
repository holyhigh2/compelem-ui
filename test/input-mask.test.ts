import { afterEach, describe, expect, it } from 'vitest'
import '../src/entries/ce-input'
import '../src/entries/ce-icon'
import '../src/entries/ce-input-mask'
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

/** emit-native：把组件事件改派成原生 CustomEvent，纯 DOM 监听才拿得到 detail */
const native = (html: string) => mount(html.replace(/^<([a-z-]+)/, '<$1 emit-native'))

/** 递归下钻 shadowRoot：原生 input 在最内层 ce-input 的 shadow 里 */
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

/** 构造一次「原生 input」调用：onInput 只读 inputType 与 target.selectionStart */
const inputOf = (value: string, inputType = 'insertText', caret = value.length) => ({
  value,
  event: { inputType, target: { selectionStart: caret } },
})

describe('ce-input-mask 的输入清洗', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('不符合掩码的字符不占掩码位：粘贴 a1b2c3d4e5f6 → 123-456', async () => {
    const el = mount(`<ce-input-mask mask="000-0000-0000"></ce-input-mask>`)
    await flush()
    el.onInput(inputOf('a1b2c3d4e5f6', 'insertText', 12))
    await flush()
    expect(deepQuery(el.shadowRoot, 'input').value).toBe('123-456')
  })

  it('纯非法字符被丢弃后不留悬空分隔符：日期掩码输入 abcdef → 空', async () => {
    const el = mount(`<ce-input-mask mask="0000/00/00"></ce-input-mask>`)
    await flush()
    el.onInput(inputOf('abcdef'))
    await flush()
    expect(deepQuery(el.shadowRoot, 'input').value).toBe('')
  })

  it('IME 上屏后原文保留，失焦时才按掩码清洗', async () => {
    const el = mount(`<ce-input-mask mask="000-0000-0000"></ce-input-mask>`)
    await flush()
    const input = deepQuery(el.shadowRoot, 'input')
    input.value = '士大夫'
    input.dispatchEvent(new Event('compositionend', { bubbles: true }))
    await flush()
    // 输入阶段不判断：上屏内容原样留在框内，避免"输入法打完就没了"
    expect(input.value).toBe('士大夫')
    el.onBlur({})
    await flush()
    // 失焦是约束兑现点
    expect(input.value).toBe('')
    expect(el.getUnmaskedValue()).toBe('')
  })

  it('失焦时按掩码重排，清掉绕过 onInput 写入的脏值', async () => {
    const el = mount(`<ce-input-mask mask="000-0000-0000"></ce-input-mask>`)
    await flush()
    const input = deepQuery(el.shadowRoot, 'input')
    input.value = '士大夫'
    el.onBlur({})
    await flush()
    expect(input.value).toBe('')
  })

  it('clear() 清掉已键入内容的显示值', async () => {
    const el = mount(`<ce-input-mask mask="000-0000-0000"></ce-input-mask>`)
    await flush()
    el.onInput(inputOf('138'))
    await flush()
    const input = deepQuery(el.shadowRoot, 'input')
    expect(input.value).toBe('138')
    el.clear()
    await flush()
    expect(input.value).toBe('')
    expect(el.getUnmaskedValue()).toBe('')
  })

  it('非 guide 模式每次显示值变化都派发 update:value', async () => {
    const el = native(`<ce-input-mask mask="000-0000-0000"></ce-input-mask>`)
    await flush()
    const values: string[] = []
    el.addEventListener('update:value', (e: any) => values.push(e.detail.value))
    el.onInput(inputOf('138'))
    el.onInput(inputOf('1380'))
    await flush()
    expect(values).toEqual(['138', '138-0'])
  })

  it('change 只在整串填满/失效时派发，不随每次键入重复', async () => {
    const el = native(`<ce-input-mask mask="000-0000-0000"></ce-input-mask>`)
    await flush()
    // change/focus/blur 在 DOM 层只是「变了」的信号（不带 detail），载荷走组件通道
    let changes = 0
    el.addEventListener('change', () => changes++)
    el.onInput(inputOf('138'))
    await flush()
    expect(changes).toBe(0)
    el.onInput(inputOf('1380013800'))
    await flush()
    expect(changes).toBe(0)
    el.onInput(inputOf('13800138000'))
    await flush()
    expect(changes).toBe(1)
  })

  it('空值聚焦（guide）也派发 focus 事件', async () => {
    const el = native(`<ce-input-mask mask="000-0000-0000" guide></ce-input-mask>`)
    await flush()
    let focuses = 0
    el.addEventListener('focus', () => focuses++)
    el.onFocus({ value: '' })
    await flush()
    expect(focuses).toBe(1)
    expect(deepQuery(el.shadowRoot, 'input').value).toBe('___-____-____')
  })
})

describe('ce-input-mask 约束只在失焦兑现', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('blocks 越界时输入阶段不改写（25 点不变成 23），失焦才钳制', async () => {
    const el = mount(`<ce-input-mask mask="00" blocks="{0,23}"></ce-input-mask>`)
    await flush()
    const input = deepQuery(el.shadowRoot, 'input')
    el.onInput(inputOf('25', 'insertText', 2))
    await flush()
    // 输入不限制：中间态不被吃掉
    expect(input.value).toBe('25')
    el.onBlur({})
    await flush()
    // 失焦兑现范围约束
    expect(input.value).toBe('23')
  })

  it('未越界时输入阶段与失焦后的显示值一致', async () => {
    const el = mount(`<ce-input-mask mask="00" blocks="{0,23}"></ce-input-mask>`)
    await flush()
    const input = deepQuery(el.shadowRoot, 'input')
    el.onInput(inputOf('08', 'insertText', 2))
    await flush()
    expect(input.value).toBe('08')
    el.onBlur({})
    await flush()
    expect(input.value).toBe('08')
  })

  it('guide 模式下越界同样延后到失焦', async () => {
    const el = mount(`<ce-input-mask mask="00:00" blocks="{0,23},{0,59}" guide greedy placeholder-char="-"></ce-input-mask>`)
    await flush()
    const input = deepQuery(el.shadowRoot, 'input')
    el.onInput(inputOf('25', 'insertText', 2))
    await flush()
    expect(input.value.slice(0, 2)).toBe('25')
    el.onBlur({})
    await flush()
    expect(input.value.slice(0, 2)).toBe('23')
  })

  it('范围修正改变了提交值时，失焦补发一次 change', async () => {
    const el = native(`<ce-input-mask mask="00" blocks="{0,23}"></ce-input-mask>`)
    await flush()
    const changes: any[] = []
    el.addEventListener('change', (e: any) => changes.push(e.detail?.value ?? 'dom'))
    el.onInput(inputOf('25', 'insertText', 2))
    await flush()
    el.onBlur({})
    await flush()
    expect(el.__maskedValue).toBe('23')
    expect(changes.length).toBeGreaterThan(0)
  })
})
