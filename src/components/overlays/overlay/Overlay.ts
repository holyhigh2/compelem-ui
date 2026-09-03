import { CompElem, Csscope, Template, classes, createRef, csscope, emits, event, h, ifTrue, prop, state, styles, tag, watch } from 'compelem';
import { isBlank, isNumeric, last, some } from "myfx";
import { getRectInContainer } from "uiik";
import { Direction, Side } from "../../../constants";
import { IColorable } from "../../../interfaces/IColorable";
import { IPlacement } from "../../../interfaces/IPlacement";
import { getEffectiveZIndex, isVisible } from "../../../utils/utils";
import style from "./style.scss?tmpl";
const STACK: Set<Overlay> = new Set();
let BodyEl: HTMLElement;
enum TriggerMode {
  CLICK = 'click',
  HOVER = 'hover',
  FOCUS = 'focus',
  POINTERDOWN = 'pointerdown'
}

export const OverlaySheet = new CSSStyleSheet();
OverlaySheet.replaceSync(style.getCssText());
/**
 * 可接受某个元素作为触发节点弹出界面的基础布局，提供相对节点的浮动位置设置及交互策略
 * 用于其他浮动组件的基础层，如：Dialog、Popover、Tooltip等
 * @attrs
 *  visible {boolean} 是否显示，model属性，受控
 *  placement {string} 相对trigger节点放置内容的位置，指定trigger选择器或trigger插槽时生效，为空时居中。可选值 right/right-start/right-end/ left/left-start/left-end top/top-start/top-end bottom/bottom-start/bottom-end
 *  contained {boolean} 浮动层是否仅在容器内显示，默认false
 *  follow {boolean} 打开期间是否跟随触发节点滚动/窗口缩放实时重算位置，默认true
 *  backdrop {boolean} 是否显示背景，默认false
 *  color {string} 背景颜色
 *  opacity {number} 背景透明度
 *  esc {boolean} 按下ESC按键时关闭overlay，默认false
 *  closeOnClick {boolean} 点击内容以外区域时关闭overlay，默认false
 *  triggerMode {string} 触发方式，click/hover/focus/pointerdown，默认click
 *  trigger {string} 触发节点选择器。注意，选择器仅在父组件域内生效。如果指定了trigger插槽则忽略此属性
 *  autoActive {boolean} 是否自动设置trigger节点 active 属性，默认false。
 *  openDelay {number} 打开延迟时间，单位ms，默认0。仅用于hover/focus触发方式
 *  maxWidth {number|string} 弹出内容最大宽度，单位px
 *  minWidth {number|string} 弹出内容最小宽度，单位px
 *  maxHeight {number|string} 弹出内容最大高度，单位px
 *  minHeight {number|string} 弹出内容最小高度，单位px
 *  width {number|string} 弹出内容宽度，值为数字时单位px
 *  height {number|string} 弹出内容高度，值为数字时单位px
 * @methods
 *  open() 打开弹出层
 *  openBy(trigger: HTMLElement, placement?: string) 打开弹出层并指定触发元素及位置
 *  close(e?: Event) 关闭弹出层
 * @staticmethods
 *  closeAll() 关闭所有弹出层
 * @slots
 *  - 默认插槽，弹出内容
 *  trigger 触发节点
 *  
 * @events
 *  beforeopen({trigger}) 动画执行前触发
 *  open() 元素已显示
 *  opened({trigger}) 动画执行完成后触发
 *  beforeclose({trigger,from,cancel}) 动画执行前触发
 *  close({trigger,from}) 执行关闭时触发 
 *  closed({trigger}) 动画执行完成后触发
 *
 * @author holyhigh2
 */
