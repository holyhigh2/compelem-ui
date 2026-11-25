import { afterEach, describe, expect, it } from 'vitest'
import { Close } from '../src/icons/icons'
import { getIcon } from '../src/icons/registry'
import '../.generated/entries/ce-button'
import '../.generated/entries/ce-button-group'
import '../.generated/entries/ce-icon'
import '../.generated/entries/ce-progress-circular'
import { nextFrame } from './helpers'

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) await nextFrame()
}

function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host
}

describe('ce-button 行为', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('disabled 落到原生 button，点击不产生 click 事件', async () => {
    const host = mount(`<ce-button disabled>停止</ce-button>`)
    await flush()
    const btn = host.querySelector('ce-button')!.shadowRoot!.querySelector('button')!
    expect(btn.disabled).toBe(true)
    let clicks = 0
    host.querySelector('ce-button')!.addEventListener('click', () => clicks++)
    btn.click()
    expect(clicks).toBe(0)
  })

  it('loading 隐藏文本并点亮进度环，结束后收回', async () => {
    const host = mount(`<ce-button loading>提交中</ce-button>`)
    await flush()
    const btn = host.querySelector('ce-button')!
    const inner = btn.shadowRoot!.querySelector('button')!
    expect(inner.style.opacity).toBe('0')
    expect(btn.shadowRoot!.querySelector('.is-loading')!.className).toContain('ce-button-show')

    btn.removeAttribute('loading')
    await flush(6)
    expect(btn.shadowRoot!.querySelector('button')!.style.opacity).toBe('1')
  })

  /**
   * 契约是「`<slot name="loader">` 常驻 + 默认进度环按 slots.loader 是否为空切换」：
   * 插槽若条件渲染，框架的 slotKeys 门禁收不到 'loader'，后插的自定义内容永远不生效。
   * 自定义内容本身在 light DOM 里，shadowRoot 查不到它，能断言的是默认支被移除。
   */
  it('loader 插槽常驻，自定义 loader 内容顶掉默认进度环', async () => {
    const plain = mount(`<ce-button loading>提交</ce-button>`)
    await flush()
    expect(plain.querySelector('ce-button')!.shadowRoot!.querySelector('slot[name="loader"]')).toBeTruthy()
    expect(plain.querySelector('ce-button')!.shadowRoot!.querySelector('ce-progress-circular')).toBeTruthy()

    document.body.innerHTML = ''
    const custom = mount(`<ce-button loading><i slot="loader" class="mine">X</i></ce-button>`)
    await flush()
    const btn = custom.querySelector('ce-button')!
    expect(btn.shadowRoot!.querySelector('slot[name="loader"]')).toBeTruthy()
    expect(btn.shadowRoot!.querySelector('ce-progress-circular')).toBeNull()
    expect(btn.querySelector('.mine')).toBeTruthy()
  })

  it('aria-label / aria-current / aria-expanded 转发到内层原生 button', async () => {
    const host = mount(`<ce-button aria-label="关闭" aria-current="page" aria-expanded="true">X</ce-button>`)
    await flush()
    const inner = host.querySelector('ce-button')!.shadowRoot!.querySelector('button')!
    expect(inner.getAttribute('aria-label')).toBe('关闭')
    expect(inner.getAttribute('aria-current')).toBe('page')
    expect(inner.getAttribute('aria-expanded')).toBe('true')
  })

  it('未给 aria 属性时不写入空值属性', async () => {
    const host = mount(`<ce-button>普通</ce-button>`)
    await flush()
    const inner = host.querySelector('ce-button')!.shadowRoot!.querySelector('button')!
    expect(inner.hasAttribute('aria-label')).toBe(false)
    expect(inner.hasAttribute('aria-expanded')).toBe(false)
  })

  it('icon 属性渲染 part="icon"，未给时不渲染图标节点', async () => {
    const withIcon = mount(`<ce-button icon="c-svg-close">删</ce-button>`)
    await flush()
    expect(withIcon.querySelector('ce-button')!.shadowRoot!.querySelector('[part="icon"]')).toBeTruthy()

    document.body.innerHTML = ''
    const plain = mount(`<ce-button>删</ce-button>`)
    await flush()
    expect(plain.querySelector('ce-button')!.shadowRoot!.querySelector('[part="icon"]')).toBeNull()
  })

  it('图标工厂无需注册即可渲染，字符串图标 API 保持兼容', async () => {
    expect(getIcon('Close')).toBeUndefined()
    const host = mount('<ce-button>删</ce-button>')
    const btn = host.querySelector('ce-button') as any
    btn.icon = Close
    btn.appendIcon = Close
    await flush()
    const icons = btn.shadowRoot!.querySelectorAll('ce-icon')
    expect(icons).toHaveLength(2)
    for (const icon of icons) {
      expect((icon as any).svg).toBe(Close)
      expect(icon.querySelector('svg')).toBeTruthy()
    }

    const legacy = mount('<ce-button icon="c-svg-close">删</ce-button>')
    await flush()
    const legacyIcon = legacy.querySelector('ce-button')!.shadowRoot!.querySelector('ce-icon')!
    expect((legacyIcon as any).svg).toBe('c-svg-close')
  })

  it('type 默认 button，避免在表单里被当成提交按钮', async () => {
    const host = mount(`<ce-button>点我</ce-button>`)
    await flush()
    expect(host.querySelector('ce-button')!.shadowRoot!.querySelector('button')!.type).toBe('button')
  })
})

