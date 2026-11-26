import { CompElem, Csscope, Template, classes, createRef, csscope, emits, event, h, ifTrue, prop, state, styles, tag, watch } from 'compelem';
import { scheduleSettle } from '../../../utils/transition';
import { isBlank, isNumeric, last, some } from "myfx";
import { getRectInContainer } from "uiik";
import { Direction, Side } from "../../../constants";
import { IColorable } from "../../../interfaces/IColorable";
import { IPlacement } from "../../../interfaces/IPlacement";
import { getEffectiveZIndex, isVisible } from "../../../utils/utils";
import style from "./style.scss?tmpl";
import { activateLayer, bringLayerToFront, deactivateLayer, popLayer, pushLayer } from "./layerHost";
const STACK: Set<Overlay> = new Set();
let BodyEl: HTMLElement;

/**
 * overlay 容器的 top-layer 管理（2026-11-10，统一到 layerHost）。
 *
 * ## 历史问题
 * 所有 overlay 的 renderRoot 都挂在 body 下的单例容器 `.ce-overlay-container`。
 * 旧版 `ce-drawer` 用 `dialog.showModal()`：浏览器把「不在 dialog 子树内」的节点
 * 判为 **inert**，于是抽屉里的下拉 / 日期面板真的打开了、也插进了 DOM，却拿不到
 * 命中测试和 :hover —— 面板看得见、点不动。真机探针证明：让容器进 top-layer、
 * 或反复 hide+show 重排顺序，在模态下都无效，因为判据是 DOM 血缘而非绘制顺序。
 *
 * ## 现在的模型
 * Drawer 已改为 `div[popover=manual]`，与 overlay 容器同属**非模态** top-layer，
 * 不再有浏览器模态边界。进出 top-layer 与 ESC 层栈统一走 `layerHost.ts`。
 * 用 `manual` 而不是 `auto`：`auto` 带 light-dismiss，而"点外部关闭"由 overlay
 * 自己的 `close-on-click` 管，不能被浏览器抢走。
 *
 * ## 为什么仍要置顶
 * 非模态 top-layer **内部按打开顺序叠放**。共享容器长期驻留，若页面先开过某个
 * overlay、再打开 Drawer，容器就会被压在 Drawer 后面 —— 探针 M 复现该失效；
 * 每次有新 overlay 打开时 `bringLayerToFront()` 同步 hide+show 一次即可恢复
 * （探针 N），同一任务内完成不闪。
 *
 * ## 为什么是引用计数
 * 容器是**全局单例**，overlay 可以叠着开（抽屉里开下拉、下拉里再开日期面板）。
 * 必须等最后一个关掉才能 `hidePopover()`，否则先关的那个会把别人的面板一起弄没。
 *
 * ## 兼容性
 * 不支持 Popover API 的浏览器：不设 popover 属性、保持修复前行为
 * （不进 top-layer，靠 z-index；绝不比以前更坏，不抛错、不告警）。
 */
let bodyLayerRefs = 0;
/** 容器是否已进入 top-layer（= 支持 Popover API 且已 showPopover） */
let bodyPopoverOn = false;

/** 容器自身的样式：压掉 UA 给 `[popover]` 的那套（居中、fit-content、边框、画布色背景） */
const BODY_LAYER_STYLE = [
  'position:fixed',
  'inset:0',
  'margin:0',
  'padding:0',
  'border:0',
  'background:transparent',
  'overflow:visible',
  'max-width:none',
  'max-height:none',
  'width:auto',
  'height:auto',
  // 容器本身**永不参与命中测试**。它是铺满视口的透明板：
  //  - 打开期间 pe:auto 会吞掉浮层外的所有点击（非模态下拉/工具提示下，
  //    背景元素收不到事件）；
  //  - 关闭态一旦 display 意外回到 block（见 deactivateLayer 的属性保留），
  //    更会永久盖住整个页面。
  // 内容侧由 `.ce-overlay-content{pointer-events:auto}` 与 `> *{pointer-events:all}`
  // 自行恢复：祖先 none 不阻止后代显式设 auto/ all —— 这条在旧版 content 仍是
  // none 时不成立（当时会挡住整棵子树），现在已真机验证（探针 ⑧）。
  'pointer-events:none',
].join(';');

/** 容器进入 top-layer（幂等；由每个 Overlay 实例配对自己的 push/pop） */
function pushBodyLayer(): void {
  if (!BodyEl) return;
  bodyLayerRefs++;
  // 降级（无 Popover API）：不进 top-layer，保持原有 z-index 行为
  if (!activateLayer(BodyEl)) return;
  bodyPopoverOn = true;
  // 共享容器长期驻留，必须每次抬到 top-layer 末尾。
  // 非模态 popover 内部按打开顺序叠放：若先开过 overlay、后开 Drawer，
  // 容器会被压住（探针 M）；hide+show 一次即恢复（探针 N）。
  bringLayerToFront(BodyEl);
}

