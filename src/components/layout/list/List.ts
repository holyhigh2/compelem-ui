import { classes, computed, csscope, Csscope, debounced, emits, h, ifElse, prop, query, state, styles, tag, Template, watch } from "compelem";
import { debounce, each, find, isArray, isDefined, isFunction, isNil, isString, size, some } from "myfx";
import { AppearanceElem, AppearanceType } from "../../../base/Appearance";

import { ListItem } from "./ListItem";
import style from "./style.scss?tmpl";
/**
 * 列表容器，会对内部元素应用列表项样式
 * @attrs
 *  select {array|string|number} 如果值为数组则开启多选，否则单选(首次赋值时判定)
 *  appearance {string} 外观。default/underline
 *  card {boolean} 是否卡片外观
 *  gap {string} 列表项间隔（CSS 长度值，传数字无效）。
 *        默认 var(--ce-list-gap, var(--ce-spacing-xs))（4px @16px 根字号）；
 *        --ce-list-gap 是全局开关。组内 ce-list-group 的列表项同样生效，
 *        间距经 --ce-list-item-gap 继承到 group 的默认 slot。
 *  space {string} 列表项空间尺寸，默认 AppearanceSpace.Default（继承自 AppearanceElem）。
 *        该值会透传给所有子 ce-list-item；两行列表项的**行间内距/主副标题间距**按其分档
 *        （compact 数据列表式 / default 设置面板式 / loose），见 ListItem.TWO_LINE_SPACING。
 *  size {boolean} 尺寸，sm/md/lg，默认md
 *  selectable {boolean} 是否可选择列表项并应用已选择样式，默认false
 *  multiple {boolean} 是否多选模式，默认根据select的值类型判定
 *  indent {string} 缩进，默认14px
 *  collapsed {boolean} 是否折叠，折叠后仅显示顶级列表项图标，默认false
 *  scrollSync {string|function} css选择器，同步滚动容器的滚动事件并同步激活列表项，list-item的href属性采用锚点链接方式与目标内容保持一致
 *  scrollSmooth {boolean} 是否平滑滚动，默认false
 *  maxRows {number} list-item 最大显示行数，超过会显示滚动条，默认不限制
 * @models
 *  select {string} 列表项选中值，受控。开启 selectable 时有效
 * @methods
 *  clear() 清除选中
 * @cssvars
 *  --list-collapsed-width 折叠后的列表宽度，默认 56px
 *  --list-item-height 单行项行高基准，默认 32px（space 档位在此基础上 ±8px）
 *  --ce-list-gap 全局列表项间距开关：仅在未显式设置 gap 时生效（gap 的默认值引用它）
 *  --ce-list-transition-duration / --ce-list-transition-timing-function
 *        折叠/展开几何动画的时长与缓动，默认 .3s / ease。
 *        与外壳（ce-aside）对齐时两处设同一值；设 0s 即让行几何瞬时到位，
 *        动画完全交给外壳 —— 逐行插值 grid-template-columns 会让图标被轨道推着走，
 *        看起来像位移。hover 变色不受这里影响，见 --ce-list-item-hover-transition-duration
 * @slots
 *  - 列表项或分割线
 * @events
 *  select({selection,item,isSelected}) 列表项选择时触发
 *
 * @author holyhigh2
 */
@emits('select', 'update:*')
@tag("ce-list")
export class List extends AppearanceElem {
  //////////////////////////////////// props
  @prop card = false
  @prop gap = 'var(--ce-list-gap, var(--ce-spacing-xs))'
  @prop selectable = false
  @prop nav = false
  @prop({ type: [Array, String, Number], model: true }) select: any[] | string | number
  @prop indent = '14px'
  @prop collapsed = false
  @prop scrollSmooth = false
  @prop({ type: [String, Function] }) scrollSync: string | Function
  @prop appearance = AppearanceType.Pale
  @prop maxRows = -1
  @prop({ type: Boolean }) multiple: boolean

  selection: Set<string> = new Set<string>()
  selectedValues: any[] = []

  @query("slot")
  slotEl: HTMLSlotElement

