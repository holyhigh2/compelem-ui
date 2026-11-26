import { bind, computed, css, csscope, Csscope, emits, forEach, h, html, ifElse, ifTrue, prop, query, show, state, tag, Template, watch } from "compelem";
import { isBlank, isEmpty, isString, size, slice, trim } from "myfx";
import { nodesToHTML } from "../../../utils/utils";
import { Close } from "../../../icons/icons";

import appearanceStyle from "../../../base/appearance.scss?tmpl";
import { formStyleSheet } from "../styleSheets";
import { BaseInput } from "./BaseInput";
import { Input } from "./Input";
import { inputStyleSheet } from "./styleSheets";

/**
 * 标签输入框
 * @attrs
 *  max {number} 最大可输入标签数
 *  maxlength {number} 每个标签最大可输入字符数
 *  placeholder {string} 提示符
 *  trigger {string} 创建标签的触发按键，可选Enter/Space/Comma，默认 Enter
 *  clearable {boolean} 支持清除，默认false
 *  max-collapse-tags {number} 最大显示tag数，超过时会折叠标签并仅显示个数，默认0，小于1无效
 * @models
 *  value {Array<string>} tag数组，受控
 * @slots
 *  -(v,i,onClose) 自定义tag
 *  append
 * @events
 *  close({value}) 关闭某个tag时触发
 *  clear 清除所有tag时触发
 *
 * @author holyhigh2
 */
@emits('update:value', 'close', 'clear')
@tag("ce-input-tag")
export class InputTag extends BaseInput {
  @query('ce-input')
  inputEl!: Input;

  static TriggerType = {
    Enter: 'Enter',
    Space: 'Space',
    Comma: 'Comma',
  }

  //////////////////////////////////// props

  @prop({ type: Array }) value: string[] = []
  @prop trigger = InputTag.TriggerType.Enter
  @prop maxCollapseTags = 0
  // 为 Select 单选模式提供：隐藏内部 ce-input 的输入框，仅保留 prepend 文本与 append 图标
  @prop hideInput = false
  // 「已展开」状态（ce-select 下拉打开时置真）。hide-input 模式下内部 input 是
  // display:none，点开下拉不产生焦点，:focus-within 永远不成立；这里把状态透传给
  // 内层 ce-input，由它自己的 ::after 下划线动画响应（与聚焦时同一套动画）。
  @prop({ type: Boolean }) active = false

