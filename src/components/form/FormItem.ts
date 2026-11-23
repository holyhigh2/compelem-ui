import { classes, CompElem, computed, css, csscope, Csscope, h, ifTrue, prop, query, state, tag, Template, watch } from "compelem";
import { closest, get, isArray, isEmpty, isNil } from "myfx";
import { Form } from "./Form";
import { FormControl } from "./FormControl";
import style from "./style.scss?tmpl";
/**
 * 表单项
 * @attrs
 *  label {string} label内容
 *  prop {string} 属性名，用于关联校验规则
 *  required {boolean} 必填
 *  validateOn {string} 触发验证的事件，默认change
 * @slots
 *  - 表单项内容
 *  label 表单项title
 * @author holyhigh2
 */
@tag("ce-form-item")
export class FormItem extends CompElem {
  //////////////////////////////////// props
  @prop label: string = '';
  @prop prop: string = '';
  @prop({ type: Boolean, model: true }) required = false;
  @prop({ type: [Object, Array] }) rule: Record<string, any> | Record<string, any>[];
  @prop validateOn = 'change'
  // Item 级 label 排版；缺省时回落到 form 级（通过 _applyFormLabelOpts 写入 @state）
  // labelWidth：形如 '120px' 或数字 120（=120px）
  @prop({ type: [String, Number] }) labelWidth: string | number;
  @prop labelAlign: 'left' | 'right' | '' = '';

  form: Form
  control: FormControl

  @state layout = 'vertical';
  // 由 form 注入的兜底值（item 未设置时使用）
  @state _formLabelWidth: string | number | undefined;
  @state _formLabelAlign: '' | 'left' | 'right' = '';

