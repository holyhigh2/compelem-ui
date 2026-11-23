import { css, csscope, Csscope, emits, h, ifElse, prop, state, tag, Template, watch } from "compelem";
import { isArray, join } from 'myfx';
import { FormControl } from "../FormControl";
import { Checkbox } from './Checkbox';
import style from "./style.scss?tmpl";
/**
 * 复选框组
 * @attrs
 *  max {number} 最多可选中的复选项，超过后其他复选项显示禁用，默认9999
 *  value {array} 按顺序对应复选框的value，受控属性
 * @slots
 *  - 1-n个复选框组件
 * @events
 *  change({value})
 *
 * @author holyhigh2
 */
@emits('update:value', 'change')
@tag("ce-checkbox-group")
export class CheckboxGroup extends FormControl {
  checkboxList: Set<Checkbox> = new Set
  //////////////////////////////////// props
  @prop({ type: Number }) max = 9999;
  // type 只传构造函数本身：`Array<String>` 的类型实参会被擦除，运行时等价于 `Array`，
  // 但会被 no-wrapper-object-types 判成包装类型；元素类型由下面的 TS 注解表达
  @prop({ type: Array, model: true }) value: Array<string> = [];
  @state label = '';

  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`:host{
      display: inline-block;
      vertical-align: super;
    }`];
  }
  /////////////////////////////////// watches
  // 表单级状态透传到子 Checkbox（对齐 RadioGroup 范式）
  @watch(['disabled', 'readonly'])
  watchDisplayState() {
    this._syncChildState();
  }
  // max 变更（attribute 或 updateProps）后重算"达上限禁用"
  @watch('max')
  watchMax() {
    this._syncChildState();
  }
  // value 变更（外部受控/reset）统一按 group.value 回放各 checkbox 选中态，
  // 使视觉与受控值始终一致；onCheckChange 的同值守卫保证不会形成回环
  @watch('value')
  watchValue() {
    this._restoreFromValue();
  }

  //////////////////////////////////// lifecycles

  render(): Template {
    // 0.30 要求 render() 只有一个主视图 h`` 模板（根级三元返回两个模板会被判为
    // "发现 2 个主视图模板"而阻断构建），分支一律用结构指令表达。
    return h`${ifElse(
      this.plaintext,
      () => h`${join(this.value, ',')}`,
      () => h`
      <div class="ce-form-checkbox-group">
        <slot ></slot>
      </div>`
    )}`;
  }

  //////////////////////////////////// methods
  /** max 的有效数值；非法（NaN）或 <=0 一律视为不限 */
  _maxNum() {
    const n = parseInt(this.max + '');
    return isNaN(n) || n <= 0 ? Infinity : n;
  }
  /** 当前选中数是否已达可选上限 */
  _isFull() {
    const values = isArray(this.value) ? this.value : [];
    return values.length >= this._maxNum();
  }
  /**
   * value 是否允许处于选中态。达上限后只有"已在 value 内"的值仍允许选中——
   * 这条豁免是必需的：_restoreFromValue 回放受控 value 时，被回放为选中的项必然
   * 已在 value 内，否则外部传入超过 max 的受控值会有一半点不亮。
   */
  _canCheck(value?: string) {
    const values = isArray(this.value) ? this.value : [];
    if (value !== undefined && values.includes(value)) return true
    return values.length < this._maxNum();
  }
  /**
   * 统一向子 Checkbox 下发"组态 + 达上限禁用"。
   * 刻意不从子项读 checked 状态：@watch 可能被并入 nextTick，那一刻子项的 __checked
   * 尚未回放，直接按 group.value 判定才能与 _restoreFromValue 的匹配规则（同一套
   * value 解析）保持一致。
   */
  _syncChildState() {
    const values = isArray(this.value) ? this.value : [];
    const full = this._isFull();
    this.checkboxList.forEach(checkbox => {
      const val = checkbox.getAttribute('value') || ''
      // 必须走 updateProps：prop setter 对非 model prop 的赋值会直接丢弃
      checkbox.updateProps({
        disabled: this.disabled || (full && !values.includes(val)),
        readonly: this.readonly
      });
    });
  }
  /** 按 value 定位子 Checkbox（与 Checkbox 侧 value || label 的取值规则保持一致） */
  _findChild(value: string) {
    return [...this.checkboxList].find(cb => (cb.value || cb.label) === value)
  }
  _addChild(checkbox: Checkbox) {
    const val = checkbox.getAttribute('value') || ''
    // 按 value 匹配（原按 childrenSize 位置对位是错误语义）；checked 是 model prop，
    // setter 赋值只会 emit 不落值，必须走 updateProps 才能真正点亮
    let values = this.value;
    if (isArray(values) && values.includes(val)) {
      checkbox.updateProps({ checked: true })
    }

    this.checkboxList.add(checkbox)

    // 子 checkbox 挂载时同步组态：仅靠 @watch 只能覆盖运行时变化，初始即禁用
    // （或初始 value 已达 max）的 group，其子 checkbox 注册时不会触发 watch，需主动下发
    this._syncChildState();
  }
  /**
   * 按当前 group.value 回放所有 checkbox 的选中态（选中 = value 在数组中）。
   * 用于外部受控 value 变更、reset 后同步视觉。
   */
  _restoreFromValue() {
    const values = this.value;
    this.checkboxList.forEach(checkbox => {
      const val = checkbox.getAttribute('value') || ''
      checkbox.toggleCheck(isArray(values) && values.includes(val))
    });
    // 选中数变化后重算"达上限禁用"：取消一项即应解除对其余项的禁用
    this._syncChildState();
  }
  onClick(e: Event) {
    if (this.readonly)
      e.preventDefault();
  }
  onCheckChange(value: string, checked: boolean) {
    const cur = isArray(this.value) ? this.value : [];
    // 无实际变化直接返回。原实现靠 "nv === cur" 判断，但取消分支用的是 filter，
    // 恒返回新数组，该判断永远不成立——导致"取消一个本就不在数组里的值"也会
    // 发出内容相同的 update:value/change（_restoreFromValue 回访时会成倍放大）
    if (checked ? cur.includes(value) : !cur.includes(value)) return
    // 达上限兜底：子组件已做前置守卫，这里保证"无论谁调用都不越界"，
    // 并把已自亮的子项回滚
    if (checked && !this._canCheck(value)) {
      this._findChild(value)?.updateProps({ checked: false })
      this._syncChildState()
      return
    }
    // 不可原地 push/remove：value 是受控 model prop，原地变更既不触发响应也不发事件，
    // 页面持有的同一引用数组还被悄悄改写。必须生成新数组 + updateProps 落值 + 显式 emit
    const nv = checked ? [...cur, value] : cur.filter(v => v != value)
    this.updateProps({ value: nv })
    // watch('value') 可能被并入 nextTick，这里同步刷一次，避免"点击已生效但禁用态未跟上"的空窗
    this._syncChildState()
    // 通知父组件 value 已变更（updateProps 只写入不会 emit）
    this.emit('update:value', { value: nv })
    this.emit('change', { value: nv })
  }
  clear() {
    this.updateProps({ value: [] })
    this.emit('update:value', { value: [] })
    this.checkboxList.forEach(cb => cb.updateProps({ checked: false }))
    this._syncChildState()
  }
}