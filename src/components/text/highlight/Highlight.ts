import { CompElem, csscope, Csscope, h, prop, query, state, tag, Template, watch } from "compelem";
import { isArray, isEmpty, isString, join, parseJSON, toArray } from "myfx";
import { IColorable } from "../../../interfaces/IColorable";
import { ColorHelper } from "../../../utils/color";
import style from "./style.scss?tmpl";
/**
 * 高亮组件
 * @attrs
 *  color {string} 高亮字体颜色，默认marktext
 *  bgColor {string} 高亮背景颜色，默认mark
 *  keyword {string|Array<string>} 高亮关键字
 *
 * @slots
 *  - 需要高亮的文本
 *
 * @author holyhigh2
 */
@tag('ce-highlight')
export class Highlight extends CompElem implements IColorable {

  //////////////////////////////////// props
  @prop({ type: String }) color: string = 'marktext';
  @prop bgColor: string = 'mark';
  @prop({ type: [String, Array] }) keyword: string | Array<string> = '';
  @state highlighted = ''

  @query('slot')
  slotDefault: HTMLSlotElement
  checkRegExp: RegExp

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  /////////////////////////////////// watches
  @watch('keyword', { immediate: true })
  watchKeyword(k: string | Array<string>) {
    let rs = k

    if (isString(k)) {
      let tmp = parseJSON<Array<string>>(k)
      if (isArray(tmp)) {
        rs = tmp
      }
    } else {
      rs = k
    }
    this.checkRegExp = new RegExp(isArray(rs) ? join(rs, '|') : rs, 'img')
    this.highlight()
  }
  @watch("color", { immediate: true })
  __watchColor(nv: any, ov: any) {
    ColorHelper.setColor(nv, this.style, '--hl-color')
  }
  @watch("bgColor", { immediate: true })
  __watchBgColor(nv: any, ov: any) {
    ColorHelper.setColor(nv, this.style, '--hl-bg-color')
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <div class="ce-highlight">
    </div>
    <slot style="display:none"></slot>
    `;
  }

  //////////////////////////////////// methods
  slotChange(slot: HTMLSlotElement, name: string): void {
    if (!name) {
      this.highlight()
    }
  }

  highlight() {
    if (!this.slotDefault) return;

    let wholeText = this.slotDefault.assignedNodes({ flatten: true })[0].nodeValue || ''

    let rsList = wholeText.matchAll(this.checkRegExp)
    let rsArray = toArray(rsList)
    if (isEmpty(rsArray)) {
      this.renderRoot!.textContent = wholeText
      return
    }
    let allHighlighted = ''
    let lastPreIndex = 0
    rsArray.forEach((rs: any) => {
      let k = rs[0]
      let i = rs.index
      let prepend = wholeText.substring(0, i - lastPreIndex)
      let marked = `<mark>${k}</mark>`
      wholeText = wholeText.substring(i - lastPreIndex + k.length, wholeText.length)
      lastPreIndex = i + k.length
      allHighlighted += prepend + marked
    })
    this.renderRoot!.innerHTML = allHighlighted + wholeText
  }
}
