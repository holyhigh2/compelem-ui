import { classes, CompElem, createRef, h, prop, tag, Template, csscope, Csscope, watch } from "compelem";
import { find } from "myfx";
import style from "./style.scss?tmpl";
/**
 * 导航条
 * @attrs
 *  activeIndex {string} 当前激活的索引
 *  borderMode {boolean} 使用border模式，默认false
 *  appearance {string} 激活项外观：default / underlined / pill / block，默认 default
 *   - default 仅主色文字加粗；underlined 底部2px主色线；pill 主色低透明胶囊；block 主色整块背景+反色文字
 *  color {string} 激活项高亮主色（CSS 颜色）；未设置时用 --ce-color-primary
 *
 * @slots
 *  - 默认插槽，根元素都会作为菜单项，子项可通过dropdownmenu进行设置。菜单项的index属性会作为跟踪索引
 *  brand() 可放置logo信息
 *  center() 中部内容（2026-10-21 新增），**绝对居中于整条 navbar**
 *  right() 右侧内容框
 * @parts
 *  left/center/right 外部可通过::part(left/center/right)设置样式
 *
 * @author holyhigh2
 */
@tag('ce-navbar')
export class Navbar extends CompElem {
  slotRef = createRef<HTMLSlotElement>()
  //////////////////////////////////// props
  @prop borderMode = false;
  @prop({ type: String }) activeIndex: string;
  @prop appearance = "default"; // default / underlined / pill / block
  @prop({ type: String }) color: string;

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  @watch("color", { immediate: true })
  watchColor(nv: string) {
    if (nv) this.style.setProperty("--ce-navbar-active-color", nv);
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
    <nav class="ce-navbar" ${classes({ "ce-navbar-border": this.borderMode, ["ce-navbar-appearance-" + this.appearance]: true })}>
      <div class="ce-navbar-container">
        <div part="left" class="ce-navbar-left-part">
          <div class="ce-navbar-brand">
            <slot name="brand"></slot>
          </div>
          <div class="ce-navbar-items" @click="${this.onClick}">
            <slot ref="${this.slotRef}" @slotchange="${this.onItemsChange}"></slot>
          </div>
        </div>
        <div part="center" class="ce-navbar-center-part">
          <slot name="center"></slot>
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