  @state rowHeight = 0

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
      // 列表项间距透给 ce-list-group 内的默认 slot；row-gap 不能跨 shadow 继承
      '--ce-list-item-gap': this.gap,
      '--list-indent-size': this.indent,
      '--list-item-font-size': this.nav ? 'var(--ce-font-nav)' : ''
    }
  }
  /////////////////////////////////// computed
  @computed
  get isSingleMode() {
    if (isDefined(this.multiple)) return !this.multiple
    return !isArray(this.select)
  }
  /////////////////////////////////// watches
  @watch('select', { immediate: true })
  watchSelect(nv: any, ov: any) {
    if (isNil(nv)) {
      return
    }
    if (size(nv) < 1 && this.selection.size > 0) {
      each(this.children, c => {
        if (c instanceof ListItem) {
          c.toggleAttribute('active', false)
        }
      })
      this.selection.clear()
    }
    this._resetSelectItem(nv);
  }
  @watch('collapsed', { immediate: false })
  watchCollapsed(nv: boolean) {
    let items = this.slotEl.assignedElements({ flatten: true })
    items.forEach(it => {
      it.toggleAttribute('collapsed', nv)
    })
  }
  @watch('appearance', { immediate: false })
  watchAppearance(nv: boolean) {
    let items = this.slotEl.assignedElements({ flatten: true })
    items.forEach(it => {
      if (it instanceof ListItem)
        it.appearance = this.appearance
    })
  }
  /**
   * space 变化时同步给已挂载的列表项。
   * 与 appearance / collapsed 的 watch 保持一致。
   */
  @watch('space', { immediate: false })
  watchSpace(nv: string) {
    let items = this.slotEl?.assignedElements({ flatten: true }) || []
    items.forEach(it => {
      if (it instanceof ListItem) it.setAttribute('space', nv)
    })
  }
  //////////////////////////////////// lifecycles
  _ss: () => void
  constructor() {
    super()
    this._ss = debounce(this._syncScroll.bind(this), 100)
  }
  mounted(): void {
    // 首帧时 `?collapsed` / `appearance` 等属性可能晚于 slotChange 才落到宿主上，
    // 于是「一开始就是折叠的列表」不会把状态下发给子项（只有之后再切换才生效）。
    this._syncItemProps()
    if (this.scrollSync) {
      this.anchorObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            const el = entry.target as HTMLElement
            const item = this.anchorMap.get(el)!
            if (entry.intersectionRatio === 0) {
              this._removeSelect(item)
            } else if (entry.intersectionRatio) {
              this._toggleSelect(item, true)
            }
          })

        }, { root: this.renderRoot, threshold: [0.01] }
      );
    }
    if (this.maxRows > 0) {
      this.afterSlotChange()
    }
  }
  render(): Template {
    return h`
      <div
        class="ce-list"
        ${classes({
      "ce-list-card": this.card,
      "is-collapsed": this.collapsed,
      [`ce-list-size-` + this.size]: true
    })}
      >
        ${ifElse(this.maxRows > 0, () => h`
          <ce-scroller direction="v" xx>
            <div
              class="ce-list-container"
              @click="${this.onItemClick}"
              ${styles({
      'row-gap': this.gap
    })}
            >
              <slot></slot>
            </div>
          </ce-scroller>
        `, () => h`
            <div
              class="ce-list-container"
              @click="${this.onItemClick}"
              ${styles({
      'row-gap': this.gap
    })}
            >
              <slot></slot>
            </div>
          `)}
      </div>
    `;
  }

  /**
   * 下发单个列表项。
   *
   * 必须由 `ListItem.mounted()` 也调用一次：组件按需加载时，`<ce-list-item>`
   * 在 `slotChange` / `mounted` 触发的那一刻**还没被升级**，`it instanceof ListItem`
   * 恒为 false ⇒ 「初始就折叠的列表」永远漏掉这些子项（只有之后再切换才生效）。
   */
  _syncItem(it: ListItem): void {
    it.setAttribute('space', this.space)
    it.setAttribute('size', this.size)
    it.setAttribute('appearance', this.appearance)
    it.toggleAttribute('collapsed', this.collapsed)
  }

  /** 把宿主上的排版/折叠状态下发给已分发的列表项 */
  _syncItemProps(): void {
    let items = this.slotEl?.assignedElements({ flatten: true }) || []
    items.forEach(it => {
      if (it instanceof ListItem) this._syncItem(it)
    })
  }

  slotChange(slot: HTMLSlotElement, name: string): void {
    this._syncItemProps()
    // 预选值回填必须走 slotChange，不能只靠 `@watch('select', {immediate:true})`。
    //
    // 原因：watch 的 immediate 回调发生在**属性初始化期**，此刻 slot 尚未分发内容，
    // `_resetSelectItem()` 开头的 `if (!this.slotEl) return` 直接返回 ⇒ 受控的 `select`
    // 值（如 `select="dt-1"`）**永远不会落到子项的 active 属性上**。
    // 现象：列表初始无任何高亮项，手点一下才亮（`_toggleSelect` 会直接写 active）。
    //
    // 下方 `afterSlotChange()` 里的 `_resetSelectItem()` 正是这条回填链路，但它此前
    // 被 `maxRows > 0` 挡在门外（虚拟滚动场景才需要）—— 于是**非虚拟列表的预选值全部失效**。
    // 这里放宽为「只要 isMounted 就跑一次回填」；`afterSlotChange` 内部其余逻辑
    // （测量首项行高、给 scroller 用）在非虚拟场景下是无害的幂等操作。
    if (this.isMounted) {
      this.afterSlotChange()
    }
    this.nextTick(this._ss)
  }
  //////////////////////////////////// methods
  @debounced(100)
  afterSlotChange() {
    let items = this.slotEl.assignedElements({ flatten: true })
    let item = find(items, it => it instanceof ListItem) as ListItem

    setTimeout(() => {
      if (item)
        this.rowHeight = item.offsetHeight
    }, 100);

    // 必须显式传 `this.select`：无参调用时 `_resetSelectItem()` 的 `selectValue` 为
    // undefined ⇒ 落到末尾的 `else { //todo }` 空分支，预选值永远不落盘（现象：列表初始
    // 无高亮，手点一下才亮）。这里是「槽分发完成后」唯一的回填时机。
    this._resetSelectItem(this.select);
  }
  onItemClick(ev: PointerEvent) {
    if (!this.selectable) return

    let t = ev.target as Element
    if (!(t instanceof ListItem)) {
      t = t.closest('ce-list-item')!
    }

    if (t instanceof ListItem) {
      if (t.disabled) return
      this._toggleSelect(t)
    }
  }
  _toggleSelect(item: ListItem, callInList?: boolean) {
    let exist = this.selection.has(item.value)
    if (exist && !item.active) {
      exist = false
    }
    if (!this.selectable) return

    if (this.isSingleMode) {
      each(this.children, c => {
        if (c instanceof ListItem) {
          c.toggleAttribute('active', false)
        }
      })

      this.selection.clear()
      this.selection.add(item.value)
      let firstItem = item
      this.select = firstItem.value

      firstItem.toggleAttribute('active', true)
    } else {
      if (exist) {
        item.toggleAttribute('active', false)
        this.selection.delete(item.value)
      } else {
        this.selection.add(item.value)
        item.toggleAttribute('active', true)
      }
      this.select = Array.from(this.selection)
      if (!callInList && this.scrollSync) {
        const element = this.anchorMapInvert.get(item)
        element?.scrollIntoView({ behavior: this.scrollSmooth ? 'smooth' : 'instant' });
      }
    }

    this.emit('select', {
      selection: Array.from(this.selection)
      , item
    })
  }
  _resetSelectItem(selectValue?: any) {
    if (!this.slotEl) return
    let items = this.slotEl.assignedElements({ flatten: true })
    if (isArray(selectValue)) {
      // 多选：由受控 select 数组重建 selection 集合（原为 //todo，导致预选值未落盘、
      // 首次点击新项时 selection 从空集开始、旧选中项丢失）
      each(this.children, c => {
        if (c instanceof ListItem) {
          c.toggleAttribute('active', false)
        }
      })
      this.selection.clear()
      each(selectValue, v => {
        let item = find(items, (it: ListItem) => it.value === v) as ListItem
        if (item) {
          this.selection.add(item.value)
          if (this.selectable)
            item.toggleAttribute('active', true)
        }
      })
    } else if (selectValue && isString(selectValue)) {
      let hasSelected = some(this.selection, (it) => it === selectValue)
      if (hasSelected) return

      each(this.children, c => {
        if (c instanceof ListItem) {
          c.toggleAttribute('active', false)
        }
      })
      this.selection.clear()
      let item = find(items, (it: ListItem) => it.value === selectValue) as ListItem
      if (item) {
        this.selection.add(item.value)
        let firstItem = item
        this.select = firstItem.value

        if (this.selectable)
          firstItem.toggleAttribute('active', true)
      }
    } else {
      //todo
    }
  }
  _removeSelect(item: ListItem) {
    this.selection.delete(item.value)
    item.toggleAttribute('active', false)

    let firstItem = this.selection.keys().next().value
    if (!firstItem) return

    this.select = (firstItem as any).value

      (firstItem as any).toggleAttribute('active', true)
  }

  _syncScroll() {
    if (this.isDestroyed || !this.scrollSync) return;

    let target
    if (isFunction(this.scrollSync)) {
      target = this.scrollSync()
    } else {
      target = document.body.querySelector(this.scrollSync)
    }
    this.syncTarget = target
    let items = this.slotEl.assignedElements({ flatten: true })

    let ids = new Map<string, ListItem>()
    items.forEach((it) => {
      const li = it as ListItem
      if (li.href)
        ids.set(li.href.replace('#', ''), li)
    })

    let anchorEls = target.querySelectorAll((ids.keys() as any).map((k: string) => '#' + k).toArray().join(','))
    each(anchorEls, (n: HTMLElement) => {
      let listItem = ids.get(n.id)!
      this.anchorMap.set(n, listItem)
      this.anchorMapInvert.set(listItem, n)
      this.anchorObserver.observe(n)
    })
  }

  clear() {
    each(this.children, c => {
      if (c instanceof ListItem) {
        c.toggleAttribute('active', false)
      }
    })
    this.selection.clear()
    this.select = this.isSingleMode ? '' : []
  }
}
