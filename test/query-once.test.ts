import { afterEach, describe, expect, it } from 'vitest'
import { CompElem, h, ifTrue, query, QueryCache, state, tag } from 'compelem'

/** ONCE 的契约是「首次查询到结果时缓存」，空结果不应占住缓存 */
@tag('test-query-once', true)
class QueryOnce extends CompElem {
  @state show = false
  @query('.late', QueryCache.ONCE) lateEl!: HTMLElement
  render() {
    return h`<div>${ifTrue(this.show, () => h`<span class="late">late</span>`)}</div>`
  }
}

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 20))
}

describe('@query(ONCE) 缓存', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('首次查询为空时不缓存，节点出现后仍能读到', async () => {
    const host = document.createElement('div')
    host.innerHTML = '<test-query-once></test-query-once>'
    document.body.append(host)
    await flush()

    const el = host.firstElementChild as any
    expect(el.lateEl == null).toBe(true)

    el.show = true
    await flush()

    expect(el.lateEl).toBeTruthy()
    expect(el.lateEl.className).toBe('late')
  })
})
