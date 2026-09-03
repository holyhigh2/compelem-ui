import { computed, csscope, Csscope, debounced, emits, forEach, h, ifElse, ifTrue, model, prop, query, QueryCache, show, state, styles, tag, Template, watch } from "compelem";
import { clone, cloneDeep, compact, concat, each, eq, filter, find, first, flatMap, get, isArray, isDefined, isEmpty, isEqual, isNumber, isObject, isUndefined, map, range, reject, size, some, test, values } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { Check, Question } from "../../../icons/icons";
import { Virtualized } from "../../../mixins/Virtualized";
import { Scroller } from "../../datadisplay/scroller/Scroller";
import { Input } from "../../form/input/Input";
import { List } from "../../layout/list/List";
import style from "./style.scss?tmpl";
export const AVAILABLE_ROW_TAG = 'available'
interface Option {
  value: any;
  label: string;
  selected: boolean
  tooltip?: string
}
/**
 * 列表数据拾取
 * 支持slot/data方式定义数据
 * optgroup标签分组开启后，非分组标签会忽略
 * @props
 *  data {array|object} 列表数组，格式[{value,label,selected,tooltip}]。如果值类型为对象表示分组数据，格式 {groupLabel: [{value,label,selected,tooltip}]}。当slot有内容时，data属性无效
 *  multiple {boolean} 是否可多选，默认false
 *  limit {number} 多选时允许的最大项，小于1表示不限制。默认0
 *  clearable {boolean} 是否可清除，默认 true
 *  filterable {boolean} 是否可过滤，默认 false
 *  maxHeight {number} 最大高度，超过会显示滚动条，默认320
 *  height {number} 固定高度，不设置时根据内容自动变动
 *  value model属性，受控。单选时字符串，多选时数组
 *  gap {number} 行间距，单位px。默认3
 * @events
 *  change({label,value}) 选中变更时触发
 *  clickoption({label,value}) 点击某个选项时触发
 *  filter({value}) 过滤时触发
 *  ready() 虚拟列表首次构建完成后触发
 * @slots
 *  default 内部可使用option/optgroup标签自定义内容样式。仅支持一层optgroup
 *  option(data) 自定义选项
 * @author holyhigh2
 */
@emits('change', 'clickoption', 'filter', 'ready', 'update:value')
@tag("ce-list-picker")
export class ListPicker extends Virtualized(AppearanceElem) {
  __formatter: Function;
  //////////////////////////////////// props
  @prop clearable = true;
  @prop multiple = false;
  @prop filterable = false;
  @prop readonly = false;
  @prop limit = 0;
  @prop gap = 3

  @prop rowHeight = 32
  @prop maxHeight = 10 * this.rowHeight
  @prop({
    type: [String, Array, Number], hasChanged(newValue: any, oldValue: any, changeChain: string[]) {
      if (isArray(newValue) && isArray(oldValue)) {
        return !eq(newValue, oldValue)
      } else {
        return newValue != oldValue
      }
    }, isValid(value: any, props?: Record<string, any>) {
      if (isUndefined(props?.multiple)) return true;
      return props?.multiple && isDefined(value) ? isArray(value) : true;
    }, model: true
  }) value: string | Array<string>;
  //单项列表/分组列表数据
  @prop({
    type: [Array, Object], shallow: true
  }) data: Record<string, any>[] | Record<string, Record<string, any>[]> = [];
  activeColor = '#2196f3'

  //已选中标签
  @state({
    hasChanged(nv, ov) {
      return !isEqual(nv, ov)
    }
  }) selectLabelAry: Array<string> = [];
  @state private __filterValue = '';
  @state private groupData: Record<string, any[]> = {}
  @state renderData: typeof this.data
  @state({ prop: 'rowHeight' }) vRowHeight = 0
  @state({ prop: 'value' }) selectedValue: typeof this.value

  selection: Record<string, []> = {}
  rounded = true

  @query('slot')
  slotEl: HTMLSlotElement;
  @query('ce-list')
  listEl: List;
  @query('ce-input')
  inputEl: Input

  //virtualized
  @state vScrollHeight = 0
  @state vCachedRows = 0
  @state sHeight = 0
  @state showTrack = true
  @query('ce-scroller', QueryCache.ONCE) scroller: Scroller
  @query('#vpillar') vPillar: HTMLElement = document.body
  @query('.ce-list-picker-list-container') container: HTMLElement

