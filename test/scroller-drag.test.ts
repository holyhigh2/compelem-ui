/**
 * `ce-scroller` 拖动会话的建立与拆除。
 *
 * 指针在浏览器窗口外释放时不会派发 `mouseup`，窗口也不会失焦，所以会话只能靠两件事收尾：
 * 指针捕获把 `pointerup` 重定向回 thumb，以及「左键已不在按下」的自愈判断。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../.generated/entries/ce-scroller'

// jsdom 不提供 DOMMatrix，而拖动起始要读 thumb 的 translate 值
if (!('DOMMatrix' in globalThis)) {
  ;(globalThis as any).DOMMatrix = class {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    constructor(_transform?: string) { }
    multiply() { return this }
  }
}

const pause = (ms = 40) => new Promise(r => setTimeout(r, ms))

function mount() {
  const host = document.createElement('div')
  host.innerHTML = '<ce-scroller><div style="height:1000px">x</div></ce-scroller>'
  document.body.append(host)
  return host.firstElementChild as any
}

const thumbOf = (el: any) => el.shadowRoot!.querySelector('.is-vertical .ce-scroller-thumb') as HTMLElement

function pev(type: string, init: Record<string, any> = {}) {
  return new (window as any).PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, pointerId: 7, buttons: 1, ...init
  })
}

describe('ce-scroller 拖动会话', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('pointerdown 建立会话，pointerup 收尾后不再响应移动', async () => {
    const el = mount()
    const thumb = thumbOf(el)
    expect(thumb).toBeTruthy()

    thumb.dispatchEvent(pev('pointerdown', { clientY: 0 }))
    expect(el.dragging).toBe(true)

    const move = vi.spyOn(el, 'onDrag')
    const end = vi.spyOn(el, 'onDragEnd')
    thumb.dispatchEvent(pev('pointerup', { buttons: 0 }))

    expect(end).toHaveBeenCalledTimes(1)
    expect(el.dragging).toBe(false)

    // 越过节流窗口后再移动，事件若仍挂着就会命中 onDrag
    await pause()
    thumb.dispatchEvent(pev('pointermove', { buttons: 0, clientY: 40 }))
    expect(move).not.toHaveBeenCalled()
  })

  /** 窗口外释放、`pointerup` 丢失时，第一次 `pointermove` 必须把残留会话拆掉 */
  it('pointerup 丢失时由左键状态自愈', async () => {
    const el = mount()
    const thumb = thumbOf(el)

    thumb.dispatchEvent(pev('pointerdown', { clientY: 0 }))
    const end = vi.spyOn(el, 'onDragEnd')

    await pause()
    thumb.dispatchEvent(pev('pointermove', { buttons: 0, clientY: 30 }))

    expect(end).toHaveBeenCalled()
    expect(el.dragging).toBe(false)
  })

  /** 会话使用 addEventListener，不能覆盖宿主页面上的 onmousemove / onblur */
  it('不写 document.onmousemove 与 window.onblur', async () => {
    const sentinelMove = () => { }
    const sentinelBlur = () => { }
    ;(document as any).onmousemove = sentinelMove
    ;(window as any).onblur = sentinelBlur

    const el = mount()
    const thumb = thumbOf(el)
    thumb.dispatchEvent(pev('pointerdown', { clientY: 0 }))
    thumb.dispatchEvent(pev('pointerup', { buttons: 0 }))

    expect((document as any).onmousemove).toBe(sentinelMove)
    expect((window as any).onblur).toBe(sentinelBlur)

    ;(document as any).onmousemove = null
    ;(window as any).onblur = null
  })

  it('销毁时拖动的 window 监听一并拆除', async () => {
    const el = mount()
    const thumb = thumbOf(el)
    thumb.dispatchEvent(pev('pointerdown', { clientY: 0 }))

    el.destroy()
    expect(el.dragging).toBe(false)

    const move = vi.spyOn(el, 'onDrag')
    await pause()
    window.dispatchEvent(pev('pointermove', { buttons: 1 }))
    expect(move).not.toHaveBeenCalled()
  })
})
