import { classes, computed, csscope, Csscope, debounced, emits, h, ifElse, prop, query, state, styles, tag, Template, watch } from "compelem";
import { debounce, each, find, isArray, isDefined, isFunction, isNil, isString, size, some } from "myfx";
import { AppearanceElem, AppearanceType } from "../../../base/Appearance";

import { ListItem } from "./ListItem";
import style from "./style.scss?tmpl";
/**
 * 列表容器，会对内部元素应用列表项样式
 * @props
 *  select {array|string|number} 如果值为数组则开启多选，否则单选(首次赋值时判定)
 *  appearance {string} 外观。default/underline
 *  divider {boolean} 是否显示分隔符
 *  card {boolean} 是否卡片外观
 *  gap {string} 列表项间隔，默认0
 *  space {string} 列表项空间尺寸，默认 AppearanceSpace.Loose
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
  @prop divider = true
  @prop card = false
  @prop gap = '0'
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
  //////////////////////////////////// lifecycles
  _ss: () => void
  constructor() {
    super()
    this._ss = debounce(this._syncScroll.bind(this), 100)
  }
  mounted(): void {
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
      "ce-list-divider": this.divider,
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

  slotChange(slot: HTMLSlotElement, name: string): void {
    let items = slot.assignedElements({ flatten: true })
    items.forEach(it => {
      if (it instanceof ListItem) {
        it.setAttribute('space', this.space)
        it.setAttribute('size', this.size)
        it.setAttribute('appearance', this.appearance)
        it.toggleAttribute('collapsed', this.collapsed)
      }
    })
    if (this.isMounted && this.maxRows > 0) {
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

    this._resetSelectItem();
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
  _resetSelectItem(selectValue?: string) {
    if (!this.slotEl) return
    let items = this.slotEl.assignedElements({ flatten: true })
    if (selectValue && isString(selectValue)) {
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
