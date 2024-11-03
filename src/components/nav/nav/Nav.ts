import { classes, CompElem, createRef, html, prop, tag, Template, watch } from "compelem";
import { find } from "myfx";
import style from "./style.scss";
const UNSELECTABLE = 'unhoverable'
/**
 * 导航基础
 * @attrs
 *  activeIndex {string} 当前激活索引，受控
 *  appearance {string} 外观。default/tab/underline/card
 *  vertical {boolean} 是否垂直
 *  color {string} 激活/高亮时的颜色，默认主色
 *  full {boolean} 撑满整行
 *
 * @slots
 *  - 默认插槽，根元素都会作为导航项，子项可通过l-dropdown进行设置。导航项的index属性会作为跟踪索引。设置了unhoverable属性的导航项不会触发悬停效果
 * @events
 *  select({activeIndex,activeNode}) 选中节点时触发
 *
 * @author holyhigh2
 */
@tag("l-nav")
export class Nav extends CompElem {
  slotRef = createRef<HTMLSlotElement>()
  //////////////////////////////////// props
  @prop({ type: String }) activeIndex: string;
  @prop appearance = "default"; //default/tab/underline/card
  @prop vertical = false;
  @prop color = '#2196f3'
  @prop full = false

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  @watch('color', { immediate: true })
  function(nv: string) {
    this.style.setProperty('--color', this.color)
  }
  @watch('activeIndex')
  watchIndex(nv: string) {
    let slotRoots = this.slotRef.current.assignedElements();
    let root = find(slotRoots, (root) => root.getAttribute('index') === nv);
    this.onClick({ target: root } as any);
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`
      <nav
        class="c-nav ${classes({
      __full: this.full,
      __vertical: this.vertical,
      ["__appearance-" + this.appearance]: true,
    })}"
      >
      <div class="--container">
          <div class="--items" @click="${this.onClick}">
            <slot
              ref="${this.slotRef}"
              @slotchange="${this.onItemsChange}"
            ></slot>
          </div>
        </div>
      </nav>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods
  onItemsChange(e: Event) {
    let slot = e.target as HTMLSlotElement
    let slotRoots = slot.assignedElements();

    if (this.activeIndex) {
      let root = find(
        slotRoots,
        (root) => root.getAttribute("index") == this.activeIndex
      );
      root && root!.classList.add("active");
    }
  }
  onClick(e: MouseEvent) {
    let menuItem = e.target as HTMLElement;

    let slotRoots = this.slotRef.current.assignedElements();
    let root = find(slotRoots, (root) => root.contains(menuItem) && !root.hasAttribute(UNSELECTABLE));

    if (!menuItem || root) {
      slotRoots.forEach((el) => el.classList.remove("active"));
    }

    if (!root) return;
    if (!menuItem.hasAttribute("index") && !root!.hasAttribute("index")) return;

    root!.classList.add("active");

    this.emit("select", { activeIndex: root?.getAttribute('index'), activeNode: root });
  }
}
