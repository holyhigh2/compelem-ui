import { afterEach, describe, expect, it } from 'vitest'
import '../src/entries/ce-skeleton-loader'

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 30))
}

function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host
}

describe('ce-skeleton-loader 空行兜底', () => {
  afterEach(() => { document.body.innerHTML = '' })

  /**
   * `paragraph` + `rows=0` 是唯一能走到兜底分支的组合：for 循环一次都不执行，
   * rows 为空。兜底行必须经 pushRow 包装成 `{ items }`，否则 `r.items` 为 undefined，
   * 渲染层的 forEach(r.items) 一个块都取不到。
   */
  it('零行时兜底成一行 { items } 结构，并真的渲染出占位块', async () => {
    const host = mount('<ce-skeleton-loader type="paragraph" rows="0"></ce-skeleton-loader>')
    const el = host.querySelector('ce-skeleton-loader') as any
    await flush()

    const rows = el.resolveRows()
    expect(rows).toHaveLength(1)
    expect(Array.isArray(rows[0].items)).toBe(true)
    expect(rows[0].items).toHaveLength(1)

    expect(el.shadowRoot.querySelectorAll('.ce-skeleton-row')).toHaveLength(1)
    expect(el.shadowRoot.querySelectorAll('.ce-skeleton-item')).toHaveLength(1)
  })
})
