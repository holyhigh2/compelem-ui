import { classes, CompElem, computed, csscope, Csscope, debounced, emits, h, prop, query, show, tag, Template, watch } from "compelem";
import { isBlank, throttle } from "myfx";
import { getMatrixInfo } from "uiik";
import { IColorable } from "../../../interfaces/IColorable";
import { ColorHelper } from "../../../utils/color";
import { isVisible } from "../../../utils/utils";
import style from "./style.scss?tmpl";

export enum Edge {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right'
}
/**
 * 滚动条组件
 * 支持自动检测与指定范围
 * @props
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
        <div class="ce-scroller-thumb" tabindex="-1" @mousedown.stop.prevent="${this.startDragV}"></div>
      </div>
      <div ${show(this.direction === '' || this.direction === 'h')} class="ce-scroller-scroll-bar is-horizontal" @mousedown.stop="${this.moveThumbH}">
        <div class="ce-scroller-thumb" tabindex="-1" @mousedown.stop.prevent="${this.startDragH}"></div>
      </div>
    </div>
    `;
  }

  beforeDestroyed(): void {
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
    if (this.thumbVHeight === vh && this.thumbHWidth === vw) return

    this.thumbVHeight = vh
    this.thumbHWidth = vw
    this.thumbV.style.height = vh + 'px'
    this.thumbH.style.width = vw + 'px'

    if (this.dragging) return

    this.draggingThumb = this.thumbV
    const maxX = sw - w
    const maxY = sh - h
    this.moveThumb(((this.y > maxY ? maxY : this.y) || 0) * this.ratioH)
    this.draggingThumb = this.thumbH
    this.moveThumb(((this.x > maxX ? maxX : this.x) || 0) * this.ratioW)

    this.emit('scrollchange', {
      maxX, maxY
    })
  }
  draggingThumb: HTMLElement
  draggingRect: DOMRect
  draggingOffset: number
  totalLen: number
  draggingTrans: number = 0
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

    if (e instanceof MouseEvent) {
      document.onmousemove = throttle(this.onDrag.bind(this), 20)
      window.onblur = document.onmouseup = this.onDragEnd.bind(this)
    }
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

    if (e instanceof MouseEvent) {
      document.onmousemove = throttle(this.onDrag.bind(this), 20)
      window.onblur = document.onmouseup = this.onDragEnd.bind(this)
    }
  }

  @debounced(200)
  onScrollEnd(edge: string, scrollTo: number, direction: string) {
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

    let edge = ''
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

    if (this._lastXY == leftOrTop) {
      return
    }

    if (isV) {
      this.emit('scroll', {
        to: scrollTo,
        edge,
        direction: 'v', preventDefault() {
          doScroll = false
        },
        el: e?.target
      }, e)
      if (doScroll)
        this.contentWrapper.scrollTop = scrollTo
    } else {
      this.emit('scroll', {
        to: scrollTo,
        edge,
        direction: 'h', preventDefault() {
          doScroll = false
        },
        el: e?.target
      }, e)

      if (doScroll)
        this.contentWrapper.scrollLeft = scrollTo
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
    console.log(leftOrTop, '...........')
    this.moveThumb(leftOrTop, e)
  }
  onDragEnd() {
    this.dragging = false;
    this.renderRoot?.classList.remove('dragging')
    this.thumbH.blur()
    this.thumbV.blur()
    document.onmousemove = null
    document.onmouseup = null
    window.onblur = null
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
    if (Math.ceil(this.contentWrapper.scrollTop) >= this.contentWrapper.scrollHeight - this.renderRoot!.offsetHeight && deltaY > 0) return

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
    if (type === 'v') {
      let sh = (this.sHeight || this.contentWrapper.scrollHeight) - (this.hasV ? this.size : 0)
      return sh > this.renderRoot!.offsetHeight
    } else {
      let sw = (this.sWidth || this.contentWrapper.scrollWidth) - (this.hasH ? this.size : 0);
      return sw > this.renderRoot!.offsetWidth
    }
  }
}
