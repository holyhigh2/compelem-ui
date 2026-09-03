import { ICloseable } from "@/interfaces/ICloseable";
import { csscope, Csscope, emits, h, prop, query, show, state, tag, Template, watch } from "compelem";
import { each, isEmpty } from "myfx";
import { AppearanceElem, AppearanceSpace } from "../../../base/Appearance";
import { ChevronLeft, ChevronRight } from "../../../icons/icons";
import { Tab } from "./Tab";
import style from "./style.scss?tmpl";
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
    return [style];
  }
  /////////////////////////////////// watches
  //总是定位到显示位置
  @watch('value')
  watchIndex(nv: string) {
    this.nextTick(() => {
      let activeNode = this.nav.querySelector(`:scope>[index="${nv}"]`) as HTMLElement
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
        <div ${show(this.showSlide)} class="ce-tabs-slide is-left" @click="${this.slideNav}">
          <ce-icon .svg="${ChevronLeft}" ></ce-icon>
        </div>
        <div class="ce-tabs-nav" @resize.debounce="${this.onNavResize}">
          <ce-nav @item-change="${this.updateSlide}" .reversed="${this.reversed}" .active-index="${this.value}" .appearance="${this.appearance}" .vertical="${this.vertical}" .color="${this.color}" @select="${this.onSelect}">
            <slot ></slot>
          </ce-nav>
        </div>
        <div ${show(this.showSlide)} class="ce-tabs-slide is-right" @click="${this.slideNav}">
          <ce-icon .svg="${ChevronRight}" ></ce-icon>
        </div>
        <div class="ce-tabs-extra" ${show(!isEmpty(this.slots.extra))}>
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
  }
  onClickClose(tab: Tab) {
    this.emit('close', { label: tab.label, index: tab.index, node: tab })
  }
  onNavResize() {
    let activeNode = this.nav.querySelector(`:scope>[index="${this.value}"]`) as HTMLElement
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
  onSelect(obj: Record<string, any>) {
    let { activeIndex, activeNode } = obj

    if (this.lastSelected === activeIndex) return;

    let tab = (this.slots.default as Tab[]).find((t: Tab) => t.index === activeIndex) as Tab
    if (tab.disabled) return
    this.changeTab(activeIndex)
    this.moveToShow(activeNode)

    this.value = activeIndex

    this.emit('select', { label: tab.label, index: activeIndex, node: activeNode })
  }
  changeTab(activeIndex: number | string) {
    each(this.slots.default, (v: Tab) => v.classList.remove('active'))
    let tab = (this.slots.default as Tab[]).find((t: Tab) => t.index === activeIndex) as Tab
    tab.classList.add('active')
    this.lastSelected = activeIndex
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
    let direction = (e.target as HTMLElement).classList.contains('is-left') ? 'left' : 'right'
    const navConW = this.navCon.offsetWidth
    const navW = this.nav.offsetWidth
    let tLeft = parseFloat(this.nav.style.transform.replace(/translateX\(([^()]*)\)/, '$1')) || 0
    tLeft *= -1
    let sl = tLeft + (direction === 'left' ? -navConW : navConW)
    if (sl < 0) sl = 0
    if (sl > navW - navConW) sl = navW - navConW
    this.nav.style.transform = `translateX(-${sl}px)`
  }
}
