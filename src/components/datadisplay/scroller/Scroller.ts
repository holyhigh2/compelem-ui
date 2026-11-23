import { classes, CompElem, computed, csscope, Csscope, debounced, emits, h, prop, query, show, tag, Template, watch } from "compelem";
import { isBlank } from "myfx";
import { getMatrixInfo } from "uiik";
import { IColorable } from "../../../interfaces/IColorable";
import { ColorHelper } from "../../../utils/color";
import { beginDrag, type DragSessionHandle } from "../../../utils/dragSession";
import { isVisible } from "../../../utils/utils";
import style from "./style.scss?tmpl";

export enum Edge {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right'
}

/** `scroll` 事件载荷 */
export type ScrollerScrollPayload = {
  /** 滚动距离（px） */
  to: number
  /** 命中的边界，不在边界时为 '' */
  edge: Edge | ''
  /** 滚动方向：v 纵向 / h 横向 */
  direction: 'v' | 'h'
  /** 取消滚动包装元素的默认操作 */
  preventDefault(): void
  /** 触发滚动的原始事件目标 */
  el?: EventTarget
}

/** `scrollend` 事件载荷：滚动操作结束后的最终位置与边界 */
export type ScrollerEndPayload = {
  to: number
  edge: Edge | ''
  direction: 'v' | 'h'
}
/**
 * 滚动条组件
 * 支持自动检测与指定范围
 * @attrs
 *  autoHide {boolean} 自动隐藏，默认true
 *  rounded {boolean} 圆角，默认true
 *  showTrack {boolean} 显示滚动条轨道，默认true
 *  size {number} 滚动条尺寸，默认10px
 *  wheelStep {number} 滚动步长，默认取event.deltaY
 *  sWidth {number} 容器滚动宽度，默认自动获取
 *  sHeight {number} 容器滚动高度，默认自动获取
 *  direction {string} 滚动方向，默认''，可选值：v/h
 * @events
 *  scroll({to,direction,edge,preventDefault}) 滚动时触发。to:滚动距离px ,edge:top/bottom/'', direction:v/h, preventDefault():取消滚动包装元素的默认操作
 *  scrollchange({maxX,maxY}) 滚动条尺寸或slot内容变化时触发
 *  scrollend({to,edge,direction}) 滚动操作结束后触发，可判断是否到顶部/底部
 * @slots
 *  - 滚动内容
 * @methods
 *  scrollXBy(x: number) 横向滚动x像素
 *  scrollYBy(y: number) 纵向滚动y像素
 *  scrollXTo(to: number) 横向滚动到to像素
 *  scrollYTo(to: number) 纵向滚动到to像素
 *  reposition() 当scrollTop与y不一致时重新设置scrollTop属性
 *  calcBounding() 重新计算滚动区大小
 * @author holyhigh2
 */
@emits('scroll', 'scrollchange', 'scrollend')
@tag('ce-scroller')
export class Scroller extends CompElem implements IColorable {

  //////////////////////////////////// props
  @prop autoHide = true;
  @prop rounded = true;
  @prop showTrack = true;
  @prop({ type: String }) color: string;
  @prop size = 10;
  @prop({ type: Number }) wheelStep: number;
  @prop direction = '';

  //滚动尺寸，默认自动获取
  @prop sWidth = 0
  @prop sHeight = 0

  dragging = false;

  @query('.ce-scroller-content-wrapper')
  contentWrapper: HTMLElement
  @query('.is-vertical .ce-scroller-thumb')
  thumbV: HTMLElement
  @query('.is-horizontal .ce-scroller-thumb')
  thumbH: HTMLElement

  thumbVHeight = 0
  thumbHWidth = 0

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  @watch("color", { immediate: true })
  watchColor(nv: any, ov: any, sourceName: string) {
    ColorHelper.setColor(nv, this.style)
  }
  @watch("size", { immediate: true })
  watchSize(nv: number, ov: any, sourceName: string) {
    this.style.setProperty('--size', nv + 'px')
  }
  @watch(["sWidth", 'sHeight'], { immediate: false })
  watchWH(nv: number, ov: any, sourceName: string) {
    if (!this.isMounted) return
    (this as any).calcBounding_$__ ? (this as any).calcBounding_$__() : this.calcBounding?.()
  }
  /////////////////////////////////// computed
  @computed
  get hasH() {
    return isBlank(this.direction) || this.direction == 'h'
  }
  @computed
  get hasV() {
    return isBlank(this.direction) || this.direction == 'v'
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }
  slotChange(slot: HTMLSlotElement, name: string): void {
    setTimeout(() => {
      (this as any).calcBounding_$__ ? (this as any).calcBounding_$__() : this.calcBounding?.()
    }, 200);
  }
  mounted(): void {

  }