  connectedCallback() {
    super.connectedCallback()
    // Virtualized mixin declares vRowHeight: number without initializer; under useDefineForClassFields
    // the @state({prop:'rowHeight'}) class field creates an own property vRowHeight=0 that shadows
    // the @state getter/setter, so updateV() divides by 0. Sync from rowHeight here.
    this.vRowHeight = this.rowHeight || 32
  }

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  //////////////////////////////////// computed
  //实际渲染列表
  @computed
  get filteredData() {
    let fv = this.__filterValue;
    if (size(this.renderData) < 1) return []

    if (!isEmpty(this.groupData)) {
      let rs: typeof this.groupData = {}
      this.selection = {}
      each(this.groupData, (gd, k: string) => {
        let filtered = filter(gd, item => test(item.label, fv, 'i'))
        if (!isEmpty(filtered)) {
          rs[k] = filtered;
          this.selection[k] = []
        }
      })

      return rs;
    }
    let rs = filter(this.renderData, item => test(item.label, fv, 'i'))

    let h = this.rowHeight * size(rs)
    if (h > this.maxHeight) h = this.maxHeight
    if (h < 3 * this.rowHeight) h = 3 * this.rowHeight
    // this.renderRoot.style.height = h + 'px'
    this.nextTick(() => {
      if (this.vPillar)
        this.updateV(size(rs), this.__viewportH())
    })

    return rs
  }
  /////////////////////////////////// watches
  @watch('gap', { immediate: true })
  watchGap(nv: number) {
    this.vRowGap = nv
  }
  @watch('data', { immediate: true })
  watchData(nv: Record<string, any>[] | Record<string, Record<string, any>[]>) {
    if (!isEmpty(this.slots.default)) return;
    this.renderData = clone(nv)
  }
  @watch('renderData', { immediate: true })
  watchRenderData(nv: Record<string, any>[] | Record<string, Record<string, any>[]>) {
    if (isObject(nv) && !isArray(nv)) {
      this.groupData = cloneDeep(nv);
    }
    if (this.selectedValue ?? this.value)
      this.watchValue(this.selectedValue ?? this.value, '')

    if (this.scroller)
      this.nextTick(() => {
        this.refreshView()
        this.scroller.calcBounding?.()
        this.updateV(size(this.filteredData), this.__viewportH())
      })
  }
  @watch('value')
  watchV(nv: any) {
    this.selectedValue = nv ?? (this.multiple ? [] : '')
  }
  @watch(['value', 'selectedValue'])
  watchValue(nv: any, ov: any) {
    if (!isObject(nv) && nv === ov) return;
    if (isArray(nv) && isEqual(nv, ov)) {
      return
    }

    let data = isArray(this.renderData) ? this.renderData : concat(...values(this.groupData));
    if (isArray(nv)) {
      this.selectLabelAry = compact(flatMap(data, d => nv.includes(d.value) ? d.label : []));
    } else {
      let s = find(data, d => d.value == nv)
      if (this.multiple) {

      } else {

      }
      if (get<string>(s, 'label', '') != get<string>(this.selectLabelAry, 0, ''))
        this.selectLabelAry = s ? compact([s.label]) : [];
    }
  }
  @watch('selectLabelAry', { deep: true })
  watchChange(nv: any, ov: any) {
    if (isEmpty(this.selectLabelAry) && isEmpty(ov)) return;

    let label = this.multiple ? this.selectLabelAry : this.selectLabelAry[0];
    let data = isArray(this.renderData) ? this.renderData : concat(...values(this.groupData));
    let value = this.multiple ? map(this.selectLabelAry, l => find(data, { label: l }).value) : get(find(data, { label: this.selectLabelAry[0] }), 'value', '');
    // if (!isEqual(nv, ov))
    this.emit('change', { label, value })
  }
  //////////////////////////////////// lifecycles
  mounted(): void {
    this.resetVirtualized()
    if (isNumber(this.height))
      this.renderRoot!.style.height = this.height + 'px'
  }
  render(): Template {
    return h`
    <selection class="ce-list-picker" @resize.debounce:200="${this.onResize}">
      ${ifTrue(this.filterable, () => h`
        <ce-input ?readonly="${this.readonly}" inside clearable unhoverable @mousedown="${this.onFilterClick}" @mouseenter="${this.onFilterEnter}" @input.debounce:300="${this.onFilterInput}" @clear="${this.onFilterClear}">
          <ce-icon class="ce-list-picker-caret" ${show(!this.inputEl?.value)} slot="append" .svg="${Question}" ></ce-icon>
        </ce-input>
      `)}
      <main ${styles({
      'flex-direction': isEmpty(this.filteredData) ? 'column' : 'row'
    })}>
      <div class="ce-list-picker-select-item is-empty" ${show(isEmpty(this.filteredData))} unhoverable style="display:block;cursor:auto">无可选项</div>
      ${ifElse(isEmpty(this.groupData), () => this._renderList(), () => this._renderGroup())}
      </main>
    </selection>
    <slot style="display:none"></slot>
    `;
  }
  _renderList() {
    if (this.sHeight < 1) {
      this.sHeight = this.rowHeight * 3
    }
    if (!isArray(this.filteredData)) return h``
    return h`
        <ce-scroller wheel-step="80" @scroll="${this.onScroll}" direction="v" s-height="${this.sHeight}" .showTrack="${this.showTrack}">
          <ce-list class="ce-list-picker-list-container" nav selectable gap="${this.gap}px" style="min-width: 10rem;" ${model(this.selectedValue, 'select')} 
          @select="${this.onSelect}" @mutate.child.debounce:100="${this.onListReady}" ?multiple="${this.multiple}">
            <div id="vpillar"></div>
            ${forEach(range(this.vCachedRows), (row, i) => i, (row, i) => h`
              <ce-list-item hoverable appearance="pale" style="height:${this.rowHeight}px;font-size:var(--ce-font-sm-em);padding-inline:var(--ce-spacing-md)">
                <span class="ce-list-picker-label"></span>
                <span class="ce-list-picker-check-icon" slot="append">
                  <ce-icon svg="c-svg-check" size="lg"></ce-icon>
                </span>
              </ce-list-item>
            `)}
          </ce-list>
        </ce-scroller>
    `
  }
  _renderGroup() {
    return h`
      ${forEach((this.filteredData), (gd, k) => k, (gd, k: string) => h`
        <ce-panel title="${k}" shadow="never" style="--padding:0.5rem">
          <ce-list size="sm" space="compact" max-rows="${this.maxRows}" selectable gap=".1rem" appearance="text">
          ${forEach(gd, li => li.key ?? li.label, (li: any) => h`
            <ce-list-item active-color="${this.activeColor}" class="ce-list-picker-select-item" appearance="text" .value="${li.value}" 
             ?disabled="${li.disabled}" data-label="${li.label}" >
              <span class="ce-list-picker-label">${this.__formatter ? this.__formatter(li) : li.label}</span>
              <span class="ce-list-picker-check-icon" slot="append">
                <ce-icon .svg="${Check}" ${show(this.selectLabelAry.includes(li.label))} size="lg"></ce-icon>
              </span>
            </ce-list-item>
          `)}
          </ce-list>
        </ce-panel>
      `)}
    `
  }

