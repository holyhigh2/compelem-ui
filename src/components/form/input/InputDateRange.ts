import { classes, createRef, css, csscope, Csscope, debounced, emits, h, ifTrue, model, prop, query, show, state, tag, Template, watch } from "compelem";
import { addTime, compareDate, formatDate, isArray, isBlank, padZ, range } from "myfx";

import { Swap } from "../../../icons/icons";
import { Overlay } from "../../overlays/overlay/Overlay";
import { DatePicker } from "../../picker/datepicker/DatePicker";

import { formStyleSheet } from "../styleSheets";
import { RangeInput } from "./RangeInput";
import { inputStyleSheet } from "./styleSheets";
enum DateInputType {
  Date = 'date',
  DateTime = 'datetime',
  Year = 'year',
  Month = 'month',
  Week = 'week'
}
/**
 * 日期范围输入框
 * @attrs
 *  type {string} year/month/date/datetime，默认date
 *  min {string} 最小值
 *  max {string} 最大值
 *  clearable {boolean} 支持清除，默认false
 *  pattern {string} 日期显示格式，默认yyyy/MM/dd
 *  patternTime {string} 时间显示格式，默认HH:mm
 *  showIcon {boolean} 显示尾部图标，默认true
 *  trigger {string} 日历面板触发方式，可选focus/click，默认click
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
@emits('change', 'clear')
@tag("ce-input-date-range")
export class InputDateRange extends RangeInput {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  __lastValue: string
  //////////////////////////////////// props
  @prop type = 'date';
  @prop inside = true;
  @prop pattern = 'yyyy/MM/dd'
  @prop patternTime = 'HH:mm'
  @prop showIcon = true
  @prop trigger = 'click'

  @prop({ type: Array, model: true }) value: Array<string> = []
  @state startValue = ''
  @state endValue = ''
  clearable = true
  // 必须写成类字段初始值：compelem 的 prop 只在初始化阶段反射 attribute，
  // 在 constructor / mounted 里赋值不会写出 [rounded]，appearance.scss 的
  // [appearance][rounded=""] 规则就永远匹配不到宿主
  rounded = true

  @state selectedDateStart = ''
  @state selectedDateEnd = ''
  minList = range(60).map(v => padZ(v, 2));
  hourList = range(24).map(v => padZ(v, 2));

  datePane = createRef<HTMLElement>()
  calendarStart = createRef<DatePicker>()
  calendarEnd = createRef<DatePicker>()
  @query('.ce-input-date-panel') datePanel: Overlay
  @query('ce-input-date[name="min-input"]') inputMin: any
  @query('ce-input-date[name="max-input"]') inputMax: any

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet, css`
      ce-range-input:focus-within {
        outline: none;
        border-color: rgb(var(--form-item-color));
      }
      ce-range-input[active],
      ce-range-input:not([disabled], ce-range-input:focus-within):hover{
        border-color: rgb(var(--form-item-color));
      }
      // 注：swap 按钮渲染在弹出面板 footer 内，而 overlay 会把面板 portal 到 document.body，
      // 组件 INNER 样式作用域（shadowRoot）到不了，故按钮样式全部走 inline style
      `];
  }
  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-input-date-range:focus-within {
        outline: none;
        border-color: rgb(var(--form-item-color));
      }
      ce-input-date-range[active],
      ce-input-date-range:not([disabled], ce-input-date-range:focus-within):hover{
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
  /**
   * 与 type 对应的日期比较/运算单位。
   * 原先这套 switch 散落在 changeStartValue/changeEndValue 里且运算时硬编码 'd'，
   * 导致 year/month 模式下间隔算错，这里统一收口
   */
  get dateUnit() {
    switch (this.type) {
      case DateInputType.DateTime: return 'm'
      case DateInputType.Year: return 'y'
      case DateInputType.Month: return 'M'
      default: return 'd'
    }
  }
  /** 日期时间显示格式（datetime 需要带上时间部分） */
  get rangePattern() {
    return this.type == DateInputType.Date ? this.pattern : (this.pattern + ' ' + this.patternTime)
  }
  /////////////////////////////////// watches
  // ce-input-date 是 readonly，日期只能经日历面板选择，
  // 因此「面板选中值 → 输入框值」这条链路必须打通，否则 rangeCheck 永远读到旧值
  @watch(['selectedDateStart'])
  watchStart() {
    this.startValue = isBlank(this.selectedDateStart) ? '' : this.formatValue(this.selectedDateStart)
  }
  @watch(['selectedDateEnd'])
  watchEnd() {
    this.endValue = isBlank(this.selectedDateEnd) ? '' : this.formatValue(this.selectedDateEnd)
  }
  @watch(['startValue', 'endValue'])
  watchValue() {
    this.value = [this.startValue, this.endValue]
    // 刷新 clamp 的回滚基线（外部赋值不经过 change 事件）
    this.__syncLastValid()
    this.emitChange()
  }
  @watch('value')
  function(nv: Array<string>) {
    if (!isArray(nv)) return
    if (nv[0]) this.startValue = nv[0]
    if (nv[1]) this.endValue = nv[1]
    // 外部赋值不走 change 事件，需手动刷新 clamp 的回滚基线
    this.__syncLastValid()
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }
  @state firstPopup = false

  render(): Template {
    return h`
      <div class="ce-range-input" ${classes({
      "ce-input-error": this.error || this.__rangeError,
      "ce-range-dual": this.dual
    })}>
        <span class="ce-input-prepend" ${show(!this.inside)}><slot name="prepend"></slot></span>
        <div part="control" class="ce-form-control" ?disabled="${this.disabled}">
          <span class="ce-input-prepend-inside" ${show(this.inside)}><slot name="prepend" ></slot></span>
          <ce-input-date no-icon name="min-input" tabindex="1" border="0" placeholder="${this.placeholderStart}" .min="${this.min}" readonly show-icon="false" ${model(this.startValue)} trigger-mode="none" type="${this.type}" .error="${this.error || this.__rangeError}" .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}" ?clearable="${this.clearable}" @clear="${this.onClearStart}" @change="${this.onChangeMin}">
            ${ifTrue(this.dual, () => h`<ce-icon slot="append" class="ce-input-calendar" svg="c-svg-calendar" size="sm"></ce-icon>`)}
          </ce-input-date>
          <span class="ce-input-separator">${this.separator}</span>
          <ce-input-date no-icon name="max-input" tabindex="2" border="0" placeholder="${this.placeholderEnd}" .max="${this.max}" readonly show-icon="false" ${model(this.endValue)} trigger-mode="none" type="${this.type}" .error="${this.error || this.__rangeError}" .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}" ?clearable="${this.clearable}" @clear="${this.onClearEnd}" @change="${this.onChangeMax}">
            <ce-icon slot="append" class="ce-input-calendar" svg="c-svg-calendar" size="sm"></ce-icon>
          </ce-input-date>
          <span class="ce-input-append-inside" ${show(this.inside)}><slot name="append" ></slot></span>
        </div>
        <span class="ce-input-append">
          <slot name="append" ></slot>
        </span>
        <div class="ce-message" ${show(this.__rangeError)}>${this.rangeMessage}</div>
      </div>

      <ce-overlay placement="bottom-end" auto-active close-on-click opacity="0.25" class="ce-input-date-panel" trigger=".ce-range-input" trigger-mode="click" @close="${this.onClose}" @beforeopen="${this.onBeforeopen}" >
       ${ifTrue(this.firstPopup, () => h`  
        <ce-card class="ce-input-time-card" style="padding: var(--ce-spacing-sm);" ref="${this.datePane}" >
          <div style="display: flex;column-gap: .5rem;height:22em;">
            <div style="display: flex;position: relative;column-gap: .5rem;">
              <ce-date-picker ?showTime="${this.type === DateInputType.DateTime}" ref="${this.calendarStart}" @change="${this.changeStartValue}" .min="${this.min}" .max="${this.max}" pattern="yyyy/MM/dd" month-unit="月" ${model(this.selectedDateStart)}></ce-date-picker>
            </div>
            <ce-divider vertical></ce-divider>
            <div style="display: flex;position: relative;column-gap: .5rem;">
              <ce-date-picker ?showTime="${this.type === DateInputType.DateTime}" ref="${this.calendarEnd}" @change="${this.changeEndValue}" .min="${this.min}" .max="${this.max}" pattern="yyyy/MM/dd" month-unit="月" ${model(this.selectedDateEnd)}></ce-date-picker>
            </div>
          </div>
          <ce-divider></ce-divider>
          <footer slot="actions" style="padding-block: .5rem;gap: 1rem;display: flex;">
            <ce-link size="sm" @click="${this.selectToday}">今天</ce-link>
            <ce-link size="sm" @click="${this.selectLastWeek}">过去一周</ce-link>
            <ce-link size="sm" @click="${this.selectLastMonth}">过去一月</ce-link>
            <!-- <ce-button class="ce-range-swap" appearance="subtle" size="sm" style="margin-left:auto;padding:0;width:1.75rem;height:1.75rem;border-radius:50%" ?disabled="${isBlank(this.startValue) && isBlank(this.endValue)}" @click="${this.swapRange}"> -->
              <!-- <ce-icon .svg="${Swap}" size="sm"></ce-icon> -->
            <!-- </ce-button> -->
          </footer>
        </ce-card>
      `)}
      </ce-overlay>
    `;
  }

  //////////////////////////////////// methods
  selectToday() {
    this.calendarStart.current?.setValue(Date.now())
    this.calendarEnd.current?.setValue(Date.now())
  }
  selectLastWeek() {
    this.calendarStart.current?.setValue(addTime(Date.now(), -7, 'd').getTime())
    this.calendarEnd.current?.setValue(Date.now())
  }
  selectLastMonth() {
    this.calendarStart.current?.setValue(addTime(Date.now(), -1, 'M').getTime())
    this.calendarEnd.current?.setValue(Date.now())
  }
  onBeforeopen() {
    if (!this.firstPopup) {
      this.firstPopup = true
    }
    this.selectedDateStart = this.startValue
    this.selectedDateEnd = this.endValue
  }
  @debounced(50)
  emitChange() {
    this.emit('change', { value: this.value })
  }
  onClearStart(obj: Record<string, any>) {
    this.selectedDateStart = ''
    this.emit('clear', { value: ['', this.endValue] })
    this.onChangeMin({ value: '', target: obj.target })
  }
  onClearEnd(obj: Record<string, any>) {
    this.selectedDateEnd = ''
    this.emit('clear', { value: [this.startValue, ''] })
    this.onChangeMax({ value: '', target: obj.target })
  }
  onConfirm() {
    this.datePanel.close()
  }
  /** 交换 start / end 日期（纯交换，不跑 rangeCheck，避免 fit/clamp 把另一端改写到与 start 相同而丢失数据） */
  swapRange() {
    const sv = this.startValue
    const ev = this.endValue
    this.startValue = ev
    this.endValue = sv
    const sd = this.selectedDateStart
    const ed = this.selectedDateEnd
    this.selectedDateStart = ed
    this.selectedDateEnd = sd
    this.emitChange()
  }
  formatValue(dateOrDateTime: string) {
    return formatDate(dateOrDateTime, this.type == "date" ? this.pattern : (this.pattern + ' ' + this.patternTime));
  }
  changeStartValue() {
    // 统一走 rangeCheck 流程，替代原先硬编码的「结束 = 起始 + 1 天」
    this.watchStart()
    this.nextTick(() => this.__checkRange('start'))
  }
  changeEndValue() {
    this.watchEnd()
    this.nextTick(() => this.__checkRange('end'))
  }

  //////////////////////////////////// range 原语
  getStart() { return this.startValue }
  getEnd() { return this.endValue }
  setStart(v: string) {
    this.startValue = v
    // 同步日历面板选中态，否则面板与输入框显示不一致（面板只吃日期部分）
    if (!isBlank(v)) this.selectedDateStart = (v + '').split(' ')[0]
  }
  setEnd(v: string) {
    this.endValue = v
    if (!isBlank(v)) this.selectedDateEnd = (v + '').split(' ')[0]
  }
  /** 日期范围：空串视为空 */
  isRangeEmpty(v: any) { return isBlank(v) }
  compareRange(a: string, b: string) { return compareDate(a, b, this.dateUnit) }
  fitFromStart(start: string) {
    return formatDate(addTime(start, this.rangeGap || 0, this.dateUnit), this.rangePattern)
  }
  fitFromEnd(end: string) {
    return formatDate(addTime(end, -(this.rangeGap || 0), this.dateUnit), this.rangePattern)
  }
  clampToBounds(v: string) {
    if (isBlank(v)) return v
    if (!isBlank(this.min) && compareDate(v, this.min, this.dateUnit) < 0) return this.min as string
    if (!isBlank(this.max) && compareDate(v, this.max, this.dateUnit) > 0) return this.max as string
    return v
  }

  onChangeMin(obj: Record<string, any>) {
    super.onChangeMin(obj)
  }
  onChangeMax(obj: Record<string, any>) {
    super.onChangeMax(obj)
  }
  clear() {
    this.selectedDateStart = ''
    this.selectedDateEnd = ''
    this.__lastValidStart = this.__lastValidEnd = undefined
    this.__setRangeError(false)
    this.emit('clear', { value: ['', ''] })
  }
  onClose(obj: Record<string, any>) {
    let { trigger, from, isInStack } = obj
    if (!isInStack) {
      Overlay.closeAll()
    }
  }
}