  render(): Template {
    return h`
    <div class="ce-scroller" ${classes({
      "is-auto-hide": this.autoHide,
      "is-rounded": this.rounded,
      "is-track-hide": !this.showTrack
    })} @resize="${this.onResize}" @wheel="${this.onWheel}">
      <div class="ce-scroller-content-wrapper">
        <slot></slot>
      </div>
      <div ${show(this.direction === '' || this.direction === 'v')} class="ce-scroller-scroll-bar is-vertical" @mousedown.stop="${this.moveThumbV}">
        <div class="ce-scroller-thumb" tabindex="-1" @pointerdown.stop.prevent="${this.startDragV}"></div>
      </div>
      <div ${show(this.direction === '' || this.direction === 'h')} class="ce-scroller-scroll-bar is-horizontal" @mousedown.stop="${this.moveThumbH}">
        <div class="ce-scroller-thumb" tabindex="-1" @pointerdown.stop.prevent="${this.startDragH}"></div>
      </div>
    </div>
    `;
  }

  /**
   * 注意用 `destroyed()` 而非 `beforeDestroyed()`。
   *
   * 编译器要把 `@debounced` 的清理注入成一个**新的** `beforeDestroyed()` 方法
   *（`methodDecoDestroy` → `beforeDestroyed() { this.xxx?.cancel?.(); … super.beforeDestroyed?.() }`）；
   * 若本类自己也声明了 `beforeDestroyed`，会变成重复方法定义（后者覆盖前者 → 用户逻辑静默丢失），
   * 因此编译器对这种情况直接报 E-METHOD-DECO-HOOK 并**整体放弃**装饰器注入 —— 那样
   * `@debounced` 会彻底失效，比报错更难查。改用 `destroyed()`（销毁链的下一环）即可两者共存。
   */
  destroyed(): void {
    this.#drag?.end(false)
    this.#drag = null
    this.dragging = false
    this.draggingThumb = this.draggingRect = null as any
  }

  get scrollTop() {
    return this.contentWrapper.scrollTop
  }
  get scrollLeft() {
    return this.contentWrapper.scrollLeft
  }

