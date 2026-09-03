import { CompElem, createRef, css, csscope, Csscope, debounced, forEach, h, ifElse, ifTrue, model, query, show, slot, state, tag, Template, watch, when } from "compelem";
import { assign, clone, compact, each, except, filter, find, findIndex, first, flatMap, formatDate, get, groupBy, includes, isArray, isBlank, isEmpty, isEqual, isNaN, isObject, isString, last, map, parseJSON, remove, set, split, union, uuid } from "myfx";
import { ControlBox } from "../../../base/ControlBox";
import { AlignType, DataType, FilterType, Operators, SortType, STATS_METRICS, STATS_METRICS_BASE } from "../../../constants";
import { Check, EyeClosed, Group, Pin, SortDown, SortUp } from "../../../icons/icons";
import { Input } from "../../form/input/Input";
import { Overlay } from "../../overlays/overlay/Overlay";
import { ListPicker } from "../../picker/listpicker/ListPicker";
import { MAX_SORT_COUNT, SCROLLER_COL_PROP, Table } from "./Table";
import { ColumnProp, FillColorCondition, MetricType, Operation, TableEvents } from "./types";
const FillColorOperatorsMap: Record<string, any> = {}
/**
 * 表格列弹出框
 * @attrs
 *  prop {string} data key
 *  width {number} 列宽，单位px
 *  stats {boolean} 显示统计信息
 * @slots
 *  - 仅支持嵌套列
 *  header 自定义表头显示
 *  cell 自定义单元格显示（仅支持slot指令)
 *
 * @author holyhigh2
 */
@tag('ce-column-config-pane')
export class ColumnConfigPane extends CompElem {

  static Filter = 1
  static Config = 2
  static Stats = 3
  static FillColor = 4

  filterPane = createRef<HTMLElement>()
  configPane = createRef<HTMLElement>()
  statPane = createRef<HTMLElement>()
  fillColorPane = createRef<HTMLElement>()
  filterPaneSelectPanel = createRef<ListPicker>()
  currentTable: Table
  @query('.fill-color-panel') fillColorPanel: Overlay | undefined
  @query('.filter-panel') filterPanel: Overlay | undefined
  @query('.config-panel') configPanel: Overlay | undefined
  @query('.stats-panel') statsPanel: Overlay | undefined
  @query('.col-align-panel') colAlignPanel: Overlay | undefined

