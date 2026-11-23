import { each, get, isEmpty, isObject, set } from "myfx";

import { CompElem, Csscope, Template, classes, csscope, emits, h, prop, tag, watch } from 'compelem';
import { FormItem } from "./FormItem";
import style from "./style.scss?tmpl";
/**
 * 表单框
 * @attrs
 *  asterisk {boolean} 显示星号，默认true
 *  disabled {boolean} 显示禁用
 *  readonly {boolean} 显示制度
 *  plaintext {boolean} 显示文本
 *  rules {object} 校验规则 {xx:{required: true, message: '不能为空', trigger: 'blur' }/[{}]}
 *  layout {string} 布局，inline/vertical/horizontal，默认vertical
 *  labelWidth {string|number} form 级 label 宽度，缺省时由 FormItem 自身值覆盖；horizontal/inline 布局下生效
 *  labelAlign {string} 'left' | 'right'，默认 left；form 级 label 文字对齐
 *  model {object}
 * @slots
 *  default ce-form-item
 * @events
 *  change({control,prop,value})
 * @methods
 *  setModel(model) 设置模型对象绑定表单，表单中控件变动时会自动更新模型数据
 *  validate():Promise 校验表单
 *  resetValidation() 重置校验
 *  reset() 重置表单
 *
 * @author holyhigh2
 */
@emits('change')
@tag("ce-form")
export class Form extends CompElem {
  formItems: Array<FormItem> = [];
  formModel: Record<string, any>;
  //////////////////////////////////// props
  @prop asterisk = true;
  @prop disabled = false;
  @prop readonly = false;
  @prop plaintext = false;
  @prop layout = 'vertical';
  // Form-level label 排版配置；缺省时由 FormItem 自身的同名 prop 生效。
  // labelWidth：形如 '120px'、数字 120（=120px）或 **'auto'** —— auto 模式下 mounted 后
  // 测量所有 item 的 label 自然宽，取 max + 1rem 统一下发（各行 label 自动对齐）
  @prop({ type: [String, Number] }) labelWidth: string | number;
  @prop labelAlign: 'left' | 'right' | '' = '';
  @prop({ type: Object, model: true }) rules: Record<string, Record<string, any> | Record<string, any>[]>
  @prop({ type: Object }) model: Record<string, any>;

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  @watch(['disabled', 'readonly', 'plaintext'])
  function(nv: any, ov: any, sourceName: string) {
    this._changeDisplay(sourceName, nv)
  }
  @watch('layout')
  watchLayout(nv: any, ov: any) {
    each(this.formItems, item => item.layout = nv);
  }
  // form 级 label 配置变更：下发到所有 item（item 自有值优先）
  @watch(['labelWidth', 'labelAlign'])
  watchLabelOpts() {
    this._propagateLabelOpts();
    // 切到 auto / auto 下新增 item 时需要（重）测量
    this.#scheduleMeasure();
  }
  // model 变更：写入 formModel 并推送到已有控件；新加入的 item 会在 _addToForm 时补拉
  // immediate 让首次 .model 绑定时即把外部模型拉入 formModel（否则 formModel 一直
  // undefined，_setChange 跳过写入，受控同步彻底失效）
  @watch('model', { immediate: true })
  watchModel(nv: Record<string, any>) {
    if (isObject(nv)) {
      this.setModel(nv);
    }
  }
  //////////////////////////////////// lifecycles
  mounted(): void {
    // auto 模式：item 们在 connectedCallback 阶段已登记进 formItems，
    // 但 shadow DOM 未必完成首帧渲染 —— 交给 rAF 测量（见 #measureLabels 重试）
    this.#scheduleMeasure();
  }

  render(): Template {
    return h`
      <form class="ce-form" ${classes({ ['layout-' + this.layout]: true })}>
        <slot></slot>
      </form>
    `;
  }

