import { afterEach, describe, expect, it } from 'vitest'
import '../.generated/entries/ce-input'
import '../.generated/entries/ce-input-otp'
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

/** 键入一格：直接写原生值再走组件通道（浏览器已把字符写进 DOM） */
const typeCell = async (el: any, i: number, text: string, inputType = 'insertText') => {
  const cell = (el.allInput as any)[i]
  cell.inputRef.current.value = text
  el.onInput({ value: text, target: cell, event: { inputType, isComposing: false } })
  await flush()
  return cell
}

const cellValue = (el: any, i: number) => (el.allInput as any)[i].inputRef.current.value

describe('ce-input-otp 输入不限制、失焦才约束', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('键入数字落格并同步 value', async () => {
    const el = mount(`<ce-input-otp length="4" type="digit"></ce-input-otp>`)
    await flush()
    await typeCell(el, 0, '1')
    await typeCell(el, 1, '2')
    expect(cellValue(el, 0)).toBe('1')
    expect(cellValue(el, 1)).toBe('2')
    expect(el.value).toBe('12')
  })

  it('数字格键入非数字字符不拦截，失焦时才清掉', async () => {
    const el = mount(`<ce-input-otp length="4" type="digit"></ce-input-otp>`)
    await flush()
    // 用最后一格：没有下一格可跳，失焦由 blur 显式触发
    await typeCell(el, 3, 'a')
    expect(cellValue(el, 3)).toBe('a')

    el.onBlur()
    await flush()
    expect(cellValue(el, 3)).toBe('')
    expect(el.value).toBe('')
  })

  it('字母格接受字母、拒绝数字（同样延后到失焦）', async () => {
    const el = mount(`<ce-input-otp length="4" type="alphabet"></ce-input-otp>`)
    await flush()
    await typeCell(el, 2, 'z')
    await typeCell(el, 3, '7')
    expect(cellValue(el, 2)).toBe('z')
    expect(cellValue(el, 3)).toBe('7')

    el.onBlur()
    await flush()
    expect(cellValue(el, 2)).toBe('z')
    expect(cellValue(el, 3)).toBe('')
    expect(el.value).toBe('z')
  })

  it('IME 组合期间完全不介入：不落格、不跳格、不清空', async () => {
    const el = mount(`<ce-input-otp length="4" type="digit"></ce-input-otp>`)
    await flush()
    const cell = (el.allInput as any)[0]
    cell.inputRef.current.value = 'zhong'
    el.onInput({ value: 'zhong', target: cell, event: { inputType: 'insertCompositionText', isComposing: true } })
    await flush()
    expect(cellValue(el, 0)).toBe('zhong')
    expect(el.value).toBe('')
  })
})
