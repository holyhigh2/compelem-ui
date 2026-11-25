import { afterEach, describe, expect, it } from 'vitest'
import { CompElem, h, ifTrue, slot, state, tag } from 'compelem'
import '../.generated/entries/ce-tag'

/**
 * 组件事件登记表的归属。
 *
 * `addEmitEvent` 把处理器写进**写回调的那个组件**（provenance owner）的登记表，key 是节点本身。
 * 插槽宿主的模板与插槽内容分属两个 owner：宿主自己的子节点登记在宿主上，插槽内容登记在
 * 写 `slot()` 回调的父组件上，两边互不可见。
 */
@tag('test-slot-child', true)
class SlotChild extends CompElem {
  innerClosed = 0
  render() {
    return h`<div class="box">
      <slot name="tag"></slot>
      <ce-tag closable @close="${() => { this.innerClosed++ }}">inner</ce-tag>
    </div>`
  }
}

@tag('test-slot-parent', true)
class SlotParent extends CompElem {
  @state n = 0
  outerClosed = 0
  render() {
    return h`<test-slot-child>
      ${slot(() => h`<ce-tag closable @close="${() => { this.outerClosed++ }}">c${this.n}</ce-tag>`, 'tag')}
    </test-slot-child>`
  }
}

/** 修饰符-only 事件（无回调表达式）不建更新点：`@close.prevent` */
@tag('test-modifier-holder', true)
class ModifierHolder extends CompElem {
  @state show = true
  render() {
    return h`<div>${ifTrue(
      this.show,
      () => h`<div class="wrap"><ce-tag closable @close.prevent>m</ce-tag></div>`
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

describe('插槽路径的登记表归属', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('插槽内容换代后，宿主自己的子节点事件仍然分发', async () => {
    const parent = await mount('<test-slot-parent></test-slot-parent>')
    const child = parent.shadowRoot.querySelector('test-slot-child') as any
    expect(child).toBeTruthy()

    // 换代：插槽回调读了 n，effect 重跑 → 旧内容 teardown
    for (let i = 1; i <= 3; i++) {
      parent.n = i
      await flush()
    }

    const innerTag = child.shadowRoot.querySelector('ce-tag') as any
    expect(innerTag).toBeTruthy()
    innerTag.emit('close', {})
    expect(child.innerClosed).toBe(1)
  })

  it('插槽内容换代后，新一代的绑定重新建立', async () => {
    const parent = await mount('<test-slot-parent></test-slot-parent>')
    const child = parent.shadowRoot.querySelector('test-slot-child') as any

    const first = child.querySelector('ce-tag') as any
    first.emit('close', {})
    expect(parent.outerClosed).toBe(1)

    parent.n = 1
    await flush()

    // 换代产出的是新节点：子模板的事件条目必须在构建后立刻 flush ，
    // 否则第二代起读不到父端的 @close
    const second = child.querySelector('ce-tag') as any
    expect(second).not.toBe(first)
    second.emit('close', {})
    expect(parent.outerClosed).toBe(2)
  })

  it('插槽内容登记在父组件的表上，不在插槽宿主的表上', async () => {
    const parent = await mount('<test-slot-parent></test-slot-parent>')
    const child = parent.shadowRoot.querySelector('test-slot-child') as any
    // 插槽内容节点在宿主的 light DOM 里
    const slotted = child.querySelector('ce-tag') as any
    expect(slotted).toBeTruthy()

    expect(parent._subComponentEventMap.get(slotted)).toBeTruthy()
    expect(child._subComponentEventMap.get(slotted)).toBeUndefined()
    // 宿主自己模板里的那个 ce-tag 登记在宿主上
    const innerTag = child.shadowRoot.querySelector('ce-tag') as any
    expect(child._subComponentEventMap.get(innerTag)).toBeTruthy()
  })

  it('修饰符-only 事件的子组件反复重建后不污染节点', async () => {
    const holder = await mount('<test-modifier-holder></test-modifier-holder>')
    for (let i = 0; i < 4; i++) {
      const tagEl = holder.shadowRoot.querySelector('ce-tag') as any
      expect(tagEl.__c_emit_event_).toBeUndefined()
      holder.show = false
      await flush()
      holder.show = true
      await flush()
    }
    // 存活节点仍能分发（`@close.prevent` 没有回调，只验证不抛且登记不串台）
    const alive = holder.shadowRoot.querySelector('ce-tag') as any
    expect(alive).toBeTruthy()
    expect(() => alive.emit('close', {})).not.toThrow()
  })
})
