import { classes, CompElem, createRef, csscope, Csscope, h, prop, state, tag, Template, watch } from "compelem";
import { scheduleSettle } from "../../../utils/transition";
import { closest, isBlank, isEmpty, isUndefined } from "myfx";
import { IPlacement } from "../../../interfaces/IPlacement";
import { beginDrag, type DragSessionHandle } from "../../../utils/dragSession";
import { Dialog } from "../dialog/Dialog";
import style from "./style.scss?tmpl";

const GAP = 5;
/** alwaysShow：等目标**首次布局**出来最多等这么久（面板还没显示时） */
const SETTLE_MIN_LIFE = 1000;
/** alwaysShow：目标首次有尺寸后再观察这么久（覆盖弹层居中 / 回流这类迟到变化） */
const SETTLE_WINDOW = 1000;
/** alwaysShow：观察窗最短时长（不到这个时间即使稳了也不收工，防"刚打开就静止"） */
const SETTLE_MIN = 200;
/** alwaysShow：连续稳定帧数（与 SETTLE_MIN 同时满足才提前收工） */
const SETTLE_STABLE_FRAMES = 3;
/** 存活心跳间隔（见 aliveWatch 注释）：目标被卸载后提示框最多滞留这么久 */
const ALIVE_INTERVAL = 150;
/** 目标断开超过这么久就彻底销毁提示框（不再等它复活），避免 body 里堆空壳 */
const ALIVE_DISPOSE_AFTER = 1000;
const enum TriggerType {
  CLICK = 'click',
  HOVER = 'hover'
}

/**
 * 「目标还在吗」共享心跳。
 *
 * 为什么需要：指令（`directives/tooltip`）把提示框表面**挂在 body / 弹层渲染根**上，
 * 与目标的 DOM 树完全解耦 ⇒ 目标被卸载时提示框**不会**跟着消失。而这件事
 * **没有任何事件可听**——`disconnectedCallback` 只属于自定义元素，任意 `Element`
 * （这里是滑杆 shadow 里的 thumb）被摘掉不会通知任何人；`MutationObserver` 也
 * 没有一个能覆盖"任意层级祖先被整枝移除"的廉价观察点。
 *
 * 实测（`artifacts/diag19.mjs`）：设置弹框从「AI」切到「数据源」，分区整枝被
 * `ifTrue` 摘掉后，两个 `tooltip="always"` 的提示框仍 `ce-tooltip-visible`
 * 钉在原坐标、`__anchor.isConnected` 已是 false —— 就是本函数要收拾的场面。
 *
 * 口径：只对「已打开且未关闭」的提示框开**一条**低频心跳（同时最多 1~2 个），
 * 每次只读 `isConnected`、不做布局读取。目标若被重新插回（同一节点复用）会自动复活。
 */
