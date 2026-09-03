import { CompElem, computed, createRef, css, csscope, Csscope, forEach, h, ifTrue, prop, query, show, state, styles, tag, Template } from "compelem";
import { every, flatMap, identity, includes, isArray, isBoolean, isEmpty, isObject, join, last, map, parseJSON, range, remove, size, some, startsWith } from "myfx";
import uii from "uiik";
import { SortType } from "../../../constants";
import { tooltip } from "../../../directives/tooltip/Tooltip";
import { Check, Drag, SortDown, SortUp } from "../../../icons/icons";
import { Button } from "../../button/Button";
import { Toggle } from "../../form/toggle/Toggle";
import { Overlay } from "../../overlays/overlay/Overlay";
import { ColumnConfigPane } from "./ColumnConfigPane";
import { MAX_GROUP_COUNT, MAX_SORT_COUNT, PRIV_COL_PREF, Table } from "./Table";
import { RowHeightType } from "./types";
enum Control {
  Field = 'field',
  Group = 'group',
  Filter = 'filter',
  Sort = 'sort',
  Fixed = 'fixed',
  RowHeight = 'rowHeight',
}
/**
 * 表格操作条
 * @attrs
 *  target {string} 关联table的选择器字符
 *  maxFixedSn {number} 最大可固定列号，默认列数量一半
 *  reverse {boolean} 是否反向排列，默认false
 *  size {string} 用于控制内部控件的size，尺寸可选 lg/md/sm，默认md
 *  compact {boolean} 仅显示图标，默认会根据宽度自动切换
 *  controls {Array<string>|boolean} 操作条控制按钮，当值为boolean时显示/隐藏所有控制按钮，当值为字符数组时根据数组内容显示控制按钮，可选值field/group/filter/sort/fixed/rowHeight 。默认true
 * @slots
 *  - 查询框、新增按钮等内容
 *  selection 复选记录后显示的操作按钮等内容
 *
 * @author holyhigh2
 */
