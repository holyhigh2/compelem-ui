import { classes, CompElem, csscope, Csscope, h, prop, state, tag, Template, watch } from "compelem";
import { closest, isBlank, isEmpty, isUndefined } from "myfx";
import { IPlacement } from "../../../interfaces/IPlacement";
import { Dialog } from "../dialog/Dialog";
import style from "./style.scss?tmpl";

const GAP = 5;
const enum TriggerType {
  CLICK = 'click',
  HOVER = 'hover'
}
/**
 * 文字提示，用于替代原生title属性
 * @props
 *  content {string} 提示内容或通过slot设置
 *  trigger {array} 触发方式 hover/click/none，默认hover
 *  placement {string} right/right-start/right-end/ left/left-start/left-end top/top-start/top-end bottom/bottom-start/bottom-end
 *  arrow {boolean} 是否显示箭头，默认true
 *  disabled {boolean} 是否禁用，默认false
 *  alwaysShow {boolean} 一直显示，同时持续监控目标元素变化（位置、尺寸）
 *  interactive {boolean} 提示框是否可响应鼠标事件，默认false
 *  dragFollow {boolean} 拖动跟随：按下目标元素时显示，拖动过程中跟随目标位置，松开后隐藏，默认false
 * @methods
 *  open() 显示
 *  close() 关闭
 *
 * @slots
 *  default 触发点，必须是一个元素
 *  content 显示内容
 *
 * @author holyhigh2
 */
@tag("ce-tooltip")
export class Tooltip extends CompElem implements IPlacement {
  defaultSlot: HTMLSlotElement;
  hook_mouseenter: any;
  hook_mouseleave: any;
  hook_dragstart: any;
  hook_dragmove: any;
  hook_dragend: any;
  //////////////////////////////////// props
  @prop content = "";
  @prop trigger = TriggerType.HOVER;
  @prop placement = "right";
  @prop arrow = true;
  @prop disabled = false;
  @prop alwaysShow = false;
  @prop interactive = false
  @prop dragFollow = false

  @state direction = 'right'
  @state startOrEnd = ''
  @state adjustedDirection = ''

