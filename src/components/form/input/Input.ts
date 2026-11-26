import { bind, classes, createRef, css, csscope, Csscope, emits, h, ifElse, ifTrue, prop, query, QueryCache, show, state, tag, Template, watch } from "compelem";
import { isBlank, isNil } from "myfx";

import { Close, EyeClosed, EyeOpened } from "../../../icons/icons";
import { formStyleSheet } from "../styleSheets";
import { BaseInput } from "./BaseInput";
import style from "./input.scss?tmpl";
/**
 * 单行输入框，内容包括
 * 前缀 控制区 后缀
 *      消息
 * @attrs
 *  value {string|number} 默认值
 *  showPassword {boolean} 密码框并显示可见性切换图标（点击切换明文/密文），默认false
 *  autoselect {boolean} 获得焦点时自动选中文本，默认false
 *  clearable {boolean} 显示清除按钮，默认false
 *  inside {boolean} 前后插槽是否抱在控制区内，默认false
 *  type {string} 输入框原生类型，默认text
 *  label {string} 显示输入标签
 *  required {boolean} 当label属性不为空时显示星号
 *  placeholder {string} 占位符
 *  rows {number} 多行模式的行数，默认 2（仅 `type="textarea"` 生效）
 *  resize {string} 多行模式的可拖拽方向：none（默认）/ vertical / horizontal / both（仅 `type="textarea"` 生效）
 *  active {boolean} 是否激活状态，激活状态会应用focus相同样式，通常用在嵌套组件中
 *  error {boolean} 错误状态，会应用错误样式
 *  errorMessage {string} 错误信息，错误状态时显示的信息，如果为空则显示hint
 *  hint {string} 提示信息
 *  hideHint {boolean} 隐藏提示框，默认false
 *  maxlength {string|number} 最大输入字符数
 *  minlength {string|number} 最小输入字符数
 *  autocomplete {string} 原生 autocomplete 属性，默认 off
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
 * @parts
 *  input 输入元素
 *  control formControl元素
 *  close 关闭图标
 *
 * @author holyhigh2
 */
@emits('update:*', 'focus', 'blur', 'input', 'change', 'clear', 'keyup', 'keydown')
@tag("ce-input")
export class Input extends BaseInput {
  inputRef = createRef<HTMLInputElement | HTMLTextAreaElement>()
  //////////////////////////////////// props
  hoverable = true
  rounded = true
  @prop showPassword = false;
  @prop inside = false;
  @prop autoselect = false;
  @prop active = false
  @prop type = 'text'
  @prop autocomplete = 'off'
  /**
   * 拼写检查开关。浏览器默认开启，英文输入会出现红色波浪线；
   * 编辑器类输入框（如 AI 对话、代码/JSON 输入）应显式关闭。
   * 单行与多行（type="textarea"）分支都会透传到原生元素。
   */
  @prop spellcheck = false
  /**
   * 多行模式的行数。仅在 `type="textarea"` 时生效。
   *
   * 为什么用 `type` 而不是新增 `multiline` 开关：`type` 本来就透传给原生输入元素，
   * 而 `textarea` 不是合法的 input type —— 它既不会与现有 type 取值冲突，
   * 又能让使用方用「同一个组件、同一个 slot 结构」切换单行/多行。
   */
  @prop({ type: Number }) rows = 2
  /**
   * 多行模式的可拖拽方向，仅在 `type="textarea"` 时生效。
   *
   * 默认 `none`：高度由 `rows` 与 `--ce-input-textarea-max-height` 决定，避免拖拽破坏
   * inside 插槽的对齐。需要拖高的场景显式传 `vertical`。
   */
  @prop({ type: String }) resize: 'none' | 'vertical' | 'horizontal' | 'both' = 'none'
  @prop({ type: [String, Number], model: true }) value = ''
  @prop({ type: [String, Number] }) changeValue = ''

