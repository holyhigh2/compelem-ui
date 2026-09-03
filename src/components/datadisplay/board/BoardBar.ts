import { computed, createRef, css, Csscope, csscope, h, model, prop, query, show, state, tag, Template, watch } from "compelem";
import { flatMap, includes, isArray, isBoolean, isEmpty, isObject, join, map, parseJSON } from "myfx";
import { BarActions } from "../../../base/BarActions";
import { tooltip } from "../../../directives/tooltip/Tooltip";
import { Field } from "../../base/Field";
import { Button } from "../../button/Button";
import { Overlay } from "../../overlays/overlay/Overlay";
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

  @state titleField: string
  @state showLabel: boolean
  @state showLabelMargin: boolean
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
  watchShowLabel(nv: boolean) {
    this.boardRef.updateProps({ showLabel: nv })
  }
  @watch('showLabelMargin')
  watchShowLabelMargin(nv: boolean) {
    this.boardRef.updateProps({ showLabelMargin: nv })
  }
  @watch('showCompact')
  watchShowCompact(nv: boolean) {
    this.boardRef.updateProps({ showCompact: nv })
  }
  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args)
  }
  mounted(): void {
    this.boardRef = (this.wrapperComponent ? this.wrapperComponent.shadowRoot! : document.body).querySelector<Board>(this.target)!

    if (this.boardRef) {
      this.titleField = this.boardRef.titleField
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
        <ce-button ${show(this.showControlField)} appearance="${!this.isAllChecked ? 'pale' : 'subtle'}" icon="c-svg-eye-closed" size="${this.size}" color="${!this.isAllChecked ? 'info' : 'rgba(0,0,0,.65)'}" @click="${this.openField}">隐藏字段</ce-button>
        <ce-button ${show(this.showControlFilter && !isEmpty(this.filterableFields))} appearance="${this.filterList.length > 0 ? 'pale' : 'subtle'}" icon="c-svg-filter-list-light" size="${this.size}" color="${this.filterList.length > 0 ? 'info' : 'rgba(0,0,0,.65)'}" @click="${this.openFilter}">筛选</ce-button>
        <ce-button ${show(this.showControlSort && !isEmpty(this.sortableFields))} .appearance="${this.sortList.length > 0 ? 'pale' : 'subtle'}" icon="c-svg-sort" size="${this.size}" .color="${this.sortList.length > 0 ? 'info' : 'rgba(0,0,0,.65)'}"  @click="${this.openSort}">
          <span ${show(this.sortList.length > 0)} style="margin-right:var(--ce-spacing-sm);">${this.sortList.length}</span> 排序
        </ce-button>
        <ce-button ${show(this.showControlAppearance)} appearance="subtle" icon="c-svg-brush-broad" size="${this.size}" @click="${this.openAppearance}" ${tooltip({ content: '外观', placement: 'top' })}></ce-button>
      </span>
    </ce-toolbar>

    <!-- 外观面板 -->
    <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="ce-board-appearance-panel" waiguan>
      <ce-card class="config-card" style="min-width: 14rem;padding: var(--ce-spacing-sm);" ref="${this.appearancePane}" >
        <ce-list gap=".2rem" style="min-width: 10rem;padding: var(--ce-spacing-xs)">
          <ce-list-header space="compact" style="font-size:var(--ce-font-sm-em);">
            外观设置
          </ce-list-header>
          <ce-list-item ripple="false" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            显示风格
            <ce-toggle slot="append" size="md" activeText="紧凑" inactiveText="宽松" style="color: var(--ce-color-primary)" ${model(this.showCompact)}></ce-toggle>
          </ce-list-item>
          <ce-list-item ripple="false" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            显示字段名
            <ce-toggle slot="append" size="sm" style="color: var(--ce-color-primary)" ${model(this.showLabel)}></ce-toggle>
          </ce-list-item>
          <ce-list-item ripple="false" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            字段间距
            <ce-toggle slot="append" size="sm" style="color: var(--ce-color-primary)" ${model(this.showLabelMargin)}></ce-toggle>
          </ce-list-item>
          <ce-divider></ce-divider>
          <ce-list-header space="compact" style="font-size:var(--ce-font-sm-em);">
            卡片标题
          </ce-list-header>
          <ce-list-item ripple="false" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-select .data="${map(this.allFields, f => ({ value: f.prop, label: f.label }))}" ${model(this.titleField)}></ce-select>
          </ce-list-item>
        </ce-list>
      </ce-card>
    </ce-overlay>
     ${super.render()}
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
    this.allFields = flatMap(this.boardRef._fieldMap, (field, prop) => {

      if (field?.sortable) {
        if (!this.sortableFields.some(f => f.value === field.prop))
          this.sortableFields.push({
            value: field.prop,
            label: field?.label
          })
      }
      if (field?.filterable) {
        if (!this.filterableFields.some(f => f.value === field.prop))
          this.filterableFields.push({
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