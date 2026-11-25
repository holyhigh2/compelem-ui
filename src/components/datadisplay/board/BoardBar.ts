import { computed, createRef, css, Csscope, csscope, forEach, h, ifTrue, model, prop, query, show, state, styles, tag, Template, watch } from "compelem";
import { flatMap, includes, isArray, isBoolean, isEmpty, isObject, join, map, parseJSON } from "myfx";
import { BarActions } from "../../../base/BarActions";
import { tooltip } from "../../../directives/tooltip/Tooltip";
import { Field } from "../../base/Field";
import { Button } from "../../button/Button";
import { Overlay } from "../../overlays/overlay/Overlay";
import { BrushBroad, CaretRight, Check, Close, Drag, EyeClosed, FilterListLight, Plus, Sort, SortDown, SortUp } from "../../../icons/icons";
import { SortType } from "../../../constants";
import { Board } from "./Board";
enum Control {
  Field = 'field',
  Group = 'group',
  Filter = 'filter',
  Sort = 'sort',
  Appearance = 'appearance',
}
/**
 * 看板操作条
 * @attrs
 *  target {string} 关联board的选择器字符
 *  reverse {boolean} 是否反向排列，默认false
 *  size {string} 用于控制内部控件的size，尺寸可选 lg/md/sm，默认md
 *  controls {Array<string>|boolean} 操作条控制按钮，当值为boolean时显示/隐藏所有控制按钮，当值为字符数组时根据数组内容显示控制按钮，可选值field/group/filter/sort/appearance 。默认true
 * @slots
 *  - 查询框、新增按钮等内容
 *  selection 复选记录后显示的操作按钮等内容
 *
 * @author holyhigh2
 */
