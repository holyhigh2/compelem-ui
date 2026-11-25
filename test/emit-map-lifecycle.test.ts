import { afterEach, describe, expect, it } from 'vitest'
import { CompElem, h, ifTrue, state, tag } from 'compelem'
import '../.generated/entries/ce-tag'

/**
 * 组件事件登记表（`_subComponentEventMap`）的归属与生命周期。
 *
 * 登记表是「节点 → { 事件名 → 处理器 }」的 WeakMap，挂在写回调的那个组件上：
 * 节点被移出视图后随节点回收，不需要在每条移除路径上手动清理；
 * 也不能把序号写到节点上——同一节点被两个 owner 注册时会撞号。
 */
@tag('test-emit-direct', true)
class DirectHolder extends CompElem {
  @state show = true
  closed = 0
  render() {
    return h`<div>${ifTrue(
      this.show,
      () => h`<ce-tag closable @close="${() => { this.closed++ }}">x</ce-tag>`
    )}</div>`
  }
}

@tag('test-emit-nested', true)
class NestedHolder extends CompElem {
  @state show = true
  closed = 0
  render() {
    return h`<div>${ifTrue(
      this.show,
      () => h`<div class="wrap"><ce-tag closable @close="${() => { this.closed++ }}">x</ce-tag></div>`
    )}</div>`
  }
}

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 20))
}

async function mount(html: string): Promise<any> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  await flush()
  return host.firstElementChild as any
}

/** 反复重建同一个条件子树：每轮都是新节点 */
async function cycles(el: any, times = 4) {
  for (let i = 0; i < times; i++) {
    el.show = false
    await flush()
    el.show = true
    await flush()
  }
}

describe('组件事件登记表以节点为 key', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('登记表是 WeakMap，且不在节点上留序号', async () => {
    const el = await mount('<test-emit-direct></test-emit-direct>')
    expect(el._subComponentEventMap).toBeInstanceOf(WeakMap)

    const tagEl = el.shadowRoot.querySelector('ce-tag') as any
    expect(el._subComponentEventMap.get(tagEl)).toBeTruthy()
    expect(tagEl.__c_emit_event_).toBeUndefined()
  })

  it('反复重建后存活节点仍能分发', async () => {
    const el = await mount('<test-emit-direct></test-emit-direct>')
    await cycles(el)

    const tagEl = el.shadowRoot.querySelector('ce-tag') as any
    tagEl.emit('close', {})
    expect(el.closed).toBe(1)
  })

  it('容器内嵌套的子组件同样登记在宿主上并能分发', async () => {
    const el = await mount('<test-emit-nested></test-emit-nested>')
    await cycles(el)

    const tagEl = el.shadowRoot.querySelector('ce-tag') as any
    expect(el._subComponentEventMap.get(tagEl)).toBeTruthy()
    tagEl.emit('close', {})
    expect(el.closed).toBe(1)
  })

  it('已移出视图的节点再 emit 不会到达父端', async () => {
    const el = await mount('<test-emit-direct></test-emit-direct>')
    const stale = el.shadowRoot.querySelector('ce-tag') as any
    expect(stale).toBeTruthy()

    el.show = false
    await flush()
    stale.emit('close', {})
    expect(el.closed).toBe(0)
  })
})