/** 容器退出 top-layer（最后一个引用释放时才真正 hide） */
function popBodyLayer(): void {
  if (bodyLayerRefs > 0) bodyLayerRefs--;
  if (bodyLayerRefs > 0 || !bodyPopoverOn || !BodyEl) return;
  bodyPopoverOn = false;
  deactivateLayer(BodyEl);
}

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
 *  surface {boolean} 弹出内容是否自带浮起表面（背景/圆角/阴影），面板类浮层应开启，默认false
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
  @prop surface = false;
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
  @state __visible = this.visible;
  /** 本实例是否已经把容器推进 top-layer。 */
  private __layerOn = false;
  /** 登记到 layerHost 的 renderRoot 快照：disconnected 时 renderRoot 可能已空 */
  private __layerEl: HTMLElement | null = null;
  /** 栈顶按 ESC 的回调（统一由 layerHost 分发） */
  private __onEsc = (e: KeyboardEvent) => {
    if (this.esc) this.close(e);
    else this.renderRoot?.classList.add('ce-overlay-shake');
  };

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

  /** 懒渲染内容（如 Dropdown）首次打开尚无尺寸时延迟显示的标记，避免在页面左上角闪现 */
  __revealPending = false

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

  /** 打开：共享容器进 top-layer + 本实例登记进统一层栈（幂等） */
  private __pushLayer() {
    if (this.__layerOn) return
    this.__layerOn = true
    pushBodyLayer()
    this.__layerEl = this.renderRoot as HTMLElement ?? null
    if (this.__layerEl) pushLayer(this.__layerEl, { onEsc: this.__onEsc })
  }
  /** 关闭 / 断开：释放一次引用（幂等，和 __pushLayer 严格配对） */
  private __popLayer() {
    if (!this.__layerOn) return
    this.__layerOn = false
    popBodyLayer()
    if (this.__layerEl) popLayer(this.__layerEl)
    this.__layerEl = null
  }
  @watch("__visible")
  watch__Visible(nv: boolean) {
    // 内部状态变化（trigger/hover/focus/esc 等）驱动 visible：
    // prop setter 对 model prop 只 emit 不落值（框架语义），
    // 必须经 updateProps 写入内部值以触发 watchVisible → open/close，
    // 同时 emit update:visible 保持对外（model 绑定）通知
    this.updateProps({ visible: nv });
    this.emit('update:visible', { value: nv })
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
        @resize="${this.onResize}"
        @transitionend.debounce="${this.onTransitionEnd}"
        @animationend="${this.onAnimationEnd}"
        @mousedown="${this.onMousedownContent}"
        @mouseup="${this.onMouseupContent}"
      >
        ${ifTrue(this.backdrop, () => h`<div class="ce-overlay-backdrop" ${styles({ opacity: this.__visible ? this.opacity + '' : '' })}></div>`)}
        <div ref="${this.contentEl}" class="ce-overlay-content" ${classes({ "is-center": !this.direction, "ce-overlay-surface": this.surface })} ${styles({
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
      // popover 属性由 activateLayer() 在首次打开时添加；这里只压掉 UA 给
      // [popover] 的那套样式。 降级路径（无 Popover API）刻意不设这套样式：
      // 否则容器会变成一个铺满视口、拦截点击的空 div。
      if (typeof (container as any).showPopover === 'function') {
        container.style.cssText = BODY_LAYER_STYLE
      }
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
    // 兜底：断开时若还占着 top-layer 引用（close 没走到），必须还回去，
    // 否则容器永远压在页面上、整个页面点不动。
    this.__popLayer()
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
        case TriggerMode.POINTERDOWN:
          this.triggerEl.removeEventListener('pointerdown', this.listenerMap.get(this.onPointerDownTrigger))
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
    /**
     * 内容尺寸变化就重算位置（调用方已 debounce 100ms）。
     *
     * 原来只算第一次：弹窗/下拉的内容经常是**打开后才渲染**的（挂件设置的配置项
     * 分组、异步候选列表），首帧量到的高度偏小，位置就按那个高度定死；等内容长高
     * 后不再重算 —— center 定位的弹窗整体偏下、底部超出视口，看着像"弹窗没限高"。
     */
    if (this.__visible) this.calcPosition(this.triggerEl)
    this.__firstContentChange = true
    // 懒渲染首开：内容渲染出尺寸后，在此定位并显示被延迟的浮层
    this._maybeReveal()
  }
  /** 浮层内容是否已具备可测量的尺寸 */
  hasContentSize() {
    const el = this.contentEl.current
    return !!(el && el.offsetHeight > 0 && el.offsetWidth > 0)
  }
  /** 首次打开且内容尚无尺寸（懒渲染）时：等尺寸就绪后再定位显示，避免在页面左上角闪现 */
  _maybeReveal() {
    if (!this.__revealPending || !this.__visible) return
    if (!this.hasContentSize()) {
      // 内容尚未画出尺寸，下一帧重新测量
      requestAnimationFrame(() => this._maybeReveal())
      return
    }
    this.__revealPending = false
    this.calcPosition(this.triggerEl)
    let overlay = this.renderRoot!
    overlay.classList.add("ce-overlay-visible")
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
        case TriggerMode.POINTERDOWN:
          let pdtb = this.onPointerDownTrigger.bind(this)

          this.listenerMap.set(this.onPointerDownTrigger, pdtb)

          this.triggerEl.addEventListener('pointerdown', pdtb)
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
    // placement 为临时覆盖值：不能直接写 placement（prop 直写会被丢弃），
    // 故按与 @watch('placement') 相同的规则刷新内部方位状态。
    if (placement) {
      let pair = placement.split('-')
      this.direction = pair[0]
      this.startOrEnd = pair[1]
      this.adjustedDirection = this.adjustedStartOrEnd = ''
    }
    this.__visible = true
    // 换触发节点时先摘掉上一个节点的 active：autoActive 的高亮只在 close() 里清理，
    // 同一浮层被 openBy 换锚点（如筛选面板从一个字段切到另一个）时旧节点不会收到 close，
    // 高亮就会残留，必须点击一次才消失。
    if (this.autoActive && this.triggerEl && this.triggerEl !== trigger) {
      this.triggerEl.toggleAttribute('active', false)
    }
    // 先记下 trigger：bindFollow() 要靠它解析滚动祖先链、relocate() 也用它。
    // 原实现把赋值放在 bindFollow 之后，首次打开时拿到的是 undefined（再次打开是上一个
    // trigger），于是祖先链为空、只绑到 window —— 容器内滚动完全不触发重定位。
    this.triggerEl = trigger
    //计算位置
    this.adjustedDirection = this.adjustedStartOrEnd = ''
    this.calcPosition(trigger)
    this._append()
    this.__pushLayer()
    this.bindFollow()
    this.bindContentResize()
    if (this.closeTimer) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    let overlay = this.renderRoot!;
    // overlay.style.zIndex = '0'
    STACK.add(this);


    this.openTimer = setTimeout(() => {
      if (!this.__visible) return
      //计算位置
      this.adjustedDirection = this.adjustedStartOrEnd = ''
      this.calcPosition(trigger)
      this.transiting = 1;
      if (this.hasContentSize()) {
        overlay.classList.add("ce-overlay-visible");
      } else {
        // 内容尚未就绪（懒渲染首开）：延迟到 onContentChange 测到尺寸后显示，避免左上角闪现
        this.__revealPending = true;
      }

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
    this.__pushLayer()
    this.bindFollow()
    this.bindContentResize()
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
      if (this.hasContentSize()) {
        overlay.classList.add("ce-overlay-visible");
      } else {
        // 内容尚未就绪（懒渲染首开）：延迟到 onContentChange 测到尺寸后显示，避免左上角闪现
        this.__revealPending = true;
      }
      this.emit("open", { trigger: this.triggerEl });
    }, this.triggerMode === TriggerMode.CLICK ? 0 : this.openDelay);

    if (this.autoActive) {
      this.triggerEl?.toggleAttribute('active', true);
    }
    this.emit("beforeopen", { trigger: this.triggerEl });
  }
  /**
   * open() 已把资源 push 进共享层栈、但 openTimer 还没执行（transiting 仍为 -1）
   * 时被调用 close()：做一次「静默释放」，不 emit 关闭事件。
   *
   * 原来这里直接 return，导致 __popLayer() 不执行 ⇒ 引用计数少一次 pop ⇒
   * 容器永远留在 top-layer 并铺满视口盖住页面（真机复现：open(); close();
   * 同一 tick 后 open=true / visible=1 / transiting=1）。
   */
  private __abortOpening(): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
    this.__popLayer()
    STACK.delete(this)
    this.__visible = false
    this.__revealPending = false
    this.unbindFollow()
    this.unbindContentResize()
    if (this.autoActive) this.triggerEl?.toggleAttribute('active', false)
    this.renderRoot?.classList.remove('ce-overlay-visible')
  }

  close(e?: Event, isInStack?: boolean) {
    if (this.transiting < 0) {
      this.__abortOpening()
      return;
    }

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
    // 先退出 top-layer：容器是共享的，本实例关掉就该少一份引用（见 pushBodyLayer）
    this.__popLayer()

    let overlay = this.renderRoot!;
    overlay.classList.remove("ce-overlay-visible");
    this.transiting = -1;
    this.__visible = false;
    this.__revealPending = false;
    this.unbindFollow()
    this.unbindContentResize()
    this.contentEl.current!.style.top = '-999px'
    this.contentEl.current!.style.left = '-999px'
    // 面板自身的 CSS 过渡（opacity/transform）可定制，收尾按真实时长算；
    // renderRoot 本身无过渡时用 300ms 兜底等内部内容淡出。
    this.closeTimer = scheduleSettle(overlay, () => {
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
  /**
   * trigger 的滚动祖先链（含跨 shadowRoot 到 host 的那几跳）。
   *
   * 为什么不能只监听 `document`：`scroll` 事件不冒泡、也不跨 shadow 边界。
   * 门户这类把内容包在 shadow root 里的场景（滚动容器是 shadow 内的 `.pb-body`），
   * 事件传不到 document —— 面板就会停在原处、看着"离开锚点"。
   * 沿祖先链逐个绑是 Floating UI getScrollParents 的做法，普通页面与 shadow 页面统一。
   */
  private __scrollParents(el: HTMLElement | null): Array<Element | Window> {
    const out: Array<Element | Window> = []
    let node: HTMLElement | null = el
    while (node) {
      if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) out.push(node)
      const root = (node as any).getRootNode?.()
      node = node.parentElement || (root && root.host ? (root.host as HTMLElement) : null)
    }
    // 兜底：文档级滚动 / window 缩放
    out.push(window)
    return out
  }
  __followTargets: Array<Element | Window> = []
  /** 当前已绑定的 trigger：trigger 变了要重绑（见 bindFollow 注释） */
  __boundTrigger: HTMLElement | null = null
  /** 内容尺寸观察者：内容异步变高后重新定位（见 bindContentResize） */
  __contentRO: ResizeObserver | null = null
  /**
   * 观察浮层内容自身的尺寸变化，变了就重新定位。
   *
   * 为什么不能只靠模板上的 `@mutate.child`：那只监听**直接子节点**的增删，
   * 而弹窗/下拉的内容通常渲染在子孙节点里（挂件设置的配置项就是往内层 div 里塞），
   * 首帧量到的高度偏小、位置就此定死 —— center 定位的弹窗会整体偏下、底部超出视口。
   * ResizeObserver 不受 DOM 层级影响，尺寸一变就能重算。
   */
  bindContentResize() {
    if (typeof ResizeObserver === "undefined") return
    const el = this.contentEl.current
    if (!el) return
    if (!this.__contentRO) {
      this.__contentRO = new ResizeObserver(() => {
        if (!this.__visible) return
        this.calcPosition(this.triggerEl)
      })
    }
    this.__contentRO.observe(el)
  }
  unbindContentResize() {
    this.__contentRO?.disconnect()
    this.__contentRO = null
  }
  bindFollow() {
    if (!this.follow) return
    // trigger 还没就绪就等：`visible` 的 watcher 会先于 `openBy` 触发一次，
    // 那时 `triggerEl` 还是上一个/undefined，按它解析祖先链必然为空。
    if (!this.triggerEl) return
    // 同一个 trigger 已绑过就不重复绑；换了 trigger 必须重绑，否则沿用旧链
    if (this.__following && this.__boundTrigger === this.triggerEl) return
    this.unbindFollow()
    this.__following = true
    this.__boundTrigger = this.triggerEl
    this.__followTargets = this.__scrollParents(this.triggerEl)
    for (const target of this.__followTargets) {
      target.addEventListener('scroll', this.__onFollowScroll as EventListener, { capture: true, passive: true } as AddEventListenerOptions)
    }
    window.addEventListener('resize', this.__onFollowScroll)
  }
  unbindFollow() {
    if (!this.__following) return
    this.__following = false
    this.__boundTrigger = null
    cancelAnimationFrame(this.__followRafId)
    for (const target of this.__followTargets) {
      target.removeEventListener('scroll', this.__onFollowScroll as EventListener, true)
    }
    this.__followTargets = []
    window.removeEventListener('resize', this.__onFollowScroll)
  }
  calcPosition(trigger: HTMLElement, relocate?: boolean) {
    // 销毁/拆卸迟到回调守卫：`onContentChange` 是防抖回调，内容被移除后
    // `contentEl.current` 可能已为 undefined。
    if (this.isDestroyed || !this.contentEl.current) return
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
  onResize() {
    // resize 走扩展事件，迟到回调里 renderRoot 已置空
    if (!this.isMounted || this.isDestroyed || !this.renderRoot) return
    if (isVisible(this.renderRoot) && this.__visible) {
      this.calcPosition(this.triggerEl)
    }
  }
  onTransitionEnd(e: Event) {
    // 竞态守卫：transitionend 带 .debounce 延时分发，若分发前 overlay 已被
    // 销毁（renderRoot 置空；典型场景：ce-dialog 关闭时 ifTrue 槽把整棵
    // overlay 子树移除），迟到回调读 renderRoot.scrollHeight 会抛
    // TypeError（2026-10-15 在 compelem-report-builder 系统配置弹框实测，
    // A/B 证实与 TableBar early-upgrade 修复无关，是 Overlay 自身既有竞态）。
    if (!this.renderRoot) return
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
    // 仅响应主键（左键）。浏览器对右键/中键只派发 mousedown 不派发 click，
    // 不过滤会导致 triggerMode=click 时右键也误开浮层（右键打开 Dialog 缺陷）
    if ((e as MouseEvent).button !== 0) return;
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

/**
 * ESC 已统一由 `layerHost.ts` 的层栈分发（只让栈顶那层响应）。
 * 不再在这里挂第二份 document keydown —— 原来 Overlay 与 Drawer 各算各的
 * 栈序，嵌套时会出现「ESC 关掉下面那层」或两层同时抖动。
 * 本实例的回调见 __onEsc，登记点见 __pushLayer。
 */
document.addEventListener("mousedown", function (e) {
  // 右键/中键不参与「点击外部关闭」判定，也不重置按压状态
  if (e.button !== 0) return;
  if (STACK.size < 1) return;
  let visibleOverlay = last(STACK)
  if (!visibleOverlay) return;

  /**
   * 「点在内容里还是外面」的判定（2026-11-10 改为**优先看 composedPath**）。
   *
   * 只靠 `contentEl.contains(e.target)` 会漏：`e.target` 是**重定向后**的
   * （shadow 外的监听器看到的是宿主元素）。overlay 的内容常常是**投影**进来的
   * （`ce-select` 的下拉把 `ce-list-picker` 投进 overlay 的 slot），
   * 点击落在选项上时，`e.target` 在 document 监听器眼里已经是外层宿主
   * ⇒ `contains` 为 false ⇒ 误判"点了外面" ⇒ 面板刚开就被关、选项永远选不中。
   *
   * `composedPath()` 给的是**未重定向**的真实路径，里面能找到 `.ce-overlay-content`。
   */
  const inContentOf = (o: Overlay) => {
    const el = o.contentEl.current
    if (!el) return false
    if (e.composedPath && (e.composedPath() as Node[]).includes(el)) return true
    return el.contains(e.target as Node)
  }
  let isInContent = inContentOf(visibleOverlay) || visibleOverlay.contentPressing
  let isInStack = isInContent || some(STACK, v => inContentOf(v))

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

/**
 * 手势终结：**任何位置**的 mouseup 都清掉全 STACK 的按压态。
 *
 * 为什么必须有它：`onMouseupContent` 是绑在内容元素上的 bubble 监听 ——
 * 「内容内按下 → 拖到框外松开」时 mouseup 的目标在内容外，该监听**根本不触发**，
 * `contentPressing` 残留 true；下一次框外 mousedown 的
 * `isInContent = … || contentPressing` 于是被误判成「点在内容里」⇒ 不关闭
 * （而 mousedown 处理器末尾的重置发生在本次判定之后，所以第一击必死、
 * 第二击才关 —— 见 compelem-report-builder diag27d 场景 B 实证）。
 *
 * 按压态本就是「单次鼠标手势」级状态：无论 mouseup 落在内容内、框外还是
 * 另一个浮层里，抬手即终结。FOCUS 模式的 blur 守卫（`onBlurTrigger` 读
 * `contentPressing`）发生在 mousedown 期间、早于 mouseup，不受影响。
 */
document.addEventListener("mouseup", function (e) {
  // 与 mousedown 一致：只跟主键，右键/中键的抬起不重置按压态
  if (e.button !== 0) return;
  if (STACK.size < 1) return;
  STACK.forEach(v => {
    v.triggerPressing = false
    v.contentPressing = false
  })
}, true);