import { classes, css, csscope, Csscope, debounced, emits, h, model, prop, query, show, state, tag, Template, watch } from "compelem";
import { compact, isArray, isBlank, isNil, trim } from "myfx";

import { formStyleSheet } from "../styleSheets";
import { RangeInput } from "./RangeInput";
import { inputStyleSheet } from "./styleSheets";
/**
 * 时间范围输入框，两端均可键入（mask）或从时间面板选择
 * @attrs
 *  min {string} 最小时间，如 08:00
 *  max {string} 最大时间，如 18:30
 *  hide-seconds {boolean} 隐藏秒（两端的值与 rangeGap 单位都随之变为分钟精度），默认false
 *  clearable {boolean} 支持清除，默认true
 *  separator {string} 分隔符，默认 '~'
 *  rangeCheck {string} 起始值大于结束值时的处理模式，默认fit，见 RangeInput
 *  rangeGap {number} fit 模式下的最小间隔，hideSeconds 为 true 时单位为分钟，否则为秒，默认0
 *  rangeMessage {string} validate 模式下的提示文案
 *  inside {boolean} 显示内部输入框轮廓，隐藏范围框轮廓，默认true
 *  placeholder {array|string} 两个范围输入框提示内容，为数组时可分别设置起始、结束提示
 * @slots
 *  prepend
 *  append
 * @events
 *  change
 *  input
 *  clear
 *
 * @author holyhigh2
 */
/** 宽松时间格式：HH:mm 或 HH:mm:ss（时可为 1~2 位） */
const TIME_RE = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/

