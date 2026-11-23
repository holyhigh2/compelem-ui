import { classes, css, csscope, Csscope, emits, h, ifElse, prop, tag, Template, watch } from "compelem";
import { FormControl } from "../FormControl";
import { Radio } from './Radio';
import style from "./style.scss?tmpl";
/**
 * 复选框组
 * @attrs
 *  value {array} 按顺序对应复选框的value，受控属性
 *  reverse {boolean} 是否反向显示，默认false
 *  inline {boolean} 是否水平显示，默认false
 * @slots
 *  - 1-n个单选框组件
 * @events
 *  change({value})
 *
 * @author holyhigh2
 */
@emits('update:value')
@tag("ce-radio-group")
export class RadioGroup extends FormControl {
  radioList: Set<Radio> = new Set
  //////////////////////////////////// props
  @prop({ type: String, model: true }) value: string = '';
  @prop reverse = false;
  @prop inline = false;

  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`:host{
      display: inline-block;
      vertical-align: super;
    }`];
  }

  /////////////////////////////////// watches
  @watch('reverse')
  function(v: boolean) {
    if (v) {
      this.radioList.forEach(el => el.setAttribute('reverse', 'true'))
    } else {
      this.radioList.forEach(el => el.removeAttribute('reverse'))
    }
  }
  // 表单级状态透传到子 Radio（plaintext 由 group render 直接输出文本，无需下沉）
  @watch(['disabled', 'readonly'])
  watchDisplayState() {
    this.radioList.forEach(radio => {
      // 必须走 updateProps：prop setter 对非 model prop 的赋值会直接丢弃
      radio.updateProps({ disabled: this.disabled, readonly: this.readonly });
    })
  }
  // value 变更（含 reset 把 value 置空、外部 setModel、用户选择）统一按 group.value 回放各 radio 选中态，
  // 使视觉与受控值始终一致。toggleCheck 不发事件，不会触发回环。
  @watch('value')
  watchValue() {
    this._restoreFromValue();
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    // 0.30 要求 render() 只有一个主视图 h`` 模板，根级三元会触发 "2 个主视图模板" 阻断
    return h`${ifElse(
      this.plaintext,
      () => h`${this.value}`,
      () => h`
      <div class="ce-form-radio-group" ${classes({ "ce-form-radio-inline": this.inline })}>
        <slot></slot>
      </div>`
    )}`;
  }

  mounted(): void {
  }
  //////////////////////////////////// methods
  _addChild(radio: Radio) {
    let v = this.value;
    if (radio.getAttribute('value') === v) {
      radio.toggleCheck(true);
    }

    this.radioList.add(radio)

    // 子 radio 挂载时同步当前禁用/只读态：仅靠 @watch('disabled') 只能覆盖运行时变化，
    // 初始即禁用的 group，其子 radio 在此注册时不会触发 watch，需主动下发。
    radio.updateProps({ disabled: this.disabled, readonly: this.readonly });
  }
  /**
   * 按当前 group.value 回放所有 radio 的选中态（选中 = value 相等）。
   * 用于 readonly/disabled 拦截后还原，以及 reset/setModel 后同步视觉。
   */
  _restoreFromValue() {
    this.radioList.forEach(radio => {
      radio.toggleCheck(radio.value === this.value);
    });
  }
  onCheckChange(value: string, target: Radio) {

    this.radioList.forEach(radio => {
      if (radio === target) {
        // 必须走 updateProps：prop setter 对 model prop 的赋值只会 emit 而不写入
        this.updateProps({ value });
      } else {
        radio.toggleCheck(false);
      }
    })

    // 通知父组件 value 已变更（updateProps 只写入不会 emit）
    this.emit('update:value', { value });
  }
  clear(): void {

  }
}