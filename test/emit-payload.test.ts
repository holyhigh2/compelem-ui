import { afterEach, describe, expect, it } from 'vitest'
import { CompElem, emits, h, tag } from 'compelem'

/**
 * emit 载荷的形状：组件实例含 `parent ↔ children` 更新树环，作为可枚举字段挂到
 * 载荷上会让 `JSON.stringify(arg)` 直接抛 TypeError（站点事件日志曾因此报错）。
 */
@emits('ping')
@tag('test-emit-child', true)
class EmitChild extends CompElem {
  render() {
    return h`<div>child</div>`
  }
  fire(event?: Event) {
    this.emit('ping', { value: 1 }, event)
  }
}

@tag('test-emit-parent', true)
class EmitParent extends CompElem {
  payload: any = null
  sawTarget = false
  onPing = (arg: any) => {
    this.payload = arg
    this.sawTarget = arg?.target?.tagName?.toLowerCase() === 'test-emit-child'
  }
  render() {
    return h`<test-emit-child @ping="${this.onPing}"></test-emit-child>`
  }
}

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 20))
}

async function mountParent(): Promise<[any, any]> {
  const host = document.createElement('div')
  host.innerHTML = '<test-emit-parent></test-emit-parent>'
  document.body.append(host)
  await flush()
  const parent = host.firstElementChild as any
  const child = parent.shadowRoot.querySelector('test-emit-child') as any
  return [parent, child]
}

describe('emit 载荷形状', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('target 仍可读但不可枚举，载荷可 JSON 序列化', async () => {
    const [parent, child] = await mountParent()
    expect(child).toBeTruthy()

    child.fire()
    await flush(1)

    expect(parent.sawTarget).toBe(true)
    expect(parent.payload.target).toBe(child)
    expect(Object.keys(parent.payload)).not.toContain('target')
    expect(() => JSON.stringify(parent.payload)).not.toThrow()
    expect(JSON.parse(JSON.stringify(parent.payload)).value).toBe(1)
  })

  it('附带原生 Event 的载荷同样不撞环', async () => {
    const [parent, child] = await mountParent()
    const ev = new Event('click')

    child.fire(ev)
    await flush(1)

    expect(parent.payload.event).toBe(ev)
    expect(() => JSON.stringify(parent.payload)).not.toThrow()
  })
})