  // __innerValue 必须以「整体替换数组」的方式更新：forEach 的 diff 比对的是
  // 数据源的引用 + 逐项值，push/splice 这类原地 mutation 会被判定为「无变化」，
  // 数据变了但子视图不会重建（表现为新 tag 不显示 / 关掉的 tag 不消失）。
  // 顺带也避免就地改写使用方通过 .value 传进来的数组。
  @state __innerValue: string[] = this.value;
  @state __plusCount: number = 0;

  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return appearanceStyle;
  }
  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet, css`
      /* ce-input-tag 宿主盒模型（默认 appearance）。
         内层 ce-input（输入引擎）已在 input.scss 的 :host(ce-input.ce-input-tag) 中去框，
         视觉盒模型改由本宿主承担——与 ce-input「宿主即盒模型」的模型对齐；
         否则库默认外观（无外部样式干预）下 ce-input-tag / ce-select 将整体无框。
         边框/圆角 token 与原内层完全一致（--ce-color-border-rgb / --ce-round-md），
         宿主 border 的 2px 正好补上内层去框少的 2px，总高度守恒。
         勿放入共享的 inputStyleSheet（style.scss）——那是 11 个组件共用的。 */
      :host(ce-input-tag) {
        /* 默认外观下宿主必须是 block：inline 盒 + block 子元素 + border 会触发
           布局膨胀（实测 62 → 97），与 ce-input 宿主的 display:block 保持一致 */
        display: block;
      }
      :host(ce-input-tag[appearance=""]) {
        border-width: var(--border-size, var(--ce-border-md));
        border-style: solid;
        border-color: rgb(var(--ce-color-border-rgb));
        border-radius: var(--round-size, var(--ce-round-md));
      }
      :host(ce-input-tag[appearance="default"]) {
        border-width: var(--border-size, var(--ce-border-md));
        border-style: solid;
        border-color: rgb(var(--ce-color-border-rgb));
        border-radius: var(--round-size, var(--ce-round-md));
      }
      /* 下划线外观：视觉盒模型同样在宿主上。
         内层 ce-input 的 border 被 ce-input.ce-input-tag 的去框规则清掉，
         所以下划线必须画在宿主；不补这条，underlined 的 select/input-tag 会变成
         "无边框无下划线、只剩一块白底"的裸块。 */
      :host(ce-input-tag[appearance="underlined"]) {
        border-width: 0 0 var(--border-size, var(--ce-border-md));
        border-style: solid;
        border-color: rgb(var(--ce-color-border-rgb));
        border-radius: 0;
        /* 底色也画在宿主上：内层 ce-input 的白底只覆盖内容盒，下划线那 1px 会透出
           后层（卡片背景图 / 半透明标题栏），边缘看起来像缺了一条。 */
        background: var(--ce-color-bg);
      }
      /* default 外观（四边框）的焦点 / 激活态高亮：内层 ce-input 被去框，蓝边只能在宿主侧补。
         必须排除 underlined 外观：它的激活表现是内层 ce-input 的 ::after 蓝色下划线
         「从中间向两侧展开」（见 Input.ts 的 hostCss），那才是组件库原有的动画。
         若这里把宿主整条底边也染蓝，会叠加成「整条瞬间变色 + 蓝线再展开」，
         与普通输入框聚焦时的表现不一致。 */
      :host(ce-input-tag:not([appearance="underlined"]):focus-within),
      :host(ce-input-tag:not([appearance="underlined"])[active]) {
        border-color: rgb(var(--form-item-color));
      }
    `];
  }

  /////////////////////////////////// watches
  @watch('value')
  watchValue(nv: string[]) {
    this.__innerValue = nv ?? []
  }
  /////////////////////////////////// computed
  @computed
  get eachValue() {
    if (this.maxCollapseTags > 0) {
      this.__plusCount = size(this.__innerValue) - this.maxCollapseTags
      return slice(this.__innerValue, 0, this.maxCollapseTags)
    }
    return this.__innerValue
  }
  //////////////////////////////////// lifecycles
  onCloseBind: Function
  constructor() {
    super()
    this.onCloseBind = this.onClose.bind(this)
  }
  render(): Template {
    return h`
      <ce-input class="ce-input-tag ce-input-floating-icon ${this.hideInput ? 'ce-input-tag-hideinput' : ''}" clearable align="${this.align}" size="${this.size}" appearance="${this.appearance}" ?active="${this.active}" .maxlength="${this.maxlength}" ?disabled="${this.disabled}" ?readonly="${this.readonly}" ${bind(this.ariaAttrs)} @keyup="${this.onKeyup}">
        <div slot="prepend" class="ce-input-tags" style="display: contents;">
          <!--
            key 必须是**内容**（value + 下标），不能用下标：用下标时同长度改内容
            （如 ce-select 折叠态标签从「文本」变「数值」）key 不变 ⇒ 文本永久停在首渲染值。
            下标后缀保证重复标签不撞 key（InputTag 入口有去重，但
            ce-select 多选的 selectLabelAry 允许同标签选项）。
          -->
          ${forEach(this.eachValue, (v, i) => v + " " + i, (v, i) => h`${ifElse(
            !!this.slotHooks.default,
            () => h`<span>${html(this.customTagHTML(v, i))}</span>`,
            () => h`<ce-tag content="${v}" closable @close="${this.onClose}">${v}</ce-tag>`
          )}`)}
          ${ifTrue(this.maxCollapseTags > 0 && this.__plusCount > 0, () => h`
              <ce-tag style="">+${this.__plusCount}</ce-tag>
          `)}
        </div>
        ${this.clearable}
        <span slot="append" class="ce-input-floating is-not-empty" >
          <ce-icon class="ce-input-close" size="sm" .svg="${Close}" @mousedown.stop @click.prevent="${this.onClear}" ${show(this.clearable && !isEmpty(this.__innerValue))}></ce-icon>
          <slot name="append"></slot>
        </span>
      </ce-input>
    `;
  }

  /**
   * 渲染使用者传入的自定义 tag 钩子（`ce-input-tag` 的 default 插槽）。
   * 钩子是编译子模板，DOM 挂在**写回调那个类**的 subViews 上 —— 只能经
   * `getSubViewNodes` 在 JS 里取一次性快照，再序列化成字符串给 `html()` 指令注入。
   */
  customTagHTML(v: any, i: number): string {
    const fn = this.slotHooks.default
    if (!fn) return ""
    return nodesToHTML(this.getSubViewNodes(fn, v, i, () => this.onClose(this.__innerValue[i])))
  }

  //////////////////////////////////// methods
  __checkMax() {
    let maxNum = parseInt(this.max + "")
    this.inputEl.toggleAttribute('readonly', maxNum > 0 && size(this.__innerValue) >= maxNum)
  }
  onKeyup({ selectionText, event, value }: Record<string, any>) {
    if (event.key === this.trigger && this.trigger === InputTag.TriggerType.Enter ||
      event.key === " " && this.trigger === InputTag.TriggerType.Space ||
      (event.key === "," || event.key === "，") && this.trigger === InputTag.TriggerType.Comma
    ) {
      value = trim(value)
      if (this.trigger === InputTag.TriggerType.Comma) {
        value = value.replace(/[,，]$/, '')
      }
      if (this.__innerValue.includes(value)) return
      if (isBlank(value)) return

      let maxNum = parseInt(this.max + "")
      if (maxNum > 0 && size(this.__innerValue) >= maxNum) {
        return
      }

      this.__innerValue = [...this.__innerValue, value]
      this.nextTick(() => {
        this.__checkMax()

        this.inputEl.clear()
        this.inputEl.focus()

      })
      this.emit('update:value', { value: this.__innerValue })
    }
  }
  clear() {
    this.inputEl.toggleAttribute('readonly', false)
    this.__innerValue = []
    this.__checkMax()
    this.emit('update:value', { value: [] })
  }
  onClear() {
    this.clear()
    this.emit('clear')
    this.inputEl.focus()
  }
  onClose(ev: string | Record<string, any>) {
    let v = isString(ev) ? ev : ev.target.getAttribute('content')
    this.__innerValue = this.__innerValue.filter(iv => iv != v)
    this.__checkMax()

    this.inputEl.focus()

    this.emit('update:value', { value: this.__innerValue })

    this.emit('close', { value: v })
  }
}