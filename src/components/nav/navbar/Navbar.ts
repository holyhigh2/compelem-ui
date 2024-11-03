import { classes, CompElem, createRef, html, prop, tag, Template } from "compelem";
import { find } from "myfx";
import style from "./style.scss";
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
@tag('l-navbar')
export class Navbar extends CompElem {
  slotRef = createRef<HTMLSlotElement>()
  //////////////////////////////////// props
  @prop borderMode = false;
  @prop({ type: String }) activeIndex: string;

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`
    <nav class="c-navbar ${classes({ __border: this.borderMode })}">
      <div class="--container">
        <div part="left" class="--left-part">
          <div class="--brand">
            <slot name="brand"></slot>
          </div>
          <div class="--items" @click="${this.onClick}">
            <slot ref="${this.slotRef}" @slotchange="${this.onItemsChange}"></slot>
          </div>
        </div>
        <div part="right" class="--right-part">
          <slot name="right"></slot>
        </div>
      </div>
    </nav>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() {
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

    let slotRoots = this.slotRef.current.assignedElements();
    let root = find(slotRoots, root => root.contains(menuItem))

    if (!menuItem.hasAttribute('index') && !root!.hasAttribute('index')) return;

    slotRoots.forEach(el => el.classList.remove('active'))
    root!.classList.add('active');
  }
}
