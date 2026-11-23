import { transitionMsOf, whenTransitionEnds } from 'compelem'

/**
 * 等元素当前 CSS 过渡结束后执行 done，返回「立即落定」函数（重复调用只生效一次）。
 * 取不到过渡时长时同步执行 done。prop 限定要等待的 transition 属性；
 * 不传时等待该元素全部属性/动画结束。
 */
export function settleTransition(el: Element, done: () => void, prop?: string): () => void {
  const ms = transitionMsOf(el)
  if (ms <= 0) {
    done()
    return () => { }
  }
  return whenTransitionEnds(el, ms, done, prop)
}

/**
 * 调度一次过渡结束后的收尾，返回可交给 clearTimeout 的句柄。
 * 系统要求减少动效时直接安排到下一 tick；否则根元素有过渡按 computed style
 * 时长 + 50ms 兜底，没有过渡时用 fallbackMs。
 * 保留 setTimeout 返回值供调用方在重开时取消。
 * 根元素无过渡不代表子树无动画，兜底时长由调用方按其 CSS 结构给定。
 */
export function scheduleSettle(el: Element | undefined, done: () => void, fallbackMs = 0): ReturnType<typeof setTimeout> {
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) return setTimeout(done, 0)
  const ms = el ? transitionMsOf(el) : 0
  return setTimeout(done, ms > 0 ? ms + 50 : fallbackMs)
}
