import { CompElem, csscope, Csscope, emits, prop, tag, watch } from "compelem";
import { isNumeric } from "myfx";
import { Panel } from "./Panel";
import { panelGroupStyleSheet } from "./panelgroupStyleSheets";
/**
 * 面板组组件，用于管理多个Panel的展开/折叠状态
 * @attrs
 *  value {string|string[]} 当前展开的面板值，支持v-model
 *  multiple {boolean} 是否允许多个面板同时展开，默认false
 *  mandatory {boolean} 是否强制至少一个面板保持展开，默认false
 *  max {number} 最多可展开的面板数量
 *  gap {string | number} 面板之间默认的间隔，默认 0；stagger 展开后的间隔在 gap>0 时取 gap，否则用默认间隔
 *  inset {boolean} inset 变体：展开的面板向内缩进（对齐 vuetify expansion-panels inset）
 *  popout {boolean} popout 变体：展开的面板向外弹出并带投影（对齐 vuetify expansion-panels popout）
 *  stagger {boolean} stagger：默认 true。有面板展开时，展开面板的上下相邻位置出现间隔
 *    （gap>0 时大小为 gap，否则为默认间隔 12px，间隔带过渡动画）；设为 false 则不产生间隔
 *  readonly {boolean} 是否只读，默认false
 *  disabled {boolean} 是否禁用所有面板，默认false
 * @events
 *  update:value 展开面板值变化时触发
 *  change 展开状态变化时触发
 * @slots
 *  - 面板内容（ce-panel元素）
 *
 * @author holyhigh2
 */
@emits('update:value', 'change')
@tag('ce-panel-group')
export class PanelGroup extends CompElem<null> {
  //////////////////////////////////// props
  @prop({ type: [String, Number, Array] }) value: string | number | (string | number)[] = [];
  @prop multiple = false;
  @prop mandatory = false;
  @prop({ type: Number }) max: number | undefined;
  @prop({ type: [String, Number] }) gap: string | number = '0';
  @prop inset = false;
  @prop popout = false;
  // 默认开启：有面板展开时，展开面板的上下相邻位置以 gap 间隔显示
  @prop stagger = true;
  @prop readonly = false;
  @prop disabled = false;

  //////////////////////////////////// state
  @csscope(Csscope.HOST)
  static get hostCss() {
    return panelGroupStyleSheet;
  }

  /////////////////////////////////// watches
  @watch('gap', { immediate: true })
  watchGap(nv: string | number) {
    // gap 语义：面板之间默认的间隔，默认 0。
    // 仅在 gap>0 时以 CSS 变量下发：stagger 展开后的间隔取 var(--ce-panel-group-gap, 12px)——
    // gap>0 用 gap，否则回退样式表默认值；设为 0px 反而会让回退失效
    const gapNum = isNumeric(this.gap) ? Number(this.gap) : parseFloat(String(this.gap)) || 0
    if (gapNum > 0) {
      const gapCss = isNumeric(this.gap) ? this.gap + 'px' : this.gap
      this.style.setProperty('--ce-panel-group-gap', gapCss)
    } else {
      this.style.removeProperty('--ce-panel-group-gap')
    }
    // gap>0 时切换为分离卡片形态（对齐 vuetify gap 变体），供样式表区分连接/分离两种外观
    this.toggleAttribute('gapped', gapNum > 0)
  }

  @watch(['inset', 'popout', 'stagger'], { immediate: true })
  watchVariant() {
    this.toggleAttribute('inset', !!this.inset)
    this.toggleAttribute('popout', !!this.popout)
    this.toggleAttribute('stagger', !!this.stagger)
  }

  @watch('value', { immediate: true })
  watchValue(nv: string | number | (string | number)[]) {
    this.syncPanels()
  }

  @watch(['readonly', 'disabled'], { immediate: true })
  watchLockState() {
    this.syncPanels()
  }

  //////////////////////////////////// lifecycles
  mounted(): void {
    const setup = () => {
      this.syncPanels()
      this.setupPanels()
    }
    setup()
    // 子面板可能在组 mounted 之后才完成自定义元素升级：syncPanels 的升级守卫会跳过
    // 未升级面板，且 value 之后再无变化不会触发 watch —— 必须等 ce-panel 定义完成后
    // 重新同步一次，否则 value/readonly/disabled/grouped 全部落空
    customElements.whenDefined('ce-panel').then(() => setup())
  }

  //////////////////////////////////// methods
  #configuredPanels = new WeakSet<Panel>()