  __anchor: Element;
  __timer: ReturnType<typeof setTimeout> | null;
  __closeTimer: ReturnType<typeof setTimeout> | null;
  __dragging = false;

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return style;
  }
  /////////////////////////////////// watches
  @watch('placement', { immediate: true })
  watchPlacement(nv: string) {
    let pair = nv.split('-')
    this.direction = pair[0]
    this.startOrEnd = pair[1]
  }
  @watch('content')
  watchContent(nv: string) {
    this.renderRoot!.textContent = nv
  }

  //////////////////////////////////// lifecycles
  hook_click: any
  constructor(...args: any[]) {
    super(...args);

    this.hook_mouseenter = this.onMouseenter.bind(this);
    this.hook_mouseleave = this.onMouseleave.bind(this);
    this.hook_click = this.onClick.bind(this);
    this.hook_dragstart = this.onDragStart.bind(this);
    this.hook_dragmove = this.onDragMove.bind(this);
    this.hook_dragend = this.onDragEnd.bind(this);
  }

  render(): Template {
    return h`
      <div
        class="ce-tooltip" ${classes({
      "ce-tooltip-arrow": this.arrow,
      "ce-tooltip-interactive": this.interactive,
      ["ce-tooltip-placement-" + (this.adjustedDirection || this.direction)]: true,
      ["is-" + this.startOrEnd]: !isBlank(this.startOrEnd)
    })} @mousedown.stop @click.stop @mouseenter="${this.onEnterTip}" @mouseleave="${this.onLeaveTip}"
      >
        ${this.content}
        <slot name="content"></slot>
      </div>
      <slot ></slot>
    `;
  }
  inited: boolean
  mounted(): void {
    if (this.inited) {
      return;
    }

    this.inited = true
    this.renderRoot?.parentElement?.removeChild(this.renderRoot);
    if (this.alwaysShow) {
      this.open();
    }
  }
  shouldUpdate(changed: Record<string, any>): boolean {
    if (isUndefined(this.__timer)) return false
    return true
  }
  slotChange(slot: HTMLSlotElement, name: string) {
    if (!name) {
      let els = slot.assignedElements({ flatten: true });
      if (isEmpty(els)) return;
      this._bindTarget(els[0])
    }
  }
  connectedCallback(): void {
    super.connectedCallback();
    if (!this.__anchor) return

    if (this.trigger == TriggerType.HOVER) {
      this.__anchor.addEventListener("mouseenter", this.hook_mouseenter);
      this.__anchor.addEventListener("mouseleave", this.hook_mouseleave);
    } else if (this.trigger == TriggerType.CLICK) {
      this.__anchor.addEventListener("click", this.hook_click);
    }
    if (this.dragFollow) {
      this.__anchor.addEventListener("mousedown", this.hook_dragstart);
    }
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (!this.__anchor) return

    if (this.trigger == TriggerType.HOVER) {
      this.__anchor.removeEventListener("mouseenter", this.hook_mouseenter);
      this.__anchor.removeEventListener("mouseleave", this.hook_mouseleave);
    } else if (this.trigger == TriggerType.CLICK) {
      this.__anchor.removeEventListener("click", this.hook_click);
    }
    if (this.dragFollow) {
      this.__anchor.removeEventListener("mousedown", this.hook_dragstart);
    }
  }
  //////////////////////////////////// methods
  /**
   * 仅用于tooltip指令
   */
  _bindTarget(node: Element) {
    this.__anchor = node
    if (this.trigger == TriggerType.HOVER) {
      node.addEventListener("mouseenter", this.hook_mouseenter);
      node.addEventListener("mouseleave", this.hook_mouseleave);
    } else if (this.trigger == TriggerType.CLICK) {
      node.addEventListener("click", this.hook_click);
    }
    if (this.dragFollow) {
      node.addEventListener("mousedown", this.hook_dragstart);
    }

  }
  updateContent(content: string) {
    // this.content = content
    this.setAttribute('content', content)

  }
  updateAlwasy(alwaysShow: boolean) {
    this.alwaysShow = alwaysShow
    if (alwaysShow) {
      this.open()
    }
  }
  container: HTMLElement
  open(relocate?: boolean) {
    if (this.disabled) return;
    if (!isBlank(this.content) && !this.renderRoot?.innerText.includes(this.content)) {
      this.nextTick(() => {
        this.forceUpdate()
      })
    }
    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    this.__timer = setTimeout(() => {
      this._relocate();
      this.renderRoot?.classList.add('ce-tooltip-visible')
      this.__timer = null;
    }, 0);
  }
  /**
   * 重新计算并设置提示框位置（不改变显隐状态），用于目标元素移动时跟随
   */
  _relocate() {
    let container: HTMLElement = this.container
    if (!this.renderRoot?.parentElement) {
      container = this.container = document.body
      let con
      if (con = (this.closest('ce-dialog') || this.closest('dialog') || closest(this, node => node.tagName == 'CE-DIALOG', 'parentComponent'))) {
        container = this.container = con instanceof HTMLDialogElement ? con : (con as Dialog).renderRoot!
      }
      container.appendChild(this.renderRoot!);
    }

    // 定位原点：left/top 相对「包含块 padding 边」解析，而非容器内容盒。
    // 无定位祖先时包含块为初始包含块（画布原点 0,0），最终坐标需叠加页面滚动；
    // 有定位祖先（如弹窗渲染根）时原点为该祖先 padding 边，视口坐标即可（滚动相互抵消）。
    const offsetParent = this.renderRoot!.offsetParent;
    const positioned = !!offsetParent && getComputedStyle(offsetParent).position !== 'static';
    let originX = 0, originY = 0;
    let boundW = window.innerWidth, boundH = window.innerHeight;
    if (positioned) {
      const r = offsetParent.getBoundingClientRect();
      const s = getComputedStyle(offsetParent);
      originX = r.x + (parseFloat(s.borderLeftWidth) || 0);
      originY = r.y + (parseFloat(s.borderTopWidth) || 0);
      boundW = offsetParent.clientWidth;
      boundH = offsetParent.clientHeight;
    }

    const a = this.__anchor.getBoundingClientRect();
    const { height, width } = this.renderRoot!.getBoundingClientRect();
    const w = a.width, h = a.height;
    // 锚点相对包含块 padding 边的坐标（视口坐标系）
    let dx = a.x - originX,
      dy = a.y - originY;
    switch (this.adjustedDirection || this.direction) {
      //top
      case 'top':
        dy = dy - height - GAP * 2;
        if (!this.adjustedDirection && dy < 0) {
          this.adjustedDirection = 'bottom'
          this.open(true)
          return;
        }
        if (this.startOrEnd === 'start') {
        } else if (this.startOrEnd === 'end') {
          dx += w - width;
        } else {
          dx += w / 2 - width / 2;
        }
        break;
      //bottom
      case 'bottom':
        dy = dy + h + GAP * 2;
        if (!this.adjustedDirection && dy + height > boundH) {
          this.adjustedDirection = 'top'
          this.open(true)
          return;
        }
        if (this.startOrEnd === 'start') {
        } else if (this.startOrEnd === 'end') {
          dx += w - width;
        } else {
          dx += w / 2 - width / 2;
        }
        break;
      //left
      case 'left':
        dx = dx - width - GAP;
        if (!this.adjustedDirection && dx < 0) {
          this.adjustedDirection = 'right'
          this.open(true)
          return;
        }
        if (this.startOrEnd === 'start') {
        } else if (this.startOrEnd === 'end') {
          dy += h - height;
        } else {
          dy += h / 2 - height / 2;
        }
        break;
      //right
      case "right":
      default:
        dx += w + GAP;
        if (!this.adjustedDirection && dx + width > boundW) {
          this.adjustedDirection = 'left'
          this.open(true)
          return;
        }
        if (this.startOrEnd === 'start') {
        } else if (this.startOrEnd === 'end') {
          dy += h - height;
        } else {
          dy += h / 2 - height / 2;
        }

        break;
    }

    // 无定位祖先时包含块为初始包含块（画布原点 0,0），把视口坐标换算为画布坐标
    if (!positioned) {
      dx += window.scrollX;
      dy += window.scrollY;
    }
    this.renderRoot!.style.left = dx + "px";
    this.renderRoot!.style.top = dy + "px";
  }
  /**
   * 公开方法：目标元素位置变化时调用，重新定位提示框
   */
  relocate() {
    if (this.disabled || !this.__anchor) return;
    this._relocate();
  }
  //////////////////////////////////// 拖动跟随
  onDragStart(e: MouseEvent) {
    if (this.disabled) return;
    if (isBlank(this.content)) return
    this.__dragging = true
    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }
    this.open();
    document.addEventListener('mousemove', this.hook_dragmove)
    document.addEventListener('mouseup', this.hook_dragend)
  }
  onDragMove(e: MouseEvent) {
    this.relocate();
  }
  onDragEnd(e: MouseEvent) {
    this.__dragging = false
    document.removeEventListener('mousemove', this.hook_dragmove)
    document.removeEventListener('mouseup', this.hook_dragend)
    if (this.alwaysShow) {
      this.relocate();
      return
    }
    this.close();
  }
  close() {
    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    this.nextTick(() => {
      this.renderRoot?.classList.remove('ce-tooltip-visible');
    })
    this.__timer = setTimeout(() => {
      if (this.renderRoot!.parentElement === this.container)
        this.container.removeChild(this.renderRoot!)
      this.__timer = null;
      this.adjustedDirection = '';
    }, 200);
  }
  onMouseenter(e: MouseEvent) {
    if (this.alwaysShow) return;
    if (this.trigger !== TriggerType.HOVER) return;
    if (isBlank(this.content)) return

    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    this.open();
  }
  onMouseleave(e: MouseEvent) {
    if (this.alwaysShow) return;
    if (this.trigger !== TriggerType.HOVER) return;
    if (this.__dragging) return; // 拖动跟随期间保持显示，不因鼠标短暂离开而关闭
    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }
    this.__closeTimer = setTimeout(() => {
      this.close()
    }, 100);
  }
  onClick(e: MouseEvent) {
    if (this.trigger !== TriggerType.CLICK) return;
    if (this.renderRoot?.parentElement) return
    if (isBlank(this.content)) return

    this.open();
    if (!this._watchClickHandle) {
      this._watchClickHandle = this.watchClick.bind(this)
    }
    document.addEventListener('click', this._watchClickHandle)
  }
  _watchClickHandle: any
  watchClick(e: Event) {
    this.close()
    document.removeEventListener('click', this._watchClickHandle)
  }
  onEnterTip(e: Event) {
    if (this.trigger !== TriggerType.HOVER) return;
    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }
    this.renderRoot?.classList.add('ce-tooltip-visible');
  }
  onLeaveTip(e: Event) {
    if (this.alwaysShow) return;
    if (this.trigger !== TriggerType.HOVER) return;

    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }
    this.__closeTimer = setTimeout(() => {
      this.close()
    }, 100);

  }
}
