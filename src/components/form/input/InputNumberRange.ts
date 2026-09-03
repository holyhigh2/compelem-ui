import { classes, css, csscope, Csscope, debounced, emits, h, model, prop, query, show, state, tag, Template, watch } from "compelem";
import { compact, isArray, isNil, isNumber, isNumeric, trim } from "myfx";

import { formStyleSheet } from "../styleSheets";
import { RangeInput } from "./RangeInput";
import { inputStyleSheet } from "./styleSheets";
/**
 * 数字范围输入框
 * @attrs
 *  min {string} 最小值
 *  max {string} 最大值
 *  clearable {boolean} 支持清除，默认false
 *  pattern {string} 日期显示格式，默认yyyy/MM/dd
 *  placeholder {array|string} 两个范围输入框提示内容，为数组时可分别设置起始、结束提示
 *  inside {boolean} 内部显示样式，默认true
 * @slots
 *  prepend
 *  append
 * @events
 *  focus
 *  blur
 *  input
 *  clear
 *
 * @author holyhigh2
 */
@emits('input', 'change', 'clear')
@tag("ce-input-number-range")
export class InputNumberRange extends RangeInput {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }

  //////////////////////////////////// props
  @prop inside = true;
  @prop({ type: String }) pattern: string

  @prop({
    type: Array, model: true, hasChanged(newValue, oldValue, changeChain, subNewValue, subOldValue) {
      let nv = isArray(newValue) ? compact(newValue) : trim(newValue)
      let ov = isArray(oldValue) ? compact(oldValue) : trim(oldValue)
      return nv[0] != ov[0] || nv[1] != ov[1]
    },
  }) value: Array<number> = []
  @state startValue: number
  @state endValue: number
  clearable = true
  // 必须写成类字段初始值：compelem 的 prop 只在初始化阶段反射 attribute，
  // 在 constructor / mounted 里赋值不会写出 [rounded]，appearance.scss 的
  // [appearance][rounded=""] 规则就永远匹配不到宿主
  rounded = true


  @query('ce-input-number[name="min-input"]') inputMin: any
  @query('ce-input-number[name="max-input"]') inputMax: any

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet, css`:host(ce-input-number-range){display:inline-block}`];
  }
  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-input-number-range:focus-within {
        outline: none;
        border-color: rgb(var(--form-item-color));
      }
      ce-input-number-range[active],
      ce-input-number-range:not([disabled], ce-input-number-range:focus-within):hover{
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
  function(nv: Array<any>, ov: Array<any>) {
    if (!isArray(nv)) return

    this.startValue = parseFloat(nv[0] + '')
    this.endValue = parseFloat(nv[1] + '')
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
          <ce-input-number name="min-input" pattern="${this.pattern}" border="0" placeholder="${this.placeholderStart}" ${model(this.startValue)} @change="${this.onChangeMin}" .error="${this.error || this.__rangeError}" .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}" ?clearable="${this.clearable}" @clear="${this.onClearStart}"></ce-input-number>
          <span class="ce-input-separator">${this.separator}</span>
          <ce-input-number name="max-input" pattern="${this.pattern}" border="0" placeholder="${this.placeholderEnd}" ${model(this.endValue)} @change="${this.onChangeMax}" .error="${this.error || this.__rangeError}" .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}" ?clearable="${this.clearable}" @clear="${this.onClearEnd}"></ce-input-number>
          <span class="ce-input-append-inside" ${show(this.inside)}><slot name="append" ></slot></span>
        </div>
        <span class="ce-input-append" ${show(!this.inside)}><slot name="append" ></slot></span>
        <div class="ce-message" ${show(this.__rangeError)}>${this.rangeMessage}</div>
      </div>
    `;
  }

  //////////////////////////////////// methods
  @debounced(50)
  emitInput() {
    this.emit('input', { value: this.value })
  }
  onClearStart() {
    this.startValue = NaN
    this.__lastValidStart = undefined
    this.__setRangeError(false)
    this.emit('clear', { value: [NaN, this.endValue] })
  }
  onClearEnd() {
    this.endValue = NaN
    this.__lastValidEnd = undefined
    this.__setRangeError(false)
    this.emit('clear', { value: [this.startValue, NaN] })
  }
  clear() {
    this.startValue = this.endValue = NaN
    this.__lastValidStart = this.__lastValidEnd = undefined
    this.__setRangeError(false)
    // this.emit('clear', { value: [NaN, NaN] })
  }

  //////////////////////////////////// range 原语
  getStart() { return this.startValue }
  setStart(v: number) { this.startValue = v }
  getEnd() { return this.endValue }
  setEnd(v: number) { this.endValue = v }
  /** 数字范围：NaN / null / undefined / 空串都视为空 */
  isRangeEmpty(v: any) {
    return isNil(v) || v === '' || Number.isNaN(v)
  }
  compareRange(a: number, b: number) { return a - b }
  fitFromStart(start: number) { return start + (this.rangeGap || 0) }
  fitFromEnd(end: number) { return end - (this.rangeGap || 0) }
  clampToBounds(v: number) {
    if (this.isRangeEmpty(v)) return v
    const min = isNumber(this.min) ? this.min : (isNumeric(this.min) ? parseFloat(this.min + '') : undefined)
    const max = isNumber(this.max) ? this.max : (isNumeric(this.max) ? parseFloat(this.max + '') : undefined)
    let r = v
    if (min !== undefined && r < min) r = min as number
    if (max !== undefined && r > max) r = max as number
    return r
  }

  onChangeMin(obj: Record<string, any>) {
    super.onChangeMin(obj)
    // 等 model 回写完成再抛事件，否则 fit 修正后的另一端可能还是旧值
    this.nextTick(() => this.emitChange())
  }
  onChangeMax(obj: Record<string, any>) {
    super.onChangeMax(obj)
    this.nextTick(() => this.emitChange())
  }
  emitChange() {
    let value = this.value = [this.getStart(), this.getEnd()]
    this.emit('change', { value: value })
  }
}