  @state __innerValue: string = this.value;
  @state hasLeft = false;
  @state hasRight = false;
  /** 密码可见性：仅在 showPassword 为 true 时由眼睛图标切换 */
  @state __passwordVisible = false;

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, style];
  }

  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
      ce-input:focus-within {
        outline: none;
        border-color: rgb(var(--form-item-color));
      }
      ce-input[active],
      ce-input:not([disabled], ce-input:focus-within):hover{
        border-color: rgb(var(--form-item-color));
      }
      ce-input[appearance="underlined"]::after {
        content: "";
        border-bottom: 1px solid rgb(var(--form-item-color));
        position: absolute;
        width: 0%;
        left: 50%;
        bottom: 0;
        transition:all .2s;
      }
      /* 蓝色下划线「从中间向两侧展开」的触发源。
         focus-within 覆盖普通输入框；[active] 覆盖 ce-select 这类不产生焦点的场景
         （hide-input 模式下内部 input display:none，点开下拉不会有 focus）。
         两条共用一个 ::after 与同一条 transition，不要另写一套动画。 */
      ce-input[appearance="underlined"]:focus-within::after,
      ce-input[appearance="underlined"][active]::after{
        width: 100%;
        left: 0%;
      }
    `
  }

  get renderEl() {
    return this.controlEl
  }

  /** 多行模式：用 `type="textarea"` 切换成原生 textarea，其余结构（inside/slot/clearable）不变 */
  get multiline(): boolean {
    return this.type === 'textarea'
  }

  /** 多行 textarea 的内联 style：文本对齐与 resize 合成一条，避免后写的覆盖前一个 */
  get __multilineStyle(): string {
    return [this.align ? `text-align:${this.align}` : '', `resize:${this.resize}`].filter(Boolean).join(';')
  }

  @query('.ce-input-floating')
  floatingBox: HTMLElement;
  @query('.ce-input-append')
  trailingBox: HTMLElement;
  @query('.ce-control', QueryCache.ONCE)
  controlEl: HTMLElement
  @query('input')
  input!: HTMLInputElement
  @query('.ce-message')
  msgEl!: HTMLElement

  /////////////////////////////////// watches
  @watch(['value', 'changeValue'])
  watchValue(nv: any) {
    if (isNil(nv)) {
      nv = ''
    }
    if (nv != this.__innerValue) {
      this.__innerValue = nv
    }
  }
  @watch('appearance')
  watchAppearance(nv: string) {
    this.bordered = nv == 'underlined' ? false : true
  }
  @watch(['hideHint', 'errorMessage'], { immediate: true })
  watchMessage(nv: any) {
    if (!this.hideHint && !isBlank(this.errorMessage)) {
      this.nextTick(() => {
        this.style.marginBottom = this.msgEl.offsetHeight + 'px'
      })
    } else {
      // 不能写死 `margin-bottom: 0px`：这是**内联样式**，会压过外部布局类
      //   （Tailwind `space-y-4` 下发的是 margin-block-end），
      //   症状是多个输入框上下紧贴、完全没有间距。
      //   没有提示信息时直接移除内联声明，把间距交还给外部 / `:host(ce-input[hint])`。
      this.style.removeProperty('margin-bottom')
    }
  }
  //////////////////////////////////// lifecycles
  beforeMount(): void {

  }
  mounted(): void {
    // 原生控件（textarea 尤其）的 value 属性只在初次解析时生效（后续 setAttribute 不再改内容），
    // 所以首帧必须命令式灌一次初值。
    this.syncInputValue()
  }
  @watch('__innerValue')
  onInnerValueChanged(): void {
    this.syncInputValue()
  }
  /**
   * 把 `__innerValue` 写回原生控件（property，不是 attribute）。
   *
   * 用户键入过的控件带 dirty 标记，attribute 不再生效 —— 只改 state 时屏幕会停在旧文本
   * （数字框失焦夹取、外部赋 `value`、清空都受影响）。
   *
   * 只在值真的不同时赋值：相同赋值会把光标顶到末尾 —— 用户打字时（输入只 emit、
   * 不回写 state）不会走到这里，但外部 setValue / 清空会，保护一下成本为零。
   */
  syncInputValue(): void {
    const el = this.inputRef.current as HTMLInputElement | HTMLTextAreaElement | null
    const v = String(this.__innerValue ?? '')
    if (el && el.value !== v) el.value = v
  }
  render(): Template {
    return h`
      <div class="ce-input" ${classes({
      "ce-input-error": this.error
    })}>
      ${ifTrue(!this.inside, () => h`
        <span class="ce-input-prepend">
          <slot name="prepend" @slotchange="${this.onPrependChange}"></slot>
        </span>
      `)}
        
        <div part="control" class="ce-form-control" ?activated="${this.active}" ?disabled="${this.disabled}">
          ${ifTrue(this.inside, () => h`
            <span class="ce-input-prepend-inside"><slot name="prepend" @slotchange="${this.onPrependChange}"></slot></span>
          `)}
          
          ${ifTrue(!isBlank(this.label), () => h`
          <label class="ce-input-label" ${classes({ "is-empty": !!this.__innerValue })}>
            <b style="color:red;vertical-align:middle;margin-right: 3px;" ${show(this.required)}>*</b>${this.label}
          </label>
          `)}
          ${ifElse(
            this.multiline,
            () => h`
            <textarea part="input" class="ce-input-textarea"
            ${classes({ "is-round-left": !this.hasLeft, "is-round-right": !this.hasRight })}
            ${bind(this.ariaAttrs)}
            ref="${this.inputRef}" rows="${this.rows}"
            placeholder="${this.placeholder}"
            spellcheck="${this.spellcheck}"
            style="${this.__multilineStyle}"
            @input="${this.onInput}" @change="${this.onChange}" @focus="${this.onFocus}" @blur="${this.onBlur}"
            @keyup="${this.onKeyup}" @keydown="${this.onKeydown}"
            ?readonly="${this.readonly}" ?disabled="${this.disabled}" maxlength="${this.__maxlengthAttr}" minlength="${this.__minlengthAttr}"></textarea>`,
            () => h`
            <input part="input" autocomplete="${this.autocomplete}" spellcheck="${this.spellcheck}"
            ${classes({ "is-round-left": !this.hasLeft, "is-round-right": !this.hasRight })}
            ${bind(this.ariaAttrs)}
            ref="${this.inputRef}" value="${this.__innerValue}"
            placeholder="${this.placeholder}"
            style="${this.align ? 'text-align:' + this.align : ''}"
            type="${this.showPassword ? (this.__passwordVisible ? 'text' : 'password') : this.type}" 
            @input="${this.onInput}"  @change="${this.onChange}" @focus="${this.onFocus}" @blur="${this.onBlur}" 
            @keyup="${this.onKeyup}" @keydown="${this.onKeydown}"
            ?readonly="${this.readonly}" ?disabled="${this.disabled}" maxlength="${this.__maxlengthAttr}" minlength="${this.__minlengthAttr}"/>`
          )}
          ${ifTrue(this.showPassword, () => h`
            <span part="password" class="ce-input-eye" @mousedown.prevent>
              <ce-icon .svg="${this.__passwordVisible ? EyeOpened : EyeClosed}" @click.prevent="${this.togglePassword}"></ce-icon>
            </span>
          `)}
          ${ifTrue(this.clearable, () => h`
            <span part="close" class="ce-input-floating" ${classes({ "is-not-empty": !!this.__innerValue })}>
              <ce-icon class="ce-input-close" .svg="${Close}" @mousedown.stop @click.prevent="${this.onClear}"></ce-icon>
            </span>
          `)}
          ${ifTrue(this.inside, () => h`
            <span class="ce-input-append-inside"><slot name="append" @slotchange="${this.onAppendChange}"></slot></span>
          `)}
        </div>
        ${ifTrue(!this.inside, () => h`
            <span class="ce-input-append"><slot name="append" @slotchange="${this.onAppendChange}"></slot></span>
          `)}
        <div class="ce-message" ${show(!this.hideHint && !isBlank(this.errorMessage))}>
          ${this.error ? (this.errorMessage ?? this.hint) : this.hint}
        </div>
      </div>
  `;
  }
  //////////////////////////////////// methods
  setValue(value: string) {
    this.value = value;
    this.inputRef.current!.value = value;
  }
  onAppendChange(e: Event) {
    let t = e.target as HTMLSlotElement;
    let slotRoots = t.assignedElements();
    if (slotRoots.length > 0) {
      this.hasRight = true
    }
  }
  onPrependChange(e: Event) {
    let t = e.target as HTMLSlotElement;
    let slotRoots = t.assignedElements();
    if (slotRoots.length > 0) {
      this.hasLeft = true
    }
  }
  onClear(e: Event) {
    this.clear()
    this.emit('clear', { value: '' })
  }
  /**
   * 切换密码明文 / 密文。
   * mousedown 已在模板上 prevent，点击不会让输入框失焦（否则会先触发 change 再切类型）。
   */
  togglePassword() {
    if (this.disabled || this.readonly) return
    this.__passwordVisible = !this.__passwordVisible
    // 切换 type 后把光标放回末尾，避免 value 保持但选区丢失
    const el = this.inputRef.current
    if (el instanceof HTMLInputElement) {
      const pos = el.value.length
      el.setSelectionRange?.(pos, pos)
    }
  }
  onKeyup(e: KeyboardEvent) {
    e.stopPropagation();
    let t = e.currentTarget as HTMLInputElement
    let selectionText = t.value.substring(t.selectionStart || 0, t.selectionEnd || 0)
    this.emit('keyup', { value: t.value, selectionText, selectionStart: t.selectionStart, selectionEnd: t.selectionEnd }, e)
  }
  onKeydown(e: KeyboardEvent) {
    // Escape 放行：命令面板等 overlay 场景依赖 document 级 Esc 关闭，
    // autoFocus 焦点就在输入框内，此处吞掉会导致 Esc 永远失效
    if (e.key !== 'Escape') e.stopPropagation();
    let t = e.currentTarget as HTMLInputElement
    let selectionText = t.value.substring(t.selectionStart || 0, t.selectionEnd || 0)
    this.emit('keydown', { value: t.value, selectionText, selectionStart: t.selectionStart, selectionEnd: t.selectionEnd }, e)
  }
  onInput(e: InputEvent) {
    let input = e.target as HTMLInputElement

    e.stopPropagation();
    this.emit('input', { value: input.value }, e)
    this.emit('update:value', { value: input.value })
  }
  onFocus(e: Event) {
    let input = e.target as HTMLInputElement
    e.stopPropagation();
    if (this.autoselect) {
      input.select()
    }

    this.emit('focus', { value: input.value }, e)
  }
  onBlur(e: Event) {
    e.stopImmediatePropagation();
    e.preventDefault()
    this.emit('blur', { value: this.inputRef.current?.value }, e)

  }
  onChange(e: Event) {
    e.stopPropagation();
    this.__innerValue = this.inputRef.current?.value ?? '';
    // change 时同步 value model：否则 FormItem 校验/Form model 读取的 control.value 始终是初始值。
    // 必须走 updateProps（prop setter 对 model prop 的赋值只会 emit 而不写入）
    this.updateProps({ value: this.__innerValue });
    this.emit('update:value', { value: this.__innerValue })
    this.emit('change', { value: this.inputRef.current?.value }, e)
    this.emit('update:changeValue', { value: this.inputRef.current?.value })
  }

  clear() {
    // 用 ref 而不是 @query('input')：多行模式下根本没有 <input>
    const el = this.inputRef.current
    if (el) el.value = ''
    this.__innerValue = '';
    this.updateProps({ value: '' });
    this.emit('update:value', { value: this.__innerValue })
    this.emit('update:changeValue', { value: this.__innerValue })
    // 清空是值变更：只发 clear 会让只监听 input 的消费方（搜索框、过滤器）
    // 停留在旧值上。input 先于 clear，与「先变更后事件」的顺序一致。
    // 此处不传原生事件：触发源是关闭图标的 click，不是输入事件。
    this.emit('input', { value: '' })
  }
  focus() {
    this.inputRef.current?.focus()
  }
  blur() {
    this.inputRef.current?.blur()
  }
  /**
   * 用于外部框架调用
   * @returns 
   */
  getInput() {
    return this.inputRef.current?.value
  }
}