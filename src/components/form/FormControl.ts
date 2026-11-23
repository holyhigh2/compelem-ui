import { closest, get, isObject } from "myfx";

import { prop } from "compelem";
import { AriaElem } from "../../base/AriaElem";
import { Form } from "./Form";
import { FormItem } from "./FormItem";
/**
 * 表单控件基类
 * 提供控件与表单交互的通用接口
 * @attrs
 *  disabled {boolean} 是否禁用
 *  readonly {boolean} 是否只读
 *  plaintext {boolean} 是否显示明文
 *  round {boolean} 是否圆角
 *  appearance {string} 外观，default/subtle/subtle-invert/outlined/flat/pale/text
 *  size {string} 尺寸，lg, md, sm, xs
 *  name {string} 属性名词，匹配formModel的key，支持作用域链
 *  error {boolean} 校验失败态，由 FormItem 下发
 *  errorMessage {string} 校验失败文案，为空时显示 FormItem 的规则文案
 *  hint {string} 控件下方的辅助提示文案
 *  hideHint {boolean} 隐藏辅助提示
 *  color {string} 控件主色，任意合法CSS颜色或内置命名色 info/success/warning/error/text
 * 
 * @author holyhigh2
 */
export abstract class FormControl extends AriaElem {

  @prop plaintext = false;

  @prop error = false;
  @prop({ type: String }) errorMessage: string | undefined

  @prop({ type: String })
  hint!: string;
  @prop hideHint = false

  @prop({ type: String })
  name!: string;
  abstract value: any;

  form!: Form;
  formItem!: FormItem;
  /////////////////////////////////// watches

  connectedCallback(): void {
    super.connectedCallback();

    let parentFormControl = closest(this.parentComponent!, (node) => node instanceof FormControl, "parentComponent")
    if (parentFormControl) {
      return;
    }

    this.form = closest(this.parentComponent!, (node) => node instanceof Form, "parentComponent")!
    this.formItem = closest(this.parentComponent!, (node) => node instanceof FormItem, "parentComponent")!
    if (this.formItem) {
      this.formItem.control = this;
      // 控件回填后补拉 form model 初始值。两处既有推送都会错过：
      // 1) Form 的 @watch('model', immediate) 在 form 初始化时触发，此时 formItems 为空；
      // 2) FormItem._addToForm 在 connectedCallback 触发，此时 control 尚未回填。
      // 必须走 updateProps：value 多为 model prop，直接赋值只会 emit 不写入
      if (this.form && isObject(this.form.formModel)) {
        const modelKey = this.name || get(this.formItem, 'prop', '');
        if (modelKey) {
          this.updateProps({ value: get(this.form.formModel, modelKey) });
        }
      }
    }
    let that = this;
    //监控change
    this.addEventListener('change', (e: Event) => {
      let control = e.target as FormControl;
      if (that.form) {
        that.form._setChange(control.name || get(control.formItem, 'prop'), control.value, e)
      }
    })
  }
  mounted(): void {
  }

  /**
   * 桥接：compelem 的 emit 默认走 wrapper 模板事件系统，DOM 层 addEventListener
   * 收不到组件事件。FormControl 内部机制（FormItem 校验触发、Form model 同步）
   * 依赖 DOM change 事件，故在 emit('change') 时同步派发一次 DOM change。
   * focus/blur 同理，Overlay 等组件需要通过 DOM 事件监听触发元素的焦点变化。
   *
   * 桥接事件**不带 detail**：它与原生 input 的 change 一样只表示"发生了变化"，
   * 消费方用 `if (e.detail)` 区分组件事件与桥接/原生事件。载荷只走组件事件通道。
   */
  emit(evName: string, arg?: Record<string, any>, event?: Event) {
    // 带 emit-native 时 super.emit 已经派发同名原生 CustomEvent（带 detail），
    // 再桥接一次会让 DOM 层收到两遍 change/focus/blur（表单校验会跑两次）
    if (!this.hasAttribute('emit-native') && (evName === 'change' || evName === 'focus' || evName === 'blur')) {
      this.dispatchEvent(new CustomEvent(evName, { bubbles: true, composed: false }))
    }
    super.emit(evName, arg, event);
  }

  //////////////////////////////////// methods
  //变更显示状态：默认实现为设置同名 prop（disabled/readonly/plaintext），
  //控件如需自定义视觉行为可覆写
  changeDisplay(stateName: string, enabled: boolean): void {
    (this as any)[stateName] = enabled;
  }
}