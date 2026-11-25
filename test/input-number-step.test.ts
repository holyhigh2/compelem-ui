import { afterEach, describe, expect, it } from 'vitest'
import '../.generated/entries/ce-input'
import '../.generated/entries/ce-icon'
import '../.generated/entries/ce-input-number'
import { nextFrame } from './helpers'

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) await nextFrame()
}

/** emit-native：compelem 默认把事件交给包装组件，纯 DOM 监听需要走原生通道 */
function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html.replace(/^<([a-z-]+)/, '<$1 emit-native')
  document.body.append(host)
  return host.firstElementChild as any
}

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

const display = (el: any) => deepQuery(el.shadowRoot, 'input')?.value

describe('ce-input-number 步进：显示值、value 与事件同一条链', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('addStep 同时更新显示值与 value，并按 value → changeValue → input → change 派发', async () => {
    const el = mount(`<ce-input-number value="5"></ce-input-number>`)
    await flush()
    const seq: string[] = []
    for (const t of ['update:changeValue', 'update:value', 'input', 'change'])
      el.addEventListener(t, (e: any) => seq.push(t + '=' + e.detail.value))

    el.addStep()
    await flush()

    expect(el.__innerValue).toBe(6)
    expect(display(el)).toBe('6')
    expect(el.value).toBe(6)
    expect(seq).toEqual(['update:value=6', 'update:changeValue=6', 'input=6', 'change=6'])
  })

  it('subtractStep 从空值起步按 min 夹取，不产生负值', async () => {
    const el = mount(`<ce-input-number min="0" max="10" step="0.5"></ce-input-number>`)
    await flush()
    el.subtractStep()
    await flush()
    expect(el.value).toBe(0)
    expect(display(el)).toBe('0')
  })

  it('addStep 到 max 后停在上限，且不重复派发 input/change', async () => {
    const el = mount(`<ce-input-number min="0" max="10"></ce-input-number>`)
    await flush()
    el.value = 10
    await flush()
    const seq: string[] = []
    el.addEventListener('input', (e: any) => seq.push('input:' + e.detail.value))
    el.addStep()
    await flush()
    expect(el.value).toBe(10)
    expect(display(el)).toBe('10')
    expect(seq).toEqual([])
  })

  it('step + precision 不产生浮点尾巴', async () => {
    const el = mount(`<ce-input-number step="0.1" precision="2"></ce-input-number>`)
    await flush()
    el.addStep()
    el.addStep()
    el.addStep()
    await flush()
    expect(display(el)).toBe('0.3')
    expect(el.value).toBe(0.3)
  })

  it('disabled 时步进无效', async () => {
    const el = mount(`<ce-input-number value="5" disabled></ce-input-number>`)
    await flush()
    el.addStep()
    await flush()
    expect(el.value).toBe(5)
  })
})

describe('ce-input-number 增减按钮命中判定', () => {
  afterEach(() => { document.body.innerHTML = '' })

  /** 按纵向中线分派：上半为增、下半为减，与鼠标按下位置一致 */
  it('onControlClick 按按下位置的上/下半决定方向', async () => {
    const el = mount(`<ce-input-number control value="5"></ce-input-number>`)
    await flush()
    const box = deepQuery(el.shadowRoot, '.ce-input-control')
    expect(box).toBeTruthy()
    box.getBoundingClientRect = () => ({ top: 100, height: 40, bottom: 140, left: 0, right: 20, width: 20, x: 0, y: 100 })

    const click = (clientY: number) => el.onControlClick({
      button: 0, clientY, target: box, composedPath: () => [box, el],
    })
    click(110)
    await flush()
    expect(el.value).toBe(6)
    click(130)
    await flush()
    expect(el.value).toBe(5)
  })

  it('几何不可用时按图标顺序推断（第一只图标为上）', async () => {
    const el = mount(`<ce-input-number control value="5"></ce-input-number>`)
    await flush()
    const box = deepQuery(el.shadowRoot, '.ce-input-control')
    const icons = box.querySelectorAll('ce-icon')
    // jsdom 的 rect 全为 0，走兜底分支
    el.onControlClick({ button: 0, clientY: 0, target: icons[0], composedPath: () => [icons[0], box] })
    await flush()
    expect(el.value).toBe(6)
    el.onControlClick({ button: 0, clientY: 0, target: icons[1], composedPath: () => [icons[1], box] })
    await flush()
    expect(el.value).toBe(5)
  })

  it('右键按下不步进', async () => {
    const el = mount(`<ce-input-number control value="5"></ce-input-number>`)
    await flush()
    const box = deepQuery(el.shadowRoot, '.ce-input-control')
    box.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40, left: 0, right: 20, width: 20, x: 0, y: 0 })
    el.onControlClick({ button: 2, clientY: 5, target: box, composedPath: () => [box] })
    await flush()
    expect(el.value).toBe(5)
  })
})

