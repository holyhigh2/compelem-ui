import { bind, classes, createRef, csscope, Csscope, emits, h, prop, state, styles, tag, Template, watch } from "compelem";
import { find } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import style from "./style.scss?tmpl";
const UNSELECTABLE = 'unhoverable'
/**
 * 导航基础
 * @props
 *  activeIndex {string} 当前激活索引，受控
 *  appearance {string} 外观。default/tab/underlined/pill
 *  vertical {boolean} 是否垂直
 *  sliderColor {string} 滑动条颜色，默认 #2196f3
 *  color {string} tab激活颜色，默认 #2196f3
 *  bgColor {string} 背景色
 *  bgStyle {string} 背景样式
 *  align {string}  内容对齐方式，默认center。支持 left/center/right
 *  reversed {boolean} 是否反向，默认false
 *
 * @slots
 *  - 默认插槽，根元素都会作为导航项，子项可通过ce-dropdown进行设置。导航项的index属性会作为跟踪索引。设置了unhoverable属性的导航项不会触发悬停效果；disabled属性不会响应点击事件
 * @events
 *  select({activeIndex,activeNode}) 选中节点时触发
 *  item-change() 导航项变化时触发
 * @author holyhigh2
 */
@emits("select", "item-change")
@tag("ce-nav")
export class Nav extends AppearanceElem {
  slotRef = createRef<HTMLSlotElement>()
  //////////////////////////////////// props
  @prop({ type: String }) activeIndex: string;
  @prop appearance = "default"; //default/tab/underlined/pill
  @prop vertical = false;
  @prop align = 'center'
  @prop reversed = false
  @prop sliderColor = '#2196f3'
  @prop({ type: String }) bgColor: string

  @state vWidth = 'auto'

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  get cssVars() {
    return {
      '--nav-item-align': this.align,
      '--nav-item-min-width': this.vWidth
    }
  }
  /////////////////////////////////// watches
  @watch('sliderColor', { immediate: true })
  watchSliderColor(nv: string) {
    this.style.setProperty('--color-slider', nv)
  }
  @watch('color', { immediate: true })
  function(nv: string) {
    if (nv)
      this.style.setProperty('--color-nav', nv)
  }
  @watch('activeIndex')
  watchIndex(nv: string) {
    let slotRoots = this.slotRef.current?.assignedElements({ flatten: true });
    let root = find(slotRoots!, (root) => root.getAttribute('index') === nv);
    this.onClick({ target: root } as any);
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
      <nav
        class="ce-nav ce-nav-appearance"
        ${classes({
      "is-vertical": this.vertical,
      "is-horizontal": !this.vertical,
      "ce-nav-reversed": this.reversed,
      ["ce-nav-appearance-" + this.appearance]: true,
    })}
      ${styles({
      background: this.bgColor
    })}
      ${bind(this.attrs)}
      >
      <div class="ce-nav-container">
          <div class="ce-nav-items" @click="${this.onClick}" 
        >
            <slot
              ref="${this.slotRef}"
              @slotchange="${this.onItemsChange}"
            ></slot>
          </div>
        </div>
      </nav>
    `;
  }
  //////////////////////////////////// methods
  onItemsChange(e: Event) {
    let slot = e.target as HTMLSlotElement
    let slotRoots = slot.assignedElements({ flatten: true });
    if (slotRoots.length < 1) {
      return;
    }

    // slotRoots.forEach((v) => v.classList.remove('active'))
    let root
    if (this.activeIndex) {
      root = find(
        slotRoots,
        (root) => root.getAttribute("index") == this.activeIndex
      );

    }
    this._active(root as HTMLElement || slotRoots[0])

    this.updateVWidth()

    this.emit("item-change", { node: root });
  }
  updateVWidth() {
    let maxW = 0
    let slotRoots = this.slotRef.current?.assignedElements({ flatten: true });
    (slotRoots as HTMLElement[])?.forEach((v: HTMLElement) => {
      if (v.offsetWidth > maxW) {
        maxW = v.offsetWidth
      }
    })
    // this.vWidth = maxW + 'px'
  }
  onClick(e: MouseEvent) {
    let menuItem = e.target as HTMLElement;
    if (menuItem.hasAttribute('disabled')) return
    let slotRoots = this.slotRef.current?.assignedElements({ flatten: true });
    let root = find(slotRoots!, (root) => root.contains(menuItem) && !root.hasAttribute(UNSELECTABLE));
    if (root?.classList.contains("active")) {
      return
    }
    // if (!menuItem || root) {
    //   slotRoots.forEach((el) => el.classList.remove("active"));
    // }

    if (!root) return;
    if (!menuItem.hasAttribute("index") && !root!.hasAttribute("index")) return;

    this._active(root as HTMLElement)

    this.emit("select", { activeIndex: root?.getAttribute('index'), activeNode: root });
  }
  _active(node: HTMLElement) {
    let slotRoots = this.slotRef.current?.assignedElements({ flatten: true });
    let lastActiveNode = find(slotRoots!, (root) => root.classList.contains('active')) as HTMLElement
    if (!lastActiveNode) {
      let tmp = find(slotRoots!, (root) => root.getAttribute('index') === this.activeIndex) as HTMLElement
      if (tmp !== node) {
        lastActiveNode = tmp
      }
    }
    let toLeft = lastActiveNode ? lastActiveNode.offsetLeft > node.offsetLeft : false;
    if (this.vertical) {
      toLeft = lastActiveNode ? lastActiveNode.offsetTop > node.offsetTop : false;
    }
    if (lastActiveNode && toLeft) {
      node.style.setProperty('--underline-left', '100%')
      node.style.setProperty('--underline-width', '0')
      node.classList.toggle('to-left', true)
      lastActiveNode.style.setProperty('--underline-left', '0%')
      lastActiveNode.style.setProperty('--underline-width', '0')
    } else {
      node.style.setProperty('--underline-left', '0%')
      node.style.setProperty('--underline-width', '0')
      node.classList.toggle('to-right', true)
      if (lastActiveNode) {
        lastActiveNode.style.setProperty('--underline-left', '100%')
        lastActiveNode.style.setProperty('--underline-width', '0')
      }
    }

    setTimeout(() => {
      slotRoots?.forEach((el) => el.classList.remove("active"));
      node.classList.add("active");
      this.nextTick(() => {
        this.updateVWidth()
      })
    }, 100);

  }
}