@tag('ce-table-bar')
export class TableBar extends CompElem {
  //////////////////////////////////// styles
  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return css`
        .uii-sortable-active{
          color:red;
        }
      `
  }
  //////////////////////////////////// props
  @prop({ type: String, required: true }) target: string;
  @prop maxFixedSn = 0
  @prop reverse = false
  @prop compact = false
  @prop size = 'md'
  @prop({ type: [Array, Boolean] }) controls: Array<string> | boolean = true

  @state fixedPropList: string[] = []
  @state tableFields: Record<string, any>[] = []
  //可分组字段
  @state groupableFields: Record<string, any>[] = []
  //可排序字段
  @state sortableFields: Record<string, any>[] = []
  //可筛选字段
  @state filterableFields: Record<string, any>[] = []
  //可填色字段
  @state colorableFields: Record<string, any>[] = []
  @state hiddenList: string[] = []
  //当前left固定列号
  @state fixedIndex = 0
  //当前行高类型
  @state rowHeightType = 'compact'
  @state sortList: Record<string, any>[] = []
  @state groupList: Array<{ prop: string, condition?: string, name: string }> = []
  @state filterList: Record<string, any>[] = []
  @state fillColorList: Record<string, any>[] = []

  @state selectionSize = 0
  selectionTotal = 0

  @state liteMode = false
  @state overlayInitedList: string[] = []

  tableRef: Table
  fieldPane = createRef<HTMLElement>()
  fixedPane = createRef<HTMLElement>()
  rowHeightPane = createRef<HTMLElement>()
  sortPane = createRef<HTMLElement>()
  groupPane = createRef<HTMLElement>()
  filterPane = createRef<HTMLElement>()
  currentTable: Table
  @query('.field-panel') fieldPanel: Overlay
  @query('.fixed-panel') fixedPanel: Overlay
  @query('.rowheight-panel') rowHeightPanel: Overlay
  @query('.sort-panel') sortPanel: Overlay
  @query('.sort-field-panel') sortFieldPanel: Overlay
  @query('.filter-panel') filterPanel: Overlay
  @query('.group-panel') groupPanel: Overlay
  @query('.group-field-panel') groupFieldPanel: Overlay
  /////////////////////////////////// computed
  @computed
  get isAllChecked() {
    let hl = this.hiddenList
    return isEmpty(this.tableFields) ? false : every(this.tableFields, f => !hl.includes(f.prop))
  }
  @computed
  get showControls() {
    return isBoolean(this.controls) ? this.controls : !isEmpty(this.controls)
  }
  @computed
  get showControlField() {
    return isBoolean(this.controls) ? this.controls : includes(this.controls, Control.Field)
  }
  @computed
  get showControlFilter() {
    return isBoolean(this.controls) ? this.controls : includes(this.controls, Control.Filter)
  }
  @computed
  get showControlGroup() {
    return isBoolean(this.controls) ? this.controls : includes(this.controls, Control.Group)
  }
  @computed
  get showControlSort() {
    return isBoolean(this.controls) ? this.controls : includes(this.controls, Control.Sort)
  }
  @computed
  get showControlFixed() {
    return isBoolean(this.controls) ? this.controls : includes(this.controls, Control.Fixed)
  }
  @computed
  get showControlRowHeight() {
    return isBoolean(this.controls) ? this.controls : includes(this.controls, Control.RowHeight)
  }
  @computed
  get showControlFillColor() {
    return isBoolean(this.controls) ? this.controls : includes(this.controls, Control.RowHeight)
  }

  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args)
  }
  beforeMount(): void {
    // this.tableRef = (this.wrapperComponent?.renderRoot ?? document.body)?.querySelector(this.target) as Table
    // if (this.tableRef) {
    //   this.tableRef._setTableBar(this)
    // }
  }
  mounted(): void {
    this.tableRef = (this.wrapperComponent?.renderRoot ?? document.body)?.querySelector(this.target) as Table
    if (this.tableRef) {
      this.tableRef._setTableBar(this)
    }
  }
  render(): Template {
    return h`
    <ce-toolbar @overflow="${this.onOverflow}">
      <span slot="${this.reverse ? '' : 'left'}" ${show(this.selectionSize < 1)} style="display:flex;column-gap: var(--ce-spacing-sm);align-items: center;">
        <slot></slot>
      </span>
      <span slot="${!this.reverse ? '' : 'left'}" ${show(this.selectionSize < 1 && this.showControls)} style="display:flex;column-gap: var(--ce-spacing-sm);align-items: center;">
        <ce-button ${show(this.showControlField)} ${tooltip({ content: '字段', placement: 'top', disabled: !(this.liteMode || this.compact) })} appearance="${!this.isAllChecked ? 'pale' : 'subtle'}" icon="c-svg-nut" size="${this.size}" color="${!this.isAllChecked ? 'info' : 'rgba(0,0,0,.65)'}" @click="${this.openField}">
        ${this.liteMode || this.compact ? '' : '字段'}
        </ce-button>
        <ce-button ${show(this.showControlFillColor && !isEmpty(this.colorableFields))} ${tooltip({ content: '填色', placement: 'top', disabled: !(this.liteMode || this.compact) })} appearance="${this.fillColorList.length > 0 ? 'pale' : 'subtle'}" icon="c-svg-fill-color" size="${this.size}" color="${this.fillColorList.length > 0 ? 'info' : 'rgba(0,0,0,.65)'}" @click="${this.openFillColor}">
        ${this.liteMode || this.compact ? '' : '填色'}
        </ce-button>
        <ce-button ${show(this.showControlGroup && !isEmpty(this.groupableFields))} ${tooltip({ content: '分组', placement: 'top', disabled: !(this.liteMode || this.compact) })} appearance="${this.groupList.length > 0 ? 'pale' : 'subtle'}" icon="c-svg-group" size="${this.size}" color="${this.groupList.length > 0 ? 'info' : 'rgba(0,0,0,.65)'}" @click="${this.openGroup}">
        ${this.liteMode || this.compact ? '' : '分组'}
        </ce-button>
        <ce-button ${show(this.showControlFilter && !isEmpty(this.filterableFields))} ${tooltip({ content: '筛选', placement: 'top', disabled: !(this.liteMode || this.compact) })} appearance="${this.filterList.length > 0 ? 'pale' : 'subtle'}" icon="c-svg-filter-list-light" size="${this.size}" color="${this.filterList.length > 0 ? 'info' : 'rgba(0,0,0,.65)'}" @click="${this.openFilter}">
        ${this.liteMode || this.compact ? '' : '筛选'}
        </ce-button>
        <ce-button ${show(this.showControlSort && !isEmpty(this.sortableFields))} ${tooltip({ content: '排序', placement: 'top', disabled: !(this.liteMode || this.compact) })} appearance="${this.sortList.length > 0 ? 'pale' : 'subtle'}" icon="c-svg-sort" size="${this.size}" color="${this.sortList.length > 0 ? 'info' : 'rgba(0,0,0,.65)'}"  @click="${this.openSort}">
          <span ${show(this.sortList.length > 0)} style="margin-right:var(--ce-spacing-sm);">${this.sortList.length}</span> ${this.liteMode || this.compact ? '' : '排序'}
        </ce-button>
        <ce-button ${show(this.showControlFixed)} ${tooltip({ content: '冻结', placement: 'top', disabled: !(this.liteMode || this.compact) })} appearance="${this.fixedIndex > 0 ? 'pale' : 'subtle'}" icon="c-svg-pin-fill" size="${this.size}" color="${this.fixedIndex > 0 ? 'info' : 'rgba(0,0,0,.65)'}" @click="${this.openFixed}">
        ${this.liteMode || this.compact ? '' : '冻结'}
        </ce-button>
        <ce-button ${show(this.showControlRowHeight)} appearance="subtle" size="${this.size}" color="rgba(0,0,0,.65)" icon="c-svg-row-height" @click="${this.openRowHeight}" ${tooltip({ content: '行高', placement: 'top' })}></ce-button>
    
      </span>

      <span slot="${this.reverse ? '' : 'left'}" ${show(this.selectionSize > 0)} style="display:flex;column-gap: var(--ce-spacing-sm);align-items: center;font-size: max(12px, var(--ce-font-sm-em));color: var(--ce-color-text-desc);">
        已选择 <b style="color:initial;">${this.selectionSize}</b> / ${this.selectionTotal} 条数据
      </span>
      <span slot="${!this.reverse ? '' : 'left'}" ${show(this.selectionSize > 0)} style="display:flex;column-gap: var(--ce-spacing-sm);align-items: stretch;">
        <slot name="selection"></slot>
        <ce-divider vertical="true"></ce-divider>
        <ce-button appearance="subtle" size="${this.size}" color="rgba(0,0,0,.65)" icon="c-svg-times" @click="${this.unselect}"></ce-button>
      </span>
    </ce-toolbar>
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
              ${forEach(this.tableFields, f => f.prop, f => h`
              <ce-list-item ripple="false" appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:0" ?unmovable="${!f.movable}">
                <ce-icon .svg="${Drag}" color="Gainsboro" size="xs" ${styles(['cursor:move;padding-right:var(--ce-spacing-md);', { visibility: f.movable ? 'visible' : 'hidden' }])}></ce-icon>
                <span style="overflow: hidden;text-overflow: ellipsis;">${f.name}</span>
                <ce-toggle slot="append" ${show(f.hidable)} ?disabled="${!f.hidable}" .value="${!this.hiddenList.includes(f.prop)}" prop="${f.prop}" size="sm" style="color: var(--ce-color-primary)" @change="${this.toggleField}"></ce-toggle>
              </ce-list-item>
              `)}
            </ce-list>
          </ce-scroller>
        </div>
      </ce-card>
      `)}
      </div>
    </ce-overlay>
    <!-- 分组面板 -->
    <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="group-panel">
      <div>
      ${ifTrue(this.overlayInitedList.includes('group-panel'), () => h`
      <ce-card class="config-card" style="min-width: 14rem;max-width: 16rem;padding: var(--ce-spacing-sm);" ref="${this.groupPane}" >
        <ce-list nav gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs)" >
          <ce-list-header space="compact" style="font-size:var(--ce-font-sm-em);">
            <span>分组设置</span>
            <ce-button appearance="text" color="red" size="sm" style="padding: 0;float: right;" ripple="false" @click="${this.cancelGroup}">取消</ce-button>
          </ce-list-header>
          ${forEach(this.groupList, s => s.prop, (s, i) => h`
            <ce-list-item ripple="false" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
              <span style="text-overflow: ellipsis;overflow: hidden;line-height: 1.5;">${i + 1}.&nbsp; ${s.name}</span>
              <ce-button slot="append" prop="${s.prop}" appearance="subtle" size="sm" @click="${this.delGroup}" icon="c-svg-close"></ce-button>
            </ce-list-item>
          `)}
        </ce-list>
        <ce-button slot="actions" appearance="pale" color="gray" ${show(this.groupList.length < MAX_GROUP_COUNT)} size="sm" style="margin-top: var(--ce-spacing-sm);" icon="c-svg-plus" @click="${this.openGroupFieldPanel}">字段</ce-button>
      </ce-card>
      `)}
      </div>
    </ce-overlay>
    <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="group-field-panel">
      <div>
      ${ifTrue(this.overlayInitedList.includes('group-field-panel'), () => h`
      <ce-card class="config-card" style="min-width: 14rem;max-width: 16rem;padding: var(--ce-spacing-sm);" >
        <div style="height: 13rem;overflow:hidden">
          <ce-scroller style="display: block;height:100%" show-track="false">
            <ce-list gap=".2rem" selectable multiple style="min-width: 10rem;padding: var(--ce-spacing-xs);" @select="${this.addGroupField}">
              ${forEach(this.groupableFields, f => f.value, f => h`
              <ce-list-item ripple="false" ?active="${this.groupList.some(x => x.prop == f.value)}" hoverable appearance="pale" value="${f.value}" style="font-size:var(--ce-font-sm-em);">
                <span style="text-overflow: ellipsis;overflow: hidden;line-height: 1.5;">${f.label} </span>
                <ce-icon slot="append" ${show(this.groupList.some(x => x.prop == f.value))} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
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
        <ce-button slot="actions" appearance="pale" color="gray" ${show(this.sortList.length < MAX_SORT_COUNT)} size="sm" style="margin-top: var(--ce-spacing-sm);" icon="c-svg-plus" @click="${this.openSortFieldPanel}">字段</ce-button>
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
    <!-- 冻结面板 -->
    <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="fixed-panel">
      <div>
      ${ifTrue(this.overlayInitedList.includes('fixed-panel'), () => h`
      <ce-card class="config-card" style="overflow: hidden;height:18rem;resize: both;min-width: 14rem;max-height: 50vh;padding: var(--ce-spacing-sm);" ref="${this.fixedPane}" >
        <ce-scroller style="display: block;height:100%" show-track="false">
          <ce-list nav gap=".2rem" selectable style="min-width: 10rem;padding: var(--ce-spacing-xs)" @select="${this.onFixed}">
            <ce-list-header space="compact" style="font-size:var(--ce-font-sm-em);">
              <span>左侧列</span>
              <ce-button appearance="text" color="red" size="sm" style="padding: 0;float: right;" ripple="false" @click="${this.cancelFixed}">取消</ce-button>
            </ce-list-header>
            ${forEach(this.fixedPropList, identity, (prop, i) => h`
            <ce-list-item value="${prop}" appearance="pale" hoverable ?active="${this.fixedIndex === i + 1}" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
              第${i + 1}列
              <ce-icon slot="append" ${show(this.fixedIndex === i + 1)} .svg="${Check}" size="md" ttt="1" style="color: var(--ce-color-primary)"></ce-icon>
            </ce-list-item>
            `)}
          </ce-list>
        </ce-scroller>
      </ce-card>
      `)}
      </div>
    </ce-overlay>
    <!-- 行高面板 -->
    <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="rowheight-panel">
      <div>
      ${ifTrue(this.overlayInitedList.includes('rowheight-panel'), () => h`
      <ce-card class="config-card" style="min-width: 14rem;padding: var(--ce-spacing-sm);" ref="${this.rowHeightPane}" >
        <ce-list nav gap=".2rem" selectable style="min-width: 10rem;padding: var(--ce-spacing-xs)" @select="${this.onRowHeight}">
          <ce-list-header space="compact" style="font-size:var(--ce-font-sm-em);">设置行高</ce-list-header>
          <ce-list-item value="compact" hoverable appearance="pale" ?active="${this.rowHeightType === RowHeightType.Compact}" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon svg="c-svg-row-height-s" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>紧凑
            <ce-icon slot="append" ${show(this.rowHeightType === RowHeightType.Compact)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
          <ce-list-item value="medium" hoverable appearance="pale" ?active="${this.rowHeightType === RowHeightType.Medium}" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon svg="c-svg-row-height-m" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>中等
            <ce-icon slot="append" ${show(this.rowHeightType === RowHeightType.Medium)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
          <ce-list-item value="loose" hoverable appearance="pale" ?active="${this.rowHeightType === RowHeightType.Loose}" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon svg="c-svg-row-height-l" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>宽松
            <ce-icon slot="append" ${show(this.rowHeightType === RowHeightType.Loose)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
        </ce-list>
      </ce-card>
      `)}
      </div>
    </ce-overlay>
    `
  }
  onOverflow(obj: Record<string, any>) {
    let { overflow } = obj
    this.liteMode = overflow
  }
  unselect() {
    this.tableRef.toggleRowSelectionAll(false)
  }
  toggleField(obj: Record<string, any>) {
    let t = obj.target as Toggle
    if (t.disabled) return

    let prop = t.getAttribute('prop')!
    this.tableRef.toggleColumnHide(prop)

    // t.value = !t.value
  }
  toggleAllField() {
    if (this.isAllChecked) {
      this.hiddenList = map(this.tableFields, f => f.prop)

      let propAry = flatMap<any, string>(this.tableFields, f => {
        if (f.hidable) return f.prop
        return []
      })
      this.tableRef.hideColumns(propAry)
    } else {
      this.hiddenList = []
      this.tableRef.hideColumns([])
    }
  }
  onRowHeight(obj: Record<string, any>) {
    let { item } = obj
    this.rowHeightType = item.value
    this.tableRef._setRowHeightType(item.value)
    this.rowHeightPanel.close()
  }
  onFixed(obj: Record<string, any>) {
    let { item } = obj
    this.fixedPanel.close()
    let lastCol = last(this.tableRef.fixedLeftColumns)
    if (lastCol && lastCol.prop === item.value) {
      this.tableRef._fixColumn(item.value, true)
      this.fixedIndex = 0
    } else {
      this.tableRef._fixColumn(item.value)
    }
  }
  cancelFixed() {
    this.fixedPanel.close()
    this.tableRef._fixColumn('', true)
    this.fixedIndex = 0
  }
  bindFieldDrag() {
    const that = this
    uii.newSortable(this.fieldPane.current?.querySelector('ce-list') as HTMLElement, {
      filter: '[unmovable]',
      spill: 'revert',
      handle: 'ce-list-item ce-icon',
      onEnd({ item, from, to }, e) {
        const prevProp = item.previousElementSibling?.getAttribute('key')!
        const colProp = item.getAttribute('key')!
        that.tableRef.moveColumnTo(colProp, prevProp)
      }
    })
  }
  openField(obj: Record<string, any>) {
    Overlay.closeAll()
    if (!this.overlayInitedList.includes('field-panel')) {
      this.overlayInitedList.push('field-panel')

      this.nextTick(() => {
        this.bindFieldDrag()
        this.fieldPanel.openBy(obj.target as Button)
      })
      return
    }

    this.fieldPanel.openBy(obj.target as Button)
  }
  openFixed(obj: Record<string, any>) {
    Overlay.closeAll()
    let x = Math.ceil(this.tableRef.allColumns.length / 2)
    if (x > 10) {
      x = 10
    }
    this.fixedPropList = map(range(x), i => this.tableRef.allColumns[i].prop)
    this.fixedIndex = this.tableRef.fixedLeftColumns.length

    if (!this.overlayInitedList.includes('fixed-panel')) {
      this.overlayInitedList.push('fixed-panel')

      this.nextTick(() => {
        this.fixedPanel.openBy(obj.target as Button)
      })
      return
    }
    this.fixedPanel.openBy(obj.target as Button)
  }
  openRowHeight(obj: Record<string, any>) {
    Overlay.closeAll()
    if (!this.overlayInitedList.includes('rowheight-panel')) {
      this.overlayInitedList.push('rowheight-panel')

      this.nextTick(() => {
        this.rowHeightPanel.openBy(obj.target as Button)
      })
      return
    }
    this.rowHeightPanel.openBy(obj.target as Button)
  }
  openFillColor(obj: Record<string, any>) {
    Overlay.closeAll()
    this.tableRef.TableConfigPane.open(this.tableRef, undefined as any, undefined as any, ColumnConfigPane.FillColor, obj.target)
  }
  //////////////////////////////////////////////////////////////  筛选相关
  cancelFilter() {
    this.filterPanel.close()
    this.filterList = []
    setTimeout(() => {
      this.tableRef._clearFilter()
    }, 50)
  }
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
    // target = target.closest('ce-list')!
    this.tableRef._openFilter(target.getAttribute('value')!, target.dataset.type!, target, true)
  }
  //////////////////////////////////////////////////////////////  分组相关
  openGroup(obj: Record<string, any>) {
    Overlay.closeAll()
    if (!this.overlayInitedList.includes('group-panel')) {
      this.overlayInitedList.push('group-panel')

      this.nextTick(() => {
        this.groupPanel.openBy(obj.target as Button)
      })
      return
    }
    this.groupPanel.openBy(obj.target as Button)
  }
  cancelGroup() {
    this.groupPanel.close()
    this.groupList = []
    setTimeout(() => {
      this.tableRef.setGroup(this.groupList)
    }, 50)
  }
  delGroup(obj: Record<string, any>) {
    let prop = (obj.target as HTMLElement).getAttribute('prop')!
    remove(this.groupList, g => g.prop === prop)

    setTimeout(() => {
      this.tableRef.setGroup(this.groupList)
    }, 50)
  }
  addGroupField(obj: Record<string, any>) {
    let { item } = obj
    if (some(this.groupList, x => x.prop === item.value)) return
    this.groupList.push({
      prop: item.value,
      name: this.tableFields.find(f => f.prop === item.value)?.name,
    })

    this.groupFieldPanel.close()
    setTimeout(() => {
      this.tableRef.setGroup(this.groupList)
    }, 50)
  }
  openGroupFieldPanel(obj: Record<string, any>) {
    if (!this.overlayInitedList.includes('group-field-panel')) {
      this.overlayInitedList.push('group-field-panel')

      this.nextTick(() => {
        this.groupFieldPanel.openBy(obj.target as Button)
      })
      return
    }
    this.groupFieldPanel.openBy(obj.target as Button)
  }
  //////////////////////////////////////////////////////////////  排序相关
  openSort(obj: Record<string, any>) {
    Overlay.closeAll()
    if (!this.overlayInitedList.includes('sort-panel')) {
      this.overlayInitedList.push('sort-panel')

      this.nextTick(() => {
        this.sortPanel.openBy(obj.target as Button)
      })
      return
    }
    this.sortPanel.openBy(obj.target as Button)
  }
  delSort(obj: Record<string, any>) {
    let prop = (obj.target as HTMLElement).getAttribute('prop')!
    this.tableRef._setSort(prop, null)
    if (this.sortList.length < 1) {
      this.sortPanel.close()
    }
  }
  cancelSort() {
    this.sortPanel.close()
    this.sortList = []
    setTimeout(() => {
      this.tableRef._clearSort()
    }, 50)
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
  addSortField(obj: Record<string, any>) {
    let { item } = obj
    this.sortFieldPanel.close()
    setTimeout(() => {
      this.tableRef._setSort(item.value, SortType.Asc)
    }, 50)
  }
  toggleSortType(obj: Record<string, any>) {
    let val = obj.value
    let prop = (obj.target as HTMLElement).dataset.prop!
    setTimeout(() => {
      this.tableRef._setSort(prop, val)
    }, 50)
  }

  //////////////////////////////////// table cbk
  _onTableColumnChange() {
    this._onContainerReady()
  }
  _onContainerReady() {
    this.fixedIndex = this.tableRef.fixedLeftColumns.length
    let colMap = this.tableRef._fieldMap
    this.groupableFields = []
    let hideList = this.tableRef._hiddenFieldList

    this.tableFields = flatMap(this.tableRef.allColumns, col => {
      if (startsWith(col.prop, PRIV_COL_PREF)) {
        return []
      }
      let colEl = colMap.get(col.prop)
      if (colEl?.groupable) {
        if (!this.groupableFields.some(f => f.value === col.prop))
          this.groupableFields.push({
            value: col.prop,
            label: colEl?.label
          })
      }
      if (colEl?.sortable) {
        if (!this.sortableFields.some(f => f.value === col.prop))
          this.sortableFields.push({
            value: col.prop,
            label: colEl?.label
          })
      }
      if (colEl?.filterable) {
        if (!this.filterableFields.some(f => f.value === col.prop))
          this.filterableFields.push({
            value: col.prop,
            label: colEl?.label,
            dataType: colEl.dataType
          })
      }
      if (colEl?.colorable) {
        if (!this.colorableFields.some(f => f.value === col.prop))
          this.colorableFields.push({
            value: col.prop,
            label: colEl?.label
          })
      }
      return {
        movable: colEl?.movable ?? false,
        name: colEl?.label,
        prop: col.prop,
        hidden: includes(hideList, col.prop),
        hidable: colEl?.hidable ?? false
      }
    })
  }
  _onColumnHideChange(columns: string[]) {
    this.hiddenList = columns//clone(this.tableRef._hiddenFieldList)
  }
  _onRowHeightChange(type: string) {
    this.rowHeightType = type
  }
  _onFixedChange(left: string) {
    this.fixedIndex = this.tableRef.allColumns.findIndex(c => c.prop === left)
  }
  _onSortChange(orders: { prop: string, sort: string }[]) {
    let tMap = this.tableRef._fieldMap
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
    this.filterList = flatMap(filters, (v, k) => {
      if (!v) {
        return []
      }
      let obj = parseJSON<{ min: string, max: string }>(v)
      let str = isArray(obj) ? join(obj) : isObject(obj) ? `${obj.min || ''} ~ ${obj.max || ''}` : v
      return {
        prop: k,
        name: this.tableFields.find(f => f.prop === k)?.name,
        search: str
      }
    })
  }
  _onSelectionChange(selection: Record<string, any>) {
    this.selectionSize = size(selection)
    this.selectionTotal = size(this.tableRef.innerData)
  }
  _onFillColorChange(fillColorConditions: Record<string, any>[]) {
    this.fillColorList = fillColorConditions
  }
}