@emits('beforeopen', 'open', 'opened', 'beforeclose', 'close', 'closed', 'update:*')
@tag("ce-overlay")
export class Overlay extends CompElem implements IPlacement, IColorable {
  static closeAll(e?: Event) {
    STACK.forEach(o => o.close(e))
  }
  //////////////////////////////////// props
  @prop({ type: Boolean, model: true }) visible = false;
  @prop placement = "";
  @prop contained = false;
  @prop follow = true;
  @prop backdrop = false;
  @prop color = "rgba(0, 0, 0)";
  @prop opacity = 0.25;
  @prop esc = false;
  @prop closeOnClick = false;
  @prop triggerMode = TriggerMode.CLICK;
  @prop trigger = "";
  @prop openDelay = 0;
  @prop autoActive = false;
  @prop({ type: [Number, String] }) maxWidth: number | string
  @prop({ type: [Number, String] }) minWidth: number | string
  @prop({ type: [Number, String] }) maxHeight: number | string
  @prop({ type: [Number, String] }) minHeight: number | string
  @prop({ type: [Number, String] }) width: number | string
  @prop({ type: [Number, String] }) height: number | string

  @state direction: string = Direction.Right
  @state adjustedDirection = ''
  @state startOrEnd = ''
  @state adjustedStartOrEnd = ''

  @state opened = false
  @state({ prop: 'visible' }) __visible = false;

