import { throttle } from 'myfx'

/** 拖动会话回调 */
export type DragSessionOptions = {
  /** 指针移动。`interval > 0` 时按该间隔节流 */
  onMove?: (e: PointerEvent) => void
  /** 会话结束：抬起、捕获丢失、窗口失焦、`pointercancel` */
  onEnd?: () => void
  /** `onMove` 的节流间隔（ms），0 表示不节流 */
  interval?: number
}

/** 一次指针拖动的句柄 */
export type DragSessionHandle = {
  /** 会话是否仍在进行 */
  readonly active: boolean
  /** 立即执行节流窗口内待发的 `onMove` */
  flush(): void
  /** 结束会话。幂等。`flush` 为 false 时丢弃节流窗口内待发的 `onMove` */
  end(flush?: boolean): void
}

class Session implements DragSessionHandle {
  active = true

  #el: Element | null
  #pointerId: number
  #onMove?: (e: PointerEvent) => void
  #onEnd?: () => void
  #throttled: ReturnType<typeof throttle> | null
  /** 是否已经建立指针捕获（延后到确实发生位移时才建立，见构造函数注释） */
  #captured = false
  /** 首次 move 的坐标：位移阈值判定用 */
  #originX: number | null = null
  #originY: number | null = null

  #move = (e: PointerEvent) => {
    if (!this.active) return
    // 指针在窗口外释放、`pointerup` 又丢失时（捕获失效或环境不支持捕获），
    // 左键状态是判断「会话已该结束了」的唯一依据
    if (e.buttons === 0) {
      this.end()
      return
    }
    // 延后捕获：单击（位移 < 3px）永不捕获，拖动超过阈值才补上。
    // 阈值内的 move 仍照常回调 onMove，拖拽手感不变。
    if (!this.#captured && this.#pointerId >= 0) {
      const ox = this.#originX
      const oy = this.#originY
      if (ox === null || oy === null) {
        this.#originX = e.clientX
        this.#originY = e.clientY
      } else if (
        Math.abs(e.clientX - ox) >= 3 ||
        Math.abs(e.clientY - oy) >= 3
      ) {
        this.#captured = true
        try {
          this.#el?.setPointerCapture?.(this.#pointerId)
        } catch { /* 环境不支持 / 指针已释放：window 监听仍兜底 */ }
      }
    }
    if (this.#throttled) this.#throttled(e)
    else this.#onMove?.(e)
  }

  #finish = () => this.end()

  constructor(el: Element, e: { pointerId?: number; clientX?: number; clientY?: number }, opts: DragSessionOptions) {
    this.#el = el
    this.#pointerId = typeof e.pointerId === 'number' ? e.pointerId : -1
    this.#onMove = opts.onMove
    this.#onEnd = opts.onEnd
    // 按下坐标能拿到就以它为位移原点（第一次 move 即可判定阈值）；
    // 拿不到（如程序化传 `{clientY:0}`）就退回"首次 move 记原点"。
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      this.#originX = e.clientX
      this.#originY = e.clientY
    }

    // ⚠️ 不在按下瞬间捕获（2026-11-12）：指针捕获期间 Chrome 会把后续 mouse / click
    // 的 target 统一重定向到捕获元素 —— 单击只读表格时，原生 click 的
    // `composedPath()` 会从 `CE-TABLE` 开始，业务侧任何「按内部节点判命中」的逻辑
    // 都会失效（报表预览的 `rb-link` 就是这么挂的）。
    // 捕获的目的是「指针移出窗口后仍能收到 pointerup」，只有真的拖动才需要，
    // 所以延后到 `#move` 里位移超过阈值那一刻再建立。
    // 单击不动 ⇒ 永不捕获；拖动 ⇒ 3px 时补上，移出窗口照旧收得到 pointerup。

    const interval = opts.interval ?? 0
    this.#throttled = interval > 0 ? throttle((ev: PointerEvent) => this.#onMove?.(ev), interval) : null

    // 挂在 window 捕获阶段：不受途中 `stopPropagation` 影响
    window.addEventListener('pointermove', this.#move, true)
    window.addEventListener('pointerup', this.#finish, true)
    window.addEventListener('pointercancel', this.#finish, true)
    window.addEventListener('blur', this.#finish)
  }

  flush() {
    this.#throttled?.flush()
  }

  end(flush = true) {
    if (!this.active) return
    this.active = false
    // 先补节流窗口内最后一次位移，再拆监听。回调异常不能挡住后续清理，
    // 否则监听会留在 window 上继续响应下一次拖动
    if (this.#throttled) {
      if (flush) {
        try {
          this.#throttled.flush()
        } catch { /* 使用方已销毁时回调可能访问空引用 */ }
      }
      this.#throttled.cancel()
    }

    window.removeEventListener('pointermove', this.#move, true)
    window.removeEventListener('pointerup', this.#finish, true)
    window.removeEventListener('pointercancel', this.#finish, true)
    window.removeEventListener('blur', this.#finish)

    const el = this.#el
    const id = this.#pointerId
    this.#el = null
    this.#pointerId = -1
    if (el && id >= 0) {
      if (sessions.get(el) === this) sessions.delete(el)
      try {
        if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id)
      } catch { /* 捕获已随指针释放 */ }
    }
    this.#onEnd?.()
  }
}

const sessions = new WeakMap<Element, Session>()

/**
 * 建立一次指针拖动会话。
 *
 * 会话用指针捕获收尾，`onEnd` 在抬起、捕获丢失、窗口失焦、`pointercancel` 时各触发一次；
 * 指针在窗口外释放时捕获仍会把 `pointerup` 送回来，收不到时下一次移动按左键状态自愈。
 *
 * 同一元素上重复调用会先结束上一次会话。
 *
 * @param el 捕获指针的元素，通常是按下时的事件目标
 * @param e 触发拖动的事件，需带 `pointerId` 才能捕获；
 *   由 `mousedown` 触发时可传入别处记下的 `pointerId`；
 *   带上 `clientX` / `clientY` 时作为位移阈值原点（能更早判定"这是拖拽"）
 */
export function beginDrag(el: Element, e: { pointerId?: number; clientX?: number; clientY?: number }, opts: DragSessionOptions = {}): DragSessionHandle {
  sessions.get(el)?.end()
  const s = new Session(el, e, opts)
  sessions.set(el, s)
  return s
}
