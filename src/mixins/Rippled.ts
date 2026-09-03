import { CompElem, Constructor } from "compelem"
import { isString } from "myfx"
import { rippleOut, RipplePalette, RippleSheet } from "../directives/ripples/Ripples"
import { getRGBColorValue } from "../utils/color"

/**
 * 涟漪效果混入，同
 * @author holyhigh2
 */
export function Rippled<T extends Constructor<any>>(spuerClass: T) {
    return class Rippled extends spuerClass {

        constructor(...args: any[]) {
            super(...args)

            this.shadowRoot!.adoptedStyleSheets.includes(RippleSheet) || (this.shadowRoot!.adoptedStyleSheets = [...this.shadowRoot!.adoptedStyleSheets, RippleSheet])

            this.addEventListener('mousedown', this.toRipple)
        }

        toRipple(e: MouseEvent, palette?: RipplePalette) {
            if (!this.ripple) return;
            if (this.loading) return;
            if (this.disabled) return;
            let currentTarget = e.currentTarget as HTMLElement

            let rootEl = (currentTarget as CompElem).renderRoot
            if (!rootEl) return

            let rgb: Record<string, any> = {}
            if (isString(this.ripple)) {
                let [r, g, b] = getRGBColorValue(this.ripple).split(' ')
                rgb = { r, g, b }
            } else {
                let bgColor = ''
                if (palette === RipplePalette.BgColor) {
                    bgColor = window.getComputedStyle(rootEl).backgroundColor
                } else {
                    bgColor = window.getComputedStyle(rootEl).color
                }
                let colorParts = bgColor.match(/\((?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)/)
                rgb = { r: parseInt(colorParts?.groups?.r!) * 1, g: parseInt(colorParts?.groups?.g!) * 1, b: parseInt(colorParts?.groups?.b!) * 1, }
            }

            const { clientX, clientY } = e
            const { x, y, width, height } = currentTarget.getBoundingClientRect()
            let rippleSx = clientX - x
            let rippleSy = clientY - y

            const diameter = Math.max(width, height) * 1.35

            let ripple = document.createElement('span')
            ripple.className='ce-ripple '
            ripple.style.width = ripple.style.height = diameter + 'px'

            ripple.style.backgroundColor = `rgb(${Math.floor(rgb.r)},${Math.floor(rgb.g)},${Math.floor(rgb.b)})`
            ripple.style.transform = `translate(${rippleSx - diameter / 2}px,${rippleSy - diameter / 2}px) scale3d(0.2,0.2,1)`
            setTimeout(() => {
                ripple.style.opacity = '0.2'
                ripple.style.transform = `translate(${(width - diameter) / 2}px,${(height - diameter) / 2}px) scale3d(1,1,1)`
            }, 10);

            ripple.ontransitioncancel = ripple.ontransitionend = (e) => {
                if (e.propertyName !== 'transform') return;
                rippleOut(ripple)
            }

            rootEl.parentNode?.insertBefore(ripple, rootEl)
        }
    }
}