describe('ce-input-number 失焦夹取与 value 回写', () => {
  afterEach(() => { document.body.innerHTML = '' })

  /** 模拟键入后失焦：直接改内层 <input> 再派发 change（与浏览器 blur 前的提交一致） */
  const typeAndCommit = async (el: any, text: string) => {
    const inner = deepQuery(el.shadowRoot, 'input')
    inner.value = text
    inner.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()
  }

  it('键入越界值后失焦：显示值与 value 都夹取到 max', async () => {
    const el = mount(`<ce-input-number control min="0" max="10" step="0.5"></ce-input-number>`)
    await flush()
    await typeAndCommit(el, '123123')
    expect(display(el)).toBe('10')
    expect(el.value).toBe(10)
  })

  it('键入低于下限的值后失焦：夹取到 min', async () => {
    const el = mount(`<ce-input-number min="0" max="10"></ce-input-number>`)
    await flush()
    await typeAndCommit(el, '-5')
    expect(display(el)).toBe('0')
    expect(el.value).toBe(0)
  })

  it('未设 min/max 时不夹取，保留键入值', async () => {
    const el = mount(`<ce-input-number></ce-input-number>`)
    await flush()
    await typeAndCommit(el, '123123')
    expect(display(el)).toBe('123123')
    expect(el.value).toBe(123123)
  })

  it('外部赋越界值同样回写到 value', async () => {
    const el = mount(`<ce-input-number max="10"></ce-input-number>`)
    await flush()
    el.value = 42
    await flush()
    expect(display(el)).toBe('10')
    expect(el.value).toBe(10)
  })

  /** changeValue 是 change 的出口镜像，初始化阶段为空不能把刚回显的值抹掉 */
  it('value="0" 挂载后正常回显 0', async () => {
    const el = mount(`<ce-input-number min="-10" max="10" value="0"></ce-input-number>`)
    await flush()
    expect(display(el)).toBe('0')
    expect(el.value).toBe(0)
  })
})

describe('ce-input-number 输入阶段不限制，失焦才约束', () => {
  afterEach(() => { document.body.innerHTML = '' })

  /** 模拟一次原生键入：只派发组件通道的 input，不改 DOM（浏览器已写好） */
  const typeInto = async (el: any, text: string) => {
    const inner = deepQuery(el.shadowRoot, 'input')
    inner.value = text
    el.onInput({ value: text, event: { inputType: 'insertText', target: inner } })
    await flush()
    return inner
  }

  it('键入越界值不在输入阶段夹取，失焦后才钳到 max', async () => {
    const el = mount(`<ce-input-number min="0" max="10"></ce-input-number>`)
    await flush()
    const inner = await typeInto(el, '123123')
    expect(inner.value).toBe('123123')
    expect(el.value).toBeUndefined()

    el.onBlur({ value: '123123', event: new Event('change') })
    await flush()
    expect(inner.value).toBe('10')
    expect(el.value).toBe(10)
  })

  it('键入非法文本时原文留在框内，失焦才清洗', async () => {
    const el = mount(`<ce-input-number></ce-input-number>`)
    await flush()
    const inner = await typeInto(el, 'abc')
    // 输入阶段不改写 DOM：改写会打断输入法组合
    expect(inner.value).toBe('abc')
    expect(el.value).toBeUndefined()

    el.onBlur({ value: 'abc', event: new Event('change') })
    await flush()
    expect(inner.value).toBe('')
    expect(el.value).toBeUndefined()
  })

  it('键入 12.5.6 时原样保留，失焦裁成首个合法数字前缀', async () => {
    const el = mount(`<ce-input-number></ce-input-number>`)
    await flush()
    const inner = await typeInto(el, '12.5.6')
    expect(inner.value).toBe('12.5.6')

    el.onBlur({ value: '12.5.6', event: new Event('change') })
    await flush()
    expect(inner.value).toBe('12.5')
    expect(el.value).toBe(12.5)
  })

  it('输入阶段不写 model，也不派发 change', async () => {
    const el = mount(`<ce-input-number min="0" max="10"></ce-input-number>`)
    await flush()
    const changes: any[] = []
    el.addEventListener('change', (e: any) => changes.push(e.detail.value))
    await typeInto(el, '5')
    expect(el.value).toBeUndefined()
    expect(changes).toEqual([])
  })

  it('前导零在提交时归一（007 → 7，0.5 保留小数位）', async () => {
    const el = mount(`<ce-input-number></ce-input-number>`)
    await flush()
    const inner = await typeInto(el, '007')
    expect(inner.value).toBe('007')
    el.onBlur({ value: '007', event: new Event('change') })
    await flush()
    expect(inner.value).toBe('7')

    const inner2 = await typeInto(el, '0.5')
    expect(inner2.value).toBe('0.5')
    el.onBlur({ value: '0.5', event: new Event('change') })
    await flush()
    expect(inner2.value).toBe('0.5')
  })
})

describe('ce-input-number 滚轮与方向键', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('滚轮下滚增大、上滚减小，并同步 value', async () => {
    const el = mount(`<ce-input-number value="5"></ce-input-number>`)
    await flush()
    const wheel = (deltaY: number) => el.onWheel({ deltaY, preventDefault() { } })
    wheel(120)
    await flush()
    expect(el.value).toBe(6)
    wheel(-120)
    await flush()
    expect(el.value).toBe(5)
  })

  it('ArrowUp / ArrowDown 同步显示值与 value', async () => {
    const el = mount(`<ce-input-number value="5"></ce-input-number>`)
    await flush()
    el.onKeyDown({ code: 'ArrowUp' })
    await flush()
    expect(el.value).toBe(6)
    el.onKeyDown({ code: 'ArrowDown' })
    await flush()
    expect(el.value).toBe(5)
  })
})