describe('ce-button-group 行为', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('未开 togglable 时点击成员按钮不产生选中态（文档契约）', async () => {
    const host = mount(`<ce-button-group value="a"><ce-button value="a">A</ce-button><ce-button value="b">B</ce-button></ce-button-group>`)
    await flush()
    const group = host.querySelector('ce-button-group')!
    const buttons = Array.from(group.querySelectorAll('ce-button'))
    buttons[1].shadowRoot!.querySelector('button')!.click()
    await flush()
    expect((group as any).value).toBe('a')
    expect(buttons[1].hasAttribute('active')).toBe(false)
  })

  /**
   * ⚠️ `emit-native` 不是可选装饰：compelem 的 `CompElem.emit()` 默认把事件交给
   * 「包装它的 compelem 组件」（`emitEvent(this.wrapperComponent, ...)`），只有宿主
   * 带 `emit-native` 属性时才真正 `dispatchEvent(CustomEvent)`。脱离 compelem 渲染树
   * 直接 addEventListener 的纯 DOM 用法不加这个属性，永远收不到 change / update:value。
   */
  it('togglable 单选：点击成员按钮后组值同步并派发 change / update:value', async () => {
    const host = mount(`<ce-button-group emit-native togglable value="a"><ce-button value="a">A</ce-button><ce-button value="b">B</ce-button></ce-button-group>`)
    await flush()
    const group = host.querySelector('ce-button-group')!
    const changes: any[] = []
    const models: any[] = []
    group.addEventListener('change', (e: any) => changes.push(e.detail))
    group.addEventListener('update:value', (e: any) => models.push(e.detail))
    const buttons = Array.from(group.querySelectorAll('ce-button'))
    // 选中态从一开始就落在宿主属性上，组值才是可审计的
    expect(buttons[0].hasAttribute('active')).toBe(true)

    buttons[1].shadowRoot!.querySelector('button')!.click()
    await flush()
    expect((group as any).value).toBe('b')
    expect(buttons[1].hasAttribute('active')).toBe(true)
    expect(buttons[0].hasAttribute('active')).toBe(false)
    expect(changes.map(d => d.value)).toEqual(['b'])
    expect(models.map(d => d.value)).toEqual(['b'])
  })

  it('togglable + multiple：选中项累加，再点取消', async () => {
    const host = mount(`<ce-button-group togglable multiple><ce-button value="a">A</ce-button><ce-button value="b">B</ce-button></ce-button-group>`)
    await flush()
    const group = host.querySelector('ce-button-group')!
    const buttons = Array.from(group.querySelectorAll('ce-button'))
    buttons[0].shadowRoot!.querySelector('button')!.click()
    await flush()
    expect((group as any).value).toEqual(['a'])
    buttons[1].shadowRoot!.querySelector('button')!.click()
    await flush()
    expect((group as any).value).toEqual(['a', 'b'])
    buttons[0].shadowRoot!.querySelector('button')!.click()
    await flush()
    expect((group as any).value).toEqual(['b'])
    expect(buttons[0].hasAttribute('active')).toBe(false)
  })

  it('required 阻止取消最后一个选中项', async () => {
    const host = mount(`<ce-button-group togglable required value="a"><ce-button value="a">A</ce-button><ce-button value="b">B</ce-button></ce-button-group>`)
    await flush()
    const group = host.querySelector('ce-button-group')!
    const buttons = Array.from(group.querySelectorAll('ce-button'))
    buttons[0].shadowRoot!.querySelector('button')!.click()
    await flush()
    expect((group as any).value).toBe('a')
    expect(buttons[0].hasAttribute('active')).toBe(true)
  })

  it('组级外观属性下发到子按钮', async () => {
    const host = mount(`<ce-button-group size="lg" appearance="flat"><ce-button>A</ce-button></ce-button-group>`)
    await flush()
    const btn = host.querySelector('ce-button')!
    expect(btn.getAttribute('size')).toBe('lg')
    expect(btn.getAttribute('appearance')).toBe('flat')
    // value 是组级 model，下发会覆盖按钮自身 value，必须排除
    expect(btn.hasAttribute('value')).toBe(false)
  })
})
