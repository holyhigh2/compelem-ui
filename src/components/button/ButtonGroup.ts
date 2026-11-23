import { Csscope, csscope, emits, event, prop, state, tag, watch } from "compelem";
import { clone, each, find, findIndex, findTreeNodes, isBlank, kebabCase, remove, toArray } from "myfx";
import { AppearanceElem } from "../../base/Appearance";
import { Button } from "./Button";
import style from "./group.scss?tmpl";
const ValueMap = new WeakMap<Button, string>()
/**
 * 按钮组
 * @attrs
 *  value {string | string[]} 绑定值，multiple为true时为数组，否则为字符串
 *  divided {boolean} 在每个按钮之间插入分隔符，默认false
 *  multiple {boolean} 是否允许多选，默认false
 *  togglable {boolean} 是否允许切换选中状态，默认false
 *  required {boolean} 是否至少选中一个按钮，默认false
 *  shift {boolean} 是否开启shift显示效果，仅对开启stacked的button生效，默认false
 * @models
 *  value 默认绑定属性，input事件触发变更
 * @events
 *  change({value}) togglable开启且选项变更时触发。如果multiple为true，value是数组，否则是字符串
 * @slots
 *  - 按钮组件
 *
 * @author holyhigh2
 */
@emits("change", "update:value")
@tag("ce-button-group")
export class ButtonGroup extends AppearanceElem {

  //////////////////////////////////// props
  @prop({ type: [String, Array], model: true }) value: string | string[] = ''
  @prop divided = false
  @prop multiple = false
  @prop togglable = false
  @prop required = false
  @prop shift = false
  @prop stacked = false

  //button props