  private setupPanels() {
    const panels = this.getPanels()
    panels.forEach(panel => {
      if (this.#configuredPanels.has(panel)) return
      this.#configuredPanels.add(panel)
      // Panel 的 emit() 默认通道不派发 CustomEvent（仅框架内部处理器可达），
      // 原生 addEventListener 无法收到；改为 emit-native 使其派发真实 CustomEvent
      panel.setAttribute('emit-native', '')
      // 组内面板启用连接式手风琴外观（去阴影、直角、分隔线），对齐 vuetify expansion-panels
      panel.setAttribute('grouped', '')
      // 组内面板默认可折叠（对齐 vuetify：expansion-panel 天然可展开/收起），
      // 避免成员未声明 collapsible 时 header 不可点、body 恒展开
      panel.setAttribute('collapsible', '')
      panel.addEventListener('expand', this.onPanelExpand.bind(this) as EventListener)
      panel.addEventListener('collapse', this.onPanelCollapse.bind(this) as EventListener)
    })
  }

  private getPanels(): Panel[] {
    return Array.from(this.querySelectorAll('ce-panel')) as Panel[]
  }

  private syncPanels() {
    const panels = this.getPanels()
    if (!panels.length) return
    // 子 panel 在 group 初始化阶段（immediate watch）可能尚未升级为自定义元素，
    // 此时没有 updateProps 方法；跳过本轮，mounted() 阶段会再次 sync 落值。
    if (panels.some((panel) => typeof (panel as any).updateProps !== 'function')) return
    const expandedValues = this.getExpandedValues()
    const locked = this.disabled || this.readonly
    const disabled = this.disabled
    const flags: boolean[] = []
    panels.forEach(panel => {
      // readonly 为非 model prop，直接赋值会被框架丢弃，必须走 updateProps
      panel.updateProps({ readonly: locked })
      if (disabled) {
        panel.toggleAttribute('disabled', true)
      }

      const panelValue = panel.value || panels.indexOf(panel)
      const shouldExpand = expandedValues.includes(panelValue)

      if (panel.expanded !== shouldExpand) {
        panel.expanded = shouldExpand
      }
      flags.push(shouldExpand)
    })
    this.syncStaggerState(panels, flags)
  }

  /**
   * stagger 布局的标记同步：状态变化时落两个标记，样式表只读属性。
   *  - 宿主 [has-expanded]：组内存在展开面板
   *  - 面板 [prev-expanded]：它的下一个兄弟是展开面板
   */
  private syncStaggerState(panels: Panel[], flags: boolean[]) {
    this.toggleAttribute('has-expanded', flags.some(Boolean))
    panels.forEach((panel, i) => {
      panel.toggleAttribute('prev-expanded', i + 1 < panels.length && flags[i + 1])
    })
  }

  private getExpandedValues(): (string | number)[] {
    if (Array.isArray(this.value)) {
      return this.value
    }
    return this.value ? [this.value] : []
  }

  private onPanelExpand(e: CustomEvent) {
    const value = e.detail?.value
    if (value === undefined) return

    let expandedValues = this.getExpandedValues()

    if (!expandedValues.includes(value)) {
      if (this.multiple) {
        if (this.max === undefined || expandedValues.length < this.max) {
          expandedValues.push(value)
        } else {
          // 如果达到最大数量，移除第一个展开的面板
          expandedValues.shift()
          expandedValues.push(value)
        }
      } else {
        // 手风琴模式（对齐 vuetify expansion-panels 默认行为）：
        // 展开某一面板时自动收起其余面板，仅保留当前面板展开
        expandedValues = [value]
      }
    }

    this.updateValue(expandedValues)
  }

  private onPanelCollapse(e: CustomEvent) {
    const value = e.detail?.value
    if (value === undefined) return

    let expandedValues = this.getExpandedValues()
    const index = expandedValues.indexOf(value)

    if (index > -1) {
      // 如果是强制模式且只剩一个面板，则不允许折叠
      if (this.mandatory && expandedValues.length === 1) {
        // 重新展开该面板
        const panels = this.getPanels()
        const panel = panels.find(p => (p.value || panels.indexOf(p)) === value)
        if (panel) {
          panel.expanded = true
        }
        return
      }

      expandedValues.splice(index, 1)
      this.updateValue(expandedValues)
    }
  }

  private updateValue(values: (string | number)[]) {
    const newValue = this.multiple ? values : (values[0] || '')
    // value 为非 model prop，直接赋值会被框架丢弃导致联动状态失效，必须走 updateProps
    this.updateProps({ value: newValue })
    this.emit('update:value', { value: newValue })
    this.emit('change', { value: newValue })
  }
}
