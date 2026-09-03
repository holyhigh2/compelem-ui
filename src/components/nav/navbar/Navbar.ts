import { classes, CompElem, createRef, h, prop, tag, Template, csscope, Csscope } from "compelem";
import { find } from "myfx";
import style from "./style.scss?tmpl";
/**
 * 导航条
 * @attrs
 *  activeIndex {string} 当前激活的索引
 *  borderMode {boolean} 使用border模式，默认false
 *
 * @slots
 *  - 默认插槽，根元素都会作为菜单项，子项可通过dropdownmenu进行设置。菜单项的index属性会作为跟踪索引
 *  brand() 可放置logo信息
 *  right() 右侧内容框
 * @parts
 *  left/right 外部可通过::part(left/right)设置样式
 *
 * @author holyhigh2
 */
@tag('ce-navbar')
export class Navbar extends CompElem {
  slotRef = createRef<HTMLSlotElement>()
  //////////////////////////////////// props
  @prop borderMode = false;
  @prop({ type: String }) activeIndex: string;

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
    <nav class="ce-navbar" ${classes({ "ce-navbar-border": this.borderMode })}>
      <div class="ce-navbar-container">
        <div part="left" class="ce-navbar-left-part">
          <div class="ce-navbar-brand">
            <slot name="brand"></slot>
          </div>
          <div class="ce-navbar-items" @click="${this.onClick}">
            <slot ref="${this.slotRef}" @slotchange="${this.onItemsChange}"></slot>
          </div>
        </div>
        <div part="right" class="ce-navbar-right-part">
          <slot name="right"></slot>
        </div>
      </div>
    </nav>
    `;
  }

  //////////////////////////////////// methods
  onItemsChange(e: Event) {
    let slot = e.target as HTMLSlotElement
    let slotRoots = slot.assignedElements();

    if (this.activeIndex) {
      let root = find(slotRoots, root => root.getAttribute('index') == this.activeIndex)
      root!.classList.add('active');
    }
  }
  onClick(e: MouseEvent) {
    let menuItem = e.target as HTMLElement

    let slotRoots = this.slotRef.current?.assignedElements();
    let root = find(slotRoots!, root => root.contains(menuItem))

    if (!menuItem.hasAttribute('index') && !root!.hasAttribute('index')) return;

    slotRoots?.forEach(el => el.classList.remove('active'))
    root!.classList.add('active');
  }
}
