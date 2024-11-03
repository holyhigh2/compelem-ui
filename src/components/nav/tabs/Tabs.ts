import { CompElem, forEach, html, prop, state, tag, Template, watch } from "compelem";
import { each, flatMap } from "myfx";
import { Tab } from "./Tab";
import style from "./style.scss";
/**
 * 页签导航
 * @attrs
 *  activeIndex {string} 当前激活的索引
 *  appearance {string} 外观。tab/underline/card
 *  vertical {boolean} 是否垂直
 *  color {string} 激活/高亮时的颜色，默认主色
 *  full {boolean} 撑满整行
 *
 * @slots
 *  - 默认插槽，根元素都会作为菜单项，子项可通过dropdownmenu进行设置。菜单项的index属性会作为跟踪索引
 * @events
 *  select({activeIndex,activeNode}) 选中节点时触发
 *
 * @author holyhigh2
 */
@tag("l-tabs")
export class Tabs extends CompElem {
  el_slot: HTMLSlotElement;
  //////////////////////////////////// props
  @prop({ type: String }) activeIndex: string;
  @prop appearance = "tab"; //tab/underline/card
  @prop vertical = false;
  @prop color = '#2196f3'
  @prop full = false

  @state tagLabels: any[] = []

  tabMap: Record<string, Tab> = {}

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  @watch('color', { immediate: true })
  function(nv: string) {
    this.style.setProperty('--color', this.color)
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`
    <div class="c-tabs">
      <l-nav .active-index="${this.activeIndex}" .appearance="${this.appearance}" .vertical="${this.vertical}" .color="${this.color}" .full="${this.full}" @select="${this.onSelect}">
        ${forEach(this.tagLabels, (label: { index: string, label: string }) => html`<div key="${label.index}" index="${label.index}">${label.label}</div>`)}
      </l-nav>
      <slot @slotchange="${this.onTabsChange}"></slot>
    </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods
  onTabsChange(e: Event) {
    let slot = e.target as HTMLSlotElement
    let slotRoots = slot.assignedElements();
    this.tagLabels = flatMap(slotRoots, tab => {
      if (tab instanceof Tab) {
        this.tabMap[tab.index] = tab
        if (tab.index == this.activeIndex) {
          tab.classList.add('active')
        }
        return { label: tab.label, index: tab.index }
      }
      return []
    })
  }
  onSelect(e: CustomEvent) {
    let { activeIndex } = e.detail
    each(this.tabMap, (v) => v.classList.remove('active'))
    let tab = this.tabMap[activeIndex]
    tab.classList.add('active')
  }
}
