import { classes, CompElem, html, prop, state, tag, Template, watch } from "compelem";
import { closest, isBlank } from "myfx";
import { getBox } from "uiik";
import { Dialog } from "../dialog/Dialog";
import style from "./style.scss";

const GAP = 5;
const enum TriggerType {
  CLICK = 'click',
  HOVER = 'hover'
}
/**
 * 文字提示，用于替代原生元素的title属性
 * @props
 *  content {string} 提示内容或通过slot设置
 *  trigger {array} 触发方式 hover/click/none，默认hover
 *  placement {string} right/right-start/right-end/ left/left-start/left-end top/top-start/top-end bottom/bottom-start/bottom-end
 *  arrow {boolean} 是否显示箭头，默认true
 *  disabled {boolean} 是否禁用，默认false
 *  alwaysShow {boolean} 一直显示，同时持续监控目标元素变化（位置、尺寸）
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
@tag("l-tooltip")
export class Tooltip extends CompElem {
  defaultSlot: HTMLSlotElement;
  hook_mouseenter: any;
  hook_mouseleave: any;
  //////////////////////////////////// props
  @prop content = "";
  @prop trigger = TriggerType.HOVER;
  @prop placement = "right";
  @prop arrow = true;
  @prop disabled = false;
  @prop alwaysShow = false;

  @state direction = 'right'
  @state startOrEnd = ''
  @state adjustedDirection = ''

  __anchor: Element;
  __timer: NodeJS.Timeout | null;
  __closeTimer: NodeJS.Timeout | null;

  static get styles(): string[] {
    return [style];
  }
  static get globalStyles(): string[] {
    return [style];
  }
  static get autoSlot() {
    return false;
  }
  /////////////////////////////////// watches
  @watch('placement', { immediate: true })
  watchPlacement(nv: string) {
    let pair = nv.split('-')
    this.direction = pair[0]
    this.startOrEnd = pair[1]
  }

  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args);

    this.hook_mouseenter = this.onMouseenter.bind(this);
    this.hook_mouseleave = this.onMouseleave.bind(this);
    this.hook_click = this.onClick.bind(this);

    const that = this;
    document.body.addEventListener('mousedown', (e) => {
      if (!that.renderRoot.parentElement) return;
      if (that.trigger === TriggerType.HOVER) return;
      if (that.alwaysShow) return;

      that.close()
    })
  }

  render(): Template {
    return html`
      <div
        class="c-tooltip ${classes({
      __arrow: this.arrow,
      ["placement-" + (this.adjustedDirection || this.direction)]: true,
      ["__" + this.startOrEnd]: !isBlank(this.startOrEnd)
    })}" @mousedown.stop @mouseenter="${this.onEnterTip}" @mouseleave="${this.onLeaveTip}"
      >
        ${this.content}
        <slot name="content"></slot>
      </div>
      <slot .node-filter="${{
        type: HTMLElement,
        maxCount: 1
      }}"></slot>
    `;
  }

  mounted(): void {
    this.renderRoot.parentElement?.removeChild(this.renderRoot);
    if (this.alwaysShow) {
      this.open();
    }
  }

  slotchange(slot: HTMLSlotElement, name: string) {
    if (!name) {
      let els = slot.assignedElements();
      this._bindTarget(els[0])
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

    let that = this;
    this.nextTick(() => {
      (node as any)._lastRect = node.getBoundingClientRect()
      var observer = new MutationObserver(function (mutationList, observer) {
        if (!that.alwaysShow) return;
        mutationList.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            let newRect = (mutation.target as Element).getBoundingClientRect()
            let oldRect = (mutation.target as any)._lastRect

            if (newRect.x != oldRect.x || newRect.y != oldRect.y || newRect.width != oldRect.width || newRect.height != oldRect.height) {
              that.open();
            }
            (node as any)._lastRect = newRect
          }
        });
      });
      observer.observe(node, { attributes: true, attributeOldValue: true });
    })

  }
  updateContent(content: string) {
    this.content = content
  }
  updateAlwasy(alwaysShow: boolean) {
    this.alwaysShow = alwaysShow
    if (alwaysShow) {
      this.open()
    }
  }
  open(relocate?: boolean) {
    if (this.disabled) return;
    let container: HTMLElement = this.container
    if (!this.renderRoot.parentElement) {
      // if (this.renderRoot.parentElement && !this.__closeTimer) return;
      container = this.container = document.body
      let con
      if (con = (this.closest('l-dialog') || this.closest('dialog') || closest(this, node => node.tagName == 'L-DIALOG', 'parentComponent'))) {
        container = this.container = con instanceof HTMLDialogElement ? con : (con as Dialog).renderRoot
      }
      container.appendChild(this.renderRoot);
    }

    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    this.__timer = setTimeout(() => {
      let { x, y, w, h } = getBox(this.__anchor, container);
      let { height, width } = this.renderRoot.getBoundingClientRect();
      let offsetParent = this.renderRoot.offsetParent ?? container
      let scrollTop = offsetParent.scrollTop
      let scrollLeft = offsetParent.scrollLeft

      let dx = x - scrollLeft,
        dy = y - scrollTop;
      switch (this.adjustedDirection || this.direction) {
        //top
        case 'top':
          dy = dy - height - GAP * 2;
          if (!this.adjustedDirection && dy < 0) {
            this.adjustedDirection = 'bottom'
            this.open(relocate ? undefined : true)
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
          if (!this.adjustedDirection && dy + height > (offsetParent.clientHeight + scrollTop)) {
            this.adjustedDirection = 'top'
            this.open(relocate ? undefined : true)
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
          if (!this.adjustedDirection && dx + width > (offsetParent.clientWidth + scrollLeft)) {
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

      this.renderRoot.style.left = dx + "px";
      this.renderRoot.style.top = dy + "px";
      this.renderRoot.classList.add('__visible')
      this.__timer = null;
    }, 0);
  }
  close() {
    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    this.nextTick(() => {
      this.renderRoot.classList.remove('__visible');
    })
    this.__timer = setTimeout(() => {
      if (this.renderRoot.parentElement === this.container)
        this.container.removeChild(this.renderRoot)
      this.__timer = null;
      this.adjustedDirection = '';
    }, 200);
  }
  onMouseenter(e: MouseEvent) {
    if (this.alwaysShow) return;
    if (this.trigger !== TriggerType.HOVER) return;

    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    this.open();
  }
  onMouseleave(e: MouseEvent) {
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
  onClick(e: MouseEvent) {
    if (this.trigger !== TriggerType.CLICK) return;
    this.open();
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
    this.renderRoot.classList.add('__visible');
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
