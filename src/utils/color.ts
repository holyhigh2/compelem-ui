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
function hue2RGB(v1: number, v2: number, vH: number) {
  if (vH < 0) vH += 1;
  if (vH > 1) vH -= 1;
  if ((6 * vH) < 1) return v1 + (v2 - v1) * 6 * vH;
  if ((2 * vH) < 1) return v2;
  if ((3 * vH) < 2) return v1 + (v2 - v1) * (2 / 3 - vH) * 6;
  return v1;
}
/**
 * HSL转RGB颜色
 * @param h 
 * @param s 
 * @param l 
 * @returns 
 */
export function HSL2RGB(h: number, s: number, l: number) {
  let r, g, b;
  if (s === 0) {
    r = l * 255;
    g = l * 255;
    b = l * 255;
  } else {
    let v1, v2;
    if (l < 0.5)
      v2 = l * (1 + s);
    else {
      v2 = (l + s) - (s * l);
    }

    v1 = 2 * l - v2;

    r = 255 * hue2RGB(v1, v2, h + 1 / 3);
    g = 255 * hue2RGB(v1, v2, h);
    b = 255 * hue2RGB(v1, v2, h - 1 / 3);
  }
  var m = Math;
  return [m.round(r), m.round(g), m.round(b)];
}

export function RGB2HSL(r: number, g: number, b: number) {
  let l = 0, s = 0, h = 0

  r = (r || 0) / 255
  g = (g || 0) / 255
  b = (b || 0) / 255
  let cmin = Math.min(r, g, b)
  let cmax = Math.max(r, g, b)
  let cdel = cmax - cmin

  l = (cmin + cmax) / 2;
  s = 0;
  h = 0;

  if (cmax > 0 && cdel > 0) {
    if (l < 0.5)
      s = cdel / (cmax + cmin);
    else {
      s = cdel / (2 - cmax - cmin);
    }


    let delR = (((cmax - r) / 6) + (cdel / 2)) / cdel
    let delG = (((cmax - g) / 6) + (cdel / 2)) / cdel
    let delB = (((cmax - b) / 6) + (cdel / 2)) / cdel

    if (r === cmax) h = delB - delG;
    else if (g === cmax) h = 1 / 3 + delR - delB;
    else if (b === cmax) h = 2 / 3 + delG - delR;

    if (h < 0) h += 1;
    if (h > 1) h -= 1;
  }
  return [h, s, l]
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
        break;
      default:
        c = `rgb(${getRGBColorValue(c)})`
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