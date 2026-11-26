import { ICloseable } from "@/interfaces/ICloseable";
import { csscope, Csscope, emits, h, prop, query, show, state, tag, Template, watch } from "compelem";
import { each, isEmpty } from "myfx";
import { AppearanceElem, AppearanceSpace } from "../../../base/Appearance";
import { activatable } from "../../../directives/a11y/Activatable";
import { ChevronLeft, ChevronRight } from "../../../icons/icons";
import { t } from "../../../locale";
import { Tab } from "./Tab";
import style from "./style.scss?tmpl";
import { FADE_CSS } from "../../../css/transition";
/**
 * 页签导航
 * @attrs
 *  value {string|number} 当前激活的索引，受控model属性
 *  appearance {string} 外观。tab/underlined/card
 *  vertical {boolean} 是否垂直，默认false
 *  color {string} 激活/高亮时的颜色，默认主色
 *  full {boolean} 撑满整行，默认false
 *  reversed {boolean} 是否反向，默认false
 *  closable {boolean} 是否显示关闭按钮，默认false
 *
 * @slots
 *  - 默认插槽，根元素都会作为菜单项，子项可通过dropdownmenu进行设置。菜单项的index属性会作为跟踪索引
 * @events
 *  select({label,index,node}) 选中节点时触发
 *  close({label,index,node}) 关闭页签时触发
 *
 * @a11y
 *  ce-nav 宿主是 role=tablist，页签是 role=tab；整组只留一个 tabindex=0 停靠点
 *  （roving tabindex），方向键在启用项间循环、Home/End 跳首尾；
 *  左右滚动按钮是 role=button 且带可访问名称，键盘可激活。
 *
 * @author holyhigh2
 */
@emits('select', 'close', 'update:value')
@tag("ce-tabs")
export class Tabs extends AppearanceElem implements ICloseable {
  @prop closable: boolean = false;
  //////////////////////////////////// props
  @prop({ type: [String, Number], model: true }) value: string | number
  appearance = "underlined"; //tab/underline/card
  @prop vertical = false;
  @prop full = false
  @prop({ type: [Boolean, String] }) ripple: boolean | string = true;
  @prop reversed = false
  @prop space = AppearanceSpace.Default

  @state tagLabels: any[] = []
  @state showSlide = false

  // tabMap: Record<string, Tab> = {}
  @query('.ce-tabs-nav') navCon: HTMLElement
  @query('ce-nav') nav: HTMLElement

