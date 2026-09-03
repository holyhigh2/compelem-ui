import { bind, csscope, Csscope, emits, h, ifTrue, prop, query, state, tag, Template, watch } from "compelem";
import { formatNumber, isBlank, isNaN, isNil, isNumber, isNumeric, merge, subtract, sum, toFixed } from "myfx";

import appearanceStyle from "../../../base/appearance.scss?tmpl";
import { ControlBox } from "../../../base/ControlBox";
import { ChevronDown, ChevronUp } from "../../../icons/icons";
import { IInputRange } from "../../../interfaces/IInputRange";
import { formStyleSheet } from "../styleSheets";
import { Input } from "./Input";
import { inputStyleSheet } from "./styleSheets";
/**
 * 数字输入框
 * @attrs
 *  value {string|number} 默认值
 *  pattern {string} 格式化，失去焦点后展示
 *  step {number} 步长，默认1
 *  precision {number} 精度
 *  min {number} 最小值
 *  max {number} 最大值
 *  scrollable {boolean} 支持鼠标滚轮控制，默认true
 *  clearable {boolean} 支持清除，默认false
 *  control {boolean} 显示调节器，默认true
 * @models
 *  value 默认绑定属性，input事件触发变更
 *  changeValue change事件绑定属性，change事件触发变更。如果绑定该属性，可通过value属性设置默认值
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
@emits('update:*', 'input', 'change', 'clear')
@tag("ce-input-number")
export class InputNumber extends ControlBox implements IInputRange {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  #hook_wheel: any;
  @query('ce-input')
  input!: Input;

  __lastValue: string
  __formatValue: string
  #focusValue: string
  //////////////////////////////////// props
  @prop step = 1;
  @prop({ type: Number }) precision: number;
  @prop({ type: Number }) min: number;
  @prop({ type: Number }) max: number;
  @prop scrollable = true;
  @prop control = false;
  @prop inside = true;
  @prop pattern = '';

  @prop({ type: Number, model: true }) value: number | undefined
  @prop({ type: [Number] }) changeValue: number | undefined
  @state __innerValue: string | number = '';

  @csscope(Csscope.GLOBAL)
  static get globalCss(): string {
    return appearanceStyle;
  }
  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet];
  }

  /////////////////////////////////// watches
  @watch('scrollable', { immediate: true, once: true })
  function(nv: any) {
    if (nv) {
      this.addEventListener('wheel', this.#hook_wheel, { passive: false })
    } else {
      this.removeEventListener('wheel', this.#hook_wheel)
    }
  }
  @watch(['min', 'max'], { immediate: true })
  watchMinMax() {
    this.nextTick(() => {
      this.setValue(this.__innerValue);
      this.__innerValue = this.pattern ? this.__formatValue : this.__innerValue + '';
    })
  }
  @watch('pattern')
  watchPattern(v: string) {
    if (v == 'undefined') {
      debugger
    }
  }
  @watch(['value', 'changeValue'])
  watchValue(nv: any) {
    if (isNil(nv)) {
      nv = ''
    }
    if (nv != this.__innerValue) {
      this.setValue(nv);
    }
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();

    this.#hook_wheel = this.onWheel.bind(this)
  }
  render(): Template {
    return h`
      <ce-input class="ce-input-number" part="input"
      border="${this.border}"
      .clearable="${this.clearable}" .required="${this.required}" .label="${this.label}" .placeholder="${this.placeholder}"
      inside="${this.inside}" 
      ?readonly="${this.readonly}" ?disabled="${this.disabled}" .error="${this.error}" .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}"
      .value="${this.__innerValue ?? ''}" ${bind(merge({
      appearance: this.appearance,
      space: this.space,
      color: this.color,
      size: this.size,
      round: this.round,
      loading: this.loading,
      label: this.label
    }, this.attrs))} @focus="${this.onFocus}" @input="${this.onInput}" @change="${this.onChange}" @blur="${this.onBlur}" @clear="${this.onClear}">
          ${ifTrue(this.control, () => h`
            <div class="ce-input-control" slot="append">
              <ce-icon .svg="${ChevronUp}" @click="${this.subtractStep}" ></ce-icon>
              <ce-icon .svg="${ChevronDown}" @click="${this.addStep}" ></ce-icon>
            </div>  
          `)}
          <slot name="append" slot="append"></slot>
      </ce-input>`;
  }
  connectedCallback(): void {
    super.connectedCallback()

    this.addEventListener('keydown', this.onKeyDown)
  }

  //////////////////////////////////// methods
  setSmallerValue(v: any): void {
    if (isBlank(this.value)) return
    if (v < this.__innerValue) {
      this.__innerValue = v - 1//这里可以换成step
    }
    if (parseFloat(this.__innerValue + '') < this.min) {
      this.__innerValue = this.min
    }
  }
  setBiggerValue(v: any): void {
    if (isBlank(this.__innerValue)) return
    if (v > this.__innerValue) {
      this.__innerValue = v + 1//这里可以换成step
    }
    if (parseFloat(this.__innerValue + '') > this.max) {
      this.__innerValue = this.max
    }
  }

  setValue(value: number | string) {
    if (isNumber(this.precision)) {
      value = toFixed(value, this.precision);
      value = parseFloat(value)
      value = isNaN(value) ? '' : value;
    }
    if (isNumber(this.min) && this.min > parseFloat(value + '')) {
      value = this.min;
    }
    if (isNumber(this.max) && this.max < parseFloat(value + '')) {
      value = this.max;
    }
    if (this.pattern) {
      this.__formatValue = formatNumber(value, this.pattern);
    }
    if (!isNumeric(value)) {
      value = parseFloat((this.__innerValue + '').replace(/^[^0-9-]*/, '').replace(/(-)*/, '$1')) || '';
    }

    this.__innerValue = value;
    this.emit('update:changeValue', { value: parseFloat(this.__innerValue + '') })
  }
  addStep() {
    if (this.readonly || this.disabled) {
      return;
    }
    this.onFocus()
    this.__innerValue = sum([this.__innerValue || 0, this.step]);
    this.onBlur({ value: this.__innerValue })
    // this.input.value = this.__innerValue + '';
  }
  subtractStep() {
    if (this.readonly || this.disabled) {
      return;
    }
    this.onFocus()
    this.__innerValue = subtract(parseFloat(this.__innerValue + '') || 0, this.step);
    this.onBlur({ value: this.__innerValue })
    // this.input.value = this.__innerValue + '';
  }
  onInput(obj: Record<string, any>) {
    let value = obj.value

    value = value == '-' ? '-' : (isNaN(value) ? (isNil(this.__lastValue) ? '' : this.__lastValue) : (this.__lastValue = value));
    value = (value + '').replace(/^0+$/, '0').replace(/^0+([^0.])/, '$1').replace(/^0+\./, '0.')
    obj.event.target.value = value;

    this.__innerValue = value;
    let numValue = parseFloat(this.__innerValue + '')
    this.emit('input', { value: numValue })

    this.value = numValue
  }
  onClear() {
    this.__innerValue = this.__formatValue = '';
    this.emit('clear', { value: '' })
  }
  onChange(obj: Record<string, any>) {
    this.onBlur(obj)
  }
  onBlur(obj: Record<string, any>) {
    let value = obj.value

    this.setValue(value);
    this.__innerValue = this.pattern ? this.__formatValue : this.__innerValue;

    if (this.__innerValue !== this.#focusValue)
      this.emit('change', { value: parseFloat(this.__innerValue + '') })
  }
  onFocus() {
    // 不能用 `|| ''` 兜底：0 是合法值但为 falsy，聚焦时会被误清空
    const v = parseFloat((this.__innerValue + '').replace(/^[^0-9-]*/, '').replace(/(-)*/, '$1'));
    this.__innerValue = Number.isNaN(v) ? '' : v;
    this.#focusValue = this.__innerValue + ''
  }
  onWheel(e: WheelEvent) {
    e.preventDefault();

    if (e.deltaY > 0) {
      this.__innerValue = sum([this.__innerValue || 0, this.step]) + ''
    } else {
      this.__innerValue = subtract(parseFloat(this.__innerValue + '') || 0, this.step) + ''
    }
    // this.input.value = this.__innerValue + '';
  }
  onKeyDown(e: KeyboardEvent) {
    let code = e.code
    switch (code) {
      case "ArrowDown":
        this.__innerValue = sum([this.__innerValue || 0, this.step]) + ''
        break;
      case "ArrowUp":
        this.__innerValue = subtract(parseFloat(this.__innerValue + '') || 0, this.step) + ''
        break;
    }
  }
  clear() {
    this.onClear()
  }
}