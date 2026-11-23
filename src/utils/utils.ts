import { closest, each, escapeHtml as escapeHtmlPure, lowerCase } from "myfx";
import { Side } from "../constants";

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

/**
 * HTML 转义（`&` `<` `>` `"` `'` 全部编码）。纯实现、无 DOM 依赖，SSR / node 单测可用。
 *
 * 转引号是浏览器文本位序列化（`textContent` → `innerHTML`，只编码 `& < >`）的超集，
 * 文本位使用无害；属性位同样适用（见 `escapeAttr`）。
 */
export function escapeHtml(html: string): string {
  return escapeHtmlPure(html)
}

/**
 * HTML **属性位**转义（`&` `<` `>` `"` `'` 全部编码）。
 *
 * 属性值由引号定界，不转引号就能提前闭合标签（`title="${x}"` 里 x 含 `"`
 * 即构成注入面）。与 `escapeHtml` 共用同一份纯转义实现，两个名字都保留，
 * 拼 HTML 时按插入位置选用。
 */
export function escapeAttr(value: unknown): string {
  return escapeHtmlPure(value)
}

/**
 * 把 compelem 子模板渲染出的节点序列化成 HTML 字符串。
 *
 * 对应 0.28 的 `Template#getHTML(comp)`（该 API 在 0.30 被删除，改为
 * `CompElem#getSubViewNodes` 取节点）。文本节点取 `nodeValue`（原样、不再转义），
 * 元素节点取 `outerHTML` —— 与旧实现逐字节一致的序列化口径。
 */
export function nodesToHTML(nodes: Node[] | undefined): string {
  if (!nodes || nodes.length === 0) return '';
  let out = '';
  for (let i = 0, l = nodes.length; i < l; i++) {
    const n = nodes[i];
    out += n.nodeType === Node.TEXT_NODE
      ? ((n as Text).nodeValue ?? '')
      : ((n as Element).outerHTML ?? '');
  }
  return out;
}

/**
 * 循环动画
 * @param cbk 回调函数 
 */
export function raf(cbk: () => void, stopTag: { stop: boolean }) {
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

/** 可聚焦元素选择器（用于焦点管理/焦点陷阱） */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(',')

/**
 * 穿透 Shadow DOM 查询单个元素。
 * 组件内部的原生控件普遍位于多级 shadow root 中（ce-input > input），
 * 常规 querySelector 无法命中，ARIA 转发/焦点管理需要此能力。
 */
export function deepQuery(root: ParentNode | null, selector: string): HTMLElement | null {
  if (!root) return null
  const direct = root.querySelector(selector)
  if (direct) return direct as HTMLElement
  const walker = root.querySelectorAll('*')
  for (const el of Array.from(walker)) {
    const shadow = (el as Element).shadowRoot
    if (shadow) {
      const hit = deepQuery(shadow, selector)
      if (hit) return hit
    }
  }
  return null
}

/** 穿透 Shadow DOM 查询所有匹配元素 */
export function deepQueryAll(root: ParentNode | null, selector: string): HTMLElement[] {
  if (!root) return []
  const result = Array.from(root.querySelectorAll(selector)) as HTMLElement[]
  const walker = root.querySelectorAll('*')
  for (const el of Array.from(walker)) {
    const shadow = (el as Element).shadowRoot
    if (shadow) result.push(...deepQueryAll(shadow, selector))
  }
  return result
}

/**
 * 元素是否显示在视图中
 * @param el 
 * @returns 
 */
export function isVisible(el: Element | null | undefined, styleOnly = false) {
  // 空值容错（缺口⑲）：字段容器的 `_fieldMap` 会把**已销毁**的字段视为不存在
  // （见 mixins/FieldContainer.ts 的 LiveFieldMap），而部分调用点写的是
  // `isVisible(this._fieldMap.get(prop)!, true)` 这样的非空断言 —— 断言抹掉了
  // 类型上的空，运行期仍会传进来 undefined。这里统一按"不可见"处理。
  if (!el) return false
  if ((el as HTMLElement).style.display === 'none') return;
  if (styleOnly) return true

  // ⭐ 性能：**未连接文档**的元素没有布局盒子，`getBoundingClientRect()` 恒返回 0×0。
  //    而 `isConnected` 是 O(1) 且**不触发布局**，把它放在测量之前，可让"已卸载 /
  //    尚未挂载"的元素零成本返回（首屏 profile 里本函数自耗时约 250ms，占 8.4%，
  //    绝大部分是 rect 背后被反复触发的强制同步布局）。
  //    语义严格等价：未连接 ⇒ rect 宽高必为 0 ⇒ 原实现同样返回 false。
  if (!(el as Element).isConnected) return false

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

/**
 * 浮层交叉轴对齐偏移量。
 * 'end' 与触发物远端对齐、'start' 不偏移，其余取值（含未设置的空串）居中。
 * Overlay 与 Tooltip 的位置计算原本各写了 4 份同样的 if/else if 空分支，统一走这里。
 * @param startOrEnd 对齐档位，见 Side 枚举
 * @param targetLen 触发物（锚点）在该轴上的尺寸
 * @param overlayLen 浮层在该轴上的尺寸
 */
export function crossAxisOffset(startOrEnd: string, targetLen: number, overlayLen: number): number {
  if (startOrEnd === Side.End) return targetLen - overlayLen
  if (startOrEnd === Side.Start) return 0
  return (targetLen - overlayLen) / 2
}

/**
 * 幂等地把样式表挂进 shadowRoot，已挂载则跳过。
 * `adoptedStyleSheets` 拿到的是冻结数组，只能整体重新赋值；
 * 旧写法里的 `.push(sheet)`（Splits）在真实浏览器里不生效。
 */
export function adoptStyleSheets(root: ShadowRoot | null | undefined, sheet: CSSStyleSheet) {
  if (!root || root.adoptedStyleSheets.includes(sheet)) return
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
}