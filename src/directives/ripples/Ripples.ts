import { directive, Directive, DirectiveUpdateTag, EnterPoint, EnterPointType } from "compelem";
import { get, isBlank, isEqual, set } from "myfx";
import style from './style.scss';

function rippleOut(ripple: HTMLElement) {
  ripple.style.opacity = '0'

  ripple.ontransitionend = () => {
    ripple.parentElement?.removeChild(ripple)
    ripple.ontransitionend = null;
  }
}

interface RippleOption {
  disabled: boolean,
  color?: string
}
/**
 * 点击出现涟漪效果
 * @author holyhigh2
 */
class Ripples extends Directive {
  update(nodes: Node[], newArgs: RippleOption[], oldArgs: RippleOption[]): DirectiveUpdateTag {
    if (!isEqual(newArgs[0], oldArgs[0])) {
      let node = this.point.startNode
      if (newArgs[0].color)
        node.color = newArgs[0].color
      set(node, '__l-ripples__', get(newArgs[0], 'disabled', false))
    }
    return DirectiveUpdateTag.NONE
  }

  static get scopes(): EnterPointType[] {
    return [EnterPointType.TAG]
  }
  constructor(point: EnterPoint) {
    super();
    this.point = point
  }
  render(option?: RippleOption) {
    let node = this.point.startNode
    //注入样式
    if (get(node, '__l-ripples__')) {
      return;
    }

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style);
    this.renderComponent.shadowRoot!.adoptedStyleSheets.push(sheet);

    if (option?.color) {
      node.color = option?.color
    }
    node.style.overflow = 'hidden'
    let pos = window.getComputedStyle(node).position
    if (pos == 'static' || isBlank(pos)) {
      node.style.position = 'relative'
    }
    node.addEventListener('mousedown', this.onMousedown)
    set(node, '__l-ripples__', get(option, 'disabled', false))
  }

  onMousedown(e: MouseEvent) {
    let currentTarget = e.currentTarget as HTMLElement
    let disabled = get(currentTarget, '__l-ripples__', false)
    if (disabled) return;

    let bgColor = window.getComputedStyle(currentTarget).color
    let colors = bgColor.match(/\((?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)/)
    let rgb = { r: parseInt(colors?.groups?.r!) * 1, g: parseInt(colors?.groups?.g!) * 1, b: parseInt(colors?.groups?.b!) * 1, }

    const { clientX, clientY } = e
    const { x, y, width, height } = currentTarget.getBoundingClientRect()
    let rippleSx = clientX - x
    let rippleSy = clientY - y

    const diameter = Math.max(width, height) + 5

    let ripple = document.createElement('span')
    ripple.className = 'l-ripple '
    ripple.style.width = ripple.style.height = diameter + 'px'

    ripple.style.backgroundColor = `rgb(${Math.floor(rgb.r)},${Math.floor(rgb.g)},${Math.floor(rgb.b)})`
    ripple.style.transform = `translate(${rippleSx - width / 2}px,${rippleSy - height / 2}px) scale3d(0.2,0.2,1)`
    setTimeout(() => {
      ripple.style.opacity = '0.2'
      ripple.style.transform = `translate(${0}px,${0}px) scale3d(1,1,1)`
    }, 10);

    ripple.ontransitioncancel = ripple.ontransitionend = (e) => {
      if (e.propertyName !== 'transform') return;
      rippleOut(ripple)
    }

    currentTarget.appendChild(ripple)
  }
}
export const ripples = directive<Parameters<typeof Ripples.prototype.render>>(Ripples);