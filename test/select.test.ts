import { afterEach, describe, expect, it } from 'vitest'
import '../.generated/entries/ce-select'
import '../.generated/entries/ce-input-tag'
import '../.generated/entries/ce-input'
import '../.generated/entries/ce-overlay'
import '../.generated/entries/ce-list-picker'
import '../.generated/entries/ce-tag'
import '../.generated/entries/ce-icon'
import '../.generated/entries/ce-progress-circular'

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 30))
}

function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.firstElementChild as any
}

/** 纯 DOM 监听组件事件必须 emit-native（见 test/form.test.ts 的说明） */
const native = (html: string) => mount(html.replace(/^<([a-z-]+)/, '<$1 emit-native'))

const DATA = [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }]

/** ce-select → ce-input-tag → ce-input → 原生 input，语义要落到最内层那一个 */
const deepInput = (el: any) => {
  const inputTag = el.shadowRoot!.querySelector('ce-input-tag')
  const ceInput = inputTag!.shadowRoot!.querySelector('ce-input')
  return ceInput!.shadowRoot!.querySelector('input')
}

describe('ce-select 折叠态取值', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('data + value 映射出对应 label', async () => {
    const el = native(`<ce-select value="b"></ce-select>`)
    el.updateProps({ data: DATA })
    await flush()
    expect(el.selectLabel).toBe('乙')
  })

  it('多选时 label 汇总为数组', async () => {
    const el = native(`<ce-select multiple></ce-select>`)
    // 走 updateProps 而不是属性：value 的类型是 [String, Array, Number] 联合，
    // 属性值不会被 JSON.parse，只有 prop 赋值路径才拿得到数组语义（页面绑定即此路径）
    el.updateProps({ data: DATA, value: ['a', 'b'] })
    await flush()
    expect(el.selectLabel).toEqual(['甲', '乙'])
  })

  /** 无 data 时以默认插槽里的 option 文本为准（自定义选项写法） */
  it('option 插槽内容提供 value→label 映射', async () => {
    const el = native(`<ce-select value="b">
      <option value="a">甲</option>
      <option value="b">乙</option>
    </ce-select>`)
    await flush()
    expect(el.selectLabel).toBe('乙')
  })

  it('未知 value 不产生 label', async () => {
    const el = native(`<ce-select value="zzz"></ce-select>`)
    el.updateProps({ data: DATA })
    await flush()
    expect(el.selectLabel).toBeFalsy()
  })

  it('clear 清空 value 并派发 change({label:"",value:""})', async () => {
    const el = native(`<ce-select clearable value="a"></ce-select>`)
    el.updateProps({ data: DATA })
    await flush()
    const changes: any[] = []
    el.addEventListener('change', (e: any) => { if (e.detail) changes.push(e.detail) })
    el.onClear()
    await flush()
    expect(el.value).toBe('')
    // emit 会把 target 写进 detail，只断言契约字段
    expect(changes.map(c => [c.label, c.value])).toEqual([['', '']])
  })
})

describe('ce-select 无障碍语义', () => {
  afterEach(() => { document.body.innerHTML = '' })

  /**
   * combobox 语义必须落在 shadow 内的原生 input 上：
   * 自定义元素宿主上的 aria-* 不会被读屏当成输入框属性。
   */
  it('原生输入框带 combobox / listbox / aria-expanded 语义', async () => {
    const el = native(`<ce-select label="城市" value="a"></ce-select>`)
    el.updateProps({ data: DATA })
    await flush()
    const input = deepInput(el)
    expect(input).toBeTruthy()
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-haspopup')).toBe('listbox')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-label')).toBe('城市')
    expect(input.getAttribute('aria-disabled')).toBe('false')
    expect(input.getAttribute('aria-required')).toBe('false')
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })

  it('filterable 时补 aria-autocomplete=list', async () => {
    const el = native(`<ce-select filterable></ce-select>`)
    el.updateProps({ data: DATA })
    await flush()
    expect(deepInput(el).getAttribute('aria-autocomplete')).toBe('list')
  })

  it('disabled 后 aria-disabled=true', async () => {
    const el = native(`<ce-select disabled></ce-select>`)
    el.updateProps({ data: DATA })
    await flush()
    expect(deepInput(el).getAttribute('aria-disabled')).toBe('true')
  })
})
