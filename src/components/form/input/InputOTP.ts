import { csscope, Csscope, emits, forEach, h, model, prop, query, queryAll, state, styles, tag, Template, watch } from "compelem";
import { compact, identity, isAlnum, isAlpha, isBlank, isNumeric, join, lowerCase, range, startsWith, toArray } from "myfx";

import appearanceStyle from "../../../base/appearance.scss?tmpl";
import { ControlBox } from "../../../base/ControlBox";
import { formStyleSheet } from "../styleSheets";
import { Input } from "./Input";
import { inputStyleSheet } from "./styleSheets";
enum OTPType {
  Digit = 'digit',
  Alphabet = 'alphabet',
  Mix = 'mix'
}
/**
 * OTP输入框
 * @attrs
 *  length {number} 输入位数，默认6
 *  placeholder {string} 输入框占位符，仅1位
 *  type {string} 可输入类型，可选digit/alphabet/mix，默认digit
 *  color {string} 输入框颜色
 *  password {boolean} 隐藏输入内容，默认false
 *  gap {string|number} 输入框间隔，当值为number时单位为px。默认0.5rem
 * @models
 *  value 默认绑定属性，input事件触发变更
 * @slots
 *  prepend
 *  append
 * @events
 *  finish({value}) 完成所有输入后触发
 *  change({value}) 输入内容变更后触发
 *
 * @author holyhigh2
 */
@emits('finish', 'change', 'update:value')
@tag("ce-input-otp")
export class InputOTP extends ControlBox {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  @prop type = 'digit'
  @prop({ type: [String, Number], model: true }) value: string | number = ''
  @prop length = 6
  @prop password = false
  @prop({ type: [String, Number] }) gap: string | number = '.5rem'
  @state valueAry: string[] = []

  @csscope(Csscope.GLOBAL)
  static get globalCss(): string {
    return appearanceStyle;
  }
  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet];
  }

  @query('ce-input:first-child')
  firstInput: Input
  @queryAll('ce-input')
  allInput: Input[]

  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  watchValue(nv: string | number) {
    this.valueAry = toArray(nv + '')
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
      <div class="ce-input-otp" ${styles({ gap: this.gap + '' })}>
        ${forEach(range(this.length), identity, (i) => h`
          <ce-input maxlength="1" show-password="${this.password}" placeholder="${this.placeholder[0] ?? ''}" ${model(this.valueAry[i])} appearance="${this.appearance}" style="text-align: center;" @keydown="${this.onKeydown}" @focus="${this.onFocus}" @input="${this.onInput}"></ce-input>
        `)}
      </div>
    `;
  }

  //////////////////////////////////// onXxx
  onFocus(obj: Record<string, any>) {
    let { value, event, target } = obj
    event.currentTarget.select()
  }
  onInput(obj: Record<string, any>) {
    let { value, event, target } = obj

    if (value && isBlank(this.value + '')) {
      this.firstInput.focus()
    } else {
      let inputType = event.inputType
      let isDel = startsWith(inputType, 'delete')
      if (isDel) {
        let k = target.getAttribute('key') >> 0
        let rightStr = this.valueAry.join('').substring(k)
        if ('deleteContentForward' == inputType) {
          if (rightStr.length > 1) {
            this.nextTick(() => {
              let updateStr = rightStr.substring(1)
              toArray<string>(updateStr).forEach((s, i) => {
                this.valueAry[k + i] = s
              })
              setTimeout(() => {
                target.input.select()
              }, 0);
            })

            range(k + rightStr.length - 1, this.valueAry.length).forEach((i) => {
              this.valueAry[i] = ''
            })
          }
        } else {
          if (rightStr.length > 1) {
            this.nextTick(() => {
              let updateStr = rightStr.substring(1)
              toArray<string>(updateStr).forEach((s, i) => {
                this.valueAry[k + i] = s
              })
            })

            range(k + rightStr.length - 1, this.valueAry.length).forEach((i) => {
              this.valueAry[i] = ''
            })
          }
          if (target.previousElementSibling) {
            target.previousElementSibling.focus()
          }
        }

        this.nextTick(() => {
          this.value = join(this.valueAry, '')
          this.emit('change', { value: this.value })
        })

        return
      }
    }

    switch (this.type) {
      case OTPType.Digit:
        if (!isNumeric(value)) {
          target.value = event.currentTarget.value = ''
          event.preventDefault();
          return
        }
        break;
      case OTPType.Alphabet:
        if (!isAlpha(value)) {
          target.value = event.currentTarget.value = ''
          event.preventDefault();
          return
        }
        break;
      case OTPType.Mix:
        if (!isAlnum(value)) {
          target.value = event.currentTarget.value = ''
          event.preventDefault();
          return
        }
        break;
      default:
        break;
    }
    if (target.nextElementSibling) {
      target.nextElementSibling.focus()
    }
    this.nextTick(() => {
      this.value = join(this.valueAry, '')
      if (compact(this.valueAry).length === this.length) {
        this.emit('finish', { value: this.value })
      } else {
        this.nextTick(() => {
          this.emit('change', { value: this.value })
        })
      }
    })
  }
  onKeydown(obj: Record<string, any>) {
    let { event, target } = obj
    let code = event.code
    if (lowerCase(code) == "arrowleft") {
      if (target.previousElementSibling) {
        target.previousElementSibling.focus()
        setTimeout(() => {
          target.previousElementSibling.input.select()
        }, 0);
      }
      return
    }
    if (lowerCase(code) == "arrowright") {
      if (target.nextElementSibling) {
        target.nextElementSibling.focus()
        setTimeout(() => {
          target.nextElementSibling.input.select()
        }, 0);
      }
      return
    }
    if (lowerCase(code) == "backspace" && !target.value) {
      if (target.previousElementSibling) {
        target.previousElementSibling.focus()
        target.previousElementSibling.input.select()
      }
      return
    }
  }
  //////////////////////////////////// methods
  clear(): void {
    this.value = ''
  }
}