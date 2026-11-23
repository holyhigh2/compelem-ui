import { bind, csscope, Csscope, emits, h, ifTrue, prop, query, state, tag, Template, watch } from "compelem";
import { formatNumber, isBlank, isNil, isNumber, isNumeric, merge, subtract, sum, toFixed } from "myfx";

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
 *  min {number} 最小值，失焦时钳制
 *  max {number} 最大值，失焦时钳制
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
  #hook_wheel: any;
  @query('ce-input')
  input!: Input;

  __lastValue: string
  __formatValue: string
  #focusValue: string
  /** 是否已完成首次 value 回显（区分"挂载回显"与"用户改动"，见 watchValue） */
  #hydrated = false;
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
  static get globalCss() {
    return appearanceStyle;
  }
  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet];
  }

  /////////////////////////////////// watches
  // ⚠️ 原为 `{ immediate: true, once: true }`：once 之后 watch 不再触发，
  // 于是下面 else 分支（removeEventListener）永远不会执行，动态改 scrollable
  // 既挂不上也摘不掉（一次生效后再改永久无效）。去掉 once；addEventListener
  // 同 (type, listener) 幂等，重复执行不会叠加监听。
  @watch('scrollable', { immediate: true })
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
  }
  /**
   * 外部 `value` → 内部 `__innerValue` 的单向同步。
   *
   * ⚠️ **必须 `immediate: true`（2026-10-29）**：`__innerValue` 原本只由用户交互
   *   （`onInput` / `onBlur` / `addStep`）写入，从不从 `value` 初始化。而 `value`
   *   的典型来源是模板的 `.value="${...}"` property 绑定 —— 它在元素 **append 之前**
   *   就赋值完成，此时该 effect 尚未建立，这次赋值不算"变化"，`__innerValue` 停在
   *   `''`，**首次渲染永远是空框**（哪怕 `el.value` 与 `getAttribute('value')` 都对）。
   *   实测：append 之后再设 property 才正常；写成 attribute `value="40"` 同样为空。
   *
   *   首次触发是**挂载回显**、不是用户改动 ⇒ 走静默分支，不抛 `update:changeValue`。
   */
  @watch('value', { immediate: true })
  watchValue(nv: any) {
    this.__syncFromProp(nv)
  }
  /**
   * `changeValue` 只在没有 `value` 时作为值来源。
   *
   * 它是 change 的出口镜像：`undefined` 只表示"还没提交过"，不表示清空。
   * 与 `value` 合在一个 watch 里时，初始化阶段 `changeValue` 的空值会把刚回显的
   * 数值抹掉（`<ce-input-number value="0">` 显示空白），清空改由 `onClear` 负责。
   */
  @watch('changeValue')
  watchChangeValue(nv: any) {
    if (isNil(nv) || !isNil(this.value)) return
    this.__syncFromProp(nv)
  }
  private __syncFromProp(v: any) {
    const nv = isNil(v) ? '' : v
    const echo = !this.#hydrated;
    this.#hydrated = true;
    // ⚠️ 用**字符串化比较**，别用 `!=`：`0 != ''` 是 false（`0 == ''` 成立），
    //    于是 `value = 0` 时这段被直接跳过 ⇒ 输入框永远空白。而"从 0 起"恰恰是
    //    值轴下限、起始值最常见的填法（2026-10-30 在图表「值轴范围」踩到）。
    if (String(nv) !== String(this.__innerValue)) {
      this.setValue(nv, echo);
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
      border="${this.border}" align="${this.align}"
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
            <div class="ce-input-control" slot="append" @mousedown="${this.onControlClick}">
              <ce-icon .svg="${ChevronUp}"></ce-icon>
              <ce-icon .svg="${ChevronDown}"></ce-icon>
            </div>  
          `)}
          <slot name="append" slot="append"></slot>
      </ce-input>`;
  }
  connectedCallback(): void {
    super.connectedCallback()

    // 捕获相位：内层 ce-input 的 keydown 处理器会 stopPropagation，
    // 冒泡相位注册的监听永远收不到上下方向键
    this.addEventListener('keydown', this.onKeyDown, true)
  }

  //////////////////////////////////// methods
  /**
   * 从事件对象中解析输入值。兼容两种事件载荷形态：
   *  - 常规（compelem 内部通道）：obj.value
   *  - emit-native（组件派发原生 CustomEvent，arg 放在 detail 上）：obj.detail.value
   * 两者皆缺失时回落到真实 <input> 的当前值，确保非数字输入在任何配置下都能被正确读取与清除。
   */
  private __resolveValue(obj: Record<string, any>): string {
    if (obj == null) return this.input?.input?.value ?? '';
    let v = obj?.detail?.value;
    if (v == null) v = obj?.value;
    if (v == null) v = this.input?.input?.value ?? '';
    return v == null ? '' : String(v);
  }
  /**
   * 显示值 → 对外数值。解析不出数字时给 `undefined`（空值的唯一对外表示）。
   * 不能给 NaN：`NaN !== NaN` 会让宿主的变更检测永远认为"变了"，
   * 也会顺着 sum / 加减污染整条计算链，JSON 序列化时还会静默变 null。
   */
  private __toNumber(v: number | string): number | undefined {
    const n = parseFloat(v + '');
    return Number.isNaN(n) ? undefined : n;
  }
  /**
   * 取输入中的首个合法数字前缀：`123123-25` → `123123`，`12.5.6` → `12.5`。
   * 用于把非法输入裁剪成有效数字（纯符号/空串返回 ''）。
   */
  private __extractNumber(v: number | string): string {
    const s = (String(v ?? '').trim().match(/-?\d*\.?\d*/)?.[0]) ?? '';
    return s === '' || s === '-' || s === '.' || s === '-.' ? '' : s;
  }
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

  /**
   * 写入内部显示值并（默认）向外同步 `update:changeValue`。
   *
   * @param silent 静默模式：只更新显示、不抛 `update:changeValue`。
   *   供 `watchValue` 的挂载回显使用（见那里的注释）—— 回显不是用户改动，
   *   往外抛会让宿主的 model 绑定在元素刚挂载时被回写一次。
   */
  setValue(value: number | string, silent = false) {
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
    // ⚠️ `isNumeric(0)` 是 **false**（它按字符串校验"看起来像不像数"），数字 0
    //    会掉进下面的"回退到上一次值"分支 ⇒ 值 0 永远显示空白。
    //    而"从 0 起"恰恰是最常见的下限 / 起点。先按 `isNumber` 归一成字符串再判。
    //    （2026-10-30 实测：`el.value = 0` ⇒ prop 是 0、`__innerValue` 是 ''、输入框空。）
    const probe = isNumber(value) ? String(value) : value;
    if (!isNumeric(probe)) {
      value = parseFloat((this.__innerValue + '').replace(/^[^0-9-]*/, '').replace(/(-)*/, '$1')) || '';
    }

    this.__innerValue = value;
    const num = this.__toNumber(this.__innerValue)
    // 夹取 / 精度处理后的值才是有效值：回写 `value`，否则 model 停在越界输入上
    // （键入 123123 失焦后显示 10，但 `el.value` 仍是 123123）
    if (num !== undefined && String(num) !== String(this.value)) this.value = num
    if (!silent) this.emit('update:changeValue', { value: num })
  }
  /**
   * 单次步进：按 `step` 增减并完成整条提交链（夹取 → 显示值 → `value` / model → input / change）。
   * 增减按钮、滚轮、上下方向键共用本入口，三者对外表现一致。
   *
   * @param dir 1 增大，-1 减小
   */
  private __step(dir: 1 | -1): void {
    if (this.readonly || this.disabled) return
    // 显示值可能带 pattern 格式或残留非法片段，先归一成可运算的数字
    this.onFocus()
    const before = this.__toNumber(this.__innerValue)
    const base = before ?? 0
    const next = dir > 0 ? sum([base, this.step]) : subtract(base, this.step)
    // setValue 负责夹取 min/max、套 precision，并发 update:changeValue
    this.setValue(next)
    const num = this.__toNumber(this.__innerValue)
    if (num !== before) {
      // value / model 的回写由 setValue 统一负责，这里只补对外事件
      this.emit('input', { value: num })
      this.emit('change', { value: num })
    }
    if (this.pattern) this.__innerValue = this.__formatValue
    // 直接写回真实输入框：按下按钮会让输入框失焦，随后的 blur 提交按 DOM 现值取值，
    // 若这里只改 state，DOM 还停留旧值，刚步进的结果会被失焦提交回滚
    const el = this.input?.input
    if (el && el.value !== this.__innerValue + '') el.value = this.__innerValue + ''
    // 步进已提交，随后失焦不再重复发 change
    this.#focusValue = this.__innerValue + ''
  }
  /**
   * 增减按钮的统一入口：整个 `.ce-input-control` 可按下，按按下位置判定方向。
   * 用 `mousedown` 而非 `click`：两只图标各只有约 17px 高，按下与抬起分别落在
   * 两只图标上时 click 的目标是容器本身，绑在图标上的处理器收不到；
   * 抬起落在容器外时 click 的目标还会是更外层元素。
   */
  onControlClick(e: MouseEvent): void {
    if (this.readonly || this.disabled || e.button !== 0) return
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target]
    const box = path.find((n: any) => n?.classList?.contains('ce-input-control')) as HTMLElement | undefined
    const rect = box?.getBoundingClientRect()
    if (!rect || !rect.height) {
      // 拿不到几何时按图标顺序推断（第一只图标为上）
      this.__step(e.target === box?.firstElementChild ? 1 : -1)
      return
    }
    this.__step(e.clientY - rect.top < rect.height / 2 ? 1 : -1)
  }
  addStep() {
    this.__step(1)
  }
  subtractStep() {
    this.__step(-1)
  }
  /**
   * 输入阶段只做透传，不做任何裁剪 / 夹取 / 回写。
   *
   * 输入法组合期间改写原生控件的 value 会打断组合、清掉候选串；夹取 min/max
   * 也会让用户输不到中间态（想输 15，先输 1 就被改成 10）。因此：
   * 原文原样写进 `__innerValue`（与 DOM 保持一致，不触发回写），
   * 约束统一放到 `onBlur`；`value` / model 同样只在提交时更新，
   * 否则父级回写会把尚未输完的文本覆盖掉。
   */
  onInput(obj: Record<string, any>) {
    // 无原生事件：内层 ce-input 清空后补发的 input。清空由 onClear 统一处理
    if (!obj.event) return

    const raw = this.__resolveValue(obj)
    this.__innerValue = raw
    const numValue = this.__toNumber(raw)
    // 记下最后一次可解析值，供失焦时"纯非法内容"的回退
    if (numValue !== undefined) this.__lastValue = String(numValue)
    this.emit('input', { value: numValue })
  }
  onClear() {
    this.__innerValue = this.__formatValue = this.__lastValue = '';
    // 清空是「无值」而非「非法输入」：不能走 setValue —— 那条路径会把解析不出
    // 数字的值回退成上一次显示值，清空刚写进去就被自己吃回去。
    this.value = undefined;
    this.emit('update:changeValue', { value: undefined });
    // 顺序 update:value → update:changeValue → input → clear，与 ce-input 的清空链路一致：
    // 只监听 input 的消费方（过滤器、联动计算）才不会停在旧数字上。
    this.emit('input', { value: undefined });
    this.emit('clear', { value: undefined });
  }
  onChange(obj: Record<string, any>) {
    this.onBlur(obj)
  }
  onBlur(obj: Record<string, any>) {
    const raw = this.__resolveValue(obj)
    // 失焦是唯一的约束点：裁出首个合法数字前缀（`123123-25` → `123123`），
    // 纯非法内容（如 'abc'）回退上一次合法值，主动删空则保持为空
    let value = this.__extractNumber(raw)
    if (value === '' && raw.trim() !== '' && !isNil(this.__lastValue)) value = this.__lastValue
    // 前导零归一（007 → 7、0.5 保留小数位）属于格式化，和裁剪一样在提交时做
    if (value) value = value.replace(/^0+$/, '0').replace(/^0+([^0.])/, '$1').replace(/^0+\./, '0.')

    const empty = value === ''
    this.setValue(value)
    // 清空必须显式回写 model：setValue 只在能解析出数字时才写 value
    if (empty && !isNil(this.value)) this.value = undefined
    if (this.pattern) this.__innerValue = this.__formatValue
    // 显示镜像落回原生控件：输入阶段不再改写 DOM，约束结果必须在这里兑现
    const el = this.input?.input
    const shown = this.__innerValue + ''
    if (el && el.value !== shown) el.value = shown

    if (this.__innerValue !== this.#focusValue)
      this.emit('change', { value: this.__toNumber(this.__innerValue) })
  }
  onFocus() {
    // 不能用 `|| ''` 兜底：0 是合法值但为 falsy，聚焦时会被误清空
    const v = parseFloat((this.__innerValue + '').replace(/^[^0-9-]*/, '').replace(/(-)*/, '$1'));
    this.__innerValue = Number.isNaN(v) ? '' : v;
    this.#focusValue = this.__innerValue + ''
  }
  onWheel(e: WheelEvent) {
    e.preventDefault();
    this.__step(e.deltaY > 0 ? 1 : -1)
  }
  onKeyDown(e: KeyboardEvent) {
    // 输入法组合期上下键用于选词：此时步进会打断候选选择
    if (e.isComposing) return
    switch (e.code) {
      case "ArrowDown":
        this.__step(-1)
        break;
      case "ArrowUp":
        this.__step(1)
        break;
    }
  }
  clear() {
    this.onClear()
  }
}