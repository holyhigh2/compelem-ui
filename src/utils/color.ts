/**
 * 颜色相关辅助函数
 * @author holyhigh2
 */
import { isNumeric, padZ, toFixed } from "myfx";

const ColorCon = document.createElement('div');
ColorCon.style.cssText = 'display:none;width:0;overflow:hidden'
const EXP_RGB = /rgba?\((?<r>\d+),? (?<g>\d+),? (?<b>\d+),?\s?(?<a>[0-9.]+)?/i
let ColorMap = new Map<string, string>()
/**
 * 获取RGB颜色值
 * @param color 
 */
export function getRGBColorValue(color: string) {
  if (!color) return '';
  if (!CSS.supports('color', color)) return color;
  if (color.indexOf('var(') > -1) return color;
  if (color.indexOf('transparent') > -1) return color;
  let rs = ColorMap.get(color)
  if (rs) return rs
  if (!ColorCon.parentNode) {
    document.body.appendChild(ColorCon)
  }
  if (/#[a-zA-Z0-9]{6,8}$/.test(color)) {
    let alpha = parseInt(color.substring(7, 9), 16)
    if (isNaN(alpha)) {
      alpha = -1
    }
    rs = `${parseInt(color.substring(1, 3), 16)} ${parseInt(color.substring(3, 5), 16)} ${parseInt(color.substring(5, 7), 16)}${alpha < 0 ? '' : ' /' + toFixed((alpha / 255), 2)}`
    ColorMap.set(color, rs)
    return rs
  }

  ColorCon.style.color = color;
  let rgbColor = window.getComputedStyle(ColorCon).color
  let rs2 = rgbColor.match(EXP_RGB)
  rs = rs2 ? `${rs2.groups?.r} ${rs2.groups?.g} ${rs2.groups?.b} ${rs2.groups?.a ? '/' + rs2.groups?.a : ''}` : ''

  ColorMap.set(color, rs)
  return rs
}
/**
 * 获取透明色
 * @param color 
 * @param opacity 
 */
export function getOpacityColor(color: string, opacity: number = 1) {
  if (!color) return '';
  let rgb = getRGBColorValue(color)
  let parts = rgb.split(' ')
  if (parts.length !== 3) {
    return color
  }
  return `rgba(${rgb}/${opacity})`
}
/**
 * HSL转RGB颜色（h/s/l 均为 0~1，返回 0~255 的三通道）
 * @param h 
 * @param s 
 * @param l 
 * @returns 
 */
export function HSL2RGB(h: number, s: number, l: number) {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/**
 * RGB转HSL颜色（返回 [h,s,l] 均为 0~1）
 * @param r 
 * @param g 
 * @param b 
 * @returns 
 */
export function RGB2HSL(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h, s, l]
}

/**
 * RGB转HSV颜色（返回 [h,s,v] 均为 0~1）。
 *
 * 与色板 CSS 背景 `linear-gradient(#0000,#000), linear-gradient(90deg,#fff,#fff0)` 用的是
 * 同一套坐标系：s = 水平饱和度（左 0 → 右 1），v = 垂直明度（上 1 → 下 0）。
 * 色相条的纯色 `HSL2RGB(h,1,0.5)` 正好等于 `HSV2RGB(h,1,1)`，二者可无损互转。
 */
export function RGB2HSV(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const v = max
  let s = 0
  let h = 0
  if (d !== 0) {
    s = d / max
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h, s, v]
}

/**
 * HSV转RGB颜色（h/s/v 均为 0~1，返回 0~255 的三通道）
 */
export function HSV2RGB(h: number, s: number, v: number) {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r: number, g: number, b: number
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    default: r = v; g = p; b = q
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export const ColorHelper = {
  /**
   * 解析颜色并插入--color变量到style中
   * @param color 
   * @param style 
   * @returns 
   */
  setColor(color: string, style: CSSStyleDeclaration, varName: string = '--color', isImportant: boolean = true) {
    if (!color) {
      return;
    }

    let c = color;
    switch (color) {
      case 'info': case 'success': case 'warning': case 'error': case 'text':
        c = `var(--ce-color-${color})`
        // 成对注入实心表面的前景色：背景是语义色时，文字色必须与该背景匹配
        // （warning 黄底、深色主题下提亮的 info / 反相后的 text 都不能用白字），
        // 由 --ce-color-on-* 按主题给出。用 var() 引用，主题切换时自动跟随，
        // 无需重算或监听主题变化。
        if (varName === '--color') {
          style.setProperty('--on-color', `var(--ce-color-on-${color})`, isImportant ? 'important' : '')
        }
        break;
      default:
        // 自定义颜色无法静态判断明暗，前景显式回落到强调色表面的通用前景
        // （--ce-color-on-primary，浅色主题下为白）。写成显式赋值而不是
        // removeProperty，让"host 先设 info 后改自定义色"时不会残留旧值。
        if (varName === '--color') {
          style.setProperty('--on-color', 'var(--ce-color-on-primary)', isImportant ? 'important' : '')
        }
        // 直接传 CSS 变量时原样透传。
        // 否则 `rgb(${getRGBColorValue('var(--x)')})` 会产出 `rgb(rgb(75 85 99))`
        // 这种非法值，属性静默失效、颜色退回继承值——暗色主题下图标就会"消失"。
        // 透传后组件可用语义 token 表达颜色（如 var(--ce-color-text-secondary)），
        // 从而跟随主题切换。
        c = color.startsWith('var(') ? color : `rgb(${getRGBColorValue(c)})`
    }

    style.setProperty(varName, c, isImportant ? 'important' : '')
  }
}


export function toRGBString(r: number | string, g: number | string, b: number | string, a?: number | string) {
  if (isNumeric(a)) {
    return `RGBA(${r},${g},${b},${toFixed(a, 2)})`;
  } else {
    return `RGB(${r},${g},${b})`;
  }
}
export function toHexString(r: number | string, g: number | string, b: number | string, a?: number | string) {
  let r16 = parseInt(r + '').toString(16);
  let g16 = parseInt(g + '').toString(16);
  let b16 = parseInt(b + '').toString(16);
  return '#' + padZ(r16, 2) + padZ(g16, 2) + padZ(b16, 2) + (isNumeric(a) ? parseInt(parseFloat(toFixed(a, 2)) * 255 + '').toString(16) : '');
}
export function toHSLString(h: number | string, s: number | string, l: number | string, a?: number | string) {
  h = parseFloat(h + '')
  s = parseFloat(s + '')
  l = parseFloat(l + '')

  if (isNumeric(a)) {
    return 'HSLA(' + (h * 360 >> 0) + ',' + (s * 100 >> 0) + '%,' + (l * 100 >> 0) + '%,' + toFixed(a, 2) + ')'
  } else {
    return 'HSL(' + (h * 360 >> 0) + ',' + (s * 100 >> 0) + '%,' + (l * 100 >> 0) + '%)'
  }

}