  //////////////////////////////////// methods
  ratioH: number = 1
  ratioW: number = 1
  @debounced(100)
  calcBounding() {
    if (!isVisible(this)) return
    if (!this.renderRoot) return
    // 容器高度为 0（隐藏中、弹窗/抽屉展开动画首帧）时不能算：此时 ratioH 为 0，
    // 反算出的 y 与滑块尺寸会把内部状态写坏，等容器恢复高度后滑块就与内容错位。
    if (!this.renderRoot.offsetHeight) return
    let sh = (this.sHeight || this.contentWrapper.scrollHeight) - (this.hasV ? this.size : 0)
    let sw = (this.sWidth || this.contentWrapper.scrollWidth) - (this.hasH ? this.size : 0)
    let h = this.renderRoot.offsetHeight - (this.hasV ? this.size : 0)
    let w = this.renderRoot.offsetWidth - (this.hasH ? this.size : 0)

    let ratioH = this.ratioH = h / sh
    let ratioW = this.ratioW = w / sw

    let vh = h * ratioH
    let vw = w * ratioW
    if (vh < this.size) {
      let nvh = this.size
      this.ratioH = (h - nvh + vh) / sh
      vh = nvh
    } else if (vh > h) {
      this.ratioH = 1
      vh = h
    }

    if (vw < this.size) {
      let nvw = this.size
      this.ratioW = (w - nvw + vw) / sw
      vw = nvw
    } else if (vw > w) {
      this.ratioW = 1
      vw = w
    }

    if (sh <= this.renderRoot.offsetHeight) {
      vh = 0
    }
    if (sw <= this.renderRoot.offsetWidth) {
      vw = 0
    }
    if (this.thumbVHeight !== vh) {
      this.thumbVHeight = vh
      this.thumbV.style.height = vh + 'px'
    }
    if (this.thumbHWidth !== vw) {
      this.thumbHWidth = vw
      this.thumbH.style.width = vw + 'px'
    }

    if (this.dragging) return

    // 内容骤减（数据清空/重建、宿主弹窗重开）时浏览器会把原生 scrollTop 夹紧，
    // 而 this.y 仍是旧值。两份状态一旦分叉：滑块停在旧位置、内容却在顶部，且
    // onWheel 的两个早退判断分别读 scrollTop 与 y ⇒ 两个方向都滚不动。
    // 以原生 scrollTop 为准收敛，并清掉 moveThumb 的去重闩，让这次落位真正生效。
    const nativeTop = this.contentWrapper.scrollTop
    if (Math.abs(nativeTop - this.y) > 1) {
      this.y = nativeTop
      this.__lastMoveV = -1
      this._lastXY = -1
    }

    const maxX = sw - w
    const maxY = sh - h
    const targetY = (this.y > maxY ? maxY : this.y) || 0
    const targetX = (this.x > maxX ? maxX : this.x) || 0
    // 去重闩只在「上次落位就是这里」时才成立。DOM 上的滑块位移一旦与目标不符
    // （y 被归一化、尺寸突变、内容夹紧），必须清闩，否则这次落位会被当成重复丢掉，
    // 滑块就永久停在旧位置（"滑块到底、内容在顶"那种错位）。
    if (Math.abs(this.__thumbOffsetV() - targetY * this.ratioH) > 0.5
      || Math.abs(this.__thumbOffsetH() - targetX * this.ratioW) > 0.5) {
      this.__lastMoveV = -1
      this.__lastMoveH = -1
      this._lastXY = -1
    }
    this.draggingThumb = this.thumbV
    this.moveThumb(targetY * this.ratioH)
    this.draggingThumb = this.thumbH
    this.moveThumb(targetX * this.ratioW)

    if (this.__lastMaxX !== maxX || this.__lastMaxY !== maxY) {
      this.__lastMaxX = maxX
      this.__lastMaxY = maxY
      this.emit('scrollchange', {
        maxX, maxY
      })
    }
  }
  /** 滑块当前位移（读内联 transform，缺省 0）：判断去重闩是否已经过期 */
  __thumbOffsetV() {
    const m = /translateY\(([-\d.]+)px\)/.exec(this.thumbV?.style.transform || '')
    return m ? Number(m[1]) : 0
  }
  __thumbOffsetH() {
    const m = /translateX\(([-\d.]+)px\)/.exec(this.thumbH?.style.transform || '')
    return m ? Number(m[1]) : 0
  }
  /** 上次 emit 的滚动上限：落位每次都会跑，尺寸没变时不必重复通知宿主 */
  __lastMaxX = -1
  __lastMaxY = -1
  draggingThumb: HTMLElement
  draggingRect: DOMRect
  draggingOffset: number
  totalLen: number
  draggingTrans: number = 0

  #drag: DragSessionHandle | null = null

