import { CompElem, computed, createRef, prop, query, state } from "compelem";
import { every, flatMap, includes, isBoolean, isEmpty, map } from "myfx";
import uii from "uiik";
import { Button } from "../components/button/Button";
import { Toggle } from "../components/form/toggle/Toggle";
import { Overlay } from "../components/overlays/overlay/Overlay";
import { SortType } from "../constants";

enum Control {
    Field = 'field',
    Group = 'group',
    Filter = 'filter',
    Sort = 'sort',
    Appearance = 'appearance',
}
/**
 * 同步筛选字段列表的高亮。
 *
 * 列表项的 active 同时被两处写：ce-list 的选中态、以及右侧条件面板
 * （ce-overlay auto-active）把触发项设为 active。切换字段时若任一环漏清，
 * 旧字段就会残留高亮（表现：从 A 切到 B 后 A 仍高亮，需再点一次才消失）。
 * 按当前字段统一刷一遍，保证列表内只有一个高亮项。
 */
export function syncFilterPaneActive(pane: HTMLElement | null | undefined, prop: string) {
    pane?.querySelectorAll('ce-list-item').forEach(el => {
        el.toggleAttribute('active', el.getAttribute('value') === prop)
    })
}
/**
 * 操作条动作基类
 * @author holyhigh2
 */
export abstract class BarActions extends CompElem {
    static MAX_SORT_COUNT = 3
    //////////////////////////////////// props
    @prop({ type: [Array, Boolean] }) actions: Array<string> | boolean = true

    // 记录面板内容已初始化。只能用整数组赋值更新：数组 mutation 不进更新队列，
    // 用 push 时读取本字段的 ifTrue 分支不会重渲染，面板内容不落地 ⇒ 浮层量不到尺寸，
    // 首次打开停在不可见状态（openBy 后 __revealPending 等不到内容）。
    @state overlayInitedList: string[] = []

    // 字段相关
    @state allFields: Record<string, any>[] = []
    @state hiddenList: string[] = []
    fieldPane = createRef<HTMLElement>()
    @query('.field-panel') fieldPanel!: Overlay

    // 排序相关
    @state sortList: Record<string, any>[] = []
    @state sortableFields: Record<string, any>[] = []
    sortPane = createRef<HTMLElement>()
    @query('.sort-panel') sortPanel!: Overlay
    @query('.sort-field-panel') sortFieldPanel!: Overlay

    // 筛选相关
    @state filterList: Record<string, any>[] = []
    @state filterableFields: Record<string, any>[] = []
    filterPane = createRef<HTMLElement>()
    @query('.filter-panel') filterPanel!: Overlay

    /////////////////////////////////// computed
    @computed
    get isAllChecked() {
        let hl = this.hiddenList
        return isEmpty(this.allFields) ? false : every(this.allFields, f => !hl.includes(f.prop))
    }
    @computed
    get showControls() {
        return isBoolean(this.actions) ? this.actions : !isEmpty(this.actions)
    }
    @computed
    get showControlField() {
        return isBoolean(this.actions) ? this.actions : includes(this.actions, Control.Field)
    }
    @computed
    get showControlFilter() {
        return isBoolean(this.actions) ? this.actions : includes(this.actions, Control.Filter)
    }
    @computed
    get showControlGroup() {
        return isBoolean(this.actions) ? this.actions : includes(this.actions, Control.Group)
    }
    @computed
    get showControlSort() {
        return isBoolean(this.actions) ? this.actions : includes(this.actions, Control.Sort)
    }

    // 回调接口
    abstract onSetSort(prop: string, sort: string | null): void
    abstract onClearSort(): void
    abstract onOpenFilter(prop: string, dataType: string, btn: HTMLElement): void
    abstract onClearFilter(): void
    abstract onToggleField(prop: string): void
    abstract onToggleAllField(props: string[]): void

