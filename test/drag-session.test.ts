/**
 * `beginDrag` 的会话生命周期。
 *
 * 会话要覆盖四条收尾路径：真实抬起、捕获丢失后按左键状态自愈、失焦、主动结束；
 * 以及节流窗口的最后一次位移不能丢。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { beginDrag } from '../src/utils/dragSession'

function pev(type: string, init: Record<string, any> = {}) {
  return new (window as any).PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, pointerId: 3, buttons: 1, ...init
  })
}

const move = (init: Record<string, any> = {}) => window.dispatchEvent(pev('pointermove', init))
const up = () => window.dispatchEvent(pev('pointerup', { buttons: 0 }))

function mount() {
  const el = document.createElement('div')
  document.body.append(el)
  const captured: number[] = []
  let released = 0
  ;(el as any).setPointerCapture = (id: number) => captured.push(id)
  ;(el as any).hasPointerCapture = () => true
  ;(el as any).releasePointerCapture = () => { released++ }
  return { el, captured, releasedCount: () => released }
}

describe('beginDrag 会话', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('按下不捕获，位移超过阈值才捕获；抬起时释放并只回调一次 onEnd', () => {
    const { el, captured, releasedCount } = mount()
    const onEnd = vi.fn()
    // 2026-11-12：按下瞬间不捕获 —— 指针捕获会让后续 click 的 target 被重定向到
    // 捕获元素，单击表格时业务侧依赖 composedPath 的命中判定会全部失效。
    beginDrag(el, pev('pointerdown', { clientX: 0, clientY: 0 }), { onEnd })

    expect(captured).toEqual([])
    move({ clientX: 1, clientY: 0 })
    expect(captured).toEqual([])

    move({ clientX: 5, clientY: 0 })
    expect(captured).toEqual([3])

    up()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(releasedCount()).toBe(1)
  })

  it('节流窗口内的最后一次移动由 flush 补发', () => {
    const { el } = mount()
    const xs: number[] = []
    const drag = beginDrag(el, pev('pointerdown'), { interval: 50, onMove: e => xs.push(e.clientX) })

    move({ clientX: 10 })
    move({ clientX: 20 })
    expect(xs).toEqual([10])

    drag.flush()
    expect(xs).toEqual([10, 20])
  })

  it('end(false) 丢弃待发的移动', () => {
    const { el } = mount()
    const xs: number[] = []
    const drag = beginDrag(el, pev('pointerdown'), { interval: 50, onMove: e => xs.push(e.clientX) })

    move({ clientX: 10 })
    move({ clientX: 20 })
    drag.end(false)
    expect(xs).toEqual([10])
  })

  /** 窗口外释放、`pointerup` 丢失时，左键状态是自愈的唯一依据 */
  it('左键已抬起时自愈收尾', () => {
    const { el } = mount()
    const onEnd = vi.fn()
    beginDrag(el, pev('pointerdown'), { onEnd })

    move({ buttons: 0, clientX: 200 })
    expect(onEnd).toHaveBeenCalledTimes(1)

    move({ clientX: 300 })
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('结束幂等，且之后不再响应移动', () => {
    const { el } = mount()
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const drag = beginDrag(el, pev('pointerdown'), { onMove, onEnd })

    drag.end()
    drag.end()
    expect(onEnd).toHaveBeenCalledTimes(1)

    move({ clientX: 50 })
    expect(onMove).not.toHaveBeenCalled()
  })

  it('同一元素重复起手会先结束上一次会话', () => {
    const { el } = mount()
    const first = vi.fn()
    const second = vi.fn()

    beginDrag(el, pev('pointerdown'), { onEnd: first })
    beginDrag(el, pev('pointerdown'), { onEnd: second })

    expect(first).toHaveBeenCalledTimes(1)
    up()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('窗口失焦同样收尾', () => {
    const { el } = mount()
    const onEnd = vi.fn()
    beginDrag(el, pev('pointerdown'), { onEnd })

    window.dispatchEvent(new Event('blur'))
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
