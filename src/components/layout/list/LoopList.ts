import { classes, csscope, Csscope, emits, forEach, h, ifTrue, prop, query, state, styles, tag, Template, transitionMsOf, watch, whenTransitionEnds } from "compelem";
import { identity, isArray, isBlank, isNil, isNumeric, range, size, some, toArray } from "myfx";
import { AppearanceElem, AppearanceType } from "../../../base/Appearance";
import { beginDrag, type DragSessionHandle } from "../../../utils/dragSession";
import { TransYReg, VirtualLoop } from "../../../mixins/VirtualLoop";
import { ListItem } from "./ListItem";
import style from "./style-loop.scss?tmpl";
import { FADE_CSS } from "../../../css/transition";

// 摇杆微动：每次滚轮 tick 滚动条的位移步长(px)。要求不能大——仅作方向反馈
const NUDGE_STEP = 4;
// 摇杆微动绝对上限(px)。按轨道半行程动态收紧后，快速连滚也永远到不了轨道端点
const NUDGE_MAX = 24;
// 停止滚轮后，滚动条回弹居中的延迟(ms)
const NUDGE_RESET_DELAY = 350;
// 拖拽滚动：拖拽距离与滚动步进速率的换算基数（每 DRAG_PX_PER_STEP px 对应每秒 1 步）
const DRAG_PX_PER_STEP = 8;
// 拖拽滚动：每秒最大步进数
const MAX_STEPS_PER_SEC = 20;

/** 摇杆式滚动条：垂直居中，拖动控制滚动方向，松开回弹 */
/**
 * 循环列表容器
 * @attrs
 *  select {array|string|number} model属性，受控。如果值为数组则开启多选，否则单选(首次赋值时判定)
 *  appearance {string} 外观。default/underline
 *  rowHeight {number} 行高，默认32
 *  gap {string} 列表项间隔，默认0
 *  showScrollbar {boolean} 是否显示摇杆式滚动条，默认true
 *  scrollbarSize {number} 滚动条宽度(px)，默认6
 * @methods
 *  scrollToSelected(force?) 滚动到选中项
 * @slots
 *  - 列表项或分割线
 * @events
 *  select({selection,item,isSelected}) 列表项选择时触发
 *
 * @author holyhigh2
 */
@emits('select', 'update:select')
@tag("ce-loop-list")
export class LoopList extends VirtualLoop(AppearanceElem) {
  //////////////////////////////////// props
  @prop divider = true;
  @prop card = false;
  @prop gap = 0
  @prop selectable = false
  @prop nav = false
  @prop({ type: [Array, String, Number], model: true }) select: any[] | string | number
  @prop indent = '14px'
  @prop scrollSmooth = false
  @prop({ type: [String, Function] }) scrollSync: string | Function
  @prop appearance = AppearanceType.Pale
  @prop data: Record<string, any>[] = []
  @prop rowHeight = 32
  @prop showScrollbar = true
  @prop scrollbarSize = 6

  selection: Set<string> = new Set()
  selectedValues: any[] = []
  isSingleMode = false

  @query("slot")
  slotEl: HTMLSlotElement

  @query(".ce-scrollbar-thumb")
  thumbEl: HTMLElement

  //虚拟化
  @state vCachedRows = 0;

  // 摇杆滚动条状态
  private _dragging = false
  private _startY = 0
  private _thumbHeight = 40
  // 拖拽滚动（RAF 驱动）
  private _rafId = 0
  private _dragDelta = 0
  private _scrollAcc = 0
  private _lastFrameTime = 0
  // 滚轮微动（wheel → 滚动条反馈）
  private _nudgeOffset = 0
  private _nudgeResetTimer: any = 0
  #drag: DragSessionHandle | null = null

