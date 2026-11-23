import { bind, classes, createRef, csscope, Csscope, emits, h, prop, state, styles, tag, Template, watch } from "compelem";
import { find } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import style from "./style.scss?tmpl";
const UNSELECTABLE = 'unhoverable'
/**
 * 导航基础
 * @attrs
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
    // 外部改 value 时目标页签可能还没插槽就位（列表重建中），直接放弃会让
    // 页签停在旧激活态。下一帧重试几次，直到目标项可用。
    const apply = (retry: number) => {
      if (nv !== this.activeIndex) return;
      let slotRoots = this.slotRef.current?.assignedElements({ flatten: true });
      let root = slotRoots && find(slotRoots, (root) => root.getAttribute('index') === nv);
      if (!root) {
        if (retry < 3) requestAnimationFrame(() => apply(retry + 1));
        return;
      }
      this._active(root as HTMLElement);
    };
    apply(0);
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
            <div class="ce-nav-tab-frame"></div>
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
      // 指定的激活项还没就位（页签列表刚重建）：退回第一项会把旧页签
      // 重新激活，出现两个 active。交给 watchIndex 的重试处理。
      if (!root) return;
    }
    const first = root as HTMLElement || slotRoots[0];
    this._active(first)
    // 首屏缺口直接就位，下一帧起才启用过渡
    this.updateTabNotch(first)
    requestAnimationFrame(() => this.classList.add('tab-notch-ready'))

    this.updateVWidth()

    this.emit("item-change", { node: root });
  }
  // 激活项相对 .ce-nav-items 的起点与长度，横向是 left/width，竖向是 top/height
  updateTabNotch(node: HTMLElement) {
    const items = this.slotRef.current?.parentElement;
    if (!items || !node) return;
    const base = items.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    const start = this.vertical ? rect.top - base.top : rect.left - base.left;
    const size = this.vertical ? rect.height : rect.width;
    this.style.setProperty("--tab-notch-start", start + "px");
    this.style.setProperty("--tab-notch-size", size + "px");
  }
  updateVWidth() {
    let slotRoots = this.slotRef.current?.assignedElements({ flatten: true });
    (slotRoots as HTMLElement[])?.forEach((v: HTMLElement) => {
      // 下划线宽度只在 active 项上展开（::after width/height:var(--underline-width)）；
      // _active 先置 0 再在 active 类就位后由这里撑开，形成滑动动画。
      // 横向下划线长度=item宽；竖向（::after 用 height）长度=item高
      if (v.classList.contains("active")) {
        const len = this.vertical ? v.offsetHeight : v.offsetWidth;
        v.style.setProperty("--underline-width", len + "px");
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
  /**
   * 激活序号：外部连续改 value、插槽重建都会多次调用 `_active`，
   * 只有最后一次的延时提交有效，否则晚到的旧提交会把 active 类加回旧项。
   */
  private __activeSeq = 0
  _active(node: HTMLElement) {
    let slotRoots = this.slotRef.current?.assignedElements({ flatten: true });
    let lastActiveNode = find(slotRoots!, (root) => root !== node && root.classList.contains('active')) as HTMLElement
    if (!lastActiveNode) {
      // Tabs.changeTab 可能已把 active 类挪到 node 上，此时按「还残留着
      // 下划线宽度」找上一项，保证它的下划线能被收回
      lastActiveNode = find(slotRoots!, (root) => {
        if (root === node) return false
        const w = parseFloat((root as HTMLElement).style.getPropertyValue('--underline-width') || '0')
        return w > 0
      }) as HTMLElement
    }
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

    const seq = ++this.__activeSeq
    setTimeout(() => {
      // 已有更新的激活请求，本次延时提交作废
      if (seq !== this.__activeSeq) return;
      slotRoots?.forEach((el) => {
        el.classList.remove("active");
        // 非当前项的下划线宽度必须归零：外部改 value 时 active 类可能已被
        // Tabs.changeTab 提前挪走，旧项宽度不收就会出现两条激活下划线
        if (el !== node) (el as HTMLElement).style.setProperty("--underline-width", "0")
      });
      node.classList.add("active");
      this.updateTabNotch(node);
      // 归位：active 下划线最终停靠在自身左/上缘。向左(上)切换时 _active 先把
      // left 置 100% 供滑入动画，若不归位，展开的下划线会落在相邻项下方
      // （CSS 中的 .is-active 归位规则与实际类名 .active 不匹配，属死代码）
      node.style.setProperty('--underline-left', '0%')
      this.nextTick(() => {
        this.updateVWidth()
      })
    }, 100);

  }
}