  /** 用指针捕获建立拖动会话；`e` 不是指针事件（轨道点击、`onWheel` 等）时不建立 */
  #startDrag(e: MouseEvent) {
    if (typeof (e as PointerEvent).pointerId !== 'number') return
    this.#drag?.end(false)
    this.#drag = beginDrag(this.draggingThumb, e as PointerEvent, {
      interval: 20,
      onMove: (ev) => this.onDrag(ev),
      onEnd: () => this.onDragEnd()
    })
  }

  startDragV(e: MouseEvent) {
    this.dragging = true;
    this.renderRoot?.classList.add('dragging')
    this.thumbV.focus()
    this.draggingThumb = this.thumbV
    this.draggingRect = this.draggingThumb.getBoundingClientRect()
    this.draggingOffset = e.clientY - this.draggingRect.y
    this.totalLen = this.thumbV.parentElement?.offsetHeight! - this.draggingRect.height - (this.hasV ? this.size : 0)

    let rect = getMatrixInfo(this.thumbV)
    this.draggingTrans = rect.y

    this.#startDrag(e)
  }
  startDragH(e: MouseEvent) {
    this.dragging = true;
    this.renderRoot?.classList.add('dragging')
    this.thumbH.focus()
    this.draggingThumb = this.thumbH
    this.draggingRect = this.draggingThumb.getBoundingClientRect()
    this.draggingOffset = e.clientX - this.draggingRect.x
    this.totalLen = this.thumbH.parentElement?.offsetWidth! - this.draggingRect.width - (this.hasH ? this.size : 0)

    let rect = getMatrixInfo(this.thumbH)
    this.draggingTrans = rect.x

    this.#startDrag(e)
  }

  @debounced(200)
  onScrollEnd(edge: Edge | '', scrollTo: number, direction: 'v' | 'h') {
    this.emit('scrollend', {
      to: scrollTo,
      edge,
      direction
    })
  }

  _lastXY = -1
  __lastMoveV = 0
  __lastMoveH = 0
  moveThumb(leftOrTop: number, e?: Event) {
    if (leftOrTop < 0.1) leftOrTop = 0
    if (leftOrTop > this.totalLen) {
      leftOrTop = this.totalLen
    }

    const isV = this.draggingThumb === this.thumbV

    if (isV ? this.__lastMoveV === leftOrTop : this.__lastMoveH === leftOrTop) {
      return
    }

    if (isV) {
      this.__lastMoveV = leftOrTop
    } else {
      this.__lastMoveH = leftOrTop
    }

    // 位移与上次落地值相同 ⇒ 不重复写 DOM。**必须在改 y/x 之前判**：旧实现把它放在
    // 写 y 之后，一旦命中就出现「y 已更新、scrollTop 与滑块仍是旧值」的半写状态，
    // 随后 onWheel 按 y 判断、按 scrollTop 判断各得一半结论，双向都滚不动。
    if (this._lastXY === leftOrTop) {
      return
    }

    let edge: Edge | '' = ''
    if (isV) {
      if (Math.abs(leftOrTop - this.totalLen) < 1) {
        edge = Edge.Bottom
      } else if (leftOrTop === 0) {
        edge = Edge.Top
      }
    } else {
      if (Math.abs(leftOrTop - this.totalLen) < 1) {
        edge = Edge.Right
      } else if (leftOrTop === 0) {
        edge = Edge.Left
      }
    }

    const scrollTo = leftOrTop / (isV ? this.ratioH : this.ratioW)

    let doScroll = true
    if (isV) {
      this.y = scrollTo
    } else {
      this.x = scrollTo
    }
    if (isV) {
      if (this.thumbVHeight < 1) {
        if (this.contentWrapper.scrollTop > 0)
          this.contentWrapper.scrollTop = 0
        this.emit('scroll', {
          to: 0,
          edge: Edge.Top,
          direction: 'v', preventDefault() {
            doScroll = false
          },
          el: e?.target
        }, e)
        return
      }
    } else {
      if (this.thumbHWidth < 1) {
        this.emit('scroll', {
          to: 0,
          edge: Edge.Left,
          direction: 'h', preventDefault() {
            doScroll = false
          },
          el: e?.target
        }, e)
        return
      }
    }

    if (isV) {
      // 先落原生滚动位置、再派发 scroll：监听者（如 `ce-table`）会同步改大批
      // `transform`，之后写 `scrollTop` 要在这些脏节点上强制一次 style + layout。
      // 被 `preventDefault` 拦下时回滚一次 —— 该分支只在表格选区格上出现。
      const prevTop = this.contentWrapper.scrollTop
      this.contentWrapper.scrollTop = scrollTo
      this.emit('scroll', {
        to: scrollTo,
        edge,
        direction: 'v', preventDefault() {
          doScroll = false
        },
        el: e?.target
      }, e)
      if (!doScroll) this.contentWrapper.scrollTop = prevTop
    } else {
      const prevLeft = this.contentWrapper.scrollLeft
      this.contentWrapper.scrollLeft = scrollTo
      this.emit('scroll', {
        to: scrollTo,
        edge,
        direction: 'h', preventDefault() {
          doScroll = false
        },
        el: e?.target
      }, e)
      if (!doScroll) this.contentWrapper.scrollLeft = prevLeft
    }

    if (doScroll)
      this.draggingThumb.style.transform = isV ? `translateY(${leftOrTop}px)` : `translateX(${leftOrTop}px)`

    this.onScrollEnd(edge, scrollTo, isV ? 'v' : 'h')

    this._lastXY = leftOrTop
  }
  onDrag(e: MouseEvent) {
    let leftOrTop = 0

    if (this.draggingThumb === this.thumbV) {
      leftOrTop = e.clientY - this.draggingRect.y - this.draggingOffset + this.draggingTrans //- (this.hasV ? this.size : 0)
    } else {
      leftOrTop = e.clientX - this.draggingRect.x - this.draggingOffset + this.draggingTrans// - (this.hasH ? this.size : 0)
    }
    this.moveThumb(leftOrTop, e)
  }
  onDragEnd() {
    // 会话内部已补过节流窗口内最后一次位移
    this.#drag?.end()
    this.#drag = null
    this.dragging = false;
    this.renderRoot?.classList.remove('dragging')
    this.thumbH?.blur()
    this.thumbV?.blur()
  }
  moveThumbV(e: MouseEvent) {
    this.startDragV(e)
    this.draggingOffset = this.draggingRect.height / 2
    this.onDrag(e)
    this.onDragEnd()
  }
  moveThumbH(e: MouseEvent) {
    this.startDragH(e)
    this.draggingOffset = this.draggingRect.width / 2
    this.onDrag(e)
    this.onDragEnd()
  }
  onResize(e: Event) {
    (this as any).calcBounding_$__ ? (this as any).calcBounding_$__() : this.calcBounding?.()
  }
  onWheel(e: WheelEvent) {
    if (this.thumbVHeight < 1) return
    let deltaY = e.deltaY
    if (this.contentWrapper.scrollTop < 1 && deltaY < 0) return
    if (Math.ceil(this.contentWrapper.scrollTop) >= this.contentWrapper.scrollHeight - (this.renderRoot?.offsetHeight ?? 0) && deltaY > 0) return

    this.startDragV({ clientY: 0 } as any)
    this.thumbV.blur()
    this.dragging = false;
    this.renderRoot?.classList.remove('dragging')
    this.draggingOffset = 0
    let distance = 0

    if (this.wheelStep) {
      if (deltaY > 0) {
        distance = this.wheelStep
      } else {
        distance = -this.wheelStep
      }
    } else {
      distance = deltaY
    }

    e.preventDefault()

    this.moveThumb((this.y + distance) * this.ratioH, e)
  }
  reposition() {
    if (this.contentWrapper.scrollTop !== this.y) {
      this.contentWrapper.scrollTop = this.y
    }
  }

  //////////////////////////////////// APIs
  x: number = 0
  y: number = 0
  scrollXBy(x: number) {
    let tw = this.thumbHWidth
    if (tw === 0) return;

    this.startDragH({ clientY: 0 } as any)
    this.thumbH.blur()
    this.dragging = false;
    this.renderRoot?.classList.remove('dragging')
    this.draggingOffset = 0
    this.moveThumb((this.x + x) * this.ratioW)
  }
  scrollYBy(y: number) {
    let th = this.thumbVHeight
    if (th === 0) return;

    this.startDragV({ clientY: 0 } as any)
    this.thumbV.blur()
    this.dragging = false;
    this.renderRoot?.classList.remove('dragging')
    this.draggingOffset = 0
    this.moveThumb((this.y + y) * this.ratioH)
  }
  scrollYTo(to?: number): void {
    let th = this.thumbVHeight
    if (th === 0) return;

    this.draggingThumb = this.thumbV
    this.moveThumb((to || 0) * this.ratioH)
  }
  scrollXTo(to?: number): void {
    let tw = this.thumbHWidth
    if (tw === 0) return;

    this.draggingThumb = this.thumbH
    this.moveThumb((to || 0) * this.ratioW)
  }
  onTop() {
    return this.y === 0
  }
  onBottom() {
    return this.__lastMoveV >= this.totalLen
  }
  isOverflow(type: string) {
    // 路由切换时销毁的组件仍可能被上一帧的定时器/观察者回调问到；
    // 此时 renderRoot 已被置空，按「不溢出」回答而不是抛异常
    if (!this.renderRoot || !this.contentWrapper) return false
    if (type === 'v') {
      let sh = (this.sHeight || this.contentWrapper.scrollHeight) - (this.hasV ? this.size : 0)
      return sh > this.renderRoot.offsetHeight
    } else {
      let sw = (this.sWidth || this.contentWrapper.scrollWidth) - (this.hasH ? this.size : 0);
      return sw > this.renderRoot.offsetWidth
    }
  }
}
