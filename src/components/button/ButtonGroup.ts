import { Csscope, csscope, emits, event, prop, state, tag } from "compelem";
import { clone, each, find, findIndex, findTreeNodes, kebabCase, remove, toArray } from "myfx";
import { AppearanceElem } from "../../base/Appearance";
import { Button } from "./Button";
import style from "./group.scss?tmpl";
const ValueMap = new WeakMap<Button, string>()
/**
 * 按钮组
 * @props
 *  value {string | string[]} 绑定值，multiple为true时为数组，否则为字符串
 *  divided {boolean} 在每个按钮之间插入分隔符，默认false
 *  multiple {boolean} 是否允许多选，默认false
 *  togglable {boolean} 是否允许切换选中状态，默认false
 *  required {boolean} 是否至少选中一个按钮，默认false
 *  shift {boolean} 是否开启shift显示效果，仅对开启stacked的button生效，默认false
 * @models
 *  value 默认绑定属性，input事件触发变更
 * @events
 *  change({value}) togglable开启且选项变更时触发。如果multiple为true，value是数组，否则是字符串
 * @slots
 *  - 按钮组件
 *
 * @author holyhigh2
 */
@emits("change", "update:value")
@tag("ce-button-group")
export class ButtonGroup extends AppearanceElem {

  //////////////////////////////////// props
  @prop({ type: [String, Array], model: true }) value: string | string[] = ''
  @prop divided = false
  @prop multiple = false
  @prop togglable = false
  @prop required = false
  @prop shift = false
  @prop stacked = false

  //button props

  @state selectedValues: string[] = []
  //////////////////////////////////// styles
  @csscope(Csscope.HOST)
  static get hostCss() {
    return style;
  }
  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  render(): any {
    return null
  }
  updated(changed: Record<string, any>): void {

    this.setButtonProps(changed)
  }
  mounted(): void {
    this.setButtonProps()
  }
  //////////////////////////////////// methods
  setButtonProps(changed?: Record<string, any>) {
    let btns = findTreeNodes<Button>(this.childNodes, n => n instanceof Button)
    let attrs = this.props
    each(btns, (btn, i) => {
      each(attrs, (v, k: string) => {
        if (v)
          btn.setAttribute(kebabCase(k), v)
      })
    })
  }
  @event('click')
  onButtonClick(e: MouseEvent) {
    if (!this.togglable) return

    let btn = e.target as Button
    let val = ValueMap.get(btn) ?? ''
    if (!val) {
      val = btn.value ?? 'button_' + (findIndex(toArray(this.children), c => c === btn))
      ValueMap.set(btn, val)
    }

    if (this.multiple) {
      if (this.selectedValues.includes(val)) {
        if (this.required && this.selectedValues.length < 2) {
          return
        }
        btn.toggleAttribute('active', false)
        remove(this.selectedValues, v => v == val)
      } else {
        this.selectedValues.push(val)
        btn.toggleAttribute('active', true)
      }
    } else {
      let lastSelectedBtn = find(this.children, (c: Button) => ValueMap.get(c) === this.selectedValues[0])
      if (this.selectedValues.includes(val)) {
        if (this.required) {
          return
        }
        btn.toggleAttribute('active', false)
        remove(this.selectedValues, v => v == val)
      } else {
        if (lastSelectedBtn) {
          lastSelectedBtn.toggleAttribute('active', false)
        }
        this.selectedValues = [val]
        btn.toggleAttribute('active', true)
      }
    }
    let value = this.multiple ? clone(this.selectedValues) : this.selectedValues[0]
    this.value = value
    this.emit('change', { value })
  }
}
