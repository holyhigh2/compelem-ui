/**
 * 测试环境补丁：jsdom 不实现布局/媒体查询相关 API，
 * 组件里有交互逻辑会直接调用，这里做最小可用替身。
 */

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as any).ResizeObserver = ResizeObserverStub
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as any
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = (() => {}) as any
}

// jsdom 不实现 document.adoptedStyleSheets，而 compelem 的 @csscope(GLOBAL)
// 在装饰器求值期就会读写它（如 Overlay）；缺失会导致整包 import 直接崩溃。
if (typeof document !== 'undefined' && !('adoptedStyleSheets' in document)) {
  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    get: () => [],
    set: () => {}
  })
}

// compelem 的首次渲染依赖 rAF 队列；jsdom 默认不提供时组件永远不渲染
if (typeof globalThis.requestAnimationFrame !== 'function') {
  ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16) as unknown as number
  ;(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id as any)
}