  slotChange(slot: HTMLSlotElement, name: string): void {
    this.__updateDataList(this.slotEl)
  }

  //////////////////////////////////// methods
  //虚拟化
  lastOH = 0
  /**
   * 真实滚动视口高度。
   * 不得用 renderRoot(selection).offsetHeight 采样：双根模板下它是 .ce-list-picker 元素，
   * 数据就位前高度≈padding(~12-20px)，会使 updateV 算出 vViewRows=1 / vCachedRows 过小，
   * 导致视口底部空白、滚动后行带缺失（回收窗口只有 cached-2*buffer 行宽）。
   */
  __viewportH(): number {
    const sh = this.scroller ? this.scroller.offsetHeight : 0
    if (sh > 0) return sh
    const rh = this.renderRoot ? this.renderRoot.offsetHeight : 0
    return rh > 0 ? rh : this.rowHeight * 3
  }
  onResize() {
    let roh = this.__viewportH()
    if (roh === this.lastOH) return

    this.updateV(size(this.filteredData), roh)
    this.lastOH = roh
  }
  #isFirstReady = false
  onListReady() {
    if (!this.isMounted) return;

    let vList = Array.from<HTMLElement>(this.container.querySelectorAll('ce-list-item'))

    let rowIndexAry = this.initV(vList, this.scroller.y)
    this.__fillCells(this.vList, rowIndexAry)
    // 兜底：行渲染完成后用真实视口高度重算虚拟参数。
    // 不能依赖 @resize —— 框架对每个元素的首个 RO 回调按初始基线跳过，且数据在首帧内就位时
    // selection 的尺寸变化会被合并进该回调，onResize 永不触发；而初始采样时 selection 尚未撑开。
    let vh = this.__viewportH()
    if (vh !== this.lastOH) {
      this.updateV(size(this.filteredData), vh)
      this.lastOH = vh
    }
    if (!this.#isFirstReady) {
      this.#isFirstReady = true
      this.emit('ready')
    }
  }
  @debounced(50)
  __fillCells(rows: HTMLElement[], rowIndexs: number[]) {
    //填充行数据
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const rowIndex = rowIndexs[r]
      this._fillRow(row, rowIndex)
    }
  }
  _fillRow(rowEl: HTMLElement, rowIndex: number) {
    const labelEl = rowEl.querySelector('.ce-list-picker-label')!
    // const checkEl = rowEl.querySelector('.ce-list-picker-check-icon')!
    const rowData = values<Option>(this.filteredData)[rowIndex]

    // let checkElChild = checkEl.firstElementChild as HTMLElement
    if (this.multiple) {
      let show = (rowData ? this.selectLabelAry.includes(rowData.label) : false)
      // checkElChild.setAttribute('checked', show + '')
      rowEl.toggleAttribute('active', show)
      // let checkbox = rowEl.querySelector('.ce-list-picker-checkbox') as Checkbox
      // checkbox.toggleCheck(show)
    } else {
      let show = rowData && this.selectLabelAry.includes(rowData.label)
      // checkElChild.style.visibility = show ? 'visible' : 'hidden'
      rowEl.toggleAttribute('active', show)
    }

    if (rowData) {
      rowEl.toggleAttribute(AVAILABLE_ROW_TAG, true)
      rowEl.setAttribute('value', rowData.value)
      // ; (rowEl as any).updateProps({value:rowData.value})

      rowEl.setAttribute('tooltip', rowData.tooltip ?? '')

      let optionFn = this.slotHooks.option
      if (isDefined(optionFn)) {
        let html = (optionFn(rowData) as Template).getHTML(this)
        labelEl.innerHTML = html
        return
      }
      labelEl.textContent = rowData.label

      // if ((rowEl as CompElem).renderRoot)
      //   (rowEl as CompElem).renderRoot!.title = rowData.label
    } else {
      rowEl.toggleAttribute(AVAILABLE_ROW_TAG, false)
      labelEl.textContent = ''
      // if ((rowEl as CompElem).renderRoot)
      //   (rowEl as CompElem).renderRoot!.title = ''
    }
  }
  onScroll(obj: Record<string, any>) {
    let { to, direction, edge, preventDefault } = obj

    if (direction === 'v') {
      if (to === this.__lastYTo) return;

      this.__lastYTo = to;
      this.scrollV(to, (rowEl, rowIndex) => {
        if (rowIndex < 0 || rowIndex >= size(this.filteredData)) return;
        rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')

        //填充行数据
        this._fillRow(rowEl, rowIndex)
      })
    }
  }
  onSelect(obj: Record<string, any>) {
    let { item } = obj

    // limit 否决：select 事件在 List 已完成 toggle 后发出，此处回滚超限项。
    // 不能只截断 selectedValue —— List.selection 会残留脏值（被拒项在下次 toggle 时复活），
    // 需同步清理；List._resetSelectItem 对数组是 //todo，UI 回同步由 refreshView 重刷完成。
    if (this.multiple && this.limit > 0 && isArray(this.selectedValue) && item) {
      if (this.selectedValue.length > this.limit && this.selectedValue.includes(item.value)) {
        this.selectedValue = this.selectedValue.filter(v => v !== item.value)
        this.listEl?.selection?.delete(item.value)
      }
    }

    this.nextTick(() => {
      this.refreshView()
    })

    this.value = clone<any>(this.selectedValue)
    this.emit('clickoption', {
      label: item.dataset.label, value: item.value
    })
  }
  setFormatter(formatter: Function) {
    this.__formatter = formatter
  }
  onFilterClick(e: Event) {
    // e.stopPropagation();
  }
  onFilterEnter(e: Event) {
    let t = e.target as Input
    t.focus()
  }
  onFilterInput(obj: Record<string, any>) {
    let value = obj.value;
    this.__filterValue = value;

    this.scroller.scrollYTo(0)
    setTimeout(() => {
      this.refreshView()
      this.scroller.calcBounding?.()
      this.resetVirtualized()
      this.emit('filter', { value })
    }, 100)
  }
  onFilterClear(obj: Record<string, any>) {
    let value = obj.value;
    this.__filterValue = value;

    setTimeout(() => {
      this.refreshView()
      this.scroller.calcBounding?.()
      this.resetVirtualized()
      this.emit('filter', { value })
    }, 100)
  }
  resetVirtualized() {
    if (!this.container) return

    if (isUndefined(this.height)) {
      if (this.container.offsetHeight > this.maxHeight) {
        this.renderRoot!.style.height = this.maxHeight + 'px'
      } else {
        this.renderRoot!.style.height = 'auto'
      }

    }
    let roh = this.__viewportH()
    setTimeout(() => {
      this.showTrack = size(this.filteredData) * this.rowHeight > roh
      this.sHeight = size(this.filteredData) * (this.rowHeight + this.vRowGap)
      this.updateV(size(this.filteredData), roh)
    }, 0);

  }
  refreshView() {
    if (isEmpty(this.vList)) return;
    //1. 滚动到指定位置
    this.scrollV(this.scroller.y, (rowEl, rowIndex) => {
      if (rowIndex < 0 || rowIndex >= size(this.filteredData)) return;
      rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')

      //填充行数据
      this._fillRow(rowEl, rowIndex)
    })
    //2. 刷新数据，不更新位置
    let rowEls = this.vList.sort((a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
    rowEls.forEach((row, i) => {
      let rowIndex = parseInt(row.dataset.rowIndex!)
      this._fillRow(row, rowIndex)
    })
  }
  onBlur(e: Event) {
    let t = e.target;
  }
  __getFilteredData(data: any[], filterValue: string) {
    return filter(data, item => test(item.label, filterValue, 'i'))
  }
  __updateDataList(slotEl: HTMLSlotElement) {
    let els = this.slots.default as HTMLElement[]//slotEl.assignedElements({ flatten: true })
    els = reject(els, el => el instanceof HTMLSlotElement)

    if (!isEmpty(this.renderData) && els.length === this.renderData.length) return;

    let data: any[] = []
    let dataGroup: typeof this.groupData = {}
    if (isEmpty(els)) return;

    let selectLabelAry: typeof this.selectLabelAry = []
    if (some(els, el => el.tagName == 'OPTGROUP')) {
      each(filter(els, el => el.tagName == 'OPTGROUP'), (opg: HTMLOptGroupElement) => {
        let opts = filter<HTMLElement>(opg.children, el => el.tagName == 'OPTION')
        dataGroup[opg.label] = map(opts, op => {
          let d = { label: op.label, value: op.value, selected: !!op.selected, disabled: !!op.disabled, key: op.key, tooltip: op.getAttribute('tooltip') }
          if (d.selected && d.label) {
            selectLabelAry.push(d.label)
          }
          return d
        })
      })

      this.renderData = dataGroup
    } else {
      each(filter(els, el => el.tagName == 'OPTION'), (op: HTMLOptionElement) => {
        let d = { label: op.label, value: op.value, selected: !!op.selected, disabled: !!op.disabled, key: op.getAttribute('key'), tooltip: op.getAttribute('tooltip') }
        data.push(d)
        if (d.selected && d.label) {
          selectLabelAry.push(d.label)
        }
      })
      this.renderData = data;
    }

    if (!isEmpty(this.selectedValue)) {
      if (isEmpty(this.selectLabelAry)) {
        if (isArray(this.selectedValue)) {
          selectLabelAry = compact(flatMap<any, string>(this.renderData, d => this.selectedValue.includes(d.value) ? d.label : []));
        } else {
          let s = find(this.renderData, d => d.value === this.selectedValue)
          selectLabelAry = s ? compact([s.label]) : [];
        }
      } else {
        return;
      }

    }
    //仅初始化时设置
    if (this.multiple) {
      this.selectLabelAry = selectLabelAry
    } else {
      this.selectLabelAry = isEmpty(selectLabelAry) ? [] : [first(selectLabelAry)]
    }
  }
  getLabel(value: string) {
    let data = isArray(this.renderData) ? this.renderData : concat(...values(this.groupData));
    return get<string>(find(data, { value: value }), 'label', '');
  }
  clear() {
    this.listEl.clear()
  }
}