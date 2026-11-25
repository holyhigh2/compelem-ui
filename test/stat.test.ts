import { afterEach, describe, expect, it } from 'vitest'
import '../.generated/entries/ce-icon'
import '../.generated/entries/ce-stat'

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 30))
}

function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host
}

describe('ce-stat 趋势箭头', () => {
  afterEach(() => { document.body.innerHTML = '' })

  // 图标走工厂直传、不依赖 registerIcons：宿主没注册任何图标时箭头也要出来
  for (const [trend, cls] of [['up', 'ce-stat-up'], ['down', 'ce-stat-down']] as const) {
    it(`trend=${trend} 渲染箭头 svg（无需注册图标）`, async () => {
      const host = mount(`<ce-stat title="总量" value="1286.4" pattern="" trend="${trend}" trend-value="3.2%"></ce-stat>`)
      await flush()
      const el = host.querySelector('ce-stat')!
      const span = el.shadowRoot!.querySelector('.ce-stat-trend')!
      expect(span.classList.contains(cls)).toBe(true)
      const icon = span.querySelector('ce-icon')!
      expect(icon.innerHTML).toContain('<svg')
      expect(icon.innerHTML).toContain('currentColor')
    })
  }

  it('没有趋势值时不出箭头容器内容', async () => {
    const host = mount(`<ce-stat title="总量" value="1" pattern=""></ce-stat>`)
    await flush()
    const span = host.querySelector('ce-stat')!.shadowRoot!.querySelector('.ce-stat-trend')!
    expect(span.style.display).toBe('none')
  })
})
