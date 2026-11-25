import { afterEach, describe, expect, it } from 'vitest'
// 只注册分页模板实际用到的标签：全量 register 会加载所有组件，
// 其中若干装饰器依赖浏览器布局 API，在 jsdom 下不适用。
import '../.generated/entries/ce-pagination'
import '../.generated/entries/ce-button'
import '../.generated/entries/ce-icon'
import '../.generated/entries/ce-progress-circular'

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 30))
}

describe('ce-pagination a11y', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('根节点暴露分页导航语义', async () => {
    const el = document.createElement('ce-pagination')
    el.setAttribute('total', '100')
    el.setAttribute('current', '2')
    el.setAttribute('page-size', '10')
    document.body.append(el)
    await flush()

    const nav = el.shadowRoot?.querySelector('nav.ce-pagination')
    expect(nav).toBeTruthy()
    expect(nav?.getAttribute('aria-label')).toBe('分页')
  })

  it('上一页/下一页在原生 button 上带有无障碍名称', async () => {
    const el = document.createElement('ce-pagination')
    el.setAttribute('total', '100')
    el.setAttribute('current', '2')
    document.body.append(el)
    await flush()

    const prev = el.shadowRoot?.querySelector('ce-button.ce-pagination-prev') as any
    const next = el.shadowRoot?.querySelector('ce-button.ce-pagination-next') as any
    expect(prev?.shadowRoot?.querySelector('button')?.getAttribute('aria-label')).toBe('上一页')
    expect(next?.shadowRoot?.querySelector('button')?.getAttribute('aria-label')).toBe('下一页')
  })

  it('当前页使用 aria-current=page', async () => {
    const el = document.createElement('ce-pagination')
    el.setAttribute('total', '100')
    // 对外受控属性是 value；current 只是内部渲染态，写 attribute 不生效
    el.setAttribute('value', '2')
    document.body.append(el)
    await flush()

    // aria-current / aria-label 都落在 ce-button shadow 内的原生 button 上
    // （宿主不反射这两个属性），因此要先定位当前页 ce-button 再下钻一层。
    const pager = el.shadowRoot?.querySelector('ce-button[data-page="2"]') as any
    const btn = pager?.shadowRoot?.querySelector('button')
    expect(btn?.getAttribute('aria-current')).toBe('page')
    expect(btn?.getAttribute('aria-label')).toBe('第 2 页')

    // 非当前页必须是 false，避免读屏把整组页码都当成「当前」
    const other = el.shadowRoot?.querySelector('ce-button[data-page="1"]') as any
    expect(other?.shadowRoot?.querySelector('button')?.getAttribute('aria-current')).toBe('false')
  })
})