const aliveSet = new Set<Tooltip>()
let aliveTimer: ReturnType<typeof setInterval> | null = null
function aliveTick() {
  for (const t of Array.from(aliveSet)) t.__syncAlive()
  if (aliveSet.size === 0 && aliveTimer) {
    clearInterval(aliveTimer)
    aliveTimer = null
  }
}
function aliveWatch(t: Tooltip) {
  aliveSet.add(t)
  if (!aliveTimer) aliveTimer = setInterval(aliveTick, ALIVE_INTERVAL)
}
function aliveUnwatch(t: Tooltip) {
  aliveSet.delete(t)
  if (aliveSet.size === 0 && aliveTimer) {
    clearInterval(aliveTimer)
    aliveTimer = null
  }
}
/**
 * 文字提示，用于替代原生title属性
 * @attrs
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
  #drag: DragSessionHandle | null = null;
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
  /** 承载 content 插槽内容克隆的容器（见 __syncRich） */
  __richEl = createRef<HTMLElement>();
  __timer: ReturnType<typeof setTimeout> | null;
  __closeTimer: ReturnType<typeof setTimeout> | null;
  /**
   * 隐藏批次令牌。`close()` 会在 nextTick / 过渡结束后才真正移除 visible 与节点，
   * 若这期间鼠标已经移入提示框（onEnterTip）或重新打开（open），这些延迟动作必须作废，
   * 否则会把刚恢复的提示框又藏起来/摘掉 —— 表现为"移入提示框后它反而消失"。
   */
  __hideToken = 0;
  /** 可交互提示框的"过桥"守卫（见 __startHoverGuard） */
  __hoverGuard: ((e: PointerEvent) => void) | null = null;
  __hoverGuardTimer: ReturnType<typeof setTimeout> | null = null;
  /** 守卫期间最后一次指针位置，用于兜底定时器判断 */
  __lastPointer: { x: number; y: number } | null = null;
  __dragging = false;
  // ── alwaysShow 的持续跟随（见 __watchSettle / __bindFollow 注释）
  __settleRaf = 0;
  __following = false;
  __followRaf = 0;
  __ro: ResizeObserver | null = null;
  /** 目标被卸载的时刻（0 = 在文档里）；用于宽限期内复活 / 超时后彻底销毁 */
  __detachedAt = 0;
  /**
   * 实例已被 `__dispose()` 销毁，不再可用。
   *
   * 指令（`directives/tooltip`）用 `WeakMap(目标节点 → 实例)` 缓存，且**更新分支
   * 永不重建实例** ⇒ 若实例销毁了而 WeakMap 条目还在，该目标节点就**永久失去**
   * 提示框（更新分支直接 return，新建分支被 `TooltipMap.has(node)` 挡住）。
   * 所以销毁必须留痕，让指令在下次渲染时按 `!tooltip.__dead` 走新建分支。
   */
  __dead = false;

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
        <span ref="${this.__richEl}" class="ce-tooltip-rich"></span>
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
      this.__anchor.addEventListener("pointerdown", this.hook_dragstart);
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
      this.__anchor.removeEventListener("pointerdown", this.hook_dragstart);
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
      node.addEventListener("pointerdown", this.hook_dragstart);
    }

  }
  updateContent(content: string) {
    // this.content = content
    this.setAttribute('content', content)

  }
  updateAlwasy(alwaysShow: boolean) {
    // 组件内不能直接给 prop 赋值（E-PROP-ASSIGN），走 updateProps 才会真正落值
    // （直写 __data_ + 更新信号）。本方法由 directives/tooltip 指令从外部调用。
    this.updateProps({ alwaysShow })
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
    // 重新打开：作废之前挂起的隐藏/摘除
    this.__hideToken++;
    this.__timer = setTimeout(() => {
      this.__syncRich();
      this._relocate();
      this.renderRoot?.classList.add('ce-tooltip-visible')
      this.__timer = null;
      // alwaysShow 的坐标**不能只算一次**（见 __watchSettle 注释）：打开时目标
      // 往往还在被弹层搬家 / 居中，一次定位会留下陈旧坐标。这里补上"跟随"。
      if (this.alwaysShow) {
        this.__bindFollow();
        this.__watchSettle();
      }
      // 目标被卸载时提示框不会自己消失（挂在 body / 弹层根上），挂上存活心跳
      this.__detachedAt = 0;
      aliveWatch(this);
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

  // ══════════════════════════════ alwaysShow 的持续跟随
  //
  // 组件文档承诺 alwaysShow「一直显示，同时持续监控目标元素变化（位置、尺寸）」，
  // 但实现里只在 `open()` 那一刻算一次坐标 —— 目标此后移动就再也不跟。
  //
  // 实测（`artifacts/diag17.mjs`，打开 ce-dialog 时逐帧采样）：
  //   t=485ms 目标 y=626 ⇒ 写入 top=595（当时正确）
  //   t=704ms 目标 y=640（弹窗仍在居中：表面 x/y/高同时在变）
  //   t=773ms 目标 y=663 稳定 ⇒ 提示框仍停在 595，**永久高出 37px**
  //   （设置弹框里 `tooltip="always"` 的滑杆即此症状）
  //
  // 注意：这类"迟到几何变化"**没有任何事件可听**（不是 scroll / resize，
  // 目标尺寸也没变，只是祖先被平移）⇒ 只能用有限时长的逐帧观察窗兜住。
  /**
   * 「目标还在、提示框还挂着、未禁用」才允许写坐标。
   *
   * 观察窗 / 事件跟随都可能在 `close()` 之后还收到回调；而 `_relocate()` 在
   * `renderRoot` 没有父节点时会把节点**重新挂回容器**（它的重挂逻辑）⇒ 不挡住
   * 就会出现"提示框已经关掉又被拽回来"的僵尸。
   */
  private __canFollow() {
    return !this.disabled
      && this.__anchor?.isConnected === true
      && this.renderRoot?.isConnected === true;
  }
  /** 高频事件（scroll/resize/尺寸）合并到一帧里重定位 */
  private __followRelocate = () => {
    if (this.__followRaf) return;
    this.__followRaf = requestAnimationFrame(() => {
      this.__followRaf = 0;
      if (this.__canFollow()) this._relocate();
    });
  }
  /**
   * alwaysShow 期间的事件跟随：目标被滚动带走 / 窗口缩放 / 自身尺寸变化。
   *
   * 口径与 `Overlay.bindFollow` 一致：`scroll` 用**捕获**（scroll 不冒泡，
   * 但捕获阶段能从任意可滚祖先收到，弹窗内部滚动条也能命中）。
   */
  __bindFollow() {
    if (this.__following) return;
    this.__following = true;
    document.addEventListener('scroll', this.__followRelocate, { capture: true, passive: true });
    window.addEventListener('resize', this.__followRelocate);
    if (typeof ResizeObserver !== 'undefined' && this.__anchor) {
      this.__ro = new ResizeObserver(this.__followRelocate);
      this.__ro.observe(this.__anchor);
    }
  }
  __unbindFollow() {
    if (!this.__following) return;
    this.__following = false;
    document.removeEventListener('scroll', this.__followRelocate, true);
    window.removeEventListener('resize', this.__followRelocate);
    this.__ro?.disconnect();
    this.__ro = null;
    cancelAnimationFrame(this.__followRaf);
    this.__followRaf = 0;
    cancelAnimationFrame(this.__settleRaf);
    this.__settleRaf = 0;
  }
  /**
   * 打开后的一段逐帧观察窗：目标矩形一有变化就重定位，连续稳定即提前收工。
   *
   * 两个时间闸门（都在常量里）：
   *  - 目标**首次拿到真实尺寸**最多等 `SETTLE_MIN_LIFE`（面板尚未显示时矩形是 0，
   *    这时既不该拿它算坐标、也不该放弃观察）；
   *  - 首次有尺寸后再观察 `SETTLE_WINDOW`，且至少 `SETTLE_MIN`、
   *    连续 `SETTLE_STABLE_FRAMES` 帧不动才收工。
   *
   * 只在**矩形真的变了**时才写样式：观察窗内不产生无谓的样式写入。
   */
  __watchSettle() {
    cancelAnimationFrame(this.__settleRaf);
    const born = performance.now();
    let started = 0;                     // 目标首次有尺寸的时刻
    let stable = 0;
    let last: { x: number; y: number; w: number; h: number } | null = null;
    const tick = () => {
      this.__settleRaf = 0;
      const a = this.__anchor?.getBoundingClientRect();
      if (!a || !this.renderRoot?.isConnected) return;          // 目标/提示框已卸载
      const now = performance.now();
      if (!started) {
        if (now - born > SETTLE_MIN_LIFE) return;                // 一直没布局 ⇒ 不跟了
        if (a.width > 0) started = now;
      }
      if (started) {
        if (a.width > 0 && !this.disabled) {
          const moved = !last || last.x !== a.x || last.y !== a.y || last.w !== a.width || last.h !== a.height;
          if (moved) {
            last = { x: a.x, y: a.y, w: a.width, h: a.height };
            stable = 0;
            this._relocate();
          } else if (++stable >= SETTLE_STABLE_FRAMES && now - started >= SETTLE_MIN) {
            return;
          }
        }
        if (now - started > SETTLE_WINDOW) return;
      }
      this.__settleRaf = requestAnimationFrame(tick);
    };
    this.__settleRaf = requestAnimationFrame(tick);
  }
  /**
   * 存活心跳的一拍（只由模块级 `aliveTick` 调用）。
   *
   * - 目标还在：若上一拍被摘过就**复活**（`open()` → `_relocate()` 会重新挂回容器），
   *   这样"同一节点被暂时移走又插回"（隐藏/显示、列表重排）不会永久丢提示框；
   * - 目标没了：立刻把**表面**摘掉——不走 `close()`（它会把状态清成"已关闭"、
   *   且摘表面还带 200ms 延时），只做最小动作；断开超过 `ALIVE_DISPOSE_AFTER`
   *   就彻底销毁，避免每次卸载都在 body 里留一个空壳。
   */
  __syncAlive() {
    const rr = this.renderRoot
    if (this.__anchor?.isConnected === true) {
      if (this.__detachedAt) {
        this.__detachedAt = 0
        this.open()
      }
      return
    }
    if (!this.__detachedAt) {
      this.__detachedAt = performance.now()
      this.__unbindFollow()
    }
    if (rr?.isConnected) {
      // 连 visible class 一起清：节点虽然摘了看不见，但留着会变成脏状态
      // （复活时 `open()` 会重新 add，且有淡入过渡，无害）
      rr.classList.remove('ce-tooltip-visible')
      rr.parentElement?.removeChild(rr)
    }
    if (performance.now() - this.__detachedAt > ALIVE_DISPOSE_AFTER) this.__dispose()
  }
  /** 目标已永久消失：解绑跟随、摘掉表面、宿主元素自身也从 body 摘掉（防空壳堆积） */
  __dispose() {
    this.__unbindFollow()
    aliveUnwatch(this)
    const rr = this.renderRoot
    if (rr?.isConnected) rr.parentElement?.removeChild(rr)
    // 必须**先**留痕再摘元素：`__dead` 是指令判断"要不要重建实例"的唯一依据
    this.__dead = true
    this.remove()
  }
  /**
   * 是否"有内容可提示"。内容可来自 `content` 属性，也可来自 `content` 插槽（富文本）。
   * 早期实现只判断属性，插槽方案会被当成"空内容"在 hover/click/drag 入口直接 return，
   * 表现为富文本提示悬停无任何反应。
   */
  private __hasTipContent(): boolean {
    return !isBlank(this.content) || !isEmpty(this.slots?.content)
  }
  /**
   * 把 `content` 插槽内容克隆进提示框表面。
   *
   * 模板里的 `<slot name="content">` 只在**宿主 shadow 树内**才有分发能力，而表面
   * 在 `mounted()` 就被搬出 shadow 树（挂到 body / 弹层渲染根）⇒ 富文本永远渲染不出来。
   * 这里在每次打开时克隆一份插槽节点放进表面容器（与 Overlay 搬运默认插槽同一目的）。
   *
   * 用克隆而非搬运：搬运会把节点从宿主 light DOM 摘走 ⇒ `this.slots.content` 变空，
   * 下一次 hover 的 `__hasTipContent()` 就会判成"无内容"，提示框只剩第一次能显示。
   */
  __syncRich() {
    const box = this.__richEl.current;
    if (!box) return;
    const nodes = this.slots?.content;
    box.replaceChildren(...(nodes ? nodes.map(n => n.cloneNode(true)) : []));
  }
  //////////////////////////////////// 拖动跟随
  onDragStart(e: PointerEvent) {
    if (this.disabled) return;
    if (!this.__hasTipContent()) return
    this.__dragging = true
    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }
    this.open();
    this.#drag?.end(false)
    this.#drag = beginDrag(this.__anchor ?? this, e, {
      onMove: () => this.relocate(),
      onEnd: () => this.onDragEnd(e)
    })
  }
  onDragMove(e: MouseEvent) {
    this.relocate();
  }
  onDragEnd(e: MouseEvent) {
    this.__dragging = false
    this.#drag = null
    if (this.alwaysShow) {
      this.relocate();
      return
    }
    this.close();
  }
  close() {
    // 跟随要先停：否则观察窗/事件回调会在提示框摘掉后把它重新挂回容器
    this.__unbindFollow();
    this.__stopHoverGuard();
    aliveUnwatch(this);
    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    const token = ++this.__hideToken;
    this.nextTick(() => {
      // 期间已移入提示框或重新打开（令牌被推进）：不要执行这次隐藏
      if (token !== this.__hideToken) return;
      this.renderRoot?.classList.remove('ce-tooltip-visible');
    })
    // 摘节点时机按真实过渡时长算，取不到时用 200ms 兜底。
    const root = this.renderRoot;
    this.__timer = scheduleSettle(root, () => {
      // 同上：隐藏已被取消（如鼠标移入/重新打开）就不要摘节点
      if (token !== this.__hideToken) return;
      // 组件可能已被销毁（路由切换 / 父级卸载）：此时 `renderRoot` 是
      // **undefined**（`CompElem#destroy()` 把 `#renderRoot` 置 null，getter 里
      // `null?.deref()` 得 undefined）。原写法 `this.renderRoot!.parentElement`
      // 会抛 `Cannot read properties of undefined (reading 'parentElement')`。
      // 实测：compelem-ui-website 从 `#/components/tooltip` 切到别的路由必现。
      if (this.renderRoot?.parentElement === this.container)
        this.container.removeChild(this.renderRoot)
      this.__timer = null;
      this.adjustedDirection = '';
    }, 200);
  }
  /**
   * 销毁时清掉两个挂起的定时器。
   *
   * 只修 `close()` 里的可选链只能止住报错，定时器仍会在已销毁实例上跑一轮
   * （`_relocate()` / `close()` 都会碰 DOM）。`CompElem#destroy()` 会在把
   * `#renderRoot` 置空**之后**才调 `destroyed()`，所以这里是清定时器的最后机会。
   */
  destroyed(): void {
    this.#drag?.end(false)
    this.#drag = null
    this.__unbindFollow()
    this.__stopHoverGuard()
    aliveUnwatch(this)
    if (this.__timer) {
      clearTimeout(this.__timer)
      this.__timer = null
    }
    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }
  }
  /**
   * 可交互提示框的"过桥"守卫。
   *
   * 目标与提示框之间始终隔着一段空隙（GAP 与展开位移），且提示框通常比目标窄
   * （示例里按钮 210px、提示框 116px）。目标 `mouseleave` 后只等 100ms 就关闭：
   * 鼠标斜向/慢速移向提示框、或从按钮偏左/偏右的位置竖直向上时，都来不及进入提示框，
   * 提示框先淡出、过渡结束后节点被摘掉，鼠标就再也进不去了。
   *
   * 所以可交互提示框离开目标后不立刻倒计时，而是跟踪指针：只要还在「目标 ∪ 提示框」
   * 的**外接矩形**内（含两者之间整条通道）就保持显示；真正离开该区域并停留一小段
   * 时间才关闭。等待期间仍继续监听，指针折返回来会撤销关闭。
   */
  private __startHoverGuard() {
    if (this.__hoverGuard) return;
    const MARGIN = 10;
    const inZone = (x: number, y: number) => {
      const a = this.__anchor?.getBoundingClientRect();
      const p = this.renderRoot?.getBoundingClientRect();
      if (!a && !p) return false;
      // 用两者的外接矩形，而不是各自扩一圈的并集：从按钮左/右边缘竖直向上时，
      // 指针会贴着提示框外侧经过 —— 明明在"过桥"，却会被判定成已离开。
      const left = Math.min(a ? a.left : Infinity, p ? p.left : Infinity) - MARGIN;
      const top = Math.min(a ? a.top : Infinity, p ? p.top : Infinity) - MARGIN;
      const right = Math.max(a ? a.right : -Infinity, p ? p.right : -Infinity) + MARGIN;
      const bottom = Math.max(a ? a.bottom : -Infinity, p ? p.bottom : -Infinity) + MARGIN;
      return x >= left && x <= right && y >= top && y <= bottom;
    };
    const scheduleClose = () => {
      if (this.__closeTimer) return;
      this.__closeTimer = setTimeout(() => {
        this.__closeTimer = null;
        const p = this.__lastPointer;
        // 关闭前再确认一次：指针可能在最后一刻回到区域里
        if (p && inZone(p.x, p.y)) return;
        this.__stopHoverGuard();
        this.close();
      }, 120);
    };
    this.__hoverGuard = (e: PointerEvent) => {
      this.__lastPointer = { x: e.clientX, y: e.clientY };
      if (inZone(e.clientX, e.clientY)) {
        // 仍在目标/提示框/两者之间的通道内（正在过桥）：撤销关闭
        if (this.__closeTimer) {
          clearTimeout(this.__closeTimer);
          this.__closeTimer = null;
        }
        return;
      }
      // 已离开联动区域：延迟关闭，但继续监听 —— 快速划过又折返时不至于已经关掉
      scheduleClose();
    };
    document.addEventListener('pointermove', this.__hoverGuard, true);
    // 指针停下时不会有 pointermove，用兜底定时器收尾：
    // 仍在联动区域内就继续观察（保持显示），离开了才关闭。
    const armFallback = () => {
      this.__hoverGuardTimer = setTimeout(() => {
        this.__hoverGuardTimer = null;
        const p = this.__lastPointer;
        if (p && inZone(p.x, p.y) && this.__hoverGuard) {
          armFallback();
          return;
        }
        this.__stopHoverGuard();
        this.close();
      }, 1500);
    };
    armFallback();
  }
  private __stopHoverGuard() {
    if (!this.__hoverGuard) return;
    document.removeEventListener('pointermove', this.__hoverGuard, true);
    this.__hoverGuard = null;
    if (this.__hoverGuardTimer) {
      clearTimeout(this.__hoverGuardTimer);
      this.__hoverGuardTimer = null;
    }
  }
  onMouseenter(e: MouseEvent) {
    if (this.alwaysShow) return;
    if (this.trigger !== TriggerType.HOVER) return;
    if (!this.__hasTipContent()) return
    // 已回到目标上，无需再跟踪过桥
    this.__stopHoverGuard();
    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }

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
    if (this.interactive) {
      // 可交互：鼠标可能正在移向提示框，交给"过桥"守卫判断，别按固定延迟直接关
      this.__lastPointer = { x: e.clientX, y: e.clientY };
      this.__startHoverGuard();
      return;
    }
    this.__closeTimer = setTimeout(() => {
      this.close()
    }, 100);
  }
  onClick(e: MouseEvent) {
    if (this.trigger !== TriggerType.CLICK) return;
    if (this.renderRoot?.parentElement) return
    if (!this.__hasTipContent()) return

    this.open();
    if (!this._watchClickHandle) {
      this._watchClickHandle = this.watchClick.bind(this)
    }
    // 延迟添加监听器，避免捕获当前点击事件导致立即关闭
    setTimeout(() => {
      document.addEventListener('click', this._watchClickHandle)
    }, 0);
  }
  _watchClickHandle: any
  watchClick(e: Event) {
    this.close()
    document.removeEventListener('click', this._watchClickHandle)
  }
  onEnterTip(e: Event) {
    if (this.trigger !== TriggerType.HOVER) return;
    // 已进入提示框，无需再跟踪过桥
    this.__stopHoverGuard();
    // 作废 close() 里挂起的隐藏/摘除：它们可能在鼠标进入后才执行
    this.__hideToken++;
    if (this.__timer) {
      clearTimeout(this.__timer)
    }
    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }
    this.renderRoot?.classList.add('ce-tooltip-visible');
  }
  onLeaveTip(e: MouseEvent) {
    if (this.alwaysShow) return;
    if (this.trigger !== TriggerType.HOVER) return;

    if (this.__closeTimer) {
      clearTimeout(this.__closeTimer)
      this.__closeTimer = null
    }
    if (this.interactive) {
      // 可交互：离开提示框不等于要立刻关闭（可能是移回目标，或只是快速划过），
      // 交给"过桥"守卫按指针实际位置判断
      this.__lastPointer = { x: e.clientX, y: e.clientY };
      this.__startHoverGuard();
      return;
    }
    this.__closeTimer = setTimeout(() => {
      this.close()
    }, 100);

  }
}