  //////////////////////////////////// methods
  /**
   * 设置表单模型到对应的控件中
   * @param formModel 表单模型对象，key为 表单项prop/控件name 属性
   */
  setModel(formModel: Record<string, any>) {
    if (!isObject(formModel)) return;

    this.formModel = formModel;
    this._applyModelToItems();
  }
  _applyModelToItems() {
    each(this.formItems, item => {
      if (!item.control) return;
      let propName = get<string>(item.control, 'name', item.prop || '')
      if (!propName) return;
      // 用 updateProps 而非直接赋值：
      // compelem 的 model prop setter 对赋值只会 emit 不写入（见 RadioGroup.onCheckChange 注释），
      // setModel 真正需要的是把外部值推入控件内部
      item.control.updateProps({ value: get(this.formModel, propName) })
    })
  }
  async validate() {
    let errors = []
    for (let index = 0; index < this.formItems.length; index++) {
      const item = this.formItems[index];
      let rule = get<Record<string, any> | Record<string, any>[]>(this.rules, item.prop)

      try {
        // 返回值不参与汇总：校验失败是以 throw 报告的，结果本身不消费
        await item._validate(rule);
      } catch (error) {
        errors.push(error)
      }
    }
    if (!isEmpty(errors)) {
      throw errors
    }
  }
  resetValidation() {
    each(this.formItems, item => {
      item._resetValidation();
    })
  }
  reset() {
    each(this.formItems, item => {
      item._reset();
    })
  }
  //用于formItem调用
  _addToForm(item: FormItem) {
    this.formItems.push(item)
    // 新 item 加入时，如果 form 已有 model（含 watch 立即执行或外部设置），补一次写入
    if (isObject(this.formModel) && item.control) {
      let propName = get<string>(item.control, 'name', item.prop || '')
      if (propName) {
        item.control.updateProps({ value: get(this.formModel, propName) })
      }
    }
    // 同步 form 级 label 排版配置
    this._propagateLabelOptsTo(item)
    // auto 模式：新 item 的 label 可能比现有都宽 → 排一次（rAF 去重）
    this.#scheduleMeasure()
  }
  _propagateLabelOpts() {
    each(this.formItems, item => this._propagateLabelOptsTo(item))
  }
  _propagateLabelOptsTo(item: FormItem) {
    // auto 模式：下发测量结果（未测出前传 undefined → item 用自然宽，测完后统一刷新）
    const w = this.labelWidth === 'auto' ? this.#autoWidth : this.labelWidth
    item._applyFormLabelOpts(w as string | number | undefined, this.labelAlign)
  }

  //////////////////////////////////// label-width="auto" /////////////
  // 测量出的统一宽度（含 +1rem 呼吸空间），undefined 表示尚未测量
  #autoWidth: number | undefined;
  #measurePending = false;
  #measureRetries = 0;

  #scheduleMeasure() {
    if (this.labelWidth !== 'auto' || this.#measurePending) return;
    this.#measurePending = true;
    // rAF 而非 nextTick：slotted item 的 shadow DOM 可能晚于父组件一帧完成渲染
    requestAnimationFrame(() => {
      this.#measurePending = false;
      this.#measureLabels();
    });
  }

  #measureLabels() {
    if (this.labelWidth !== 'auto') return;
    let max = 0;
    each(this.formItems, (item: FormItem) => {
      const label = item.shadowRoot?.querySelector('.ce-form-form-item-label') as HTMLElement | null;
      if (!label) return;
      // 临时解除定宽，量自然宽（label 无 padding，offsetWidth 即文本宽）
      const prev = label.style.width;
      label.style.width = 'auto';
      const w = Math.ceil(label.getBoundingClientRect().width);
      label.style.width = prev;
      if (w > max) max = w;
    });
    if (max <= 0) {
      // 一个 label 都没量到（尚未渲染）：最多重试 3 帧，避免无 item 的表单空转
      if (++this.#measureRetries <= 3) requestAnimationFrame(() => this.#measureLabels());
      return;
    }
    this.#measureRetries = 0;
    this.#autoWidth = max + 16; // +1rem 呼吸空间
    this._propagateLabelOpts();
  }
  //变更表单内部控件显示状态
  _changeDisplay(stateName: string, enabled: boolean) {
    each(this.formItems, item => {
      item.changeDisplay(stateName, enabled);
    })
  }
  _setChange(propChain: string, value: any, e: Event) {
    // 未设置 model 的表单跳过写入（myfx.set 对 undefined 目标可能抛错，
    // 会中断同一 change 事件上后续 listener——如 FormItem 的校验触发）
    if (isObject(this.formModel)) {
      set(this.formModel, propChain, value)
    }
    this.emit('change', { control: e.target, prop: propChain, value }, e)
  }
}