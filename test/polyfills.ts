// jsdom 缺失 API 的补丁集合。必须作为 setup.ts 的第一个 import，
// 以保证在 src/index.ts（模块初始化即调用 replaceSync）之前生效。

// jsdom 的 NodeIterator 在移除当前引用节点后会提前终止遍历（与浏览器行为不符），
// 导致 compelem 模板解析时 UpdatePoints 丢失。改为创建时预快照所有匹配节点。
function snapshotIterator(root: Node, whatToShow: number, nodeFilter: any): any {
  const nodes: Node[] = []
  const accept = (node: Node): number => {
    if (!(whatToShow & (1 << (node.nodeType - 1)))) return NodeFilter.FILTER_REJECT
    if (!nodeFilter) return NodeFilter.FILTER_ACCEPT
    return typeof nodeFilter === 'function' ? nodeFilter(node) : nodeFilter.acceptNode(node)
  }
  const collect = (parent: Node) => {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (accept(child) === NodeFilter.FILTER_ACCEPT) nodes.push(child)
      collect(child)
    }
  }
  collect(root)
  let index = 0
  return {
    root,
    whatToShow,
    filter: nodeFilter ?? null,
    pointerBeforeReferenceNode: false,
    get referenceNode() {
      return nodes[index - 1] ?? root
    },
    nextNode() {
      return index < nodes.length ? nodes[index++] : null
    },
    previousNode() {
      return index > 0 ? nodes[--index] : null
    },
    detach() {}
  }
}
;(document as any).createNodeIterator = function (
  root: Node,
  whatToShow = 0xffffffff,
  nodeFilter?: any
) {
  return snapshotIterator(root, whatToShow, nodeFilter ?? null)
}

// jsdom 的 ShadowRoot / Document 未实现 adoptedStyleSheets（compelem 样式注入依赖）
function patchAdoptedStyleSheets(proto: any) {
  if (!proto || 'adoptedStyleSheets' in proto) return
  Object.defineProperty(proto, 'adoptedStyleSheets', {
    configurable: true,
    get(this: any) {
      return (this.__adoptedSheets ??= [])
    },
    set(this: any, v: any[]) {
      this.__adoptedSheets = v ?? []
    }
  })
}
patchAdoptedStyleSheets((globalThis as any).ShadowRoot?.prototype)
patchAdoptedStyleSheets((globalThis as any).Document?.prototype)
patchAdoptedStyleSheets((globalThis as any).DocumentFragment?.prototype)

// jsdom 的 CSSStyleSheet 未实现 replaceSync（compelem 样式注入依赖）
if (typeof (CSSStyleSheet.prototype as any).replaceSync !== 'function') {
  ;(CSSStyleSheet.prototype as any).replaceSync = function (css: string) {
    ;(this as any).__cssText = css
  }
  ;(CSSStyleSheet.prototype as any).replace = function (css: string) {
    ;(this as any).__cssText = css
    return Promise.resolve(this)
  }
  ;(CSSStyleSheet.prototype as any).insertRule = function (rule: string, index = 0) {
    if (!(this as any).cssRules) (this as any).cssRules = []
    ;(this as any).cssRules.splice(index, 0, rule)
    return index
  }
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  ;(globalThis as any).ResizeObserver = ResizeObserverStub
}

// jsdom 缺失 CSS.supports（src/utils/color.ts 颜色检查依赖）
if (typeof (globalThis as any).CSS?.supports !== 'function') {
  ;(globalThis as any).CSS = (globalThis as any).CSS ?? {}
  ;(globalThis as any).CSS.supports = () => true
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  })
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!HTMLElement.prototype.animate) {
  ;(HTMLElement.prototype as any).animate = () => ({
    finished: Promise.resolve(),
    cancel: () => {},
    onfinish: null
  })
}
