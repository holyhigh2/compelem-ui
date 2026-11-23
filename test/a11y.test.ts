import { describe, expect, it } from 'vitest'
import { Button } from '../src/components/button/Button'
import { Panel } from '../src/components/datadisplay/panel/Panel'
import { Message } from '../src/components/feedback/message/Message'
import { Notification } from '../src/components/feedback/notification/Notification'
import { Icon } from '../src/components/icons_images/icon/Icon'
import { Nav } from '../src/components/nav/nav/Nav'
import { Tab } from '../src/components/nav/tabs/Tab'
import { Tabs } from '../src/components/nav/tabs/Tabs'

/**
 * 直接 new 组件类要求类已在 customElements 上注册（HTMLElement 构造器会校验注册表），
 * 且必须在构造之前完成；模板里引用的 ce-icon / ce-button / ce-nav 也要注册，
 * 否则它们只是未知元素，拿不到内部 shadow、也就看不到落到原生控件上的 ARIA。
 */
for (const [tag, ctor] of [
  ['ce-icon', Icon],
  ['ce-button', Button],
  ['ce-nav', Nav],
  ['ce-message', Message],
  ['ce-notification', Notification],
  ['ce-panel', Panel],
  ['ce-tabs', Tabs],
  ['ce-tab', Tab],
] as [string, any][]) {
  if (!customElements.get(tag)) customElements.define(tag, ctor)
}

function mount<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el)
  return el
}

/** compelem 的首次渲染排在 rAF 之后，等一帧才有 shadow DOM */
function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => r(null)))
}

describe('消息/通知的播报语义', () => {
  it('info 与 success 用 role=status，warning 与 error 用 role=alert', async () => {
    for (const [type, role] of [['info', 'status'], ['success', 'status'], ['warning', 'alert'], ['error', 'alert']] as const) {
      const el = mount(new Message({ type, descr: '内容' }))
      await nextFrame()
      expect(el.getAttribute('role')).toBe(role)
      el.remove()
    }
  })

  it('没有标题时不渲染空 <h3>（空标题会被读屏播报成「标题」噪声）', async () => {
    const el = mount(new Message({ descr: '只有描述' }))
    await nextFrame()
    expect(el.renderRoot.querySelector('h3')).toBeNull()
    el.remove()
  })

  it('装饰图标对读屏隐藏，关闭按钮有可访问名称', async () => {
    const el = mount(new Message({ descr: '内容', header: '标题', closable: true }))
    await nextFrame()
    expect(el.renderRoot.querySelector('.ce-message-icon')?.getAttribute('aria-hidden')).toBe('true')
    const close = el.renderRoot.querySelector('.ce-message-close')
    expect(close?.getAttribute('role')).toBe('button')
    expect(close?.getAttribute('aria-label')).toBe('关闭')
    expect(close?.getAttribute('tabindex')).toBe('0')
    el.remove()
  })

  it('不可关闭时关闭按钮不进入焦点序列', async () => {
    const el = mount(new Message({ descr: '内容' }))
    await nextFrame()
    const close = el.renderRoot.querySelector('.ce-message-close')
    expect(close?.hasAttribute('tabindex')).toBe(false)
    expect(close?.getAttribute('aria-disabled')).toBe('true')
    el.remove()
  })

  it('通知同样导出部件名并带上播报语义', async () => {
    const el = mount(new Notification({ type: 'error', descr: '失败', header: '出错了', closable: true }))
    await nextFrame()
    // renderRoot 就是模板根元素本身，querySelector 查不到自己，部件名要直接读它
    expect(el.renderRoot.getAttribute('part')).toBe('root')
    expect(el.getAttribute('role')).toBe('alert')
    expect(el.renderRoot.querySelector('[part="descr"]')?.textContent).toBe('失败')
    el.remove()
  })
})

describe('面板折叠语义', () => {
  it('折叠头是带 aria-expanded 的原生按钮，内容区折叠时移出无障碍树', async () => {
    const el = mount(new Panel({ title: '区块', collapsible: true }))
    await nextFrame()
    const button = el.renderRoot.querySelector('ce-button')
    expect(button?.getAttribute('aria-expanded')).toBe('true')
    const body = el.renderRoot.querySelector('main[part="body"]')
    expect(body?.getAttribute('role')).toBe('region')
    expect(body?.hasAttribute('inert')).toBe(false)

    ;(el as any).toggleExpanded()
    await nextFrame()
    expect(el.renderRoot.querySelector('ce-button')?.getAttribute('aria-expanded')).toBe('false')
    const collapsed = el.renderRoot.querySelector('main[part="body"]')
    expect(collapsed?.hasAttribute('inert')).toBe(true)
    expect(collapsed?.getAttribute('aria-hidden')).toBe('true')
    el.remove()
  })
})

describe('页签键盘导航', () => {
  it('容器为 tablist、页签为 tab，整组只留一个 Tab 停靠点', async () => {
    const tabs = mount(new Tabs())
    await nextFrame()
    expect(tabs.renderRoot.querySelector('ce-nav')?.getAttribute('role')).toBe('tablist')
    const prev = tabs.renderRoot.querySelector('.ce-tabs-slide.is-left')
    expect(prev?.getAttribute('role')).toBe('button')
    expect(prev?.getAttribute('aria-label')).toBe('向前滚动页签')

    const t1 = new Tab({ index: 'a', label: 'A' })
    const t2 = new Tab({ index: 'b', label: 'B', disabled: true })
    tabs.append(t1, t2)
    tabs.value = 'a'
    await nextFrame()
    expect(t1.getAttribute('role')).toBe('tab')
    expect(t1.getAttribute('aria-selected')).toBe('true')
    expect(t1.getAttribute('tabindex')).toBe('0')
    expect(t2.getAttribute('aria-selected')).toBe('false')
    expect(t2.getAttribute('tabindex')).toBe('-1')
    expect(t2.getAttribute('aria-disabled')).toBe('true')
    tabs.remove()
  })

  it('方向键在启用项之间循环，Home/End 跳到首尾', async () => {
    const tabs = mount(new Tabs())
    await nextFrame()
    const items = ['a', 'b', 'c'].map((index) => new Tab({ index, label: index.toUpperCase() }))
    tabs.append(...items)
    tabs.value = 'a'
    await nextFrame()

    const press = (k: string) => tabs.renderRoot.querySelector('ce-nav')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
    press('ArrowRight')
    expect(tabs.value).toBe('b')
    press('ArrowLeft')
    press('ArrowLeft')
    expect(tabs.value).toBe('c')
    press('Home')
    expect(tabs.value).toBe('a')
    press('End')
    expect(tabs.value).toBe('c')
    tabs.remove()
  })
})
