/**
 * 组件挂载辅助工具
 *
 * compelem 组件遵循标准 Custom Elements 生命周期：
 * appendChild 触发 connectedCallback → setup（同步渲染 Shadow DOM）→ mounted。
 *
 * 用法：
 *   const el = await mount('ce-button', { attrs: { disabled: true } })
 *   const el = await mount('ce-button', { html: '<span>确定</span>' })
 */
export interface MountOptions {
  /** 挂载前设置的 attributes（kebab-case），boolean true 表示空值属性 */
  attrs?: Record<string, string | number | boolean>
  /** light DOM 子内容 */
  html?: string
  /** 挂载目标容器，默认 document.body */
  parent?: HTMLElement
  /** 宿主组件 tag：组件依赖 parentComponent 时需要包裹在另一个 ce-* 组件内挂载 */
  wrapper?: string
}

export async function mount<T extends HTMLElement = HTMLElement>(
  tag: string,
  opts: MountOptions = {}
): Promise<T> {
  const el = document.createElement(tag) as T
  const { attrs = {}, html = '', parent = document.body, wrapper } = opts

  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) {
      el.setAttribute(k, '')
    } else if (v === false || v === null || v === undefined) {
      continue
    } else {
      el.setAttribute(k, String(v))
    }
  }
  if (html) el.innerHTML = html

  if (wrapper) {
    const host = document.createElement(wrapper)
    host.appendChild(el)
    parent.appendChild(host)
  } else {
    parent.appendChild(el)
  }
  // 等待微任务，冲刷组件内部 nextTick / Promise 逻辑
  await Promise.resolve()
  return el
}

export function unmount(el: HTMLElement) {
  el.remove()
}
