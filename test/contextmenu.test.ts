import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/entries/ce-menu'
import '../src/entries/ce-context-menu'

/**
 * `ce-context-menu` 的关键约束（都是踩过的坑，不是风格偏好）：
 *  1. target 选择器必须在**组件所在 shadow root** 里解析 —— 宿主常把菜单和目标容器
 *     放进同一个 shadow，document.querySelector 找不到；
 *  2. 右键监听必须在 mounted 里绑（bindEvents 早于 mounted，targetEl 那时还是空）；
 *  3. 打开期间才挂 document 监听，反复 open 不能累积；
 *  4. 未渲染时 open/close 不能抛（宿主可能在挂载前就调）。
 */
const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 20))
}

function mount(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.firstElementChild as HTMLElement
}

/** 纯 DOM 里监听组件事件必须 emit-native：否则 emit() 走框架通道、不派发 DOM 事件 */
const native = (html: string) => mount(html.replace(/^<([a-z-]+)/, '<$1 emit-native'))

const rightClick = (el: Element, init: MouseEventInit = {}) => {
  const ev = new MouseEvent('contextmenu', {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: 20,
    clientY: 30,
    ...init
  })
  el.dispatchEvent(ev)
  return ev
}

const outsideDown = () =>
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))

/** 挂一个「菜单 + 目标容器」在同一层级的最简场景 */
function scenario(html: string) {
  const root = mount(`<div class="shell">${html}</div>`)
  const cm = root.querySelector('ce-context-menu') as any
  const zone = root.querySelector('.zone') as HTMLElement
  return { root, cm, zone }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ce-context-menu 目标解析', () => {
  it('target 选择器在组件所在 shadow root 内解析，右键目标内部元素能弹出', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const sr = host.attachShadow({ mode: 'open' })
    // 目标容器与菜单同在 shadow 里：document.querySelector('.zone') 是查不到的
    sr.innerHTML =
      '<div class="zone"><span class="hit"></span></div><ce-context-menu emit-native target=".zone"></ce-context-menu>'
    const cm = sr.querySelector('ce-context-menu') as any
    cm.setItems([{ text: '删除', value: 'del' }])
    await flush()

    expect(cm.targetEl).toBe(sr.querySelector('.zone'))
    rightClick(sr.querySelector('.hit')!)
    expect(cm.isOpen()).toBe(true)
  })

  it('target 为空时退到 parentElement，右键容器自身空白处也能弹出', async () => {
    const zone = document.createElement('div')
    document.body.append(zone)
    zone.innerHTML = '<ce-context-menu emit-native></ce-context-menu>'
    const cm = zone.firstElementChild as any
    cm.setItems([{ text: '删除', value: 'del' }])
    await flush()

    expect(cm.targetEl).toBe(zone)
    // contains 不含自身：旧写法在这一步会直接 return
    rightClick(zone)
    expect(cm.isOpen()).toBe(true)
  })

  it('右键落在目标容器之外时不打开', async () => {
    const { cm, root } = scenario('<div class="zone"></div><ce-context-menu emit-native target=".zone"></ce-context-menu>')
    cm.setItems([{ text: '删除', value: 'del' }])
    await flush()

    rightClick(root)
    expect(cm.isOpen()).toBe(false)
  })
})

describe('ce-context-menu 关闭路径', () => {
  it('Esc 关闭', async () => {
    const { cm, zone } = scenario('<div class="zone"></div><ce-context-menu emit-native target=".zone"></ce-context-menu>')
    cm.setItems([{ text: '删除', value: 'del' }])
    await flush()
    rightClick(zone)
    expect(cm.isOpen()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cm.isOpen()).toBe(false)
  })

  it('滚轮关闭', async () => {
    const { cm, zone } = scenario('<div class="zone"></div><ce-context-menu emit-native target=".zone"></ce-context-menu>')
    cm.setItems([{ text: '删除', value: 'del' }])
    await flush()
    rightClick(zone)
    expect(cm.isOpen()).toBe(true)

    document.dispatchEvent(new Event('wheel', { bubbles: true }))
    expect(cm.isOpen()).toBe(false)
  })

  it('点菜单外面关闭，点菜单内部不关闭', async () => {
    const { cm, zone } = scenario('<div class="zone"></div><ce-context-menu emit-native target=".zone"></ce-context-menu>')
    cm.setItems([{ text: '删除', value: 'del' }])
    await flush()

    rightClick(zone)
    // 菜单内部（穿透 shadow 用 composedPath 判定）
    const inner = (cm as any).renderRoot.querySelector('ce-menu') as HTMLElement
    inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))
    expect(cm.isOpen()).toBe(true)

    outsideDown()
    expect(cm.isOpen()).toBe(false)
  })

  it('反复打开不会累积 document 监听：一次外部点击只触发一次 close', async () => {
    const { cm, zone } = scenario('<div class="zone"></div><ce-context-menu emit-native target=".zone"></ce-context-menu>')
    cm.setItems([{ text: '删除', value: 'del' }])
    await flush()

    for (let i = 0; i < 3; i++) {
      rightClick(zone)
      cm.close()
    }

    let closes = 0
    cm.addEventListener('close', () => closes++)
    rightClick(zone)
    expect(closes).toBe(0)
    outsideDown()
    expect(closes).toBe(1)
  })
})

describe('ce-context-menu 健壮性', () => {
  it('未渲染时 close() 不抛（宿主可能在挂载前就调）', () => {
    const Ctor = customElements.get('ce-context-menu') as any
    const raw = new Ctor()
    expect(() => raw.close()).not.toThrow()
  })

  it('items 不是必填：不传 items 挂载不报 required', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    mount('<ce-context-menu></ce-context-menu>')
    await flush()
    const texts = err.mock.calls.map(c => c.map(String).join(' '))
    err.mockRestore()
    expect(texts.some(t => t.includes("Prop 'items' is required"))).toBe(false)
  })

  it('beforeopen 里 cancel 不消费右键：原生菜单该照常出现', async () => {
    const { cm, zone } = scenario('<div class="zone"></div><ce-context-menu emit-native target=".zone"></ce-context-menu>')
    cm.setItems([{ text: '删除', value: 'del' }])
    await flush()
    cm.addEventListener('beforeopen', (e: any) => e.detail?.cancel?.())

    const ev = rightClick(zone)
    expect(cm.isOpen()).toBe(false)
    expect(ev.defaultPrevented).toBe(false)
  })
})