  //scrollSync
  anchorObserver: IntersectionObserver
  anchorMap = new WeakMap<HTMLElement, ListItem>
  anchorMapInvert = new WeakMap<ListItem, HTMLElement>
  syncTarget: HTMLElement
  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style, FADE_CSS];
  }
  get cssVars() {
    return {
    }
  }
  /////////////////////////////////// watches
  @watch('select', { immediate: true })
  watchSelect(nv: any) {
    if (isNil(nv)) return

    this.isSingleMode = !isArray(nv)

    if (this.isSingleMode || (size(nv) < 1 && this.selection.size > 0)) {
      this.selection.clear()
    }

    if (this.vList)
      (this.vList as ListItem[]).forEach((li: ListItem) => {
        if (li.value === nv || this.selection.has(li.value)) {
          li.toggleAttribute('active', true)
          this.selection.add(li.value)
        } else {
          li.toggleAttribute('active', false)
        }
      })

  }
  @watch('data', { immediate: false })
  watchData(nv: boolean) {
    this.updateV(this.renderRoot!.offsetHeight, size(nv))
    // 数据迟到/变化但可视行数未变时，updateV 不会触发重渲染，
    // 需主动刷新已有行的文本，否则会残留上一次的 undefined/旧值
    this.#fillText()
  }
  @watch('appearance', { immediate: false })
  watchAppearance(nv: boolean) {
    let items = this.slotEl.assignedElements({ flatten: true })
    items.forEach(it => {
      if (it instanceof ListItem)
        it.appearance = this.appearance
    })
  }
  //////////////////////////////////// lifecycles
  mounted(): void {
    this.updateV(this.renderRoot!.offsetHeight, size(this.data))
  }
  destroyed(): void {
    this.#drag?.end(false)
    this.#drag = null
  }
  render(): Template {
    return h`<div class="ce-list-loop" 
    ${classes({
      [`ce-list-size-` + this.size]: true,
      'has-scrollbar': this.showScrollbar
    })} 
    @wheel.prevent.throttle:150="${this.onWheel}" @resize.debounce:100="${this.onResize}">
      <div class="ce-list-container" @mutate.child.debounce:100="${this.onListReady}" @click="${this.onItemClick}">
        ${forEach(range(this.vCachedRows), identity, (v, i) => h`
          <ce-list-item .space="${this.space}" center value="${v}" ${styles([{ height: this.rowHeight + 'px', transform: `translateY(${i * (this.rowHeight + this.gap)}px)` }, 'font-size:var(--ce-font-sm);padding-inline:var(--ce-spacing-md);'])} data-row-index="${i}" hoverable appearance="pale" ripple="false">
          </ce-list-item>
        `)}
      </div>
      ${ifTrue(this.showScrollbar, () => h`
        <div class="ce-scrollbar">
          <div class="ce-scrollbar-thumb"
               ${styles([{ height: this._thumbHeight + 'px', width: this.scrollbarSize + 'px' }])}
               @pointerdown="${this.onThumbDown}">
          </div>
        </div>
      `, { enter: "fade", leave: "fade" })}
    </div> `;
  }

  //////////////////////////////////// methods
  #lastInitedSize = 0
  #lastDataLen = -1
  #lastSelect: any = null
  /**
   * 用当前 data 回填可视行的文本与 value。空数据（length<1）时跳过，
   * 避免写成 data[i % 0] = data[NaN] = undefined。
   * 注意：row 的 value 必须使用「实际数据值」而非行索引——虚拟化首屏时 render() 只把行索引写进 value，
   * 若此处不补写数据值，点选某行会拿到行索引（如点 "09" 得到 "9"）。
   * 这与 onWheel / scrollToSelected 的取值口径（this.data[idx] + ''）保持一致。
   */
  #fillText() {
    if (!this.vList || this.vList.length < 1) return
    if (!this.data || this.data.length < 1) return
    (this.vList as ListItem[]).forEach((li: ListItem, i) => {
      const val = this.data[i % this.data.length] + ''
      li.textContent = val
      // 必须用 updateProps 存值：ListItem.value 是非 model @prop，直接 li.value= 会被框架 setter 丢弃（不存储）
      li.updateProps({ value: val })
    })
  }
  onListReady() {
    // 销毁后 isMounted 为 false、renderRoot 已置空；离场动画的 freeze 窗口里 isMounted
    // 仍为 true，靠 isDestroyed 挡掉 mutate.child 防抖在这一段落进来的回调
    if (!this.isMounted || this.isDestroyed || !this.renderRoot) return;

    this.vList = Array.from(this.renderRoot!.querySelectorAll('.ce-list-container ce-list-item'))
    if (size(this.vList) < 1) return

    let dataChanged = false
    if (this.#lastInitedSize !== this.vList.length || this.#lastDataLen !== this.data.length) {
      this.#fillText()
      this.#lastInitedSize = this.vList.length
      this.#lastDataLen = this.data.length
      dataChanged = true
    }

    let selectChanged = this.select !== this.#lastSelect
    this.#lastSelect = this.select

    if (selectChanged || dataChanged || (this.scrollingSize > 0 && this.scrollingSize != this.vList.length)) {
      this.scrollToSelected(selectChanged || dataChanged)
    }

  }
  /**
   * scrollV 的行内容同步回调：滚动后按 rowIndex 从 data 取值回填行文本/value，
   * 并刷新选中高亮。onWheel 与拖拽滚动共用，保证取值口径一致。
   */
  #syncRow = (rowEl: any, rowIndex: number) => {
    if (!this.data || !this.data.length) return
    const v = this.data[rowIndex % this.data.length] + ''
    rowEl.textContent = v
    rowEl.updateProps({ value: v })
    if (this.select === rowEl.value) {
      rowEl.toggleAttribute('active', true)
    } else {
      rowEl.toggleAttribute('active', false)
    }
  }
  onWheel(event: WheelEvent) {
    const delta = Math.sign(event.deltaY);
    this.scrollV(delta, this.#syncRow)
    // 滚动条方向微动反馈
    this.#nudgeThumb(delta)
  }
  /**
   * 滚轮驱动的滚动条微动：每次滚轮 tick 沿滚动方向移动 NUDGE_STEP px 后，
   * 在滚轮停止 NUDGE_RESET_DELAY 后回弹居中。偏移量被钳制在
   * min(NUDGE_MAX, 轨道半行程) 内——无论滚动多快、持续多久，
   * thumb 都到不了轨道端点（循环列表没有"底"）。
   */
  #nudgeThumb(dir: number) {
    if (!this.showScrollbar) return
    const thumb = this.thumbEl
    if (!thumb || this._dragging) return
    const track = thumb.parentElement
    const halfTravel = track
      ? Math.max(0, (track.getBoundingClientRect().height - this._thumbHeight) / 2)
      : NUDGE_MAX
    const max = Math.min(NUDGE_MAX, halfTravel)
    this._nudgeOffset = Math.max(-max, Math.min(max, this._nudgeOffset + dir * NUDGE_STEP))
    // 立即跟随（无过渡保证手感），回弹时再启用过渡
    thumb.style.top = '50%'
    thumb.style.transition = 'none'
    thumb.style.transform = `translateY(calc(-50% + ${this._nudgeOffset}px))`
    clearTimeout(this._nudgeResetTimer)
    this._nudgeResetTimer = setTimeout(() => {
      this._nudgeOffset = 0
      const t = this.thumbEl
      if (!t || this._dragging) return
      t.style.transition = 'transform 0.3s ease-out'
      t.style.transform = 'translateY(-50%)'
      // 收尾按实际过渡时长，不再与上面那行 0.3s 重复维护一个 300ms
      whenTransitionEnds(t, transitionMsOf(t), () => { t.style.transition = '' }, 'transform')
    }, NUDGE_RESET_DELAY)
  }
  scrollingSize = 0
  //如果当前视图中没有选中项，则滚动到选中项
  scrollToSelected(force?: boolean) {
    if (!this.data || !this.data.length) return
    if (isBlank(this.select) || !isNumeric(this.select)) return
    // vList 仅在 onListReady（DOM 就绪 + @mutate.child.debounce:100）后才被赋值。
    // openTimePanel 在 nextTick 里同步调用本方法时，overlay portal 可能尚未完成布局，
    // vList 仍为 undefined → 访问 .length/.sort 抛 "Cannot read properties of undefined"。
    // 此时直接返回：onListReady 在列表就绪后会再次调用本方法完成滚动定位，行为一致。
    if (!this.vList || this.vList.length < 1) return
    let inView = some(this.vList, (li: ListItem) => {
      let sameVal = li.value === this.select
      if (!sameVal) return false
      let top = parseFloat(li.style.transform.replace(TransYReg, '$1'))
      if (top >= 0 && top <= this.offsetHeight - this.rowHeight) {
        return true
      }
      return false
    })
    if (force) inView = false
    let rowIndex = this.data.findIndex(v => v === this.select)
    let startRowIndex = rowIndex - parseInt(this.vList.length / 3 + '')
    if (startRowIndex < 0) startRowIndex = this.data.length + startRowIndex
    if (!inView) {
      //刷新数据，不更新位置
      let rowEls = this.vList.sort((a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
      rowEls.forEach((li: HTMLElement) => {
        let val = this.data[startRowIndex % this.data.length] + ''
        // li.value = val
        li.setAttribute('value', val)
        li.dataset.rowIndex = val
        li.textContent = val
        if (val === this.select) {
          li.toggleAttribute('active', true)
        } else {
          li.toggleAttribute('active', false)
        }
        startRowIndex++
      })
      this.scrollingSize = this.vList.length
    }
  }
  onResize() {
    setTimeout(() => {
      if (!this.isMounted || this.isDestroyed || !this.renderRoot) return
      if (this.offsetHeight > 0) {
        this.updateV(this.renderRoot!.offsetHeight, size(this.data));
        this.updateThumbHeight();
      }
    }, 50);
  }

  // 更新滑块高度
  private updateThumbHeight() {
    if (!this.showScrollbar) return
    const viewRows = Math.ceil(this.vViewHeight / (this.rowHeight + (this.gap as number)))
    const totalRows = this.data?.length || 1
    const ratio = Math.min(viewRows / totalRows, 1)
    this._thumbHeight = Math.max(30, ratio * this.vViewHeight * 0.6)
  }

  /**
   * 摇杆滚动条拖拽：
   * - mousemove 只负责更新 thumb 视觉位置并记录拖拽位移（_dragDelta）
   * - 按住期间由 requestAnimationFrame 循环（定时器）持续驱动 list 滚动：
   *   每帧根据拖拽位移换算步进速率（与 |位移| 成正比，封顶 MAX_STEPS_PER_SEC），
   *   时间累积达到 1 步即调用 scrollV。scrollV 内部有 scrolling 重入保护，
   *   被阻塞时不消耗累积量，松开后也不会突发补偿（累积上限 2 步）。
   * - mouseup 取消 RAF 并回弹居中。
   * 选 RAF 而非 setInterval：与显示刷新同步、scrollV 重入窗口不错拍、
   * 标签页隐藏自动暂停、cancelAnimationFrame 即时停止无残留。
   */
  onThumbDown(e: PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    this._dragging = true
    this._startY = e.clientY
    this._dragDelta = 0
    this._scrollAcc = 0
    this._lastFrameTime = 0
    // 打断进行中的滚轮微动回弹，避免与拖拽定位互相覆盖
    clearTimeout(this._nudgeResetTimer)
    this._nudgeOffset = 0

    const thumb = this.thumbEl
    const container = thumb?.parentElement
    if (thumb) {
      thumb.classList.add('dragging')
    }

    // 计算容器边界
    const containerRect = container?.getBoundingClientRect()
    const minTop = 0
    const maxTop = containerRect ? containerRect.height - this._thumbHeight : 0

    const onMove = (ev: MouseEvent) => {
      if (!this._dragging) return
      this._dragDelta = ev.clientY - this._startY

      // thumb 视觉位置跟随（限制在容器范围内）
      if (thumb && containerRect) {
        const thumbCenter = containerRect.height / 2
        const newTop = Math.max(minTop, Math.min(maxTop, thumbCenter - this._thumbHeight / 2 + this._dragDelta))
        thumb.style.top = `${newTop}px`
        thumb.style.transform = 'none'
      }
    }

    // RAF 定时循环：按住期间持续滚动
    const rafLoop = (now: number) => {
      if (!this._dragging || !this.isConnected) {
        this._dragging = false
        return
      }
      if (this._lastFrameTime === 0) this._lastFrameTime = now
      // 上限 100ms：后台标签页恢复时避免一次性爆发大量步进
      const elapsed = Math.min(now - this._lastFrameTime, 100)
      this._lastFrameTime = now

      const dir = Math.sign(this._dragDelta)
      if (dir !== 0) {
        const stepsPerSec = Math.min(Math.abs(this._dragDelta) / DRAG_PX_PER_STEP, MAX_STEPS_PER_SEC)
        this._scrollAcc = Math.min(this._scrollAcc + elapsed * stepsPerSec / 1000, 2)
        while (this._scrollAcc >= 1 && !this.scrolling) {
          this._scrollAcc -= 1
          this.scrollV(dir, this.#syncRow)
        }
      }
      this._rafId = requestAnimationFrame(rafLoop)
    }
    this._rafId = requestAnimationFrame(rafLoop)

    const onUp = () => {
      this._dragging = false
      cancelAnimationFrame(this._rafId)

      if (thumb) {
        thumb.classList.remove('dragging')
        // 回弹到居中位置
        thumb.style.transition = 'top 0.3s ease-out, transform 0.3s ease-out'
        thumb.style.top = '50%'
        thumb.style.transform = 'translateY(-50%)'
        setTimeout(() => {
          thumb.style.transition = ''
        }, 300)
      }
    }

    this.#drag?.end(false)
    this.#drag = beginDrag(thumb ?? this, e, {
      onMove,
      onEnd: () => {
        this.#drag = null
        onUp()
      }
    })
  }

  onItemClick(ev: PointerEvent) {
    let t = ev.target
    if (t instanceof ListItem) {
      if (t.disabled) return
      this.onClick(t)
    }
  }
  onClick(item: ListItem) {
    // 去激活旧选中项：必须在 shadow DOM（this.vList）中按 value 查找，
    // this.querySelector 查的是 light DOM，ce-list-item 实际在 shadow 内，恒返回 null，
    // 会导致旧高亮残留（任何「select 值不变 → watchSelect 不重算」场景都会漏清）。
    this.selection.forEach((v) => {
      let el = (this.vList as ListItem[] | undefined)?.find((li: ListItem) => li.value === v)
      el?.toggleAttribute('active', false)
    })
    this.selection.clear()

    this.selection.add(item.value)
    item.toggleAttribute('active', true)
    this.select = item.value
    this.emit('select', { selection: toArray(this.selection), item })
  }
  resetActive() {
    (this.vList as ListItem[]).forEach((li: ListItem) => {
      if (this.selection.has(li.value)) {
        li.toggleAttribute('active', true)
      } else {
        li.toggleAttribute('active', false)
      }
    })
  }
}
