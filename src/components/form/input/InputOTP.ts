import { csscope, Csscope, emits, forEach, h, prop, query, queryAll, state, styles, tag, Template, watch } from "compelem";
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
  @prop type = 'digit'
  @prop({ type: [String, Number], model: true }) value: string | number = ''
  @prop length = 6
  @prop password = false
  @prop({ type: [String, Number] }) gap: string | number = '.5rem'
  @state valueAry: string[] = []

  @csscope(Csscope.GLOBAL)
  static get globalCss() {
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
    const str = nv == null ? '' : nv + ''
    // valueAry 按「格位」存值（长度恒为 length），value 只是它的紧凑拼接。
    // 内部回写时两者一致，此时不能重建数组，否则字符会被挤到前面的格位，
    // 与屏幕上实际所在的格对不上。
    if (str === join(this.valueAry, '') && this.valueAry.length === this.length) return
    const ary: string[] = Array.from(str)
    while (ary.length < this.length) ary.push('')
    this.valueAry = ary.slice(0, this.length)
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
      <div class="ce-input-otp" ${styles({ gap: this.gap + '' })}>
        ${forEach(range(this.length), identity, (i) => h`
          <ce-input maxlength="1" autocomplete="one-time-code" type="${this.password ? 'password' : 'text'}" placeholder="${this.placeholder[0] ?? ''}" appearance="${this.appearance}" align="${this.align || 'center'}" @keydown="${this.onKeydown}" @focus="${this.onFocus}" @input="${this.onInput}" @blur="${this.onBlur}"></ce-input>
        `)}
      </div>
    `;
  }

  //////////////////////////////////// onXxx
  onFocus(obj: Record<string, any>) {
    let { value, event, target } = obj
    event.currentTarget.select()
  }
  //////////////////////////////////// methods
  /** 事件目标所在的格下标：优先按 ce-input 宿主定位，事件目标来自其内部原生 input 时按 ref 反查 */
  private __cellIndex(target: any): number {
    // @queryAll 返回的是类数组（NodeList），不能直接 indexOf
    const list: any[] = Array.from((this.allInput as any) ?? [])
    const i = list.indexOf(target)
    if (i >= 0) return i
    return list.findIndex(x => x?.inputRef?.current === target)
  }
  /** 当前 type 是否接受该字符。只在失焦时用于清洗，输入阶段不拦。 */
  private __matchType(v: string): boolean {
    switch (this.type) {
      case OTPType.Digit: return isNumeric(v)
      case OTPType.Alphabet: return isAlpha(v)
      case OTPType.Mix: return isAlnum(v)
      default: return true
    }
  }
  /** 写入某一格的显示值与内部数组，不做类型校验 */
  private __writeCell(i: number, v: string) {
    if (i < 0) return
    const host: any = this.allInput?.[i]
    const el = host?.inputRef?.current as HTMLInputElement | undefined
    if (el && el.value !== v) el.value = v
    this.valueAry[i] = v
  }
  onInput(obj: Record<string, any>) {
    let { value, event, target } = obj
    // 无原生事件：由内层 ce-input 清空后补发的 input。逐位搬运依赖 inputType 与
    // currentTarget 定位位下标，无事件时无从判断，跳过；空值由 clear 事件同步。
    if (!event) return
    // 输入法组合期间不介入：此时跳格或改写内容都会打断候选选择
    if (event.isComposing || event.inputType === 'insertCompositionText') return

    const k = this.__cellIndex(target)

    if (value && isBlank(this.value + '')) {
      this.firstInput.focus()
    } else {
      let inputType = event.inputType
      let isDel = startsWith(inputType, 'delete')
      if (isDel) {
        let rightStr = this.valueAry.join('').substring(k)
        if ('deleteContentForward' == inputType) {
          if (rightStr.length > 1) {
            this.nextTick(() => {
              let updateStr = rightStr.substring(1)
              toArray<string>(updateStr).forEach((s, i) => {
                this.valueAry[k + i] = s
              })
              setTimeout(() => {
                target?.input?.select?.()
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
          if (target?.previousElementSibling) {
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

    // 输入阶段不判断合法性：字符原样落格，类型约束在失焦时执行
    this.__writeCell(k, (value + '').slice(0, 1))
    if (target?.nextElementSibling) {
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
  /**
   * 失焦是类型约束的唯一兑现点：清掉与 `type` 不符的字符。
   * 输入阶段放行任意字符，否则输入法组合期间的内容会被当场清掉。
   */
  onBlur(_obj?: Record<string, any>) {
    let dirty = false
    Array.from((this.allInput as any) ?? []).forEach((input: any, i: number) => {
      const el = input?.inputRef?.current as HTMLInputElement | undefined
      const v = el?.value ?? ''
      if (!v || this.__matchType(v)) return
      if (el) el.value = ''
      this.valueAry[i] = ''
      dirty = true
    })
    if (dirty) {
      this.nextTick(() => {
        this.value = join(this.valueAry, '')
        this.emit('change', { value: this.value })
      })
    }
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