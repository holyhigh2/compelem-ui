import { CompElem, computed, createRef, forEach, h, ifTrue, prop, query, show, state, styles, Template } from "compelem";
import { every, flatMap, includes, isBoolean, isEmpty, map } from "myfx";
import uii from "uiik";
import { Button } from "../components/button/Button";
import { Toggle } from "../components/form/toggle/Toggle";
import { Overlay } from "../components/overlays/overlay/Overlay";
import { SortType } from "../constants";
import { SortDown, SortUp } from "../icons/icons";

enum Control {
    Field = 'field',
    Group = 'group',
    Filter = 'filter',
    Sort = 'sort',
    Appearance = 'appearance',
}
/**
 * 操作条动作基类
 * @author holyhigh2
 */
export abstract class BarActions extends CompElem {
    static MAX_SORT_COUNT = 3
    //////////////////////////////////// props
    @prop({ type: [Array, Boolean] }) actions: Array<string> | boolean = true

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

    render(): Template {
        return h`
        <!-- 字段控制面板 -->
        <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="field-panel">
            <div>
            ${ifTrue(this.overlayInitedList.includes('field-panel'), () => h`
            <ce-card class="config-card" style="min-width: 14rem;max-width: 18rem;padding: var(--ce-spacing-sm);height:18rem;overflow: hidden;resize: both;max-height: 50vh;" ref="${this.fieldPane}" >
            <header style="display: flex;justify-content: space-between;align-items: center;margin-bottom:var(--ce-spacing-sm)">
                <div style="font-size:var(--ce-font-sm-em);color: var(--ce-color-text-desc);">字段设置</div>
                <ce-toggle size="sm" style="color: var(--ce-color-primary)" active-text="隐藏全部" inactive-text="显示全部" .value="${this.isAllChecked}" @change="${this.toggleAllField}"></ce-toggle>
            </header>
            <div style="overflow:hidden;flex:1;">
                <ce-scroller style="display: block;height:100%" show-track="false">
                <ce-list gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs);">
                    ${forEach(this.allFields, f => f.prop, f => h`
                    <ce-list-item ripple="false" appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:0" ?unmovable="${!f.movable}">
                    <ce-icon svg="c-svg-drag" color="Gainsboro" size="xs" ${styles('cursor:move;padding-right:var(--ce-spacing-md);', { visibility: f.movable ? 'visible' : 'hidden' })}></ce-icon>
                    <span style="overflow: hidden;text-overflow: ellipsis;">${f.name}</span>
                    <ce-toggle slot="append" ${show(f.hidable)} ?disabled="${!f.hidable}" 
                    .value="${!this.hiddenList.includes(f.prop)}" 
                    prop="${f.prop}" size="sm" style="color: var(--ce-color-primary)" 
                    @change="${this.toggleField}">
                    </ce-toggle>
                    </ce-list-item>
                    `)}
                </ce-list>
                </ce-scroller>
            </div>
            </ce-card>
            `)}
            </div>
        </ce-overlay>
        <!-- 排序面板 -->
        <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="sort-panel">
            <div>
            ${ifTrue(this.overlayInitedList.includes('sort-panel'), () => h`
            <ce-card class="config-card" style="padding: var(--ce-spacing-sm);resize: both;max-height: 50vh;min-width: 14rem;max-width: 16rem;" ref="${this.sortPane}" >
            <ce-list gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs)">
                <ce-list-header space="compact" style="font-size:var(--ce-font-sm-em);">
                排序设置
                <ce-button appearance="text" color="red" size="sm" style="padding: 0;float: right;" ripple="false" @click="${this.cancelSort}">取消</ce-button>
                </ce-list-header>
                ${forEach(this.sortList, (s, i) => i, (s, i) => h`
                <ce-list-item ripple="false" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
                    <div style="display:flex;width: 100%;justify-content: space-between;">
                    <span style="text-overflow: ellipsis;overflow: hidden;line-height: 1.5;">
                        ${i + 1}.&nbsp;${s.name} &nbsp;&nbsp;
                    </span>
                    <ce-toggle .value="${s.sort === SortType.Asc}" data-prop="${s.prop}" active-value="asc" inactive-value="desc" size="sm" style="color: var(--ce-color-primary);width: 3.75rem;" @change="${this.toggleSortType}">
                        <ce-icon slot="active" .svg="${SortUp}" size="lg" style="color: #fff;"></ce-icon>
                        <ce-icon slot="inactive" .svg="${SortDown}" size="lg" style="color: var(--ce-color-text-desc);"></ce-icon>
                    </ce-toggle>
                    </div>
                    <ce-button slot="append" prop="${s.prop}" appearance="subtle" size="sm" @click="${this.delSort}" icon="c-svg-close"></ce-button>
                </ce-list-item>
                `)}
            </ce-list>
            <ce-button slot="actions" appearance="pale" color="gray" ${show(this.sortList.length < BarActions.MAX_SORT_COUNT)} size="sm" style="margin-top: var(--ce-spacing-sm);" icon="c-svg-plus" @click="${this.openSortFieldPanel}">字段</ce-button>
            </ce-card>
            `)}
            </div>
        </ce-overlay>
        <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="sort-field-panel">
            <div>
            ${ifTrue(this.overlayInitedList.includes('sort-field-panel'), () => h`
            <ce-card class="config-card" style="min-width: 14rem;padding: var(--ce-spacing-sm);" >
            <div style="height: 13rem;overflow:hidden">
                <ce-scroller style="display: block;height:100%" show-track="false">
                <ce-list gap=".2rem" selectable multiple style="min-width: 10rem;padding: var(--ce-spacing-xs);" @select="${this.addSortField}">
                    ${forEach(this.sortableFields, f => f.value, f => h`
                    <ce-list-item ripple="false" ?active="${this.sortList.some(x => x.prop == f.value)}" hoverable appearance="pale" value="${f.value}" style="font-size:var(--ce-font-sm-em);">
                    <span style="text-overflow: ellipsis;overflow: hidden;">${f.label}</span>
                    <ce-icon slot="append" ${show(this.sortList.some(x => x.prop == f.value))} svg="c-svg-check" size="md" style="color: var(--ce-color-primary)"></ce-icon>
                    </ce-list-item>
                    `)}
                </ce-list>
                </ce-scroller>
            </div>
            </ce-card>
            `)}
            </div>
        </ce-overlay>
        <!-- 筛选面板 -->
        <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="filter-panel">
            <div>
            ${ifTrue(this.overlayInitedList.includes('filter-panel'), () => h`
            <ce-card class="config-card" style="overflow: hidden;height:18rem;resize: both;max-height: 50vh;min-width: 14rem;padding: var(--ce-spacing-sm);" ref="${this.filterPane}" >
                <header style="display: flex;justify-content: space-between;align-items: center;margin-bottom:var(--ce-spacing-sm)">
                <div style="font-size:var(--ce-font-sm-em);color: var(--ce-color-text-desc);">筛选设置</div>
                <ce-button appearance="text" color="red" size="sm" style="padding: 0;float: right;" ripple="false" @click="${this.cancelFilter}">取消</ce-button>
                </header>
                <div style="overflow:hidden;flex:1;">
                <ce-scroller style="display: block;height:100%" show-track="false">
                <ce-list selectable gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs)" @select="${this.openFilterPane}">
                    ${forEach(this.filterableFields, (s, i) => i, (s, i) => h`
                    <ce-list-item ripple="false" value="${s.value}" data-type="${s.dataType}" hoverable style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
                        <span style="overflow: hidden;text-overflow: ellipsis;">${s.label}</span> &nbsp;&nbsp; <span style="pointer-events:none;font-size:var(--ce-font-sm-em);color: var(--ce-color-text-desc);overflow: hidden;text-overflow: ellipsis;">${this.filterList.find(x => x.prop == s.value)?.search}</span>
                        <ce-icon slot="append" svg="c-svg-chevron-right" style="color: var(--ce-color-text);"></ce-icon>
                    </ce-list-item>
                    `)}
                </ce-list>
                </ce-scroller>
                </div>
            </ce-card>
            `)}
            </div>
        </ce-overlay>
        `
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
            this.overlayInitedList.push('field-panel')

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

        this.onToggleField && this.onToggleField(prop)
    }
    toggleAllField() {
        if (this.isAllChecked) {
            this.hiddenList = map(this.allFields, f => f.prop)

            let propAry = flatMap<any, string>(this.allFields, f => {
                if (f.hidable) return f.prop
                return []
            })
            this.onToggleAllField && this.onToggleAllField(propAry)
        } else {
            this.hiddenList = []
            this.onToggleAllField && this.onToggleAllField([])
        }
    }

    //////////////////////////////////////////////////////////////  排序相关
    openSort(obj: Record<string, any>) {
        if (!this.overlayInitedList.includes('sort-panel')) {
            this.overlayInitedList.push('sort-panel')

            this.nextTick(() => {
                this.sortPanel.openBy(obj.target as Button)
            })
            return
        }
        this.sortPanel.openBy(obj.target as Button)
    }
    openSortFieldPanel(obj: Record<string, any>) {
        if (!this.overlayInitedList.includes('sort-field-panel')) {
            this.overlayInitedList.push('sort-field-panel')

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
            this.overlayInitedList.push('filter-panel')

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
        if (this.onOpenFilter) this.onOpenFilter(target.getAttribute('value')!, target.dataset.type!, target)
    }
    cancelFilter() {
        this.filterPanel.close()
        this.filterList = []
        setTimeout(() => {
            if (this.onClearFilter) this.onClearFilter()
        }, 50)
    }
}