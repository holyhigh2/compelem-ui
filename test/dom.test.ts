import { describe, expect, it } from 'vitest'
import { deepQuery, deepQueryAll, escapeHtml, FOCUSABLE_SELECTOR } from '../src/utils/utils'

describe('deepQuery', () => {
  it('可以穿透多层 shadow root 命中原生控件', () => {
    const host = document.createElement('div')
    const first = host.appendChild(document.createElement('section'))
    const shadow1 = first.attachShadow({ mode: 'open' })
    const inner = shadow1.appendChild(document.createElement('span'))
    const shadow2 = inner.attachShadow({ mode: 'open' })
    const input = document.createElement('input')
    shadow2.appendChild(input)

    expect(deepQuery(host, 'input')).toBe(input)
    expect(deepQueryAll(host, 'input')).toEqual([input])
  })

  it('控件选择器覆盖常见的可聚焦元素', () => {
    const host = document.createElement('div')
    const button = document.createElement('button')
    const disabled = document.createElement('button')
    disabled.setAttribute('disabled', '')
    const div = document.createElement('div')
    div.setAttribute('tabindex', '0')
    host.append(button, disabled, div)

    const focusables = deepQueryAll(host, FOCUSABLE_SELECTOR)
    expect(focusables).toContain(button)
    expect(focusables).toContain(div)
    expect(focusables).not.toContain(disabled)
  })

  it('root 为空时返回 null / 空数组', () => {
    expect(deepQuery(null, 'input')).toBeNull()
    expect(deepQueryAll(null, 'input')).toEqual([])
  })
})

describe('escapeHtml', () => {
  it('转义危险字符（& < >），引号也一并编码', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    )
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('引号同样被编码：文本位与属性位共用同一纯转义口径', () => {
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;')
  })

  it('不重复接收已转义内容以外的改动：& 先于其它字符被编码', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('可以连续调用（纯函数，无 DOM 依赖）', () => {
    expect(escapeHtml('a')).toBe('a')
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;')
    expect(escapeHtml('c')).toBe('c')
  })
})