  closeTimer: any
  openTimer: any

  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return style;
  }
  @csscope(Csscope.HOST)
  static get hostCss() {
    return style;
  }
  contentEl = createRef<HTMLElement>()

  triggerEl: HTMLElement

  transiting = -1

  listenerMap = new WeakMap()

  /////////////////////////////////// watches
  @watch("visible")
  watchVisible(nv: boolean) {
    if (nv) {
      if (this.openTimer) return
      this.open();
    } else {
      this.close();
    }
  }
  @watch("__visible")
  watch__Visible(nv: boolean) {
    this.visible = nv
  }
  @watch('placement', { immediate: true })
  watchPlacement(nv: string) {
    if (isBlank(nv)) return
    let pair = nv.split('-')
    this.direction = pair[0]
    this.startOrEnd = pair[1]
  }
  @watch('follow')
  watchFollow(nv: boolean) {
    if (nv && this.__visible) this.bindFollow()
    else this.unbindFollow()
  }
  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
      <div
        part="root"
        class="ce-overlay"
        ${classes({
      "ce-overlay-contained": this.contained,
      ["ce-overlay-placement-" + (this.adjustedDirection || this.direction)]: true,
      ["is-" + this.startOrEnd]: !isBlank(this.startOrEnd)
    })}
        ${styles({ '--color-overlay': this.color })}
        @resize="${this.onReisze}"
        @transitionend.debounce="${this.onTransitionEnd}"
        @animationend="${this.onAnimationEnd}"
        @mousedown="${this.onMousedownContent}"
        @mouseup="${this.onMouseupContent}"
      >
        ${ifTrue(this.backdrop, () => h`<div class="ce-overlay-backdrop" ${styles({ opacity: this.__visible ? this.opacity + '' : '' })}></div>`)}
        <div ref="${this.contentEl}" class="ce-overlay-content" ${classes({ "is-center": !this.direction })} ${styles({
      width: isNumeric(this.width) ? this.width + 'px' : this.width,
      height: isNumeric(this.height) ? this.height + 'px' : this.height,
      'max-width': isNumeric(this.maxWidth) ? this.maxWidth + 'px' : this.maxWidth,
      'min-width': isNumeric(this.minWidth) ? this.minWidth + 'px' : this.minWidth,
      'max-height': isNumeric(this.maxHeight) ? this.maxHeight + 'px' : this.maxHeight,
      'min-height': isNumeric(this.minHeight) ? this.minHeight + 'px' : this.minHeight,
    })} @mutate.child.debounce:100="${this.onContentChange}">
        </div>
      </div>
      <slot name="trigger"></slot>
      <slot></slot>
    `;
  }
  slotChange(slot: HTMLSlotElement, name: string): void {
    if (name === 'trigger') {
      let trigger = slot.assignedElements({ flatten: true })[0] as HTMLElement
      if (trigger) {
        this.triggerEl = trigger
        this._listenTrigger()
      }
    } else if (!name) {
      //move default slot to content
      this.slots.default?.forEach((el) => {
        this.contentEl.current?.appendChild(el);
      });
    }
  }
  mounted(): void {
    if (!BodyEl) {
      let container = document.createElement('div')
      container.className='ce-overlay-container'
      document.body.appendChild(container)
      BodyEl = container
    }
    if (this.contained && this.wrapperComponent) {
      this.wrapperComponent.shadowRoot!.adoptedStyleSheets.includes(OverlaySheet) || (this.wrapperComponent.shadowRoot!.adoptedStyleSheets = [...this.wrapperComponent.shadowRoot!.adoptedStyleSheets, OverlaySheet])
    }

    // this.nextTick(() => {
    let overlay = this.renderRoot!
    overlay.parentNode?.removeChild(overlay);

    //move default slot to content
    this.slots.default?.forEach((el) => {
      this.contentEl.current?.appendChild(el);
    });
    // })


    //todo transition必须在open之前设置。后期通过transition标签实现
    this.contentEl.current!.style.transform = 'scale(0.95)';

    this.watchVisible(this.__visible)
  }
  connectedCallback(): void {
    super.connectedCallback();

    if (!this.slots.trigger && !isBlank(this.trigger)) {
      this.triggerEl = (this.wrapperComponent?.renderRoot?.parentNode?.querySelector(this.trigger) || this.wrapperComponent?.querySelector(this.trigger)) as HTMLElement
      this._listenTrigger()
    }
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unbindFollow()
    if (this.triggerEl) {
      switch (this.triggerMode) {
        case TriggerMode.HOVER:
          this.triggerEl.removeEventListener('mouseenter', this.listenerMap.get(this.onMouseEnterTrigger))
          this.contentEl.current?.removeEventListener('mouseleave', this.listenerMap.get(this.onMouseLeaveContent))
          this.triggerEl.removeEventListener('mouseleave', this.listenerMap.get(this.onMouseLeaveTrigger))
          break;
        case TriggerMode.FOCUS:
          this.triggerEl.removeEventListener('mousedown', this.listenerMap.get(this.onMousedownTrigger))
          this.triggerEl.removeEventListener('focus', this.listenerMap.get(this.onFocusTrigger))
          this.triggerEl.removeEventListener('blur', this.listenerMap.get(this.onBlurTrigger))
          break;
        case TriggerMode.CLICK:
          this.triggerEl.removeEventListener('mousedown', this.listenerMap.get(this.onMousedownTrigger))
          this.triggerEl.removeEventListener('click', this.listenerMap.get(this.onClickTrigger))
          break;
      }
    }
  }

  //////////////////////////////////// methods
  __firstContentChange = false
  onContentChange() {
    if (!this.__firstContentChange) {
      this.calcPosition(this.triggerEl)
      this.__firstContentChange = true
    }
  }
  @event('click')
  onHostClick(e: Event) {
    const t = e.target
    if (t === this.triggerEl) {
      if (TriggerMode.CLICK === this.triggerMode) {
        this.onClickTrigger()
      }
    }
  }
  @event('mousedown')
  onHostMousedown(e: Event) {
    const t = e.target
    if (t === this.triggerEl) {
      if (TriggerMode.CLICK === this.triggerMode) {
        this.onMousedownTrigger(e)
      }
    }
  }
  _listenTrigger() {
    if (this.triggerEl) {
      if (this.listenerMap.has(this.onMouseEnterTrigger)) return
      let mdtb
      switch (this.triggerMode) {
        case TriggerMode.HOVER:
          let metb = this.onMouseEnterTrigger.bind(this)
          let mlcb = this.onMouseLeaveContent.bind(this)
          let mltb = this.onMouseLeaveTrigger.bind(this)

          this.listenerMap.set(this.onMouseEnterTrigger, metb)
          this.listenerMap.set(this.onMouseLeaveContent, mlcb)
          this.listenerMap.set(this.onMouseLeaveTrigger, mltb)

          this.triggerEl.addEventListener('mouseenter', metb)
          this.contentEl.current?.addEventListener('mouseleave', mlcb)
          this.triggerEl.addEventListener('mouseleave', mltb)
          break;
        case TriggerMode.FOCUS:
          mdtb = this.onMousedownTrigger.bind(this)
          let ftb = this.onFocusTrigger.bind(this)
          let btb = this.onBlurTrigger.bind(this)

          this.listenerMap.set(this.onMousedownTrigger, mdtb)
          this.listenerMap.set(this.onFocusTrigger, ftb)
          this.listenerMap.set(this.onBlurTrigger, btb)

          this.triggerEl.addEventListener('mousedown', mdtb)
          this.triggerEl.addEventListener('focus', ftb)
          this.triggerEl.addEventListener('blur', btb)
          break;
        case TriggerMode.CLICK:
          mdtb = this.onMousedownTrigger.bind(this)
          let ctb = this.onClickTrigger.bind(this)

          this.listenerMap.set(this.onMousedownTrigger, mdtb)
          this.listenerMap.set(this.onClickTrigger, ctb)

          this.triggerEl.addEventListener('mousedown', mdtb)
          this.triggerEl.addEventListener('click', ctb)
          break;
      }
    }
  }
  _append() {
    let overlay = this.renderRoot!
    if (!BodyEl) return
    if (BodyEl.contains(overlay)) return;

    if (this.contained) {
      let parent = this.offsetParent || this.parentElement
      if (parent) {
        parent.appendChild(overlay)
      } else {
        BodyEl.appendChild(overlay)
      }
    } else {
      BodyEl.appendChild(overlay)
    }
  }
  openBy(trigger: HTMLElement, placement?: string) {
    // if (placement) this.placement = placement
    this.__visible = true
    //计算位置
    this.adjustedDirection = this.adjustedStartOrEnd = ''
    this.calcPosition(trigger)
    this._append()
    this.bindFollow()
    if (this.closeTimer) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    let overlay = this.renderRoot!;
    // overlay.style.zIndex = '0'
    STACK.add(this);

    this.triggerEl = trigger

    this.openTimer = setTimeout(() => {
      if (!this.__visible) return
      //计算位置
      this.adjustedDirection = this.adjustedStartOrEnd = ''
      this.calcPosition(trigger)
      this.transiting = 1;
      overlay.classList.add("ce-overlay-visible");

      this.emit("open", { trigger: trigger });
      let parentOverlay = this.triggerEl.closest('.ce-overlay')
      if (!parentOverlay && this.triggerEl instanceof CompElem) {
        parentOverlay = (this.triggerEl as CompElem).parentComponent?.closest('.ce-overlay')!
      }
      if (parentOverlay) {
        overlay.style.setProperty('z-index', `calc(${parseInt(window.getComputedStyle(parentOverlay).zIndex)} + 1)`, 'important')
      } else {
        overlay.style.setProperty('z-index', `calc(var(--ce-z-index-overlay) + 1)`, 'important')
      }
    }, this.triggerMode === TriggerMode.CLICK ? 0 : this.openDelay);

    if (this.autoActive) {
      trigger?.toggleAttribute('active', true);
    }
    this.emit("beforeopen", { trigger: trigger });
  }
  open() {
    this.__visible = true
    //计算位置
    this.adjustedDirection = this.adjustedStartOrEnd = ''
    this.calcPosition(this.triggerEl)
    this._append()
    this.bindFollow()
    if (this.closeTimer) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }

    let overlay = this.renderRoot!;
    let triggerIndex = this.triggerEl ? getEffectiveZIndex(this.triggerEl) : 0
    let rootIndex = getEffectiveZIndex(overlay)

    if (this.triggerEl && rootIndex <= triggerIndex && triggerIndex > 0) {
      overlay.style.setProperty('z-index', `calc(${triggerIndex} + 1)`, 'important')
    } else {
      overlay.style.setProperty('z-index', `calc(var(--ce-z-index-overlay) + ${STACK.size})`, 'important')
    }

    STACK.add(this);

    this.openTimer = setTimeout(() => {
      if (!this.__visible) return

      this.transiting = 1;

      //计算位置
      this.adjustedDirection = this.adjustedStartOrEnd = ''
      this.calcPosition(this.triggerEl)
      overlay.classList.add("ce-overlay-visible");
      this.emit("open", { trigger: this.triggerEl });
    }, this.triggerMode === TriggerMode.CLICK ? 0 : this.openDelay);

    if (this.autoActive) {
      this.triggerEl?.toggleAttribute('active', true);
    }
    this.emit("beforeopen", { trigger: this.triggerEl });
  }
  close(e?: Event, isInStack?: boolean) {
    if (this.transiting < 0) return;

    if (this.openTimer) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
    let toClose = true
    this.emit("beforeclose", {
      trigger: this.triggerEl, from: e?.target, isInStack, cancel() {
        toClose = false
      }
    }, e);
    if (!toClose) return

    let overlay = this.renderRoot!;
    overlay.classList.remove("ce-overlay-visible");
    this.transiting = -1;
    this.__visible = false;
    this.unbindFollow()
    this.contentEl.current!.style.top = '-999px'
    this.contentEl.current!.style.left = '-999px'
    //todo 这里移动到动画结束事件中
    this.closeTimer = setTimeout(() => {
      //重新打开时不需要移除
      if (this.__visible) return;
      overlay.style.zIndex = '-1'
      STACK.delete(this);
    }, 300);
    if (this.autoActive) {
      this.triggerEl?.toggleAttribute('active', false);
    }
    this.emit("close", {
      trigger: this.triggerEl, from: e?.target, isInStack
    }, e);
  }
  relocate() {
    this.calcPosition(this.triggerEl)
  }
  __following = false
  __followRafId = 0
  __onFollowScroll = (e: Event) => {
    if (!this.__visible) return
    //面板内容自身的滚动（如选项列表内部滚动条）不触发重定位
    if (e?.type === 'scroll' && this.contentEl.current?.contains(e.target as Node)) return
    cancelAnimationFrame(this.__followRafId)
    this.__followRafId = requestAnimationFrame(() => {
      if (this.__visible) this.relocate()
    })
  }
  bindFollow() {
    if (!this.follow || this.__following) return
    this.__following = true
    document.addEventListener('scroll', this.__onFollowScroll, { capture: true, passive: true })
    window.addEventListener('resize', this.__onFollowScroll)
  }
  unbindFollow() {
    if (!this.__following) return
    this.__following = false
    cancelAnimationFrame(this.__followRafId)
    document.removeEventListener('scroll', this.__onFollowScroll, true)
    window.removeEventListener('resize', this.__onFollowScroll)
  }
  calcPosition(trigger: HTMLElement, relocate?: boolean) {
    //计算位置
    let conH = this.renderRoot!.offsetHeight
    let conW = this.renderRoot!.offsetWidth
    let oh = this.contentEl.current!.offsetHeight
    let ow = this.contentEl.current!.offsetWidth
    //watch content mutation
    if (oh < 1 || ow < 1) return

    if (trigger && this.direction) {
      //resize
      //contained：相对 offsetParent 的坐标；非 contained：浮层根节点为 fixed，直接使用触发元素视口矩形。
      //不能经 getRectInContainer(…, document.body) 换算，否则会混入 body margin 造成面板偏移
      let rect = this.contained ?
        getRectInContainer(trigger, this.offsetParent as HTMLElement)
        : (() => { let vr = trigger.getBoundingClientRect(); return { x: vr.x, y: vr.y, w: vr.width, h: vr.height } })()
      let tw = rect.w
      let th = rect.h

      //todo 这里应该放在事件中
      // this.contentEl.style.height = height + 'px'
      // this.contentEl.style.width = width + 'px'

      let cw = this.contentEl.current!.offsetWidth
      let ch = this.contentEl.current!.offsetHeight

      let viewHeight = this.contained ? this.offsetParent?.getBoundingClientRect().height! : window.innerHeight
      let viewWidth = this.contained ? this.offsetParent?.getBoundingClientRect().width! : window.innerWidth

      let top = this.contained ? rect.y - window.scrollY : rect.y
      let left = this.contained ? rect.x - window.scrollX : rect.x
      let dx = left, dy = top
      let scrollTop = this.offsetParent?.scrollTop ?? 0
      let scrollLeft = this.offsetParent?.scrollLeft ?? 0
      let startOrEnd = this.adjustedStartOrEnd || this.startOrEnd
      switch (this.adjustedDirection || this.direction) {
        //top
        case Direction.Top:
          dy = dy - oh;
          if (startOrEnd === 'start') {
          } else if (startOrEnd === 'end') {
            dx += tw - cw;
          } else {
            dx += tw / 2 - cw / 2;
          }
          break;
        //bottom
        case Direction.Bottom:
          dy = dy + th;
          if (startOrEnd === 'start') {
          } else if (startOrEnd === 'end') {
            dx += tw - cw;
          } else {
            dx += tw / 2 - cw / 2;
          }
          break;
        //left
        case Direction.Left:
          dx = dx - cw;
          if (startOrEnd === 'start') {
          } else if (startOrEnd === 'end') {
            dy += th - ch;
          } else {
            dy += th / 2 - ch / 2;
          }
          break;
        //right
        case Direction.Right:
          dx += tw;
          if (startOrEnd === 'start') {
          } else if (startOrEnd === 'end') {
            dy += th - ch;
          } else {
            dy += th / 2 - ch / 2;
          }

          break;
      }
      //check
      if (!this.adjustedDirection && !this.adjustedStartOrEnd && dy < 0) {
        this.adjustedDirection = Direction.Bottom
        this.calcPosition(trigger, relocate ? undefined : true)
        return;
      } else if (!this.adjustedDirection && !this.adjustedStartOrEnd && dy + ch - scrollTop > viewHeight) {
        this.adjustedDirection = Direction.Top
        this.calcPosition(trigger, relocate ? undefined : true)
        return;
      }

      if (!this.adjustedDirection && !this.adjustedStartOrEnd && dx < 0) {
        if (this.direction === Direction.Left) {
          this.adjustedDirection = Direction.Right
        } else {
          this.adjustedStartOrEnd = this.startOrEnd === Side.Start ? Side.End : Side.Start
        }

        this.calcPosition(trigger, true)
        return;
      } else if (!this.adjustedDirection && !this.adjustedStartOrEnd && dx + cw - scrollLeft > viewWidth) {
        if (this.direction === Direction.Right) {
          this.adjustedDirection = Direction.Left
        } else {
          this.adjustedStartOrEnd = this.startOrEnd === Side.Start ? Side.End : Side.Start
        }

        this.calcPosition(trigger, true)
        return;
      }
      //apply
      this.contentEl.current!.style.top = dy + 'px'
      this.contentEl.current!.style.left = dx + 'px'
    } else {
      this.contentEl.current!.style.top = conH / 2 - oh / 2 + 'px'
      this.contentEl.current!.style.left = conW / 2 - ow / 2 + 'px'
    }
  }
  onReisze() {
    if (isVisible(this.renderRoot!) && this.__visible) {
      this.calcPosition(this.triggerEl)
    }
  }
  onTransitionEnd(e: Event) {
    if (this.transiting > 0) {
      this.emit("opened", { trigger: this.triggerEl });
      if (this.renderRoot!.scrollHeight > this.renderRoot!.clientHeight) {
        this.renderRoot!.style.height = 'auto';
      }
    } else {
      this.emit("closed", { trigger: this.triggerEl });
      this.renderRoot!.style.height = '';
    }
  }
  onAnimationEnd() {
    this.renderRoot?.classList.remove("ce-overlay-shake");
  }
  onClickTrigger() {
    if (this.triggerMode !== TriggerMode.CLICK) return;
    this.__visible = true
  }
  contentPressing = false
  onMousedownContent(e: Event) {
    let t = e.target as Node
    if (this.contentEl.current?.contains(t)) {
      this.contentPressing = true
    }
  }
  onMouseupContent(e: Event) {
    let t = e.target as Node
    if (this.contentEl.current?.contains(t)) {
      this.contentPressing = false
    }
  }
  triggerPressing = false
  onMousedownTrigger(e: Event) {
    this.triggerPressing = true
    this.openBy(this.triggerEl, 'bottom-start')
  }
  onPointerDownTrigger() {
    if (this.triggerMode !== TriggerMode.POINTERDOWN) return;
    this.__visible = true
  }
  onFocusTrigger() {
    if (this.triggerMode !== TriggerMode.FOCUS) return;
    this.__visible = true
  }
  onBlurTrigger(e: Event) {
    if (this.triggerMode !== TriggerMode.FOCUS) return;
    if (this.contentPressing) return
    this.__visible = false
  }
  onMouseEnterTrigger() {
    if (this.triggerMode !== TriggerMode.HOVER) return;
    this.open()
  }
  onMouseLeaveTrigger(e: MouseEvent) {
    if (this.triggerMode !== TriggerMode.HOVER) return;
    let t = e.relatedTarget
    if (this.contentEl.current?.contains(t as Node)) return;
    this.close(e)
  }
  onMouseLeaveContent(e: MouseEvent) {
    if (this.triggerMode !== TriggerMode.HOVER) return;
    if (this.__visible) this.close(e)
  }
}

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  if (STACK.size < 1) return;
  let visibleOverlay = last(STACK)
  if (!visibleOverlay) return;

  e.preventDefault();

  if (visibleOverlay.esc) {
    visibleOverlay.close(e);
  } else {
    //todo 这里不能直接设置动画，需要通知transition进行动画
    visibleOverlay.renderRoot?.classList.add("ce-overlay-shake");
  }
});
document.addEventListener("mousedown", function (e) {
  // if (e.button !== 0) return;
  if (STACK.size < 1) return;
  let visibleOverlay = last(STACK)
  if (!visibleOverlay) return;

  let isInContent = visibleOverlay.contentEl.current?.contains(e.target as Node) || visibleOverlay.contentPressing
  let isInStack = isInContent || some(STACK, v => v.contentEl.current?.contains(e.target as Node))

  if (visibleOverlay.closeOnClick) {
    if (isInContent) {

    } else {
      if (visibleOverlay.triggerPressing) {
        e = { target: visibleOverlay.triggerEl } as any
      }
      if (!visibleOverlay.triggerPressing || visibleOverlay.triggerMode !== TriggerMode.FOCUS) {
        if (isInStack) {
          visibleOverlay.close(e, isInStack);
        } else {
          Overlay.closeAll(e)
        }
      }

    }
  } else {
    if (isInContent) {

    } else {
      //todo 这里不能直接设置动画，需要通知transition进行动画
      visibleOverlay.renderRoot?.classList.add("ce-overlay-shake");
    }
  }

  STACK.forEach(v => {
    v.triggerPressing = false
    v.contentPressing = false
  })
  // visibleOverlay.triggerPressing = false
  // visibleOverlay.contentPressing = false
}, true);