  @state selectedValues: string[] = []
  /** 观察子按钮增删（子视图晚于 mounted 到位时补下发初始属性） */
  #childObserver?: MutationObserver
  //////////////////////////////////// styles
  @csscope(Csscope.HOST)
  static get hostCss() {
    return style;
  }
  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  render(): any {
    return null
  }
  /**
   * ⚠️ 原实现是 `updated(changed) { this.setButtonProps(changed) }`，且 `changed` 从未被用到
   * （`setButtonProps()` 只读 `this.props`）。compelem 0.31 起 `updated()` 只在
   * `forceUpdate()` 里被调用（恒传 `{}`），响应式重渲染不再经过它 ⇒ **属性变更后
   * 不再向子按钮下发属性**（如运行时切 `divided`/`stacked`/`size`）。
   *
   * 改为显式 `@watch`：逐个源各自触发一次，与「哪个 prop 变了就重下发」等价的保守近似
   * （`setButtonProps` 自身幂等：只 setAttribute，不做增量）。
   *
   * ⚠️ 2026-10-18：早期列表**漏了外观族**（`appearance` / `size` / `color` / `round` …）⇒
   *    运行时（如 DevTools「元素」面板）改 `appearance="flat"` 时组宿主属性变了、子
   *    `ce-button` 却纹丝不动（`setButtonProps` 根本没被唤醒）。此处补齐 —— 凡是
   *    `setButtonProps` 会下发的**可视**属性，变更都要触发一次下发。
   */
  @watch([
    'divided', 'multiple', 'togglable', 'required', 'shift', 'stacked', 'value',
    'appearance', 'size', 'color', 'activeColor', 'space',
    'shadow', 'shadow2', 'border', 'border2',
    'round', 'round2', 'shadowed', 'bordered', 'rounded', 'hoverable',
  ])
  onGroupPropsChange() {
    this.setButtonProps()
  }
  mounted(): void {
    this.setButtonProps()
    this.syncSelection()
    // ① mounted 时子按钮常已存在但**尚未完成自定义元素升级**（instanceof Button 为 false），
    //    或父模板的 patch 把子按钮插在 mounted 之后：两种情况下 mounted 这次下发都会落空。
    // ② 用一拍宏任务补一次（与 syncSelection 同一时机）；更晚到位的由下面的
    //    MutationObserver 兜底。
    setTimeout(() => {
      this.setButtonProps()
      this.syncSelection()
    }, 0)
    // ⚠️ 子按钮可能晚于 mounted 才到位（子视图动态渲染、列表 forEach、ifTrue 切换）：
    // mounted 里那一次下发会落空，而此后没有任何 trigger（@watch 只跟踪组自身的 prop）
    // ⇒ 组上 appearance/size/round 永远不下发，子按钮停在默认值上，改一次属性才生效。
    // 本组件是 light DOM（render() 返回 null，没有 <slot>），slotchange 无从触发，
    // 因此用 MutationObserver 观察 childList（属性变更不在此列，仍由 @watch 负责）。
    if (!this.#childObserver && typeof MutationObserver !== 'undefined') {
      this.#childObserver = new MutationObserver(records => {
        // 只在"增删的节点确实是按钮"时才下发：文本节点更新、内部包装节点重排
        // 都会产生 childList 记录，但那与级联无关。
        let relevant = false
        each(records, r => {
          let nodes: Node[] = [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)]
          each(nodes, (n: Node) => {
            if (relevant) return
            if (n === this) return
            if (n instanceof Button) relevant = true
            else if (n.nodeType === 1) {
              let el = n as Element
              if (el.matches('ce-button') || el.querySelector('ce-button')) relevant = true
            }
          })
        })
        if (!relevant) return
        this.setButtonProps()
        // 新插入的按钮可能尚未升级，下一拍再补一次选中态
        if (this.togglable) setTimeout(() => this.syncSelection(), 0)
      })
      this.#childObserver.observe(this, { childList: true, subtree: true })
    }
  }
  destroyed(): void {
    this.#childObserver?.disconnect()
    this.#childObserver = undefined
  }
  //////////////////////////////////// methods
  setButtonProps(changed?: Record<string, any>) {
    let btns = findTreeNodes<Button>(this.childNodes, n => n instanceof Button)
    let attrs = this.props
    each(btns, (btn, i) => {
      each(attrs, (v, k: string) => {
        // value 是组级 model，下发会覆盖按钮自身的 value 导致选中判定错乱
        if (v && k !== 'value')
          btn.setAttribute(kebabCase(k), v)
      })
    })
  }
  // 外部绑定 / 内部点击导致的 value 变更，统一同步选中态
  @watch('value')
  onValueChange() {
    this.syncSelection()
  }
  /**
   * 成员按钮在组内的唯一值：显式 value 优先，未设置时才用 'button_序号'。
   *
   * ⚠️ 显式值必须每次实时读，不能进缓存：本组件是 light DOM，`mounted()` 会先于
   * 子按钮自己的属性→prop 初始化跑到，那一刻 `btn.value` 还是 `undefined`。
   * 原实现把兜底 id 一并写进 `ValueMap` 且之后只认缓存 ⇒ 真实 value 被
   * `'button_N'` 永久顶掉，表现为初始 `value="a"` 不点亮 A、点击后组值变成
   * `button_1`、外部 v-model 拿到无意义的值。缓存只用于「确实没有 value」的按钮，
   * 那才是需要保持稳定 id 的场景。
   */
  #buttonValue(btn: Button): string {
    // prop 未初始化时退回属性，让 mounted 第一次就能算对选中态
    let val = btn.value || btn.getAttribute('value')
    if (isBlank(val)) {
      val = ValueMap.get(btn) ?? ('button_' + findIndex(toArray(this.children), c => c === btn))
      ValueMap.set(btn, val as string)
    }
    return val as string
  }
  /** 将 model value 同步到 selectedValues 与按钮 active 态 */
  syncSelection() {
    if (!this.togglable) return
    let btns = findTreeNodes<Button>(this.childNodes, n => n instanceof Button)
    // 注意：myfx toArray 会把字符串拆成字符数组，这里必须按类型归一化
    let vals = Array.isArray(this.value) ? [...this.value] : [this.value as string]
    this.selectedValues = vals.filter(v => v != null && v !== '')
    each(btns, (btn) => {
      btn.toggleAttribute('active', this.selectedValues.includes(this.#buttonValue(btn)))
    })
  }
  @event('click')
  onButtonClick(e: MouseEvent) {
    if (!this.togglable) return
    if (!(e.target instanceof Button)) return

    let btn = e.target as Button
    let val = this.#buttonValue(btn)

    if (this.multiple) {
      if (this.selectedValues.includes(val)) {
        if (this.required && this.selectedValues.length < 2) {
          return
        }
        btn.toggleAttribute('active', false)
        remove(this.selectedValues, v => v == val)
      } else {
        this.selectedValues.push(val)
        btn.toggleAttribute('active', true)
      }
    } else {
      let lastSelectedBtn = find(this.children, (c: Button) => this.#buttonValue(c) === this.selectedValues[0])
      if (this.selectedValues.includes(val)) {
        if (this.required) {
          return
        }
        btn.toggleAttribute('active', false)
        remove(this.selectedValues, v => v == val)
      } else {
        if (lastSelectedBtn) {
          lastSelectedBtn.toggleAttribute('active', false)
        }
        this.selectedValues = [val]
        btn.toggleAttribute('active', true)
      }
    }
    let value = this.multiple ? clone(this.selectedValues) : this.selectedValues[0]
    this.value = value
    this.emit('change', { value })
  }
}
