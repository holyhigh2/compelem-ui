import { closest, each, lowerCase } from "myfx";

/**
 * 检测必填属性是否为空
 * @param dom 
 * @param attrs 
 */
export function checkRequiredAttrs(dom: HTMLElement, ...requiredAttrs: string[]): string {
  const attrs = dom.attributes
  let missing = ''
  each<string>(requiredAttrs, re => {
    if (!attrs.getNamedItem(re)) {
      missing = re
      return false;
    }
  })
  return missing
}

export function showError(tagName: string, ...args: unknown[]): void {
  console.error(`[CompElem-UI <${lowerCase(tagName)}>]`, ...args);
}

const escaper: HTMLElement = document.createElement('div');
export function escapeHtml(html: string) {
  escaper.textContent = html;
  return escaper.innerHTML;
}

/**
 * 循环动画
 * @param cbk 回调函数 
 */
export function raf(cbk: Function, stopTag: { stop: boolean }) {
  requestAnimationFrame(() => {
    if (stopTag.stop) return;
    cbk()
    raf(cbk, stopTag)
  })
}

/**
 * 获取/设置元素属性
 * @param el 
 * @param name 
 * @param value 
 */
export function attr(el: HTMLElement, name: string, value?: string) {
  if (!el.getAttribute) return
  if (value === undefined) {
    return el.getAttribute(name)
  } else {
    el.setAttribute(name, value)
  }
}

/**
 * 元素是否显示在视图中
 * @param el 
 * @returns 
 */
export function isVisible(el: Element, styleOnly = false) {
  if ((el as HTMLElement).style.display === 'none') return;
  if (styleOnly) return true

  let rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }
  return true;
}

/**
 * 是否合成层
 * @param node 
 * @returns 
 * @see https://juejin.cn/post/7365785904705814582
 */
export function isCompoundLayer(node: HTMLElement) {
  if (node.style.transform && node.style.transform != 'none') return true
  if (node.style.opacity && node.style.opacity != 'none') return true
  if (node.style.perspective && node.style.perspective != 'none') return true
  if (node.style.filter && node.style.filter != 'none') return true
  if (node.style.willChange && node.style.willChange != 'none') return true
  if (node.style.backdropFilter && node.style.backdropFilter != 'none') return true

  return false
}

/**
 * 获取元素的zIndex数字
 * @param el 
 * @returns 
 */
export function getEffectiveZIndex(el: Node) {
  let effectiveZIndex = 0; // 默认值或起始值
  let pEl = el.parentNode instanceof ShadowRoot ? el.parentNode.host : el.parentNode
  while (pEl instanceof Element && pEl.tagName !== 'BODY') {
    const parentStyle = window.getComputedStyle(pEl);
    const parentZIndex = parentStyle.getPropertyValue('z-index');
    if (parentZIndex !== 'auto' && parentZIndex !== '0') { // 找到非auto和0的z-index时停止
      effectiveZIndex += parseInt(parentZIndex, 10); // 转换为数字并返回
    }
    if (pEl.parentNode instanceof ShadowRoot) {
      pEl = pEl.parentNode.host
    } else {
      pEl = pEl.parentNode; // 继续检查父元素
    }
  }
  return effectiveZIndex;
}

export function makeStoppable(e: Event, onStop: () => void) {
  let lastStopPropagation = e.stopPropagation
  let lastStopImmediatePropagation = e.stopImmediatePropagation
  e.stopPropagation = () => {
    if (onStop) onStop()
    lastStopPropagation.call(e)
  }
  e.stopImmediatePropagation = () => {
    if (onStop) onStop()
    lastStopImmediatePropagation.call(e)
  }
}

export function getCompElemOf(el: Node) {
  let df = closest<ShadowRoot>(el, n => n instanceof ShadowRoot && (n as any).host, 'parentNode')!
  return df?.host
}

export function ensurePx(value: string | number): string {
  // 1. 数字直接加 px
  if (typeof value === 'number') {
    // 特殊处理：0 可以保留 '0'，但加 'px' 也不影响渲染，看你喜好
    return value === 0 ? '0' : `${value}px`;
  }

  // 2. 字符串：检查是否已经包含字母单位（px, rem, em, %, vw等）或结尾为 0
  const hasUnit = /[a-zA-Z%]+$/.test(value);

  // 如果已经包含单位，或者值是 '0'/'auto'/'inherit' 等关键字，直接返回
  if (hasUnit || value === '0' || value === 'auto' || value === 'inherit') {
    return value;
  }

  // 3. 纯数字字符串（如 '16'）追加 px
  return `${value}px`;
}