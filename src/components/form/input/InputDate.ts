import { bind, computed, createRef, csscope, Csscope, emits, h, ifTrue, model, prop, query, show, state, tag, Template, watch } from "compelem";
import { addTime, compareDate, formatDate, isBlank, isEmpty, merge, padZ, range } from "myfx";

import appearanceStyle from "../../../base/appearance.scss?tmpl";
import { ControlBox } from "../../../base/ControlBox";
import { Calendar } from "../../../icons/icons";
import { IInputRange } from "../../../interfaces/IInputRange";
import { Overlay } from "../../overlays/overlay/Overlay";
import { formStyleSheet } from "../styleSheets";
import { Input } from "./Input";
import { inputStyleSheet } from "./styleSheets";
enum DateInputType {
  Date = 'date',
  DateTime = 'datetime',
  Year = 'year',
  Month = 'month',
  Week = 'week'
}
/**
 * 日期输入框
 * @attrs
 *  type {string} year/month/date/datetime，默认date
 *  min {string} 最小值
 *  max {string} 最大值
 *  clearable {boolean} 支持清除，默认false
 *  pattern {string} 日期显示格式，默认yyyy/MM/dd
 *  hide-seconds {boolean} 当type是datetime是，是否隐藏秒设置，默认false
 *  value {string} 日期值，受控
 *  noIcon {boolean} 是否隐藏图标
 * @models
 *  value 默认绑定属性，input事件触发变更
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
@emits('update:value', 'focus', 'clear', 'change')
@tag("ce-input-date")
export class InputDate extends ControlBox implements IInputRange {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  @query('ce-input')
  input: Input;

  __lastValue: string
  //////////////////////////////////// props
  @prop type = 'date';
  @prop({ type: String }) min: string;
  @prop({ type: String }) max: string;
  @prop inside = true;
  @prop pattern = 'yyyy/MM/dd'
  @prop triggerMode = 'click'
  @prop noIcon = false
  @prop hideSeconds = false;

  @prop({ type: String, model: true }) value = ''

  @state __innerValue: string = '';
  @state inputMask = ''
  @state inputBlocks = ''
  @state firstPopup = false
  @state selectedDate = ''
  @state selectedTime = ''

  minList = range(60).map(v => padZ(v, 2));
  hourList = range(24).map(v => padZ(v, 2));

  datePane = createRef<HTMLElement>()
  @query('.ce-input-date-panel') datePanel: Overlay

  @csscope(Csscope.GLOBAL)
  static get globalCss(): string {
    return appearanceStyle;
  }
  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet];
  }

  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  watchValue(nv: string) {
    let v = nv ?? ''
    // 仅 datetime 类型需要带时间；其余类型（date/year/month/week）只用 pattern，
    // 否则选中日期后会因时间 pattern 被追加 " 00:00:00"，与纯日期面板格式不一致
    const fmt = this.type === DateInputType.DateTime
      ? this.pattern + ' ' + (this.hideSeconds ? 'HH:mm' : 'HH:mm:ss')
      : this.pattern
    this.__innerValue = formatDate(v, fmt)

    if (this.type === DateInputType.DateTime) {
      this.selectedTime = formatDate(v, (this.hideSeconds ? 'HH:mm' : 'HH:mm:ss'))
    }
  }
  @watch('type', { immediate: true })
  watchType(nv: string) {
    switch (nv) {
      case DateInputType.Date:
        this.inputMask = '0000/00/00'
        this.inputBlocks = '{1970,2100},{1,12},{1,31}'
        break;
      case DateInputType.DateTime:
        this.inputMask = '0000/00/00 00:00' + (this.hideSeconds ? '' : ':00')
        this.inputBlocks = '{1970,2100},{1,12},{1,31},{0,23},{0,59}' + (this.hideSeconds ? '' : ',{0,59}')
        break;
      case DateInputType.Year:
        this.inputMask = '0000'
        this.inputBlocks = '{1970,2100}'
        break;
      case DateInputType.Month:
        this.inputMask = '0000/00'
        this.inputBlocks = '{1970,2100},{1,12}'
        break;
      case DateInputType.Week:
        this.inputMask = ''
        break;
    }
  }
  @watch('selectedTime')
  watchHM(nv: string) {
    this.__setValue()
  }
  @watch(['min', 'max'], { immediate: true })
  watchMinMax() {
    this.nextTick(() => {
      if (compareDate(this.min, this.__innerValue) > 0) {
        this.__innerValue = this.min
      }
      if (compareDate(this.max, this.__innerValue) < 0) {
        this.__innerValue = this.max
      }
    })
  }

  @computed
  get timePattern() {
    return this.hideSeconds ? 'HH:mm' : 'HH:mm:ss'
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
      <ce-input-mask border="${this.border}" class="ce-input-date" part="input" .mask="${this.inputMask}" .blocks="${this.inputBlocks}" placeholder-char="-" 
      .clearable="${this.clearable}" .required="${this.required}" .label="${this.label}" .placeholder="${this.placeholder}"
      inside="${this.inside}"
      ?readonly="${this.readonly}" ?disabled="${this.disabled}"  .error="${this.error}" 
      @focus="${this.onFocus}" @blur="${this.onBlur}" @clear="${this.onClear}" 
      .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}"
      .value="${this.__innerValue}" ${bind(merge({
      appearance: this.appearance,
      space: this.space,
      color: this.color,
      size: this.size,
      round: this.round,
      loading: this.loading,
      label: this.label
    }, this.attrs))} >
        <div slot="append" >
          ${ifTrue(isEmpty(this.slots.append) && !this.noIcon, () => h`<ce-icon class="ce-input-calendar" ${show(!this.clearable || (!this.value))} .svg="${Calendar}" @click="${this.openDatePanel}"></ce-icon>`)}
          <slot name="append"></slot>
        </div>
      </ce-input-mask>
      
      <ce-overlay placement="bottom-end" auto-active close-on-click opacity="0.25" class="ce-input-date-panel" @close="${this.onClose}">
        <div>
          ${ifTrue(this.firstPopup, () => h`
          <ce-card class="ce-input-time-card" style="padding: var(--ce-spacing-sm);" ref="${this.datePane}" >
              <div style="display: flex;position: relative;column-gap: 1rem;height: 100%;">
                <ce-date-picker @change="${this.onChange}" .min="${this.min}" .max="${this.max}" pattern="yyyy/MM/dd" month-unit="月" ${model(this.selectedDate)}>
                  ${ifTrue(this.type === 'datetime', () => h`
                    <ce-input-time slot="header" hide-seconds="${this.hideSeconds}" ${model(this.selectedTime)}></ce-input-time>  
                  `)}
                </ce-date-picker>
              </div>
              ${ifTrue(this.type == DateInputType.DateTime, () => h`
                <ce-divider></ce-divider>
                <footer slot="actions" style="padding-top:.25rem;gap: 1rem;display: flex;justify-content: flex-end;align-items: center;">
                  <ce-button appearance="subtle" @click="${this.selectNow}">此刻</ce-button>
                  <ce-button appearance="outlined" color="info" @click="${this.closePanel}">确定</ce-button>
                </footer>
              `)}
            </ce-card>
        `)}
        </div>
      </ce-overlay>
    `;
  }

  //////////////////////////////////// methods
  selectNow() {
    let date = new Date()
    this.selectedDate = formatDate(date, this.pattern)
    this.selectedTime = formatDate(date, this.timePattern)
  }
  setSmallerValue(v: any): void {
    if (isBlank(this.value)) return

    let type = 'd'
    switch (this.type) {
      case DateInputType.Date:
        break;
      case DateInputType.DateTime:
        type = 'm'
        break;
      case DateInputType.Year:
        type = 'y'
        break;
      case DateInputType.Month:
        type = 'M'
        break;
      case DateInputType.Week:
        break;
    }
    this.nextTick(() => {
      if (this.value && compareDate(this.value, v, type) > 0) {
        this.value = formatDate(addTime(v, -1, 'd'), this.type == DateInputType.Date ? this.pattern : (this.pattern + ' ' + this.timePattern))
        if (compareDate(this.value, this.min, type) < 0) {
          this.value = this.min
        }
        let pair = this.value.split(' ')
        this.selectedDate = pair[0]
        if (this.type === DateInputType.DateTime) {
          pair = pair[1].split(':')
          // this.selectedHour = pair[0]
          // this.selectedMin = pair[1]
        }
      }
    })
  }
  setBiggerValue(v: any): void {
    if (isBlank(this.value)) return

    let type = 'd'
    switch (this.type) {
      case DateInputType.Date:
        break;
      case DateInputType.DateTime:
        type = 'm'
        break;
      case DateInputType.Year:
        type = 'y'
        break;
      case DateInputType.Month:
        type = 'M'
        break;
      case DateInputType.Week:
        break;
    }
    this.nextTick(() => {
      if (compareDate(v, this.value, type) > 0) {
        this.value = formatDate(addTime(v, 1, 'd'), this.type == DateInputType.Date ? this.pattern : (this.pattern + ' ' + this.timePattern))
        if (compareDate(this.value, this.max, type) > 0) {
          this.value = this.max
        }
        let pair = this.value.split(' ')
        this.selectedDate = pair[0]
        if (this.type === DateInputType.DateTime) {
          pair = pair[1].split(':')
          this.selectedTime = pair[1]
        }
      }
    })
  }
  onChange(obj: Record<string, any>) {
    let { value } = obj

    this.selectedDate = value

    this.__setValue()
    if (this.type === DateInputType.Date) {
      this.datePanel.close()
    }
  }
  __setValue() {
    if (isBlank(this.selectedDate)) {
      this.selectedDate = formatDate(new Date(), this.pattern)
    }
    switch (this.type) {
      case DateInputType.Date:
        this.__innerValue = formatDate(this.selectedDate, this.pattern)
        break;
      case DateInputType.DateTime:
        this.__innerValue = formatDate(this.selectedDate + ' ' + this.selectedTime, this.pattern + ' ' + this.timePattern)
        break;
      case DateInputType.Year:
        break;
      case DateInputType.Month:
        break;
      case DateInputType.Week:
        break;
    }

    this.emit('change', { value: this.__innerValue })
    this.emit('update:value', { value: this.__innerValue })
  }
  openDatePanel() {
    this.firstPopup = true
    if (!isBlank(this.__innerValue) && compareDate(this.selectedDate, this.__innerValue) != 0) {
      this.selectedDate = this.selectedDate = formatDate(this.__innerValue, this.pattern)
    }
    let inputValue = formatDate(this.__innerValue, this.timePattern)
    if (!isBlank(this.__innerValue) && this.type === 'datetime' && inputValue !== formatDate(this.selectedTime, this.timePattern)) {
      this.selectedTime = inputValue
    }
    this.nextTick(() => {
      this.datePanel.openBy(this)
    })
  }
  onClear() {
    this.__innerValue = '';
    this.emit('clear', { value: '' })
  }
  onBlur(obj: Record<string, any>) {
    let value = obj.value
    this.__innerValue = value
    this.emit('change', { value })
    this.emit('update:value', { value })
  }
  onFocus() {
    // triggerMode 为 none 时不弹自己的面板。
    // ce-input-date-range 内部的 ce-input-date 带 trigger-mode="none"：
    // 它是 readonly 但仍可聚焦，若不判断就会在范围面板之外再叠一层单日期面板
    // if (this.triggerMode !== 'none') {
    //   this.openDatePanel()
    // }
    this.emit('focus')
  }
  clear() {
    this.__innerValue = this.selectedDate = this.selectedTime = ''
  }
  onClose() {

  }
  closePanel() {
    this.datePanel.close()
  }
}