  @query('.ce-form-form-item-error-message')
  msgSpan: HTMLElement

  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`
      :host{
        margin-bottom: 1.125rem;
        vertical-align: top;
        display: block;
      }
      // inline 布局：整行（宿主元素）需改为 inline-block 才能横向排列。
      // 注意：表单的 ::slotted(ce-form-item){display:inline-block} 特异性低于本组件
      // 的 :host{display:block}（0,0,1 < 0,1,0）而失效，故改由宿主类驱动，确保生效。
      :host(.ce-form-layout-inline){
        display: inline-block;
        vertical-align: top;
        margin-right: var(--ce-spacing-md);
        margin-bottom: 0;
      }
    `];
  }
  /////////////////////////////////// watches
  // layout 变更（来自 form 下发或自身）时，同步宿主类，驱动整行排列（inline 需 inline-block）
  @watch('layout')
  private onLayoutChange() {
    this.#syncLayoutHostClass()
  }
  //////////////////////////////////// lifecycles

  /**
   * label 的整段 style。
   *
   * 必须是 `@computed` 而非 render() 局部变量：它用在 `ifTrue` 回调内的 `<label style="...">`
   * 上，而回调的 DOM/插值是在按类烘焙的 effect 工厂里求值的，那里只有 `__comp`，
   * 看不到 render() 的局部作用域（报「引用了无法解析的自由标识符 'labelStyle'」）。
   *
   * 注意：compelem 一个属性只支持**一个**插值，所以这里返回拼好的整串，而不是拆成两个插值。
   */
  @computed get labelStyle() {
    // 计算 label 排版：item 自有值优先，缺省用 form 注入的兜底，文本对齐再缺省 'left'
    let lw: any = this.labelWidth != null ? this.labelWidth : this._formLabelWidth
    // ⚠️ attribute 传入的 label-width（如 label-width="62"）到这里是字符串 "62"，
    // 不归一会生成无单位的 width:62 —— 非法 CSS 被浏览器整条丢弃，label 退回自然宽
    // （表现为各行 label 不对齐）。纯数字字符串一律补成 number。
    if (typeof lw === 'string' && /^\d+(\.\d+)?$/.test(lw.trim())) lw = Number(lw)
    let lwCss = lw == null ? '' : (typeof lw === 'number' ? lw + 'px' : String(lw))
    // vertical 布局 label 位于控件上方，始终左对齐（符合主流组件库习惯）；
    // horizontal/inline 下 label 在控件左侧，沿用 form/item 级 labelAlign（默认 left）
    let align = this.layout === 'vertical' ? 'left' : (this.labelAlign || this._formLabelAlign || 'left')
    return `text-align:${align}` + (lwCss ? `;width:${lwCss}` : '')
  }

  render(): Template {
    return h`
      <div class="ce-form-item" ${classes({
      // 类名需与 form/style.scss 中 .ce-form-layout-* 规则匹配
      ['ce-form-layout-' + this.layout]: true
    })}>
        ${ifTrue(!!this.label || !isEmpty(this.slots.label), () => h`
          <label part="label" for="${this.prop}" class="ce-form-form-item-label" style="${this.labelStyle}">
            ${ifTrue(this.required, () => h`<b style="color:red">*</b>`)}
            ${this.label}
            <slot name="label"></slot>
          </label>
        `)}
        <div part="control" class="ce-form-form-item-wrapper"><slot></slot></div>
      </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.form = closest(this.parentComponent!, (node) => node instanceof Form, "parentComponent")!
    if (this.form) {
      this.form._addToForm(this)
      this.layout = this.form.layout
    }
    // 初始同步宿主布局类（connectedCallback 内赋值若与默认值相同不会触发 watch）
    this.#syncLayoutHostClass()
  }
  #syncLayoutHostClass() {
    (['vertical', 'horizontal', 'inline'] as const).forEach(m =>
      this.classList.toggle('ce-form-layout-' + m, this.layout === m))
  }
  #validateListenerAttached = false;
  #attachValidateListener() {
    if (this.#validateListenerAttached || !this.control) return;
    this.#validateListenerAttached = true;
    let that = this;
    this.control.addEventListener(this.validateOn, e => {
      let rule = get<Record<string, any> | Record<string, any>[]>(this.form.rules, that.prop)
      // _validate 校验失败会 throw {name,rule}，这里仅用于触发内联错误展示，
      // 不可向上抛出（否则变成未捕获的 rejection，污染控制台），故吞掉
      that._validate(rule).catch(() => { })
    })
  }
  mounted(): void {
    // control 由子控件在连接期回填（FormControl.connectedCallback），
    // mounted 时可能尚未就绪，需延迟到下一帧再挂校验触发监听
    this.#attachValidateListener();
    this.nextTick(() => this.#attachValidateListener());
  }

  //////////////////////////////////// methods
  //如果错误返回 {name,rule} 信息
  async _validate(rule: Record<string, any> | Record<string, any>[]) {
    if (!this.control || !this.prop) return true;

    let rules: any[] = []
    // ⚠️ 原实现 `rules = rule` 之后又 `if (rule) rules.push(rule)`：
    // — rule 是数组时，把宿主 form.rules[prop] 那个数组**推进它自己** ⇒ 每次校验
    //   该数组长度 +1 个自引用，永不回收（规则配置被永久污染）；
    // — rule 是单个对象时，push 的是同一个对象，语义正确但依赖上面的分支顺序。
    // 统一改为副本：数组浅拷贝、单对象包一层。
    if (isArray(rule)) {
      rules = [...rule]
    } else if (rule) {
      rules = [rule]
    }
    if (this.rule) rules.push(this.rule)
    if (this.required) {
      rules.push({ required: true })
    }

    //1. 获取control值
    let value = this.control.value;
    //2. 校验
    for (let index = 0; index < rules.length; index++) {
      const r = rules[index];
      if (r.validator) {
        let check = await r.validator(value)
        if (!check) {
          this._showErrorMessage(this.prop, r.message)
          throw { name: this.prop, rule: r }
        }
      } else if (r.required) {
        if (isNil(value) || value.length < 1 || isEmpty(value + '')) {
          this._showErrorMessage(this.prop, r.message)
          throw { name: this.prop, rule: r }
        } else {
          this._resetValidation()
        }
      } else {
        //类型标识调用校验器
      }
    }
  }
  _resetValidation() {
    // 用 updateProps 设值：直接属性赋值对非 model prop 会被 compelem 丢弃，
    // 且 updateProps 会把 error 的 boolean false 同步移除 [error] 属性（驱动错误样式）
    this.control.updateProps({ error: false, errorMessage: undefined });
    // errorMessage 为 undefined 时 updateProps 不清理残留 [error-message] 属性，手动移除
    this.control.removeAttribute('error');
    this.control.removeAttribute('error-message');
  }
  _reset() {
    // 必须走 updateProps：直接 this.control.value = '' 对非 model prop 会被 compelem 丢弃；
    // 即使 value 是 model prop，直接赋值也只 emit 不写入。更新后一并清掉校验状态。
    this.control.updateProps({ value: '' });
    this._resetValidation();
  }
  _showErrorMessage(prop: string, msg: string) {
    let errorMsg = ''
    if (msg) {
      errorMsg = msg
    } else {
      errorMsg = prop + ' is required.'
    }
    // 用 updateProps 同时写 property 与 [error]/[error-message] 属性（prop 含 attribute 映射），
    // 直接 this.control.error = true 会被 compelem 丢弃（非 model prop）
    this.control.updateProps({ error: true, errorMessage: errorMsg });
  }
  changeDisplay(stateName: string, enabled: boolean) {
    // 将表单级状态（disabled/readonly/plaintext）透传给内部控件。
    // 必须走 updateProps：prop setter 对非 model prop 的赋值会直接丢弃
    if (this.control) {
      this.control.updateProps({ [stateName]: enabled });
    }
  }
  /**
   * 接收 Form 下发的 form-level label 排版配置，作为 item 未显式设置时的兜底值。
   * 写入 @state 以触发重渲染。
   */
  _applyFormLabelOpts(width: string | number | undefined, align: '' | 'left' | 'right') {
    this._formLabelWidth = width;
    this._formLabelAlign = align ?? '';
  }
}