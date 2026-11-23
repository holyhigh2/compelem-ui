import { afterEach, describe, expect, it } from 'vitest'
import { CompElem, h, tag } from 'compelem'

/**
 * 模板里「只有修饰符、没有回调值」的事件写法（`@click.stop` / `@dragover.prevent`）
 * 由编译器写进 emptyEvents，运行时以 noop 回调注册 —— 修饰符仍须生效。
 */
const hits: string[] = []

@tag('test-modifier-box', true)
class ModifierBox extends CompElem {
  onOuter() {
    hits.push('outer')
  }
  render() {
    return h`<div class="outer" @click="${this.onOuter}">
      <span class="stopper" @click.stop></span>
      <span class="preventer" @dragover.prevent></span>
      <span class="plain"></span>
    </div>`
  }
}

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 20))
}

async function mount(): Promise<any> {
  const host = document.createElement('div')
  host.innerHTML = '<test-modifier-box></test-modifier-box>'
  document.body.append(host)
  const el = host.querySelector('test-modifier-box') as any
  await flush()
  return el
}

describe('无回调的事件修饰符绑定', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    hits.length = 0
  })

  it('@click.stop 阻断冒泡，而非空绑定', async () => {
    const el = await mount()
    const stopper = el.shadowRoot.querySelector('.stopper') as HTMLElement
    expect(stopper).toBeTruthy()

    hits.length = 0
    stopper.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(hits).toEqual([])
  })

  it('未加修饰符的兄弟节点照常冒泡（对照组）', async () => {
    const el = await mount()
    const plain = el.shadowRoot.querySelector('.plain') as HTMLElement

    hits.length = 0
    plain.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(hits).toEqual(['outer'])
  })

  it('@dragover.prevent 取消默认行为', async () => {
    const el = await mount()
    const preventer = el.shadowRoot.querySelector('.preventer') as HTMLElement

    const ev = new MouseEvent('dragover', { bubbles: true, cancelable: true, composed: true })
    preventer.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})
