import { classes, csscope, Csscope, emits, forEach, h, prop, query, state, styles, tag, Template, watch } from "compelem";
import { identity, isArray, isBlank, isNil, isNumeric, range, size, some, toArray } from "myfx";
import { AppearanceElem, AppearanceType } from "../../../base/Appearance";
import { TransYReg, VirtualLoop } from "../../../mixins/VirtualLoop";
import { ListItem } from "./ListItem";
import style from "./style-loop.scss?tmpl";
/**
 * 循环列表容器
 * @props
 *  select {array|string|number} model属性，受控。如果值为数组则开启多选，否则单选(首次赋值时判定)
 *  appearance {string} 外观。default/underline
 *  rowHeight {number} 行高，默认32
 *  gap {string} 列表项间隔，默认0
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

  selection: Set<string> = new Set()
  selectedValues: any[] = []
  isSingleMode = false

  @query("slot")
  slotEl: HTMLSlotElement

  //虚拟化
  @state vCachedRows = 0;

  //scrollSync
  anchorObserver: IntersectionObserver
  anchorMap = new WeakMap<HTMLElement, ListItem>
  anchorMapInvert = new WeakMap<ListItem, HTMLElement>
  syncTarget: HTMLElement
  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
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
  render(): Template {
    return h`<div class="ce-list-loop" 
    ${classes({
      [`ce-list-size-` + this.size]: true
    })} 
    @wheel.prevent.throttle:150="${this.onWheel}" @resize.debounce:100="${this.onResize}">
      <div class="ce-list-container" @mutate.child.debounce:100="${this.onListReady}" @click="${this.onItemClick}">
        ${forEach(range(this.vCachedRows), identity, (v, i) => h`
          <ce-list-item .space="${this.space}" center value="${v}" ${styles([{ height: this.rowHeight + 'px', transform: `translateY(${i * (this.rowHeight + this.gap)}px)` }, 'font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md);'])} data-row-index="${i}" hoverable appearance="pale" ripple="false">
          </ce-list-item>
        `)}
      </div>
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
    if (!this.isMounted) return;

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
  onWheel(event: WheelEvent) {
    const delta = Math.sign(event.deltaY);
    this.scrollV(delta, (rowEl: any, rowIndex) => {
      if (!this.data || !this.data.length) return
      const v = this.data[rowIndex % this.data.length] + ''
      rowEl.textContent = v
      rowEl.updateProps({ value: v })
      if (this.select === rowEl.value) {
        rowEl.toggleAttribute('active', true)
      } else {
        rowEl.toggleAttribute('active', false)
      }
    })
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
      if (this.offsetHeight > 0) {
        this.updateV(this.renderRoot!.offsetHeight, size(this.data));
      }
    }, 50);
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
