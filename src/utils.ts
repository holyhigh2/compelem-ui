import { each, lowerCase } from "myfx"
const EXP_RGB = /rgba?\((?<r>\d+),? (?<g>\d+),? (?<b>\d+)/i
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

const ColorCon = document.createElement('div');
ColorCon.style.cssText = 'display:none;width:0;overflow:hidden'

/**
 * 获取RGB颜色值
 * @param color 
 */
export function getRGBColorValue(color: string) {
  if (!color) return '';
  if (!CSS.supports('color', color)) return color;
  if (color.indexOf('var(') > -1) return color;
  if (color.indexOf('transparent') > -1) return color;
  if (!ColorCon.parentNode) {
    document.body.appendChild(ColorCon)
  }
  ColorCon.style.color = color;
  let rgbColor = window.getComputedStyle(ColorCon).color
  let rs = rgbColor.match(EXP_RGB)

  return rs ? `${rs.groups?.r} ${rs.groups?.g} ${rs.groups?.b}` : ''
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