  @state overlayInitedList: string[] = []
  //////////////////////////////////// styles
  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return css`
        .filter-date,
        .filter-datetime{
          width:24rem;
          display:block;
        }
        .config-card ce-list-item:not([active]) ce-icon{
          display:none;
        }
        .config-card.dt-not-tag-text .dt-not-tag-text,
        .config-card.dt-number .dt-number,
        .config-card.dt-text .dt-text,
        .config-card.dt-tag .dt-tag,
        .config-card.dt-user .dt-user,
        .config-card.dt-date .dt-date,
        .config-card.dt-time .dt-time,
        .config-card.dt-datetime .dt-datetime ,
        .config-card.st-asc .st-asc ,
        .config-card.st-desc .st-desc ,
        
        .config-card.scp-filled .scp-filled
        .config-card.scp-not-filled .scp-not-filled
        .config-card.scp-filled-percent .scp-filled-percent
        .config-card.scp-not-filled-percent .scp-not-filled-percent{
          display:block;
        }
        .t-c-dt,.t-c-scp,.t-c-st{
          display:none;
        }
        .ce-fill-color-list{
          width: max-content;
          min-width: 10rem;
          padding-top: var(--ce-spacing-xs);
        }
        .ce-fill-color-list ce-list-item::part(root),
        .ce-fill-color-list ce-list-item::part(heading){
          display:flex;
          gap:.5rem;
        }
        .ce-config-tag-select{
          max-width:15rem !important;
        }
      `
  }

  //////////////////////////////////// props
  @state sortable = false
  @state groupable = false
  @state colorable = false
  @state hidable = false
  @state singleSort = true
  @state sortedSize = 0
  @state settingsColDataType = ''
  @state settingsColProp = ''
  @state filterCondition = ''
  @state configSortedMap: Record<string, string> = {}
  @state configSettingsMap: Record<string, string[]> = {}
  @state statsColStatMap: Record<string, string>
  @state statsColValue = ''
  @state statsFns: any[] = []
  componentStateMap: WeakMap<CompElem, typeof this.statsColStatMap> = new WeakMap()

  @state allKindsOfTags: Record<string, string> = {}
  @state({
    hasChanged(newValue, oldValue, changeChain, subNewValue, subOldValue) {
      //变量只会通过赋值变更，其他变动不触发
      return newValue !== oldValue
    },
  }) tagsOrUsers: Record<string, string>[] = []
  @state filteredTagsOrUsers: string[] = []
  @state filteredTags: string[] = []
  @state tagAppearance = ''
  @state colFilterFill = ''
  __lastColFilterFill = ''

  @state colAlignType: string = ''
  colAlignPane = createRef<HTMLElement>()

  @state fillColorConditions: Array<FillColorCondition> = []

  @state filterText = ''

  fillColorTypes = [
    { value: 'row', label: '整行' },
    { value: 'col', label: '整列' },
    { value: 'cell', label: '单元格' }
  ]
  fillColorColumns: Array<{ value: string, label: string, dataType: string }> = []

  /////////////////////////////////// watches
  @watch('settingsColDataType')
  __watchSettingsColDataType(nv: string) {
    let cl = this.filterPane.current?.classList
    let cl2 = this.configPane.current?.classList
    let cl3 = this.statPane.current?.classList
    // let ks = cl ? Array.from(cl.values()) : null
    let ks = cl?.values() ?? cl2?.values() ?? cl3?.values() ?? []
    Array.from(ks).forEach(k => {
      if (k.indexOf('dt-') > -1) {
        cl?.remove(k)
        cl2?.remove(k)
        cl3?.remove(k)
      }
    })
    cl?.toggle('dt-' + nv, true)
    cl2?.toggle('dt-' + nv, true)
    cl3?.toggle('dt-' + nv, true)
    cl3?.toggle('dt-not-tag-text',
      this.settingsColDataType !== DataType.Tag
      && this.settingsColDataType !== DataType.Text
      && this.settingsColDataType !== DataType.Image
      && this.settingsColDataType !== DataType.User
    )
  }
  @watch(['configSortedMap', 'settingsColProp'], { deep: true })
  __watchConfigSortedMap(nv: Record<string, string>) {
    if (!this.configPane?.current) return

    let ascOrDesc = this.configSortedMap[this.settingsColProp]
    //dom
    this.configPane.current?.querySelectorAll('ce-list.sort-pane ce-list-item').forEach(li => {
      li.toggleAttribute('active', li.getAttribute('name') === ascOrDesc)
    })

    let cl = this.configPane.current!.classList
    let ks = Array.from(cl.values())
    ks.forEach(k => {
      if (k.indexOf('st-') > -1)
        cl.remove(k)
    })
    cl.toggle('st-' + ascOrDesc, true)
  }
  @watch(['statsColStatMap', 'settingsColProp', 'statsColValue'], { deep: true })
  __watchStatsColStatMap(nv: Record<string, string>) {
    if (!this.statPane.current) return

    let cl = this.statPane.current!.classList
    let ks = Array.from(cl.values())
    ks.forEach(k => {
      if (k.indexOf('scp-') > -1)
        cl.remove(k)
    })
    cl.toggle('scp-' + this.statsColValue, true)
  }
  #lastFTU: Array<string>
  @watch('filteredTagsOrUsers')
  __watchFilteredTagsOrUsers(nv: Array<string>) {
    if (isEmpty(nv) && isEmpty(this.#lastFTU)) return
    if (isEqual(nv, this.#lastFTU)) return

    this.onFilterTag(nv)
    this.#lastFTU = nv
  }
  @watch('colFilterFill')
  __watchFilterFill(nv: string, ov: string) {
    // this.onFilterFill(nv)
  }

  @watch('fillColorConditions', { deep: true })
  __watchOp(nv: Array<Record<string, any>>, ov: [], src: string, subValue: string) {
    if (isBlank(subValue)) return

    if (src.length === 3) {
      let condi = nv[parseInt(src[1])]
      let k = src[2]
      if (k === 'operator') {
        condi.tooltip = find(Operators, op => op.value == subValue)?.tooltip
      } else if (k === 'column') {
        let col = this.fillColorColumns.find(col => col.value == subValue)!
        condi.dataType = col.dataType
        let fillColorOperators = flatMap(Operators, op => {
          if (op.applies) {
            return op.applies.includes(col.dataType) ? { label: op.label, tooltip: op.tooltip, value: op.value } : []
          } else {
            return { label: op.label, tooltip: op.tooltip, value: op.value }
          }
        })
        if (!fillColorOperators.some(f => f.value === condi.operator)) {
          condi.operator = ''
        }

        condi.operators = fillColorOperators
        let hasSelection = findIndex(fillColorOperators, op => op.value === condi.operator) > -1
        if (!hasSelection) {
          condi.operator = fillColorOperators[0].value
        }
      }
      if (subValue === '><' || subValue === '⊇' || subValue === '⊉') {
        let newVal: any = []
        if (condi.values && !isArray(condi.values)) {
          newVal.push(condi.values)
        }
        condi.values = newVal
      } else {
        if (isArray(condi.values)) {
          condi.values = condi.values[0]
        }
      }
    }
    setTimeout(() => {
      this.currentTable.setFillColor(this.fillColorConditions)
      setTimeout(() => {
        this.fillColorPanel?.relocate()
      }, 100);
    }, 0);
  }
  //////////////////////////////////// computed

  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args)
  }

  render(): Template {
    return h`
    <!-- 填色面板 -->
    <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="fill-color-panel">
    <div>
    ${ifTrue(this.overlayInitedList.includes('fill-color-panel'), () => h`
      <ce-card class="config-card" style="min-width: 14rem;" ref="${this.fillColorPane}" >
        <header style="display: flex;justify-content: space-between;align-items: center;">
          <div style="font-size:var(--ce-font-sm-em);color: var(--ce-color-text-desc);">设置填色</div>
          <ce-button slot="append" appearance="text" color="red" size="sm" style="padding: 0;" ripple="false" @click="${this.clearFills}">清空</ce-button>
        </header>
        <ce-list class="ce-fill-color-list" gap=".5rem">
          ${forEach(this.fillColorConditions, (condi, i) => i, (condi, i) => h`
            <ce-list-item ripple="false" appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:0;gap:1rem">
              <ce-input-color ${model(condi.color)}></ce-input-color>
              <ce-select ${model(condi.type)} .data="${this.fillColorTypes}" style="width: 6rem;min-width: 6rem;"></ce-select>
              <ce-select ${model(condi.column)} .data="${this.fillColorColumns}" style="width: 8rem;min-width: 8rem;"></ce-select>
              <ce-tooltip .content="${condi.tooltip}" placement="top" ${show(this.fillColorConditions[i].type != 'col')}>
                <ce-select ${model(condi.operator)} .data="${condi.operators}" style="width: 3.5rem;min-width: 3.5rem;">
                </ce-select>
              </ce-tooltip>
              <span ${show(condi.type != 'col' && condi.operator != '∄' && condi.operator != '∃')}>
              ${when(condi.dataType, [
      [(v: string) => v === 'tag' || v === 'user', () => h`
                      ${ifElse(condi.dataType === DataType.Tag,
        () => h`<ce-select class="ce-config-tag-select" collapse-items="3" tags ?multiple="${condi.operator == '⊇' || condi.operator == '⊉'}" .data="${this.getFillColorTags(condi.column, condi.dataType)}" ${model(condi.values)}>
          ${slot((data) => h`<ce-tag color="${data.color}" round="pill" size="md" style="display:inline-block;">${data.label}</ce-tag>`, 'tag')}
          ${slot((data) => h`<ce-tag color="${data.color}" round="pill" size="md" style="display:inline-block;">${data.label}</ce-tag>`, 'option')}
        </ce-select>`
        , () => h`222`)}
                `],
      [(v: string) => v === 'number' && condi.operator == '><', () => h`<ce-input-number-range ${model(condi.values)} style="width: 14rem;min-width: 14rem;" .placeholder="${['最小值', '最大值']}" maxlength="100" clearable></ce-input-number-range>`],
      [(v: string) => (v === 'date' || v === 'datetime') && condi.operator != '><', () => h`<ce-input-date maxlength="12" ${model(condi.values)} clearable style="width: 8rem;min-width: 8rem;"></ce-input-date>`],
      [(v: string) => (v === 'date' || v === 'datetime') && condi.operator == '><', () => h`<ce-input-date-range maxlength="12" ${model(condi.values)} clearable></ce-input-date-range>`],
      [() => true, () => h`<ce-input ${model(condi.values)} style="width: 10rem;min-width: 10rem;" size="md" space="default" maxlength="20" clearable ></ce-input>`]
    ])}
              </span>
              <ce-button slot="append" prop="${condi.id}" appearance="subtle" size="md" @click="${this.delFillColorCondition}" icon="c-svg-close"></ce-button>
            </ce-list-item>
          `)}
        </ce-list>
        <ce-button slot="actions" appearance="pale" color="gray" size="sm" style="margin-top: var(--ce-spacing-md);" icon="c-svg-plus" @click="${this.addFillCondition}">添加条件</ce-button>
      </ce-card>
    `)}
    </div>
    </ce-overlay>
    <!-- 过滤面板 -->
    <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="filter-panel">
    <div>
    ${ifTrue(this.overlayInitedList.includes('filter-panel'), () => h`
      <ce-card class="config-card" style="min-width: 14rem;" ref="${this.filterPane}" >
        <header style="display: flex;justify-content: space-between;align-items: center;">
          <div style="font-size:var(--ce-font-sm-em);color: var(--ce-color-text-desc);">快捷筛选</div>
          <ce-button slot="append" appearance="text" color="red" size="sm" style="padding: 0;" ripple="false" @click="${this.clearInput}">清空</ce-button>
        </header>
        <div class="ce-table-t-c-dt ce-table-dt-number">
          <ce-input-number-range class="ce-table-filter-number" style="width:16rem" .placeholder="${['最小值', '最大值']}" maxlength="100" @change="${this.onFilterNumber}" @clear="${this.onFilterNumber}" clearable></ce-input-number-range>
        </div>
        <ce-input class="ce-table-t-c-dt ce-table-dt-text " class="ce-table-filter-text" hide-hint space="default" maxlength="100" ${model(this.filterText)} clearable @change="${this.onFilterText}" @clear="${this.clearInput}"></ce-input>
        <div class="ce-table-t-c-dt ce-table-dt-date" >
          <ce-input-date-range class="ce-table-filter-date" maxlength="12" @change="${this.onFilterDate}" @clear="${this.onFilterDate}" clearable></ce-input-date-range>
        </div>
        <div class="ce-table-t-c-dt ce-table-dt-time">
          <ce-input-time class="ce-table-filter-time" hide-hint space="compact" clearable maxlength="8" @change="${this.onFilterTime}" @clear="${this.onFilterTime}" ></ce-input>
            ~ 
          <ce-input-time class="ce-table-filter-time" hide-hint space="compact" clearable maxlength="8" @change="${this.onFilterTime}" @clear="${this.onFilterTime}" ></ce-input>
        </div>
        <div class="ce-table-t-c-dt ce-table-dt-datetime" >
          <ce-input-date-range type="datetime" class="ce-table-filter-datetime" maxlength="19" @change="${this.onFilterDateTime}" @clear="${this.onFilterDateTime}" clearable></ce-input-date-range>
        </div>
        <div class="ce-table-t-c-dt ce-table-dt-tag ce-table-dt-user">
          <ce-list-picker multiple filterable .data="${this.tagsOrUsers}" maxHeight="300" ${model(this.filteredTagsOrUsers)} ref="${this.filterPaneSelectPanel}">
            ${slot((data) => h`
              ${ifElse(this.settingsColDataType === DataType.Tag,
      () => h`<ce-tag color="${data.color}" round="pill" appearance="${this.tagAppearance ?? 'pale'}" size="md" style="display:inline-block;max-width:80%">${data.label}</ce-tag>`
      , () => h`<ce-tag round="pill" class="user" size="md" style="display:inline-block;height: 1.6em;max-width:80%;padding-left: 0;overflow: hidden;text-overflow: ellipsis;">
              <ce-avatar style="margin-right: var(--ce-spacing-sm);vertical-align: bottom;height: 1.6rem;width: auto;aspect-ratio:1;" size="xs" ?image="${data.image}"></ce-avatar>
              <span>${data.label}</span></ce-tag>`)}
            `, 'option')}
          </ce-list-picker>
        </div>
        <ce-divider color="Gainsboro" style="margin-top: var(--ce-spacing-sm);"></ce-divider>
        <ce-list nav gap=".2rem" selectable style="min-width: 10rem;padding-top: var(--ce-spacing-xs)" @select="${this.onFilterFill}" ${model(this.colFilterFill, 'select')}>
          <ce-list-item value="${MetricType.Filled}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            ${get(STATS_METRICS_BASE, [MetricType.Filled, 'k'])}
            <ce-icon slot="append" ${show(this.colFilterFill === MetricType.Filled)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
          <ce-list-item value="${MetricType.NotFilled}" hoverable style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            ${get(STATS_METRICS_BASE, [MetricType.NotFilled, 'k'])}
            <ce-icon slot="append" ${show(this.colFilterFill === MetricType.NotFilled)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
        </ce-list>
      </ce-card>
    `)}
    </div>
    </ce-overlay>
    <!-- 操作面板 -->
    <ce-overlay placement="bottom-start" close-on-click opacity="0.25" class="config-panel">
    <div>
    ${ifTrue(this.overlayInitedList.includes('config-panel'), () => h`
      <ce-card class="config-card" style="min-width: 14rem;" ref="${this.configPane}">
        <ce-list class="sort-pane" nav gap=".2rem" selectable style="min-width: 10rem;padding-block: var(--ce-spacing-xs)" @select="${this.onSort}">
          <ce-list-header space="compact" style="font-size:var(--ce-font-sm-em);">快捷操作</ce-list-header>
          <ce-list-item ${show(this.sortable)} ?disabled="${!this.singleSort && this.sortedSize >= MAX_SORT_COUNT && !this.configSortedMap[this.settingsColProp]}" name="${SortType.Asc}" value="${SortType.Asc}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon slot="append" class="ce-table-t-c-st ce-table-st-asc" .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
            <ce-icon .svg="${SortUp}" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>
            按 [
            <span class="ce-table-t-c-dt ce-table-dt-number">0 - 9</span>
            <span class="ce-table-t-c-dt ce-table-dt-text ce-table-dt-tag ce-table-dt-user">A - Z</span>
            <span class="ce-table-t-c-dt ce-table-dt-date ce-table-dt-time ce-table-dt-datetime">早 - 晚</span>] 排序
          </ce-list-item>
          <ce-list-item ${show(this.sortable)} ?disabled="${!this.singleSort && this.sortedSize >= MAX_SORT_COUNT && !this.configSortedMap[this.settingsColProp]}" name="${SortType.Desc}" value="${SortType.Desc}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <div slot="append" >
              <ce-icon class="ce-table-t-c-st ce-table-st-desc" .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
            </div>
            <ce-icon .svg="${SortDown}" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>
            按 [
            <span class="ce-table-t-c-dt ce-table-dt-number">9 - 0</span>
            <span class="ce-table-t-c-dt ce-table-dt-text ce-table-dt-tag ce-table-dt-user">Z - A</span>
            <span class="ce-table-t-c-dt ce-table-dt-date ce-table-dt-time ce-table-dt-datetime">晚 - 早</span>] 排序
          </ce-list-item>
        </ce-list>
        <ce-divider color="Gainsboro"></ce-divider>
        <ce-list nav gap=".2rem" selectable multiple style="min-width: 10rem;padding-top: var(--ce-spacing-xs)" @select="${this.onSettings}">
          ${ifTrue(this.colorable, () => h`
            <ce-list-item selectable="false" value="${Operation.FillColor}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
              <ce-icon svg="c-svg-fill-color" size="xs" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>
              整列填色
            </ce-list-item>
            <ce-divider color="Gainsboro"></ce-divider>
          `)}
          <ce-list-item ${show(this.groupable)} value="${Operation.Group}" ?active="${this.configSettingsMap[this.settingsColProp]?.includes(Operation.Group)}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <div slot="append" >
              ${ifElse(this.configSettingsMap[this.settingsColProp]?.includes(Operation.Group), () => h`<ce-icon .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>`, () => h``)}
            </div>
            <ce-icon .svg="${Group}" size="xs" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>
            按值分组
          </ce-list-item>
          <ce-list-item value="${Operation.Freeze}" ?active="${this.configSettingsMap[this.settingsColProp]?.includes(Operation.Freeze)}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <div slot="append" >
              ${ifElse(this.configSettingsMap[this.settingsColProp]?.includes(Operation.Freeze), () => h`<ce-icon .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>`, () => h``)}
            </div>
            <ce-icon .svg="${Pin}" size="xs" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>
            冻结
          </ce-list-item>
          <ce-list-item class="hide-col" ${show(this.hidable)} value="hide" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon .svg="${EyeClosed}" size="xs" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>
            隐藏
          </ce-list-item>
          <ce-list-item ripple="false" value="${Operation.Align}" hoverable style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)" @click.capture.stop="${this.openAlignPane}">
            <ce-icon svg="c-svg-align-center" size="xs" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>
            对齐方式
            <ce-icon slot="append" svg="c-svg-chevron-right" size="sm" style="color: var(--ce-color-text);"></ce-icon>
          </ce-list-item>
        </ce-list>
      </ce-card>
      `)}
      </div>
    </ce-overlay>
    <!-- 对齐面板 -->
    <ce-overlay placement="right-start" close-on-click opacity="0.25" class="col-align-panel">
      <div>
    ${ifTrue(this.overlayInitedList.includes('col-align-panel'), () => h`
      <ce-card class="config-card" style="min-width: 14rem;max-width: 16rem;" ref="${this.colAlignPane}" >
        <ce-list nav gap=".2rem" class="align-list" selectable style="min-width: 10rem;padding: var(--ce-spacing-xs)" @select="${this.onAlignChange}">
          <ce-list-item value="${AlignType.Justify}" hoverable appearance="pale" ?active="${this.colAlignType === AlignType.Justify}" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon svg="c-svg-align-justify" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>默认
            <ce-icon slot="append" ${show(this.colAlignType === AlignType.Justify)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
          <ce-list-item value="${AlignType.Left}" hoverable appearance="pale" ?active="${this.colAlignType === AlignType.Left}" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon svg="c-svg-align-left-block" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>居左
            <ce-icon slot="append" ${show(this.colAlignType === AlignType.Left)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
          <ce-list-item value="${AlignType.Center}" hoverable appearance="pale" ?active="${this.colAlignType === AlignType.Center}" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon svg="c-svg-align-center-block" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>居中
            <ce-icon slot="append" ${show(this.colAlignType === AlignType.Center)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
          <ce-list-item value="${AlignType.Right}" hoverable appearance="pale" ?active="${this.colAlignType === AlignType.Right}" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon svg="c-svg-align-right-block" size="md" style="color: var(--ce-color-text-secondary);padding-right:var(--ce-spacing-md)"></ce-icon>居右
            <ce-icon slot="append" ${show(this.colAlignType === AlignType.Right)} .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
          </ce-list-item>
        </ce-list>
      </ce-card>
      `)}
      </div>
    </ce-overlay>
    <!-- 统计面板 -->
    <ce-overlay placement="top-end" auto-active close-on-click opacity="0.25" class="stats-panel">
    <div>
    ${ifTrue(this.overlayInitedList.includes('stats-panel'), () => h`
      <ce-card class="config-card" ref="${this.statPane}">
        <ce-list gap=".2rem" nav selectable style="min-width: 10rem;" @select="${this.onStat}" ${model(this.statsColValue, 'select')}>
          <ce-list-header space="compact" style="font-size:var(--ce-font-sm-em);">设置统计指标</ce-list-header>
          ${forEach(this.statsFns, fn => fn.value, fn => h`
            <ce-list-item value="${fn.value}"  hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
              <ce-icon slot="append"  .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
              ${fn.name}
            </ce-list-item>
          `)}
          <ce-divider></ce-divider>
          <ce-list-item value="${MetricType.Filled}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon slot="append" class="ce-table-t-c-scp ce-table-scp-filled" .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
            ${get(STATS_METRICS_BASE, [MetricType.Filled, 'k'])}
          </ce-list-item>
          <ce-list-item value="${MetricType.NotFilled}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon slot="append" class="ce-table-t-c-scp ce-table-scp-not-filled" .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
            ${get(STATS_METRICS_BASE, [MetricType.NotFilled, 'k'])}
          </ce-list-item>
          <ce-list-item value="${MetricType.FilledPercent}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon slot="append" class="ce-table-t-c-scp ce-table-scp-filled-percent" .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
            ${get(STATS_METRICS_BASE, [MetricType.FilledPercent, 'k'])}
          </ce-list-item>
          <ce-list-item value="${MetricType.NotFilledPercent}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            <ce-icon slot="append" class="ce-table-t-c-scp ce-table-scp-not-filled-percent" .svg="${Check}" size="md" style="color: var(--ce-color-primary)"></ce-icon>
            ${get(STATS_METRICS_BASE, [MetricType.NotFilledPercent, 'k'])}
          </ce-list-item>
          <ce-list-item value="${MetricType.None}" hoverable appearance="pale" style="font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
            ${get(STATS_METRICS_BASE, [MetricType.None, 'k'])}
          </ce-list-item>
        </ce-list>
      </ce-card>
      `)}
      </div>
    </ce-overlay>
    `
  }
  configAnchor: HTMLElement
  open(table: Table, prop: string, dataType: string, type: number, btn: HTMLElement, filterCondition?: string, side = false) {
    dataType = dataType || 'text'

    switch (type) {
      case ColumnConfigPane.Filter:
        if (!this.overlayInitedList.includes('filter-panel')) {
          this.overlayInitedList.push('filter-panel')

          this.nextTick(() => {
            this.open(table, prop, dataType, type, btn, filterCondition, side)
          })
          return
        }
        break
      case ColumnConfigPane.Config:
        if (!this.overlayInitedList.includes('config-panel')) {
          this.overlayInitedList.push('config-panel')

          this.nextTick(() => {
            this.open(table, prop, dataType, type, btn, filterCondition, side)
          })
          return
        }
        break;
      case ColumnConfigPane.Stats:
        if (!this.overlayInitedList.includes('stats-panel')) {
          this.overlayInitedList.push('stats-panel')

          this.nextTick(() => {
            this.open(table, prop, dataType, type, btn, filterCondition, side)
          })
          return
        }
        break;
      case ColumnConfigPane.FillColor:
        if (!this.overlayInitedList.includes('fill-color-panel')) {
          this.overlayInitedList.push('fill-color-panel')

          this.nextTick(() => {
            this.open(table, prop, dataType, type, btn, filterCondition, side)
          })
          return
        }
        break;
    }

    this.currentTable = table
    const col = table._fieldMap?.get(prop)
    this.sortable = col?.sortable ?? false
    this.groupable = col?.groupable ?? false
    this.colorable = col?.colorable ?? false
    if (col?.multiple) {
      this.sortable = this.groupable = false
    }
    this.hidable = col?.hidable ?? false
    this.singleSort = table.singleSort

    this.settingsColProp = prop ?? ''
    this.configAnchor = btn

    if (this.settingsColDataType == dataType) {
      this.__watchSettingsColDataType(dataType)
    } else {
      this.settingsColDataType = dataType
    }

    this.statsColStatMap = this.componentStateMap.get(table) || {}
    this.statsColValue = (this.statsColStatMap ?? [])[this.settingsColProp] ?? ''
    if (this.statsColValue === MetricType.None) {
      this.statsColValue = ''
    }

    this.__lastColFilterFill = ''
    this.colFilterFill = table.__filterFillMap[prop] ?? ''

    if (ColumnConfigPane.Filter === type) {
      if (dataType === DataType.Tag) {
        this.tagAppearance = col!.tagAppearance
        this.allKindsOfTags = table._tagColorMap.get(prop)!
        this.tagsOrUsers = map(this.allKindsOfTags, (v, k) => {
          return {
            label: k,
            value: k,
            color: v
          }
        })
        table.emit(TableEvents.SetFilterList, {
          type: dataType, prop, list: this.tagsOrUsers, setter: (items: Record<string, any>[]) => {
            this.tagsOrUsers = items
          }
        })
        //非对象颜色定义仅支持字符搜索
        if (!isObject(this.allKindsOfTags)) {
          this.settingsColDataType = dataType = DataType.Text
        }
      } else if (dataType === DataType.User) {
        let users = groupBy(table.data, row => {
          let val = row[prop]
          if (isArray<any>(val)) {
            return val[0]
          }
          return val
        })
        set(users, null + '', null)
        set(users, undefined + '', null)
        let ca = col?.avatarField
        let cf = col?.avatarColor

        this.tagsOrUsers = flatMap(users, (v, k) => {
          if (!v) return []
          let rs = {
            label: k,
            value: k,
            image: '',
            color: cf!
          }
          if (ca) {
            let imgs = get<any>(v[0], ca!)
            if (isArray<string>(imgs)) {
              rs.image = imgs[0]
            } else if (isString(imgs)) {
              rs.image = imgs
            }
          }
          return rs
        }) as any

        table.emit(TableEvents.SetFilterList, {
          type: dataType, prop, list: this.tagsOrUsers, setter: (items: Record<string, any>[]) => {
            this.tagsOrUsers = items
          }
        })

        if (this.filterPaneSelectPanel.current && this.filterPaneSelectPanel.current.scroller) this.filterPaneSelectPanel.current.scroller.y = 0
      }
      if (dataType === DataType.Tag || dataType === DataType.User) {
        //更新选中值
        let conditions = groupBy((table.__tableBar ?? table.__boardBar).filterList, v => v.prop)
        if (conditions[prop]) {
          this.filteredTagsOrUsers = compact(split(conditions[prop][0].search, ','))
        } else {
          this.filteredTagsOrUsers = []
        }
      }
    }

    switch (type) {
      case ColumnConfigPane.Filter:
        let input = this.filterPane.current?.querySelector('.ce-table-dt-' + dataType)

        if (!this.overlayInitedList.includes('filter-panel'))
          this.overlayInitedList.push('filter-panel')

        if (input?.classList.contains('dt-tag')) {
          this.filteredTags = parseJSON<string[]>((filterCondition + '') || '[]')
        } else if (input instanceof Input) {
          // input.value = filterCondition ?? ''
          this.filterText = filterCondition ?? ''
        } else {
          let inputRangeEl = input?.querySelector('ce-input-number-range,ce-input-date-range') as any
          if (inputRangeEl) {
            let condi: Record<string, string> = parseJSON<{}>(filterCondition ?? '{}')
            inputRangeEl.value = [condi.min ?? '', condi.max ?? '']
          }
        }
        this.nextTick(() => {
          this.filterPaneSelectPanel.current?.resetVirtualized()
        })
        this.filterPanel?.openBy(btn, side ? 'right-start' : undefined)
        break;
      case ColumnConfigPane.Config:
        this.configPanel?.openBy(btn)
        break;
      case ColumnConfigPane.Stats:
        let fns = map(STATS_METRICS[this.settingsColDataType], ({ k }, fnName) => {
          return { name: k, value: fnName }
        })

        table.emit(TableEvents.BeforeDoStats, {
          fns: Object.freeze(fns), setter: (fnAry: typeof fns) => {
            fns = fnAry
            assign(table.extStatsMap, fns)
          }
        })

        this.statsFns = fns
        this.statsPanel?.openBy(btn)
        break;
      case ColumnConfigPane.FillColor:
        let allTypes = union(...map(Operators, op => op.applies))
        each(allTypes, (t: string) => {
          FillColorOperatorsMap[t] = filter(Operators, op => op.applies ? op.applies.includes(t) : true)
        })
        this.fillColorConditions = clone(table.fillColorConditions)

        this.fillColorColumns = flatMap<any>(table.getAllValidCols(SCROLLER_COL_PROP, ColumnProp.Index, ColumnProp.Selection), col => col.colorable ? ({ value: col.prop, label: col.label, dataType: col.dataType }) : [])
        this.fillColorPanel?.openBy(btn)
        break;
    }
    // this.settingsColProp = ''
    this.nextTick(() => {
      this.forceUpdate()
    })

    if (!prop) return

    //首次初始化
    if (!this.configSettingsMap[this.settingsColProp]) {
      this.configSettingsMap[this.settingsColProp] = []
    }

    //初始化sort
    this.configSortedMap = {}
    each(table.sortOrders, ({ prop, sort }) => {
      this.configSortedMap[prop] = sort
    })
    this.sortedSize = table.sortOrders.length

    //初始化分组
    let groupCols = map(table.groupOrders, o => o.prop)
    if (groupCols.length > 0 && includes(groupCols, prop) && !this.configSettingsMap[prop].includes(Operation.Group)) {
      this.configSettingsMap[prop].push(Operation.Group)
    } else if (groupCols.length < 1) {
      each(this.configSettingsMap, (v: string[]) => {
        remove(v, x => x === Operation.Group)
      })
    } else {
      each(this.configSettingsMap, (v: string[], p) => {
        if (includes(groupCols, prop)) return
        remove(v, x => x === Operation.Group)
      })
    }

    //初始化隐藏
    let hiddenCols = table._hiddenFieldList
    if (!includes(hiddenCols, prop) && this.configSettingsMap[prop].includes('hide')) {
      remove(this.configSettingsMap[prop], x => x === Operation.Hide)
      this.configPane.current?.querySelector('.hide-col')?.removeAttribute('active')
    }

    //初始化对齐
    if (table.columnAlign && table.columnAlign[prop]) {
      this.colAlignType = table.columnAlign[prop]!
    } else {
      this.colAlignType = AlignType.Justify
    }
  }
  /////////////////////////////////////////////////// filters
  onFilterFill() {
    let table = this.currentTable
    let val = this.colFilterFill
    if (val === this.__lastColFilterFill) {
      val = this.colFilterFill = ''
    }
    this.__lastColFilterFill = val
    table?._setFilterFill(this.settingsColProp, val)
  }
  onFilterDate(obj: Record<string, any>) {
    return this._onFilterDateTime('d', obj)
  }
  onFilterDateTime(obj: Record<string, any>) {
    return this._onFilterDateTime('m', obj)
  }
  onFilterTime() {
    let inputs = this.filterPane.current?.querySelectorAll<HTMLInputElement>('ce-input.filter-time')!
    let minV = first<HTMLInputElement>(inputs)!.value
    let maxV = last<HTMLInputElement>(inputs)!.value
    this.filterCondition = `{ min: "${minV}", max: "${maxV}" } `
    let table = this.currentTable
    table?._setFilter(this.settingsColProp, FilterType.Time, this.filterCondition)
  }
  _onFilterDateTime(type: string, obj: Record<string, any>) {
    let filterType = ''
    if (type === 'm') filterType = 'datetime'
    if (type === 'd') filterType = 'date'
    let { value } = obj
    let minV = formatDate(value[0], type === 'd' ? 'yyyy/MM/dd' : 'yyyy/MM/dd HH:mm')
    let maxV = formatDate(value[1], type === 'd' ? 'yyyy/MM/dd' : 'yyyy/MM/dd HH:mm')
    if (isBlank(minV) && isBlank(maxV)) {
      this.filterCondition = ''
      // return
    } else {
      this.filterCondition = `{ min: "${minV}", max: "${maxV}", type: "${type}" } `
    }

    let table = this.currentTable
    table?._setFilter(this.settingsColProp, FilterType.DateTime, this.filterCondition)
  }
  onFilterNumber(obj: Record<string, any>) {
    let { value } = obj
    let minV = value[0]
    let maxV = value[1]
    this.filterCondition = isNaN(minV) && isNaN(maxV) ? '' : `{ min:${minV || '""'}, max:${maxV || '""'} } `
    let table = this.currentTable
    table?._setFilter(this.settingsColProp, FilterType.Number, this.filterCondition)
  }
  onFilterText(obj: Record<string, any>) {
    let { value } = obj
    this.filterCondition = value
    let table = this.currentTable
    this.filterPanel?.close()
    setTimeout(() => {
      table?._setFilter(this.settingsColProp, FilterType.Text, this.filterCondition)
    }, 50)
  }
  onFilterTag(selection: string[]) {
    this.filterCondition = isEmpty(selection) ? '' : JSON.stringify(selection)
    let table = this.currentTable
    this.filteredTags = selection

    setTimeout(() => {
      table?._setFilter(this.settingsColProp, this.settingsColDataType as any, this.filterCondition)
    }, 50)
  }
  clearInput() {
    let inputs = this.filterPane.current?.querySelectorAll<ControlBox>(`
      .t-c-dt.dt-${this.settingsColDataType} ce-input-number-range,
      .t-c-dt.dt-${this.settingsColDataType} ce-input,
      .t-c-dt.dt-${this.settingsColDataType} ce-input-date-range,
      .t-c-dt.dt-${this.settingsColDataType} ce-input-time`)

    inputs?.forEach(el => {
      el.clear()
    })
    this.colFilterFill = ''
    this.onFilterFill()
    this.filterCondition = ''
    if (this.settingsColDataType === DataType.Tag || this.settingsColDataType === DataType.User) {
      this.filteredTags = []
      this.filteredTagsOrUsers = []
    }
    let table = this.currentTable

    this.filterPanel?.close()
    setTimeout(() => {
      table?._setFilter(this.settingsColProp, null, '')
    }, 50)
  }
  /////////////////////////////////////////////////// configs
  onSort(obj: Record<string, any>) {
    this.configPanel?.close()

    let { item } = obj
    let table = this.currentTable

    //todo configSortedMap 需要在监听sort事件中更新
    setTimeout(() => {
      if (this.configSortedMap[this.settingsColProp] != item.value) {
        this.configSortedMap[this.settingsColProp] = item.value
        table._setSort(this.settingsColProp, item.value)
      } else {
        this.configSortedMap[this.settingsColProp] = ''
        table._setSort(this.settingsColProp, null)
      }
    }, 100);
  }
  onSettings(obj: Record<string, any>) {
    let { selection, item } = obj
    let table = this.currentTable
    let settings = selection//map(keys(selection), (item: ListItem) => item.value)
    let lastSettings = this.configSettingsMap[this.settingsColProp]
    let ex = except(settings, lastSettings ?? [])
    if (isEmpty(ex) && settings.length > 0) {
      remove(lastSettings, x => x === settings[0])
      this.configSettingsMap[this.settingsColProp] = clone(lastSettings)
      this.configPanel?.close()
      if (item.value === Operation.Group) {
        table._toggleGroupColumn(this.settingsColProp)
      }
      return
    }

    if (includes(item.value, Operation.Freeze)) {
      let clear = includes(lastSettings, Operation.Freeze)
      table._fixColumn(this.settingsColProp, clear)
      if (clear) {
        remove(settings, x => x === Operation.Freeze)
        // this.configSettingsMap[this.settingsColProp] = clone(lastSettings);
      }
    } else if (includes(item.value, Operation.Hide)) {
      table._hideField(this.settingsColProp)
    } else if (includes(item.value, Operation.Group)) {
      table._toggleGroupColumn(this.settingsColProp)
    } else if (includes(item.value, Operation.FillColor)) {
      this.open(table, this.settingsColProp, this.settingsColDataType, ColumnConfigPane.FillColor, this.configAnchor)
      this.addFillCondition(this.settingsColProp)
    }
    this.configSettingsMap[this.settingsColProp] = clone(settings)
    this.configPanel?.close()
  }
  /////////////////////////////////////////////////// stats
  @debounced(500)
  onStat(e?: Record<string, any> | Table) {
    let table = this.currentTable || e
    let statsColStatMap: Record<string, any> | undefined = this.componentStateMap.get(table)
    //初始化
    if (!statsColStatMap) {
      this.statsColStatMap = statsColStatMap = {}
      this.componentStateMap.set(table, statsColStatMap)
    } else {
      this.statsColStatMap = statsColStatMap
    }

    let prop
    if (e instanceof Table) {
      table._columnFootMap.forEach(cf => {
        if (isString(cf.stats) && cf.stats !== 'none') {
          statsColStatMap[cf.prop] = cf.stats
        }
      })
      if (isEmpty(statsColStatMap)) return;
    } else {
      let { item } = e!
      let statType = item.value
      prop = this.settingsColProp
      statsColStatMap[prop] = statType
      // 这里需要直接调用组件的更新props方法，该方法用于在组件原生环境调用时更新props
      // set(table._columnFootMap.get(prop)!, 'stats', statType)
      table._columnFootMap.get(prop)?.updateProps({ stats: statType })
    }

    table._setStat(statsColStatMap, STATS_METRICS_BASE, STATS_METRICS, prop)
    this.statsPanel?.close()
  }
  /////////////////////////////////////////////////// align
  openAlignPane(obj: Record<string, any>) {
    if (!this.overlayInitedList.includes('col-align-panel')) {
      this.overlayInitedList.push('col-align-panel')

      this.nextTick(() => {
        this.colAlignPanel?.openBy(obj.target as HTMLElement)
      })
      return
    }
    this.colAlignPanel?.openBy(obj.target as HTMLElement)
  }
  onAlignChange(obj: Record<string, any>) {
    let { selection } = obj
    Overlay.closeAll()
    let table = this.currentTable
    table._setAlign(this.settingsColProp, selection[0])
  }
  /////////////////////////////////////////////////// fill color
  getFillColorTags(prop: string, dataType: string) {
    this.allKindsOfTags = this.currentTable._tagColorMap.get(prop)!
    let rs = map(this.allKindsOfTags, (v, k) => {
      return {
        label: k,
        value: k,
        color: v
      }
    })
    return rs
  }
  clearFills() {
    let table = this.currentTable
    table.clearFillColor()
    this.fillColorConditions = []

    setTimeout(() => {
      this.currentTable.setFillColor(this.fillColorConditions)
      setTimeout(() => {
        this.fillColorPanel?.relocate()
      }, 100);
    }, 0);
  }
  delFillColorCondition(obj: Record<string, any>) {
    let fcid = obj.target.getAttribute('prop')

    this.currentTable.delFillColorCondition(fcid)

    let table = this.currentTable
    this.fillColorConditions = table.fillColorConditions
  }
  addFillCondition(prop?: string) {
    if (!isString(prop)) prop = ''

    this.currentTable.addFillCondition({
      id: uuid(),
      type: 'col',
      color: '',
      column: prop ?? this.settingsColProp ?? '',
      operator: '',
      tip: '',
      values: ''
    })

    let table = this.currentTable
    this.fillColorConditions = table.fillColorConditions
  }
}