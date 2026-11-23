import { afterEach, describe, expect, it } from 'vitest'
import { CompElem, h, ifTrue, state, tag } from 'compelem'
import '../src/entries/ce-button'

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 30))
}

function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host
}

/**
 * `isMounted` 是「DOM 是否可用」判据：首屏 mounted() 之后为 true，__finalize() 之后为 false。
 * 消费侧的 `if (!this.isMounted) return` 守卫、@query 门控都依赖它随销毁一起失效。
 */
describe('isMounted 生命周期语义', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('挂载后为 true，@query 已解析出元素', async () => {
    const host = mount(`<ce-button>提交</ce-button>`)
    await flush()
    const btn = host.querySelector('ce-button')!
    expect(btn.isMounted).toBe(true)
    expect(btn.isDestroyed).toBe(false)
    expect(btn.renderRoot).toBeTruthy()
    expect(btn.slotEl).toBeTruthy()
  })

  it('destroy 落定后 isMounted 转 false，@query 门控回收为 undefined', async () => {
    const host = mount(`<ce-button>提交</ce-button>`)
    await flush()
    const btn = host.querySelector('ce-button')!
    btn.destroy()

    expect(btn.isDestroyed).toBe(true)
    expect(btn.isMounted).toBe(false)
    expect(btn.renderRoot).toBeUndefined()
    // @query 访问器以 isMounted 为门控，销毁后必须读不到旧元素
    expect(btn.slotEl).toBeUndefined()
    expect(btn.progress).toBeUndefined()
    expect(document.body.contains(btn)).toBe(false)
  })

  it('destroy 之后 nextTick 仍执行，不滞留挂载队列', async () => {
    const host = mount(`<ce-button>提交</ce-button>`)
    await flush()
    const btn = host.querySelector('ce-button')!
    btn.destroy()

    const ran = await Promise.race([
      new Promise<string>(r => btn.nextTick(() => r('ran'))),
      new Promise<string>(r => setTimeout(() => r('timeout'), 200)),
    ])
    expect(ran).toBe('ran')
  })
})

/** beforeDestroyed 抛错：释放链不能断在这里 */
@tag('test-throw-before', true)
class ThrowBefore extends CompElem {
  @state v = 0
  beforeDestroyed() {
    throw new Error('boom-before')
  }
  render() {
    return h`<div class="inner">${this.v}</div>`
  }
}

/** destroyed 抛错：清理已结束，异常照常上抛 */
@tag('test-throw-destroyed', true)
class ThrowAfter extends CompElem {
  destroyed() {
    throw new Error('boom-destroyed')
  }
  render() {
    return h`<div class="inner">x</div>`
  }
}

@tag('test-batch-ok', true)
class BatchOk extends CompElem {
  render() { return h`<span>ok</span>` }
}

@tag('test-batch-bad', true)
class BatchBad extends CompElem {
  destroyed() { throw new Error('boom-batch') }
  render() { return h`<span>bad</span>` }
}

@tag('test-batch-host', true)
class BatchHost extends CompElem {
  @state show = true
  render() {
    return h`<div class="wrap">${ifTrue(
      this.show,
      () => h`<test-batch-ok></test-batch-ok><test-batch-bad></test-batch-bad><test-batch-ok></test-batch-ok>`
    )}</div>`
  }
}

/**
 * 销毁链的异常隔离。
 *
 * `#frozen` 在用户钩子之前就已置位，钩子抛错若中断后续释放，
 * 组件会停在「isDestroyed 为 true、事件 / effect / 资源仍在跑、DOM 还在文档里」的僵尸态。
 */
describe('销毁链的异常隔离', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('beforeDestroyed 抛错不中断释放，DOM 与挂载态一并落定', async () => {
    const host = mount('<test-throw-before></test-throw-before>')
    await flush()
    const el = host.firstElementChild as any
    expect(el.isMounted).toBe(true)

    expect(() => el.destroy()).not.toThrow()

    expect(el.isDestroyed).toBe(true)
    expect(el.isMounted).toBe(false)
    expect(el.renderRoot).toBeUndefined()
    expect(el.isConnected).toBe(false)
  })

  it('destroyed 抛错时清理已完成，异常仍上抛', async () => {
    const host = mount('<test-throw-destroyed></test-throw-destroyed>')
    await flush()
    const el = host.firstElementChild as any

    expect(() => el.destroy()).toThrow('boom-destroyed')

    expect(el.isDestroyed).toBe(true)
    expect(el.isMounted).toBe(false)
    expect(el.isConnected).toBe(false)
  })

  it('批量移除时单个节点抛错，其余节点仍被摘除', async () => {
    const host = mount('<test-batch-host></test-batch-host>')
    await flush()
    const el = host.firstElementChild as any
    expect(el.shadowRoot.querySelectorAll('test-batch-ok, test-batch-bad').length).toBe(3)

    el.show = false
    await flush()

    // 中间那个的 destroyed() 抛错，不能让后两个留在 DOM 里
    expect(el.shadowRoot.querySelectorAll('test-batch-ok, test-batch-bad').length).toBe(0)
    expect(el.shadowRoot.querySelector('.wrap')!.innerHTML).toBe('')
  })
})
