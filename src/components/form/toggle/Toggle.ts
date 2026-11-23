import { classes, csscope, Csscope, emits, h, ifElse, ifTrue, prop, query, state, styles, tag, Template, watch } from "compelem";
import { isBoolean, isDefined } from "myfx";

import { FormControl } from "../FormControl";
import formStyle from "../style.scss?tmpl";
import style from "./style.scss?tmpl";
import { inReusedRow } from "../../../utils/row-reuse";
/**
 * 开关组件
 * @attrs
 *  activeText {string} 激活时的文本
 *  inactiveText {string} 未激活时的文本
 *  activeValue {string} 激活时的值，默认 'active'
 *  inactiveValue {string} 未激活时的值，默认 'inactive'
 *  value {string|boolean} 当值为字符串时匹配in/activeValue，受控属性 
 *  inset {boolean} 嵌入模式，默认true
 *  
 *  其他FormControl属性
 * @models
 *  value 默认绑定属性
 * @slots
 *  - 显示label内容
 *  active 激活时显示内容
 *  inactive 非激活时显示内容
 * @events
 *  change({value,checked}) value 与组件当前值同类型：布尔模式下是布尔，字符串模式下是 activeValue/inactiveValue
 *
 * @author holyhigh2
 */
@emits('change', 'update:value')
@tag("ce-toggle")
export class Toggle extends FormControl {
  //////////////////////////////////// props
  @prop activeText = ' ';
  @prop inactiveText = ' ';
  @prop activeValue = 'active';
  @prop inactiveValue = 'inactive';
  @prop inset = true;
  @prop({ type: [String, Boolean], model: true }) value: boolean | string = '';

  @state __innerValue: typeof this.value
  @state checked = false;

  round = 'pill'

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyle, style];
  }
  get renderEl() {
    return this.formContrl
  }
  @query('.ce-form-control')
  formContrl: HTMLElement
  @query('input')
  input: HTMLInputElement;
  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  function(nv: string | boolean) {
    this.__innerValue = nv
    if (isBoolean(nv)) {
      this.checked = nv;
    } else if (/(?:^true$)|(?:^false$)/.test(nv)) {
      this.checked = nv === 'true' ? true : false
    } else {
      this.checked = this.activeValue == nv ? true : false;
    }
    // input.checked 由 @watch('checked') 统一同步，此处不再重复写
    // 表格复用行 DOM 时的换主写入不播切换动画；其余写入（宿主回写、数据更新、
    // 表单赋值、用户点击）照常过渡。
    if (inReusedRow(this)) this.__settleTransitions()
  }

  /**
   * 把 `checked` 写进原生 input。
   *
   * 模板里的 `?checked` 落到 input 的 attribute 上，只改「默认选中态」；用户交互过
   * 一次后（dirty checkedness）attribute 不再影响 IDL 属性，所以状态必须显式同步，
   * 否则 `toggleCheck()`、外部写 `checked` 这类不经过 `value` 的路径画面不跟随。
   */
  @watch('checked')
  watchChecked(nv: boolean) {
    if (this.input) this.input.checked = nv
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    // 0.30 要求 render() 只有一个主视图 h`` 模板，根级三元会触发 "2 个主视图模板" 阻断
    return h`${ifElse(
      this.plaintext,
      () => h`${this.checked ? this.activeText : this.inactiveText}`,
      () => h`
      <label class="ce-form-toggle" ${classes({
      "is-disabled": this.disabled
    })}>
        <div class="ce-form-control" ${classes({ "is-inset": this.inset })} ${styles({
      width: '100%',
      overflow: 'visible'
    })}>
          <input type="checkbox" role="switch" aria-checked="${this.checked}" tabindex="0" ?disabled="${this.disabled}" ?checked="${this.checked}" @click.stop="${this.onClick}" @change="${this.onChange}"/>
          <div class="ce-form-toggle-track" ${classes({ "is-disabled": this.disabled, "is-rounded": this.round, "is-readonly": this.readonly })}>
            ${ifTrue(this.inset, () => h`
              <span class="is-active">
              ${this.activeText}
              <slot name="active"></slot>
            </span>
            <span class="is-inactive">${this.inactiveText}<slot name="inactive"></slot></span>  
            `)}
          </div>
          <div class="ce-form-toggle-thumb"></div>
        </div>
        
        <div class="ce-form-toggle-label"><slot></slot></div>
      </label>`)}`;
  }

  //////////////////////////////////// methods
  onClick(e: Event) {
    if (this.readonly)
      e.preventDefault();
  }
  onChange(e: Event) {
    this.__commit((e.target as HTMLInputElement).checked, e)
  }
  /**
   * 把原生 input 的选中态写回 `value` 并派发 `change`。
   *
   * 布尔模式下 `value` 就是布尔（与 `update:value` 同源），字符串模式下才换算成
   * `activeValue`/`inactiveValue` —— 两条通道必须给出同一个值，否则消费方按文档
   * 写 `el.value = argOf(e).value` 会把布尔开关切成字符串模式。
   */
  __commit(checked: boolean, event?: Event) {
    const next = isBoolean(this.__innerValue)
      ? checked
      : checked ? (this.activeValue || 'active') : (this.inactiveValue || 'inactive')
    if (this.__innerValue === next) return
    this.value = this.__innerValue = next as typeof this.value
    this.emit('change', { value: next, checked }, event)
  }
  toggleCheck(checked?: boolean) {
    if (this.disabled) return
    const next = isDefined(checked) ? checked! : !(this.input?.checked ?? this.checked)
    if (this.input) this.input.checked = next
    this.__commit(next)
  }

  //////////////////////////////////// 过渡抑制
  /** `__settleTransitions()` 的序号：连续写入时只处理最后一次。 */
  __settleSeq = 0
  /**
   * 把本轮换主写入引起的过渡直接推到终值。
   *
   * 轨道与滑块上的 `transition: all 0.2s` 是常驻声明，改值必然起过渡；
   * 表格虚拟行复用会在滚动中反复改值，放任它就是「开关来回闪」。
   * 等一帧让模板把新状态写进 DOM（此时过渡已在 `getAnimations()` 里），再
   * `finish()` 到终值 —— 只有一帧的位移偏差，肉眼不可见。
   */
  __settleTransitions() {
    const seq = ++this.__settleSeq
    requestAnimationFrame(() => {
      if (seq !== this.__settleSeq || this.isDestroyed) return
      const root = this.renderRoot
      if (!root) return
      const els = [root.querySelector('.ce-form-toggle-track'), root.querySelector('.ce-form-toggle-thumb')]
      for (const el of els) {
        if (!el) continue
        for (const a of el.getAnimations()) {
          if (!(a instanceof CSSTransition)) continue
          try { a.finish() } catch { /* 过渡可能已结束 */ }
        }
      }
    })
  }
}