@tag('ce-board-bar')
export class BoardBar extends BarActions {
  //////////////////////////////////// styles
  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return css`
        /* 工具栏是密度上下文：内部控件未显式给字号时按正文档继承 */
        ce-board-bar {
          font-size: var(--ce-font-md);
        }
        .uii-sortable-active{
          color:red;
        }
      `
  }
  //////////////////////////////////// props
  @prop({ type: String, required: true }) target: string;
  @prop reverse = false
  @prop size = 'md'
  @prop({ type: [Array, Boolean] }) controls: Array<string> | boolean = true

  //当前行高类型
  @state rowHeightType = 'default'
  @state groupList: Array<{ prop: string, condition?: string, name: string }> = []

  // 首帧给空串而非 undefined：model 绑定 undefined 时 ce-select 不回显，
  // 卡片标题下拉会一直显示空白。真正的默认值在 _onContainerReady 里按字段补。
  @state titleField = ''
  // 必须给布尔初值：模型在首帧绑定 undefined 会让 ce-toggle 落到字符串模式，
  // 回写变成 active/inactive，后续 watch 的布尔归一化会把开关永久按 false 处理
  @state showLabel = true
  @state showLabelMargin = true
  @state showCompact: boolean = false
  @state selectionSize = 0
  selectionTotal = 0

  boardRef: Board
  appearancePane = createRef<HTMLElement>()
  groupPane = createRef<HTMLElement>()

  @query('.ce-board-appearance-panel') appearancePanel: Overlay

  @query('.group-panel') groupPanel: Overlay
  @query('.group-field-panel') groupFieldPanel: Overlay
  /////////////////////////////////// computed

  @computed
  get showControlAppearance() {
    return isBoolean(this.controls) ? this.controls : includes(this.controls, Control.Appearance)
  }

  @watch('titleField')
  watchTitleField(nv: string) {
    this.boardRef.updateProps({ titleField: nv })
  }
  @watch('showLabel')
  watchShowLabel(nv: boolean | string) {
    this.boardRef.updateProps({ showLabel: nv === true || nv === 'true' })
  }
  @watch('showLabelMargin')
  watchShowLabelMargin(nv: boolean | string) {
    this.boardRef.updateProps({ showLabelMargin: nv === true || nv === 'true' })
  }
  @watch('showCompact')
  watchShowCompact(nv: boolean | string) {
    this.boardRef.updateProps({ showCompact: nv === true || nv === 'true' })
  }
  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args)
  }
  mounted(): void {
    this.boardRef = (this.wrapperComponent ? this.wrapperComponent.shadowRoot! : document.body).querySelector<Board>(this.target)!

    if (this.boardRef) {
      this.titleField = this.boardRef.titleField || ''
      this.showLabel = this.boardRef.showLabel
      this.showLabelMargin = this.boardRef.showLabelMargin
      this.showCompact = this.boardRef.showCompact

      this.boardRef._setBoardBar(this)
    }
  }
  render(): Template {
    return h`
    <ce-toolbar>
      <span slot="${this.reverse ? '' : 'left'}" ${show(this.selectionSize < 1)} style="display:flex;column-gap: var(--ce-spacing-sm);align-items: center;">
        <slot></slot>
      </span>
      <span slot="${!this.reverse ? '' : 'left'}" ${show(this.selectionSize < 1 && this.showControls)} style="display:flex;column-gap: var(--ce-spacing-sm);align-items: center;">
        <ce-button ${show(this.showControlField)} appearance="${!this.isAllChecked ? 'pale' : 'subtle'}" .icon="${EyeClosed}" size="${this.size}" color="${!this.isAllChecked ? 'info' : 'var(--ce-color-text-secondary)'}" @click="${this.openField}">隐藏字段</ce-button>
        <ce-button ${show(this.showControlFilter && !isEmpty(this.filterableFields))} appearance="${this.filterList.length > 0 ? 'pale' : 'subtle'}" .icon="${FilterListLight}" size="${this.size}" color="${this.filterList.length > 0 ? 'info' : 'var(--ce-color-text-secondary)'}" @click="${this.openFilter}">筛选</ce-button>
        <ce-button ${show(this.showControlSort && !isEmpty(this.sortableFields))} .appearance="${this.sortList.length > 0 ? 'pale' : 'subtle'}" .icon="${Sort}" size="${this.size}" .color="${this.sortList.length > 0 ? 'info' : 'var(--ce-color-text-secondary)'}"  @click="${this.openSort}">
          <span ${show(this.sortList.length > 0)} style="margin-right:var(--ce-spacing-sm);">${this.sortList.length}</span> 排序
        </ce-button>
        <ce-button ${show(this.showControlAppearance)} appearance="subtle" .icon="${BrushBroad}" size="${this.size}" @click="${this.openAppearance}" ${tooltip({ content: '外观', placement: 'top' })}></ce-button>
      </span>
    </ce-toolbar>

    <!-- 外观面板 -->
    <ce-overlay surface placement="bottom-start" auto-active close-on-click opacity="0.25" class="ce-board-appearance-panel" waiguan>
      <ce-card class="config-card" style="min-width: 14rem;padding: var(--ce-spacing-sm);" ref="${this.appearancePane}" >
        <ce-list gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs)">
          <ce-list-header space="compact">
            外观设置
          </ce-list-header>
          <ce-list-item ripple="false" style="padding-inline:var(--ce-spacing-md)">
            显示风格
            <ce-toggle slot="append" size="md" activeText="紧凑" inactiveText="宽松" style="color: var(--ce-color-primary);--ce-toggle-track-font-size:var(--ce-font-md)" ${model(this.showCompact)}></ce-toggle>
          </ce-list-item>
          <ce-list-item ripple="false" style="padding-inline:var(--ce-spacing-md)">
            显示字段名
            <ce-toggle slot="append" size="sm" style="color: var(--ce-color-primary)" ${model(this.showLabel)}></ce-toggle>
          </ce-list-item>
          <ce-list-item ripple="false" style="padding-inline:var(--ce-spacing-md)">
            字段间距
            <ce-toggle slot="append" size="sm" style="color: var(--ce-color-primary)" ${model(this.showLabelMargin)}></ce-toggle>
          </ce-list-item>
          <ce-divider></ce-divider>
          <ce-list-header space="compact">
            卡片标题
          </ce-list-header>
          <ce-list-item ripple="false" style="padding-inline:var(--ce-spacing-md)">
            <ce-select .data="${map(this.allFields, f => ({ value: f.prop, label: f.label }))}" ${model(this.titleField)}></ce-select>
          </ce-list-item>
        </ce-list>
      </ce-card>
    </ce-overlay>
        <!-- 字段控制面板 -->
        <ce-overlay surface placement="bottom-start" auto-active close-on-click opacity="0.25" class="field-panel">
            <div>
            ${ifTrue(this.overlayInitedList.includes('field-panel'), () => h`
            <ce-card class="config-card" style="min-width: 14rem;max-width: 18rem;padding: var(--ce-spacing-sm);height:18rem;overflow: hidden;resize: both;max-height: 50vh;" ref="${this.fieldPane}" >
            <header style="display: flex;justify-content: space-between;align-items: center;margin-bottom:var(--ce-spacing-sm)">
                <div style="color: var(--ce-color-text-desc);">字段设置</div>
                <ce-toggle size="sm" style="color: var(--ce-color-primary);--ce-toggle-track-font-size:var(--ce-font-md)" active-text="隐藏全部" inactive-text="显示全部" .value="${this.isAllChecked}" @change="${this.toggleAllField}"></ce-toggle>
            </header>
            <div style="overflow:hidden;flex:1;">
                <ce-scroller style="display: block;height:100%" show-track="false">
                <ce-list gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs);">
                    ${forEach(this.allFields, f => f.prop, f => h`
                    <ce-list-item ripple="false" appearance="pale" style="padding-inline:0" ?unmovable="${!f.movable}">
                    <ce-icon .svg="${Drag}" color="Gainsboro" size="xs" ${styles(['cursor:move;padding-right:var(--ce-spacing-md);', { visibility: f.movable ? 'visible' : 'hidden' }])}></ce-icon>
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
        <ce-overlay surface placement="bottom-start" auto-active close-on-click opacity="0.25" class="sort-panel">
            <div>
            ${ifTrue(this.overlayInitedList.includes('sort-panel'), () => h`
            <ce-card class="config-card" style="padding: var(--ce-spacing-sm);resize: both;max-height: 50vh;min-width: 14rem;max-width: 16rem;" ref="${this.sortPane}" >
            <ce-list gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs)">
                <ce-list-header space="compact">
                排序设置
                <ce-button appearance="text" color="red" size="sm" style="padding: 0;float: right;" ripple="false" @click="${this.cancelSort}">取消</ce-button>
                </ce-list-header>
                ${forEach(this.sortList, (s, i) => i, (s) => h`
                <ce-list-item ripple="false" style="padding-inline:var(--ce-spacing-md)">
                    <div style="display:flex;width: 100%;justify-content: space-between;">
                    <span style="text-overflow: ellipsis;overflow: hidden;line-height: 1.5;">
                        ${this.sortList.indexOf(s) + 1}.&nbsp;${s.name} &nbsp;&nbsp;
                    </span>
                    <ce-toggle .value="${s.sort === SortType.Asc}" data-prop="${s.prop}" active-value="asc" inactive-value="desc" size="sm" style="color: var(--ce-color-primary);width: 3.75rem;" @change="${this.toggleSortType}">
                        <ce-icon slot="active" .svg="${SortUp}" size="lg" style="color: #fff;"></ce-icon>
                        <ce-icon slot="inactive" .svg="${SortDown}" size="lg" style="color: var(--ce-color-text-desc);"></ce-icon>
                    </ce-toggle>
                    </div>
                    <ce-button slot="append" prop="${s.prop}" appearance="subtle" size="sm" @click="${this.delSort}" .icon="${Close}"></ce-button>
                </ce-list-item>
                `)}
            </ce-list>
            <ce-button slot="actions" appearance="pale" color="gray" ${show(this.sortList.length < BarActions.MAX_SORT_COUNT)} size="sm" style="margin-top: var(--ce-spacing-sm);" .icon="${Plus}" @click="${this.openSortFieldPanel}">字段</ce-button>
            </ce-card>
            `)}
            </div>
        </ce-overlay>
        <ce-overlay surface placement="bottom-start" auto-active close-on-click opacity="0.25" class="sort-field-panel">
            <div>
            ${ifTrue(this.overlayInitedList.includes('sort-field-panel'), () => h`
            <ce-card class="config-card" style="min-width: 14rem;padding: var(--ce-spacing-sm);" >
            <div style="height: 13rem;overflow:hidden">
                <ce-scroller style="display: block;height:100%" show-track="false">
                <ce-list gap=".2rem" selectable multiple style="min-width: 10rem;padding: var(--ce-spacing-xs);" @select="${this.addSortField}">
                    ${forEach(this.sortableFields, f => f.value, f => h`
                    <ce-list-item ripple="false" ?active="${this.sortList.some(x => x.prop == f.value)}" hoverable appearance="pale" value="${f.value}">
                    <span style="text-overflow: ellipsis;overflow: hidden;">${f.label}</span>
                    <ce-icon slot="append" ${show(this.sortList.some(x => x.prop == f.value))} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
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
        <ce-overlay surface placement="bottom-start" auto-active close-on-click opacity="0.25" class="filter-panel">
            <div>
            ${ifTrue(this.overlayInitedList.includes('filter-panel'), () => h`
            <ce-card class="config-card" style="overflow: hidden;height:18rem;resize: both;max-height: 50vh;min-width: 14rem;padding: var(--ce-spacing-sm);" ref="${this.filterPane}" >
                <header style="display: flex;justify-content: space-between;align-items: center;margin-bottom:var(--ce-spacing-sm)">
                <div style="color: var(--ce-color-text-desc);">筛选设置</div>
                <ce-button appearance="text" color="red" size="sm" style="padding: 0;float: right;" ripple="false" @click="${this.cancelFilter}">取消</ce-button>
                </header>
                <div style="overflow:hidden;flex:1;">
                <ce-scroller style="display: block;height:100%" show-track="false">
                <ce-list selectable gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs)" @select="${this.openFilterPane}">
                    ${forEach(this.filterableFields, (s, i) => i, (s, i) => h`
                    <ce-list-item ripple="false" value="${s.value}" data-type="${s.dataType}" hoverable style="padding-inline:var(--ce-spacing-md)">
                        <span style="overflow: hidden;text-overflow: ellipsis;">${s.label}</span> &nbsp;&nbsp; <span style="pointer-events:none;font-size:var(--ce-font-sm);color: var(--ce-color-text-desc);overflow: hidden;text-overflow: ellipsis;">${this.filterList.find(x => x.prop == s.value)?.search}</span>
                        <ce-icon slot="append" .svg="${CaretRight}" style="color: var(--ce-color-text);"></ce-icon>
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
  unselect() {
    this.boardRef.toggleRowSelectionAll(false)
  }
  // 父类回调
  onSetSort(prop: string, sort: string | null) {
    this.boardRef._setSort(prop, sort)
  }
  onClearSort() {
    this.boardRef._clearSort()
  }
  onOpenFilter(prop: string, dataType: string, btn: HTMLElement) {
    this.boardRef._openFilter(prop, dataType, btn, true)
  }
  onClearFilter() {
    this.boardRef._clearFilter()
  }
  onToggleField(prop: string) {
    this.boardRef.toggleFieldHide(prop)
  }
  onToggleAllField(props: string[]): void {
    this.boardRef.toggleAllFieldHide(props)
  }
  ////////////////////////////////////////// 外观相关
  openAppearance(e: MouseEvent) {
    Overlay.closeAll()
    this.appearancePanel.openBy(e.target as Button)
  }

  //////////////////////////////////// border cbk
  _onContainerReady() {
    // 状态数组必须整体赋值：compelem 不追踪数组元素的原地变更，
    // 直接 push 不会重渲染工具栏，筛选/排序按钮会一直停留在首次渲染的隐藏态
    const sortableFields: Array<{ value: string, label: string }> = []
    const filterableFields: Array<{ value: string, label: string, dataType: string }> = []
    this.allFields = flatMap(this.boardRef._fieldMap, (field, prop) => {

      if (field?.sortable) {
        sortableFields.push({
          value: field.prop,
          label: field?.label
        })
      }
      if (field?.filterable) {
        filterableFields.push({
          value: field.prop,
          label: field?.label,
          dataType: field.dataType
        })
      }
      return {
        movable: field?.movable ?? false,
        name: field?.label,
        label: field.label,
        value: field.prop,
        prop: field.prop,
        // hidden: includes(hideList, field.prop),
        hidable: field?.hidable ?? false
      }
    })
    this.sortableFields = sortableFields
    this.filterableFields = filterableFields
    // 卡片标题默认取看板当前设置；看板侧还没有值时回落到第一个字段，
    // 避免外观面板里的「卡片标题」下拉开局为空。
    if (!this.titleField) {
      this.titleField = this.boardRef?.titleField || this.allFields[0]?.value || ''
    }
  }
  _onFieldChange(fields: Field[]) {
    this.allFields = fields
  }
  _onHideChange(columns: string[]) {
    this.hiddenList = columns//clone(this.boardRef._hiddenFieldList)
  }
  _onSortChange(orders: { prop: string, sort: string }[]) {
    let tMap = this.boardRef._fieldMap
    this.sortList = map(orders, ({ prop, sort }) => {
      return {
        prop, sort,
        name: tMap.get(prop)?.label
      }
    })
  }
  _onGroupChange(grouped: Record<string, any>) {
    this.groupList = map(grouped, ({ prop, name }) => {
      return {
        prop,
        name
      }
    })
  }
  _onFilterChange(filters: Record<string, any>) {
    this.filterList = map(filters, (v, k) => {
      let obj = parseJSON<{ min: string, max: string }>(v)
      let str = isArray(obj) ? join(obj) : isObject(obj) ? `${obj.min || ''} ~ ${obj.max || ''}` : v
      return {
        prop: k,
        name: this.allFields.find(f => f.prop === k)?.label,
        search: str
      }
    })
  }

}