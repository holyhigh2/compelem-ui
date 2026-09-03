import { CompElem, directive, EnterPointType } from "compelem";
import { find, isUndefined } from "myfx";
import { getRGBColorValue } from "../../utils/color";
import { getCompElemOf } from "../../utils/utils";
import style from './style.scss?inline';

export function rippleOut(ripple: HTMLElement) {
  ripple.style.opacity = '0'

  ripple.ontransitionend = () => {
    ripple.parentNode?.removeChild(ripple)
    ripple.ontransitioncancel = ripple.ontransitionend = null;
    if (RippleCache.length < MAX_CACHE_SIZE)
      RippleCache.push(ripple)
  }
}

const NodeMap = new WeakMap
const PropagationMap = new WeakMap
export const RippleSheet = new CSSStyleSheet();
RippleSheet.replaceSync(style);

export function bindSheet(target: Element) {
  let compEl = getCompElemOf(target)
  if (!compEl) return

  compEl.shadowRoot!.adoptedStyleSheets.includes(RippleSheet) || (compEl.shadowRoot!.adoptedStyleSheets = [...compEl.shadowRoot!.adoptedStyleSheets, RippleSheet])
}

export enum RipplePalette {
  Color = 'color',
  BgColor = 'bgcolor'
}

const MAX_CACHE_SIZE = 10
const RippleCache: HTMLElement[] = []

interface RippleOption {
  //是否禁用
  disabled?: boolean,
  //指定颜色
  color?: string,
  //自动从target中提取颜色，使用 'color' / 'bgcolor'
  palette?: string,
  //指定参照物用于确定尺寸
  refer?: (el: HTMLElement) => HTMLElement,
  //插入节点内部，默认插入节点后
  inner?: boolean,
  //当元素是组件根元素时，自动绑定host
  propagation?: boolean
}
/**
 * 点击出现涟漪效果
 * @author holyhigh2
 */
export const ripples = directive((function Ripples(option?: RippleOption) {
  return (pointNode: Node, [option]: any[], oldArgs: any, { renderComponent }: { renderComponent: CompElem }) => {
    let refer = pointNode as HTMLElement
    if (option.refer) {
      refer = option.refer(pointNode)
    }
    refer.style.overflow = 'hidden'
    let propagation = isUndefined(option.propagation) ? true : option.propagation

    if (propagation && pointNode.parentNode instanceof DocumentFragment && !renderComponent.renderRoot) {
      renderComponent.toggleAttribute('__rippled', true)
      NodeMap.set(renderComponent, option)
      PropagationMap.set(renderComponent, pointNode)
    }
    ; (pointNode as HTMLElement).toggleAttribute('__rippled', true)

    NodeMap.set(pointNode, option)
  };
}) as any, [EnterPointType.TAG])

export function onMousedown(target: Element, e: PointerEvent) {
  if (PropagationMap.has(target)) {
    target = PropagationMap.get(target)
  }
  let opts = NodeMap.get(target)
  if (!opts || opts.disabled) return;

  bindSheet(target)

  let palette = isUndefined(opts.palette) ? RipplePalette.Color : opts.palette

  let rgb: Record<string, any> = {}
  if (opts.color) {
    let [r, g, b] = getRGBColorValue(opts.color).split(' ')
    rgb = { r, g, b }
  } else {
    let bgColor = ''
    if (palette === RipplePalette.Color) {
      bgColor = window.getComputedStyle(target).color
    } else {
      bgColor = window.getComputedStyle(target).backgroundColor
    }
    let colorParts = bgColor.match(/\((?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)/)
    rgb = { r: parseInt(colorParts?.groups?.r!) * 1, g: parseInt(colorParts?.groups?.g!) * 1, b: parseInt(colorParts?.groups?.b!) * 1, }
  }

  let refer = target
  if (opts.refer) {
    refer = opts.refer(target)
  }
  const { clientX, clientY } = e
  const { x, y, width, height } = refer.getBoundingClientRect()
  let rippleSx = clientX - x
  let rippleSy = clientY - y

  const diameter = Math.max(width, height) * 1.35

  let ripple
  if (RippleCache.length > 0) {
    ripple = RippleCache.pop()!
  } else {
    ripple = document.createElement('span')
  }

  ripple.className='ce-ripple '
  ripple.style.width = ripple.style.height = diameter + 'px'

  ripple.style.opacity = '0'
  ripple.style.backgroundColor = `rgb(${Math.floor(rgb.r)},${Math.floor(rgb.g)},${Math.floor(rgb.b)})`
  ripple.style.transform = `translate(${rippleSx - diameter / 2}px,${rippleSy - diameter / 2}px) scale3d(0.2,0.2,1)`

  ripple.ontransitioncancel = ripple.ontransitionend = (e) => {
    if (e.propertyName !== 'transform') return;
    rippleOut(ripple)
  }

  if (opts.inner) {
    target.appendChild(ripple)
  } else {
    target.after(ripple)
  }

  setTimeout(() => {
    ripple.style.opacity = '0.2'
    ripple.style.transform = `translate(${(width - diameter) / 2}px,${(height - diameter) / 2}px) scale3d(1,1,1)`
  }, 20);
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.body.hasAttribute('__rippled')) return

  document.body.addEventListener('pointerdown', (ev: PointerEvent) => {
    let rippleTarget = find(ev.composedPath(), el => el instanceof Element && el.hasAttribute('__rippled')) as Element
    onMousedown(rippleTarget, ev as any)
  }, true)
  document.body.toggleAttribute('__rippled', true)
})