  @csscope(Csscope.INNER)
  static get css() {
    return [style, FADE_CSS];
  }
  /////////////////////////////////// watches
  //总是定位到显示位置
  @watch('value')
  watchIndex(nv: string) {
    this.nextTick(() => {
      let activeNode = this.__tabOf(nv)
      if (activeNode) {
        this.changeTab(nv)
        this.moveToShow(activeNode)
      }
    })
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
      <nav class="ce-tabs" ?vertical="${this.vertical}">
        <div ${show(this.showSlide, { transition: "fade" })} class="ce-tabs-slide is-left"
          ${activatable({ label: t('tabs.scrollPrev'), activate: () => this.slide('left') })}
          @click="${this.slideNav}">
          <ce-icon .svg="${ChevronLeft}" ></ce-icon>
        </div>
        <div class="ce-tabs-nav" @resize.debounce="${this.onNavResize}" @wheel="${this.onWheel}">
          <ce-nav role="tablist" @item-change="${this.updateSlide}" .reversed="${this.reversed}" .active-index="${this.value}" .appearance="${this.appearance}" .vertical="${this.vertical}" .color="${this.color}" @select="${this.onSelect}" @keydown="${this.onNavKeydown}">
            <slot ></slot>
          </ce-nav>
        </div>
        <div ${show(this.showSlide, { transition: "fade" })} class="ce-tabs-slide is-right"
          ${activatable({ label: t('tabs.scrollNext'), activate: () => this.slide('right') })}
          @click="${this.slideNav}">
          <ce-icon .svg="${ChevronRight}" ></ce-icon>
        </div>
        <div class="ce-tabs-extra" ${show(!isEmpty(this.slots.extra), { transition: "fade" })}>
          <slot name="extra"></slot>
        </div>
      </nav>
    `;
  }

  mounted(): void {
    this.updateSlide()
  }
  //////////////////////////////////// methods
  updateSlide() {
    this.showSlide = this.nav.offsetWidth > this.navCon.offsetWidth
  }
  slotChange(slot: HTMLSlotElement, name: string): void {
    let items = slot.assignedElements({ flatten: true })
    items.forEach(it => {
      if (it instanceof Tab) {
        it.setAttribute('space', this.space)
        it.setAttribute('size', this.size)
      }
    })
    // 增删页签后按当前 value 重算选中态与 roving tabindex：新页签带着 Tab 自己的
    // 兜底默认值（aria-selected=false / tabindex=-1）进来，不重算就会出现
    // 「整组没有 tabindex=0 停靠点」或「选中项不是 value 指向的那个」。
    this.changeTab(this.value)
  }
  onClickClose(tab: Tab) {
    this.emit('close', { label: tab.label, index: tab.index, node: tab })
  }
  onNavResize() {
    let activeNode = this.__tabOf(this.value)
    if (activeNode)
      this.moveToShow(activeNode)
    this.updateSlide()
    let maxRight = this.nav.offsetWidth - this.navCon.offsetWidth
    if (maxRight < 0) maxRight = 0
    let tLeft = parseFloat(this.nav.style.transform.replace(/translateX\(([^()]*)\)/, '$1')) || 0
    if (tLeft > 0) tLeft = 0
    if (tLeft < maxRight) tLeft = maxRight
    this.nav.style.transform = `translateX(-${tLeft}px)`
  }
  lastSelected: any
  private __wheelTimer = 0
  onSelect(obj: Record<string, any>) {
    let { activeIndex, activeNode } = obj

    if (this.lastSelected === activeIndex) return;

    let tab = (this.slots.default as Tab[]).find((t: Tab) => t.index === activeIndex) as Tab
    if (!tab || tab.disabled) return
    this.changeTab(activeIndex)
    this.moveToShow(activeNode)

    this.value = activeIndex

    this.emit('select', { label: tab.label, index: activeIndex, node: activeNode })
  }
  changeTab(activeIndex: number | string) {
    // roving tabindex：整组只留一个 tabindex=0 的停靠点，其余 -1。
    // aria-selected 必须显式写 false 而不是省略，否则读屏把未选中页签也当成候选。
    each(this.slots.default, (v: Tab) => {
      const on = v.index === activeIndex
      v.classList.toggle('active', on)
      v.setAttribute('aria-selected', String(on))
      v.setAttribute('tabindex', on ? '0' : '-1')
    })
    this.lastSelected = activeIndex
  }
  /**
   * 按 index 取页签。
   *
   * 不能用 `this.nav.querySelector(':scope>[index=...]')`：页签是 ce-tabs 的
   * 光 DOM 子节点，经插槽**分发**进 ce-nav，并没有被重新父化，所以 ce-nav 的
   * 直接子元素只有那个 <slot>，选择器恒返回 null —— 外部改 value 因此从来不同步。
   * slots.default 才是权威列表（changeTab / onSelect 一直用的就是它）。
   */
  __tabOf(index: number | string): Tab | undefined {
    return (this.slots.default as Tab[])?.find((t: Tab) => t.index === index)
  }
  moveToShow(activeNode: HTMLElement) {
    if (!activeNode) return
    let allTabs = this.slots.default
    let navConRect = this.navCon.getBoundingClientRect()
    let activeNodeRect = activeNode.getBoundingClientRect()
    //如果当前节点加下一个节点的一半超过边界就移动
    let nextActiveNode = activeNode.nextElementSibling as HTMLElement
    let nextActiveNodeRect = nextActiveNode && allTabs.includes(nextActiveNode) ? nextActiveNode.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 }
    let prevActiveNode = activeNode.previousElementSibling as HTMLElement
    let prevActiveNodeRect = prevActiveNode && allTabs.includes(prevActiveNode) ? prevActiveNode.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 }
    let nodeRight = activeNodeRect.x + activeNodeRect.width + nextActiveNodeRect.width / 2
    if (nodeRight > navConRect.x + navConRect.width) {
      let tLeft = -(activeNode.offsetLeft - navConRect.width + activeNodeRect.width + nextActiveNodeRect.width / 2)
      if (tLeft < -(this.nav.offsetWidth - navConRect.width)) tLeft = -(this.nav.offsetWidth - navConRect.width)
      this.nav.style.transform = `translateX(${tLeft}px)`
    } else if (activeNodeRect.x - prevActiveNodeRect.width / 2 < navConRect.x) {
      let tLeft = -(activeNode.offsetLeft - activeNodeRect.width / 2 - prevActiveNodeRect.width / 2)
      if (tLeft > 0) tLeft = 0
      this.nav.style.transform = `translateX(${tLeft}px)`
    }
  }
  slideNav(e: MouseEvent) {
    this.slide((e.target as HTMLElement).classList.contains('is-left') ? 'left' : 'right')
  }
  slide(direction: 'left' | 'right') {
    const navConW = this.navCon.offsetWidth
    const navW = this.nav.offsetWidth
    let tLeft = parseFloat(this.nav.style.transform.replace(/translateX\(([^()]*)\)/, '$1')) || 0
    tLeft *= -1
    let sl = tLeft + (direction === 'left' ? -navConW : navConW)
    if (sl < 0) sl = 0
    if (sl > navW - navConW) sl = navW - navConW
    this.nav.style.transform = `translateX(-${sl}px)`
  }
  /**
   * 鼠标滚轮 / 触控板横滑映射为页签横向平移，免去逐个点两侧箭头。
   * - vertical 布局的 ce-nav 被 `transform:none!important` 锁死，直接跳过。
   * - 优先取横向增量 deltaX（触控板横滑），普通鼠标只有 deltaY，映射为横向。
   * - deltaMode 区分 px / 行 / 页，避免“行”模式下每次只挪 3px 几乎不动。
   * - 仅在实际发生位移时 preventDefault：到达两端后把滚动交还页面，避免卡住整页滚动。
   * - 滚动期间临时去掉 0.3s 过渡让操作跟手，停滚后再恢复。
   */
  onWheel(e: WheelEvent) {
    if (this.vertical || !this.showSlide) return
    const navConW = this.navCon.offsetWidth
    const max = this.nav.offsetWidth - navConW
    if (max <= 0) return

    // deltaMode: 0=像素, 1=行, 2=页
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? navConW : 1
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (!raw) return
    const delta = raw * unit

    // style.transform 形如 translateX(-Npx)，取回当前已平移的 N（正值）
    const cur = -(parseFloat(this.nav.style.transform.replace(/translateX\(([^()]*)\)/, '$1')) || 0)
    let next = cur + delta
    if (next < 0) next = 0
    if (next > max) next = max
    if (next === cur) return

    e.preventDefault()
    this.nav.style.transition = 'none'
    this.nav.style.transform = `translateX(-${next}px)`
    clearTimeout(this.__wheelTimer)
    this.__wheelTimer = window.setTimeout(() => {
      this.nav.style.transition = ''
    }, 120)
  }
  /**
   * WAI-ARIA APG 的 tablist 键盘模型：方向键在**启用**项之间循环，Home/End 跳首尾。
   * 跳过 disabled 项，否则键盘用户会停在一个点不动的页签上。
   */
  onNavKeydown(e: KeyboardEvent) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const items = (this.slots.default as Tab[]) ?? []
    const enabled = items.filter((t: Tab) => !t.disabled)
    if (enabled.length < 1) return
    e.preventDefault()
    const i = enabled.findIndex((t: Tab) => t.index === this.value)
    let next: Tab
    if (e.key === 'Home') next = enabled[0]
    else if (e.key === 'End') next = enabled[enabled.length - 1]
    else {
      // 未选中时从首/尾起步；已选中时按方向循环
      const step = e.key === 'ArrowRight' ? 1 : -1
      const from = i < 0 ? (step > 0 ? -1 : 0) : i
      next = enabled[(from + step + enabled.length) % enabled.length]
    }
    if (!next || next.index === this.value) return
    this.changeTab(next.index)
    this.moveToShow(next)
    this.value = next.index
    this.emit('select', { label: next.label, index: next.index, node: next })
  }
}