@emits('input', 'change', 'clear')
@tag("ce-input-time-range")
export class InputTimeRange extends RangeInput {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }

  //////////////////////////////////// props
  @prop inside = true;
  @prop hideSeconds = false

  @prop({
    type: Array, model: true, hasChanged(newValue, oldValue, changeChain, subNewValue, subOldValue) {
      let nv = isArray(newValue) ? compact(newValue) : trim(newValue)
      let ov = isArray(oldValue) ? compact(oldValue) : trim(oldValue)
      return nv[0] != ov[0] || nv[1] != ov[1]
    },
  }) value: Array<string> = []
  @state startValue: string = ''
  @state endValue: string = ''
  clearable = true
  // 必须写成类字段初始值：compelem 的 prop 只在初始化阶段反射 attribute，
  // 在 constructor / mounted 里赋值不会写出 [rounded]，appearance.scss 的
  // [appearance][rounded=""] 规则就永远匹配不到宿主
  rounded = true

  @query('ce-input-time[name="min-input"]') inputMin: any
  @query('ce-input-time[name="max-input"]') inputMax: any

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet, css`
      :host(ce-input-time-range){display:inline-block}
      ce-range-input:focus-within {
        outline: none;
        border-color: rgb(var(--form-item-color));
      }
      ce-range-input[active],
      ce-range-input:not([disabled], ce-range-input:focus-within):hover{
        border-color: rgb(var(--form-item-color));
      }
    `];
  }
  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-input-time-range:focus-within {
        outline: none;
        border-color: rgb(var(--form-item-color));
      }
      ce-input-time-range[active],
      ce-input-time-range:not([disabled], ce-input-time-range:focus-within):hover{
        border-color: rgb(var(--form-item-color));
      }
    `
  }

  /////////////////////////////////// computed
  get placeholderStart() {
    return isArray(this.placeholder) ? this.placeholder[0] : this.placeholder
  }
  get placeholderEnd() {
    return isArray(this.placeholder) ? this.placeholder[1] : this.placeholder
  }
  /** rangeGap 的单位：hideSeconds 时为分钟，否则为秒（与两端值的精度保持一致） */
  get gapUnitSeconds() {
    return this.hideSeconds ? 60 : 1
  }
  /////////////////////////////////// watches
  @watch(['startValue', 'endValue'])
  watchValue(nv: any, ov: any) {
    if (nv === ov) return

    let newValue = [this.startValue, this.endValue]
    let oldValue = this.value
    this.value = newValue
    // 刷新 clamp 的回滚基线：外部直接赋 startValue/endValue 不经过 change 事件，
    // 若不在这里补，clamp 会回滚到一个早已过期的值
    this.__syncLastValid()
    if (!isArray(oldValue) || newValue[0] != oldValue[0] || newValue[1] != oldValue[1])
      this.emitInput()
  }
  @watch('value')
  function(nv: Array<any>) {
    if (!isArray(nv)) return

    this.startValue = this.normalizeTime(nv[0])
    this.endValue = this.normalizeTime(nv[1])
    // 外部赋值不走 change 事件，需手动刷新 clamp 的回滚基线
    this.__syncLastValid()
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
      <div class="ce-range-input" ${classes({
      "ce-input-error": this.error || this.__rangeError,
      "ce-range-dual": this.dual
    })}>
        <span class="ce-input-prepend" ${show(!this.inside)}><slot name="prepend"></slot></span>
        <div part="control" class="ce-form-control" ?disabled="${this.disabled}">
          <span class="ce-input-prepend-inside" ${show(this.inside)}><slot name="prepend" ></slot></span>
          <ce-input-time name="min-input" border="0" placeholder="${this.placeholderStart}" ?hide-seconds="${this.hideSeconds}" ${model(this.startValue)} @change="${this.onChangeMin}" .error="${this.error || this.__rangeError}" .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}" ?clearable="${this.clearable}" @clear="${this.onClearStart}"></ce-input-time>
          <span class="ce-input-separator">${this.separator}</span>
          <ce-input-time name="max-input" border="0" placeholder="${this.placeholderEnd}" ?hide-seconds="${this.hideSeconds}" ${model(this.endValue)} @change="${this.onChangeMax}" .error="${this.error || this.__rangeError}" .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}" ?clearable="${this.clearable}" @clear="${this.onClearEnd}"></ce-input-time>
          <span class="ce-input-append-inside" ${show(this.inside)}><slot name="append" ></slot></span>
        </div>
        <span class="ce-input-append" ${show(!this.inside)}><slot name="append" ></slot></span>
        <div class="ce-message" ${show(this.__rangeError)}>${this.rangeMessage}</div>
      </div>
    `;
  }

  //////////////////////////////////// methods
  /**
   * 把任意输入归一化为当前精度的时间串（hideSeconds → HH:mm，否则 HH:mm:ss）。
   * 非法输入（含 mask 中间态产生的 ':' / '::'）一律归空，
   * 避免 garbage 流入 range 比较
   */
  normalizeTime(v: any): string {
    if (isNil(v) || v === '') return ''
    const m = TIME_RE.exec(String(v).trim())
    if (!m) return ''
    const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0')
    const mm = m[2]
    const ss = m[3] ?? '00'
    return this.hideSeconds ? `${hh}:${mm}` : `${hh}:${mm}:${ss}`
  }
  /** 'HH:mm[:ss]' → 秒数；非法输入返回 NaN */
  toSeconds(v: any): number {
    if (isBlank(v)) return NaN
    const m = TIME_RE.exec(String(v).trim())
    if (!m) return NaN
    return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3] ?? '0', 10)
  }
  /** 秒数 → 当前精度的时间串；越界钳制到 00:00:00 ~ 23:59:59（不跨午夜回绕） */
  fromSeconds(sec: number): string {
    if (Number.isNaN(sec)) return ''
    sec = Math.max(0, Math.min(86399, sec))
    const hh = Math.floor(sec / 3600)
    const mm = Math.floor((sec % 3600) / 60)
    const ss = sec % 60
    const p = (n: number) => String(n).padStart(2, '0')
    return this.hideSeconds ? `${p(hh)}:${p(mm)}` : `${p(hh)}:${p(mm)}:${p(ss)}`
  }

  @debounced(50)
  emitInput() {
    this.emit('input', { value: this.value })
  }
  onClearStart() {
    this.startValue = ''
    this.__lastValidStart = undefined
    this.__setRangeError(false)
    this.emit('clear', { value: ['', this.endValue] })
  }
  onClearEnd() {
    this.endValue = ''
    this.__lastValidEnd = undefined
    this.__setRangeError(false)
    this.emit('clear', { value: [this.startValue, ''] })
  }
  clear() {
    this.startValue = this.endValue = ''
    this.__lastValidStart = this.__lastValidEnd = undefined
    this.__setRangeError(false)
  }

  /**
   * 子组件 change（mask 提交 / 面板确定）先回写本端状态再走 rangeCheck ——
   * ce-input-time 的 model 回写可能晚于 change 事件，读 getStart() 会拿到旧值
   */
  onChangeMin(obj: Record<string, any>) {
    this.startValue = this.normalizeTime(obj?.value)
    super.onChangeMin(obj)
    // 等 model 回写完成再抛事件，否则 fit 修正后的另一端可能还是旧值
    this.nextTick(() => this.emitChange())
  }
  onChangeMax(obj: Record<string, any>) {
    this.endValue = this.normalizeTime(obj?.value)
    super.onChangeMax(obj)
    this.nextTick(() => this.emitChange())
  }
  emitChange() {
    let value = this.value = [this.getStart(), this.getEnd()]
    this.emit('change', { value: value })
  }

  //////////////////////////////////// range 原语
  getStart() { return this.startValue }
  setStart(v: string) { this.startValue = v }
  getEnd() { return this.endValue }
  setEnd(v: string) { this.endValue = v }
  /** 时间范围：归一化后为空串即视为空 */
  isRangeEmpty(v: any) { return isBlank(v) }
  compareRange(a: string, b: string) {
    const sa = this.toSeconds(a)
    const sb = this.toSeconds(b)
    if (Number.isNaN(sa) || Number.isNaN(sb)) return 0
    return sa - sb
  }
  fitFromStart(start: string) {
    return this.fromSeconds(this.toSeconds(start) + (this.rangeGap || 0) * this.gapUnitSeconds)
  }
  fitFromEnd(end: string) {
    return this.fromSeconds(this.toSeconds(end) - (this.rangeGap || 0) * this.gapUnitSeconds)
  }
  clampToBounds(v: string) {
    if (isBlank(v)) return v
    const sv = this.toSeconds(v)
    if (Number.isNaN(sv)) return ''
    const min = this.toSeconds(this.normalizeTime(this.min))
    const max = this.toSeconds(this.normalizeTime(this.max))
    if (!Number.isNaN(min) && sv < min) return this.fromSeconds(min)
    if (!Number.isNaN(max) && sv > max) return this.fromSeconds(max)
    return v
  }
}