    //////////////////////////////////////////////////////////////  字段相关
    bindFieldDrag() {
        const that = this
        uii.newSortable(this.fieldPane.current?.querySelector('ce-list') as HTMLElement, {
            filter: '[unmovable]',
            spill: 'revert',
            handle: 'ce-list-item ce-icon',
            onEnd({ item, from, to }, e) {
                const prevProp = item.previousElementSibling?.getAttribute('key')!
                const colProp = item.getAttribute('key')!
                that.emit('movefield', { prop: colProp, prevProp })
                // that.tableRef.moveColumnTo(colProp, prevProp)
            }
        })
    }
    openField(obj: Record<string, any>) {
        Overlay.closeAll()
        if (!this.overlayInitedList.includes('field-panel')) {
            this.overlayInitedList = [...this.overlayInitedList, 'field-panel']

            this.nextTick(() => {
                // this.bindFieldDrag()
                this.fieldPanel.openBy(obj.target as Button)
            })
            return
        }

        this.fieldPanel.openBy(obj.target as Button)
    }
    toggleField(obj: Record<string, any>) {
        let t = obj.target as Toggle
        if (t.disabled) return

        let prop = t.getAttribute('prop')!

        this.onToggleField?.(prop)
    }
    toggleAllField() {
        if (this.isAllChecked) {
            this.hiddenList = map(this.allFields, f => f.prop)

            let propAry = flatMap<any, string>(this.allFields, f => {
                if (f.hidable) return f.prop
                return []
            })
            this.onToggleAllField?.(propAry)
        } else {
            this.hiddenList = []
            this.onToggleAllField?.([])
        }
    }

    //////////////////////////////////////////////////////////////  排序相关
    openSort(obj: Record<string, any>) {
        if (!this.overlayInitedList.includes('sort-panel')) {
            this.overlayInitedList = [...this.overlayInitedList, 'sort-panel']

            this.nextTick(() => {
                this.sortPanel.openBy(obj.target as Button)
            })
            return
        }
        this.sortPanel.openBy(obj.target as Button)
    }
    openSortFieldPanel(obj: Record<string, any>) {
        if (!this.overlayInitedList.includes('sort-field-panel')) {
            this.overlayInitedList = [...this.overlayInitedList, 'sort-field-panel']

            this.nextTick(() => {
                this.sortFieldPanel.openBy(obj.target as Button)
            })
            return
        }
        this.sortFieldPanel.openBy(obj.target as Button)
    }
    cancelSort() {
        this.sortPanel.close()
        this.sortList = []
        setTimeout(() => {
            if (this.onClearSort) this.onClearSort()
        }, 50)
    }
    addSortField(obj: Record<string, any>) {
        let { item } = obj
        this.sortFieldPanel.close()
        setTimeout(() => {
            if (this.onSetSort) this.onSetSort(item.value, SortType.Asc)
        }, 50)
    }
    delSort(obj: Record<string, any>) {
        let prop = (obj.target as HTMLElement).getAttribute('prop')!
        if (this.onSetSort) this.onSetSort(prop, null)
        if (this.sortList.length < 1) {
            this.sortPanel.close()
        }
    }
    toggleSortType(obj: Record<string, any>) {
        let val = obj.value
        let prop = (obj.target as HTMLElement).dataset.prop!
        setTimeout(() => {
            if (this.onSetSort) this.onSetSort(prop, val)
        }, 50)
    }

    //////////////////////////////////////////////////////////////  筛选相关
    openFilter(obj: Record<string, any>) {
        Overlay.closeAll()
        if (!this.overlayInitedList.includes('filter-panel')) {
            this.overlayInitedList = [...this.overlayInitedList, 'filter-panel']

            this.nextTick(() => {
                this.filterPanel.openBy(obj.target as Button)
            })
            return
        }
        this.filterPanel.openBy(obj.target as Button)
    }
    openFilterPane(obj: Record<string, any>) {
        let { item } = obj

        let target = item as HTMLElement
        const prop = target.getAttribute('value')!
        syncFilterPaneActive(this.filterPane.current, prop)
        if (this.onOpenFilter) this.onOpenFilter(prop, target.dataset.type!, target)
    }
    cancelFilter() {
        this.filterPanel.close()
        this.filterList = []
        setTimeout(() => {
            if (this.onClearFilter) this.onClearFilter()
        }, 50)
    }
}