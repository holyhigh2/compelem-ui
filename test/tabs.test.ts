import { afterEach, describe, expect, it } from 'vitest'
import '../src/entries/ce-tabs'
import '../src/entries/ce-tab'
import '../src/entries/ce-nav'
import '../src/entries/ce-icon'

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

const TABS_HTML = `<ce-tabs value="b">
  <ce-tab index="a" label="甲"></ce-tab>
  <ce-tab index="b" label="乙"></ce-tab>
  <ce-tab index="c" label="丙" disabled></ce-tab>
</ce-tabs>`

const tabsOf = (el: any) => Array.from(el.querySelectorAll('ce-tab'))

describe('ce-tabs 选中行为', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('初始 value 点亮对应页签并让它成为唯一 Tab 停靠点', async () => {
    const el = native(TABS_HTML)
    await flush()
    const tabs = tabsOf(el)
    expect(tabs.map(t => t.classList.contains('active'))).toEqual([false, true, false])
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(tabs.map(t => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('点击页签更新 value 并派发 select({label,index})', async () => {
    const el = native(TABS_HTML)
    await flush()
    const selects: any[] = []
    el.addEventListener('select', (e: any) => { if (e.detail) selects.push([e.detail.label, e.detail.index]) })
    const tabs = tabsOf(el)
    tabs[0].click()
    await flush()
    expect(el.value).toBe('a')
    expect(tabs[0].classList.contains('active')).toBe(true)
    expect(tabs[1].classList.contains('active')).toBe(false)
    expect(selects).toEqual([['甲', 'a']])
  })

  it('disabled 页签点击不切换', async () => {
    const el = native(TABS_HTML)
    await flush()
    tabsOf(el)[2].click()
    await flush()
    expect(el.value).toBe('b')
    expect(tabsOf(el)[2].classList.contains('active')).toBe(false)
  })

  it('外部改 value 属性同步选中态', async () => {
    const el = native(TABS_HTML)
    await flush()
    el.setAttribute('value', 'c')
    await flush()
    expect(tabsOf(el)[2].classList.contains('active')).toBe(true)
    expect(tabsOf(el)[1].classList.contains('active')).toBe(false)
  })

  it('增删页签后按当前 value 重算选中态', async () => {
    const el = native(TABS_HTML)
    await flush()
    const added = document.createElement('ce-tab')
    added.setAttribute('index', 'd')
    added.setAttribute('label', '丁')
    el.append(added)
    await flush()
    const tabs = tabsOf(el)
    expect(tabs.length).toBe(4)
    // slotChange 会重新下发 space/size 并 changeTab(this.value)
    expect(tabs[3].getAttribute('size')).not.toBeNull()
    expect(tabs[1].classList.contains('active')).toBe(true)
    expect(tabs[3].getAttribute('aria-selected')).toBe('false')
  })

  it('closable 页签的关闭图标派发 close({label,index})', async () => {
    const el = native(`<ce-tabs closable value="a">
      <ce-tab index="a" label="甲"></ce-tab>
    </ce-tabs>`)
    await flush()
    const closes: any[] = []
    el.addEventListener('close', (e: any) => { if (e.detail) closes.push([e.detail.label, e.detail.index]) })
    const closeBtn = (el.querySelector('ce-tab') as any).shadowRoot!.querySelector('.ce-tabs-close')!
    expect(closeBtn.getAttribute('role')).toBe('button')
    // 鼠标路径挂在 mousedown 上，键盘路径由 activatable 的 Enter/Space 触发
    closeBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    closeBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flush()
    expect(closes).toEqual([['甲', 'a'], ['甲', 'a']])
  })

  it('无页签时键盘导航不抛错', async () => {
    const el = native(`<ce-tabs></ce-tabs>`)
    await flush()
    const nav = el.shadowRoot!.querySelector('ce-nav')!
    expect(() => nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))).not.toThrow()
    await flush()
    expect(el.value).toBeFalsy()
  })
})
