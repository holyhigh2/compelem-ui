import { bind, classes, event, html, ifTrue, prop, query, state, tag, Template, watch } from "compelem";
import { formatNumber, isNaN, isNil, isNumber, merge, subtract, sum, toFixed } from "myfx";
import { ChevronDown, ChevronUp } from "../../../icons/icons";
import { FormControl } from "../FormControl";
import formStyle from "../style.scss";
import { Input } from "./Input";
import style from "./style.scss";
/**
 * 数字输入框
 * @attrs
 *  pattern {string} 格式化，失去焦点后展示
 *  step {number} 步长，默认1
 *  precision {number} 精度
 *  min {number} 最小值
 *  max {number} 最大值
 *  scrollable {boolean} 支持鼠标滚轮控制，默认true
 *  clearable {boolean} 支持清除，默认false
 *  control {boolean} 显示调节器，默认true
 * @slots
 *  leading
 *  trailing
 * @events
 *  focus
 *  blur
 *  input
 *
 * @author holyhigh2
 */
@tag("l-input-number")
export class InputNumber extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  #hook_wheel: any;
  @query('l-input')
  input: Input;

  __lastValue: string
  __formatValue: string
  //////////////////////////////////// props
  @prop step = 1;
  @prop({ type: Number }) precision: number;
  @prop({ type: Number }) min: number;
  @prop({ type: Number }) max: number;
  @prop clearable = false;
  @prop scrollable = true;
  @prop control = true;
  @prop inside = true;
  @prop pattern = '';

  @prop({ type: Number, sync: true })
  get value() {
    return parseFloat(this.__innerValue + '') || ''
  }
  //仅用于外部变更
  set value(v: any) {
    if (this.__innerValue == v) return;

    let num = parseFloat(v)
    this.__innerValue = isNaN(num) ? '' : num;
    if (isNil(v)) {
      this.__innerValue = '';
    }
    this.__lastValue = this.__innerValue + '';
    this.nextTick(() => {
      this.setValue(this.__innerValue);
      this.__innerValue = this.pattern ? this.__formatValue : this.__innerValue + '';
    })

    // this.emit('update:value', { value: this.__innerValue })
    // this.input.value = this.pattern ? this.__formatValue : this.__innerValue+'';
  }
  @state __innerValue: string | number = '';

  static get styles(): string[] {
    return [formStyle, style];
  }

  /////////////////////////////////// watches
  @watch('scrollable', { immediate: true, once: true })
  function(nv: any) {
    if (nv) {
      this.addEventListener('wheel', this.#hook_wheel)
    } else {
      this.removeEventListener('wheel', this.#hook_wheel)
    }
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();

    this.#hook_wheel = this.onWheel.bind(this)
  }

  render(): Template {
    return html`
      <l-input class="c-form-input-number ${classes({
      __disabled: this.disabled
    })}" 
      .clearable="${this.clearable}" inside="${this.inside}" @input="${this.onInput}" 
      ?readonly="${this.readonly}" ?disabled="${this.disabled}"
      .value="${this.__innerValue ?? ''}" ${bind(merge({
      appearance: this.appearance,
      color: this.color,
      size: this.size,
      round: this.round,
      loading: this.loading,
      label: this.label
    }, this.attrs))} @focus="${this.onFocus}" @blur="${this.onBlur}" @clear="${this.onClear}">
        <div slot="trailing" >
          ${ifTrue(this.control, () => html`
            <div class="--control">
              <l-icon .svg="${ChevronUp}" @click="${this.subtractStep}" ></l-icon>
              <l-icon .svg="${ChevronDown}" @click="${this.addStep}" ></l-icon>
            </div>  
          `)}
          <slot name="trailing"></slot>
        </div>
      </l-input>
    `;
  }

  //////////////////////////////////// methods
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

    this.__innerValue = value;
    this.emit('update:value', { value: this.__innerValue })
  }
  addStep() {
    if (this.readonly || this.disabled) {
      return;
    }
    this.onFocus()
    this.__innerValue = sum(this.__innerValue || 0, this.step);
    this.onBlur({ detail: { value: this.__innerValue } } as any)
    // this.input.value = this.__innerValue + '';
  }
  subtractStep() {
    if (this.readonly || this.disabled) {
      return;
    }
    this.onFocus()
    this.__innerValue = subtract(parseFloat(this.__innerValue + '') || 0, this.step);
    this.onBlur({ detail: { value: this.__innerValue } } as any)
    // this.input.value = this.__innerValue + '';
  }
  onInput(e: CustomEvent) {
    let value = e.detail.value

    value = value == '-' ? '-' : (isNaN(value) ? (isNil(this.__lastValue) ? '' : this.__lastValue) : (this.__lastValue = value));
    value = (value + '').replace(/^0+$/, '0').replace(/^0+([^0.])/, '$1').replace(/^0+\./, '0.')
    e.detail.event.target.value = value;
    // this.input.value = value;
    this.__innerValue = value;
    // this.value = value;
    this.emit('input', { value: this.__innerValue })
    if (value !== '-') {
      this.emit('update:value', { value: this.__innerValue })
    }

  }
  onClear() {
    this.__innerValue = this.__formatValue = '';
  }
  onBlur(e: CustomEvent) {
    let value = e.detail.value

    this.setValue(value);
    this.__innerValue = this.pattern ? this.__formatValue : this.__innerValue + '';
    // this.input.value = this.pattern ? this.__formatValue : this.__innerValue + '';

    this.emit('change', { value: this.__innerValue })
  }
  onFocus() {
    this.__innerValue = parseFloat((this.__innerValue + '').replace(/^[^0-9-]*/, '').replace(/(-)*/, '$1')) || 0;
  }
  onWheel(e: WheelEvent) {
    e.preventDefault();

    if (e.deltaY > 0) {
      this.__innerValue = sum(this.__innerValue || 0, this.step) + ''
    } else {
      this.__innerValue = subtract(parseFloat(this.__innerValue + '') || 0, this.step) + ''
    }
    // this.input.value = this.__innerValue + '';
  }
  @event('keydown', { target: function () { return this } })
  onKeyDown(e: KeyboardEvent) {
    let code = e.code
    switch (code) {
      case "ArrowDown":
        this.__innerValue = sum(this.__innerValue || 0, this.step) + ''
        break;
      case "ArrowUp":
        this.__innerValue = subtract(parseFloat(this.__innerValue + '') || 0, this.step) + ''
        break;
    }

  }
}