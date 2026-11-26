import { computed, csscope, Csscope, debounced, emits, forEach, h, ifElse, ifTrue, model, prop, query, QueryCache, show, state, styles, tag, Template, watch } from "compelem";
import { clone, cloneDeep, compact, concat, each, filter, find, first, flatMap, get, isArray, isDefined, isEmpty, isEqual, isNumber, isObject, isString, isUndefined, map, range, reject, size, some, test, values } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { Check, Question } from "../../../icons/icons";
import { Virtualized } from "../../../mixins/Virtualized";
import { Scroller } from "../../datadisplay/scroller/Scroller";
import { Input } from "../../form/input/Input";
import { List } from "../../layout/list/List";
import style from "./style.scss?tmpl";
import { FADE_CSS } from "../../../css/transition";
import { nodesToHTML } from "../../../utils/utils";
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
 * @attrs
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
    type: [String, Array, Number], isValid(value: any, props?: Record<string, any>) {
      if (isUndefined(props?.multiple)) return true;
      return props?.multiple && isDefined(value) ? isArray(value) : true;
    }, model: true
  }) value!: string | Array<string>;
  //单项列表/分组列表数据
  @prop({ type: [Array, Object] }) data: Record<string, any>[] | Record<string, Record<string, any>[]> = [];
  activeColor = '#2196f3'

  //已选中标签
  @state selectLabelAry: Array<string> = [];
  @state private __filterValue = '';
  @state groupData: Record<string, any[]> = {}
  @state renderData: typeof this.data
  @state vRowHeight = 0
  @state selectedValue: typeof this.value = this.value

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

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style, FADE_CSS];
  }

  /**
   * scroller 的展示高度。
   * 原 `_renderList()` 里那句 `if (this.sHeight < 1) this.sHeight = this.rowHeight * 3`
   * 是渲染期初始化。内联后没有地方放这条副作用了，用 getter 保留同样的写回语义
   * （`sHeight` 是 @state，组件内可写）。
   */
  get listHeight(): number {
    if (this.sHeight < 1) this.sHeight = this.rowHeight * 3
    return this.sHeight
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
  @watch('rowHeight')
  watchRowHeight() {
    this.nextTick(() => {
      this.resetVirtualized()
      // resetVirtualized 只重算高度/轨道，行位移要由 initV 重铺
      this.onListReady()
    })
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
  // 原 `_renderList()` / `_renderGroup()` 已就地内联到下面的 ifElse 分支：
  // 0.30 的结构指令回调体必须是**直接书写**的唯一 h`` 模板，回调里调用
  // 「返回 Template 的方法」会被判为「命中 0 个」而阻断编译。
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
      ${ifElse(isEmpty(this.filteredData), () => h`
        <div class="ce-list-picker-select-item is-empty" unhoverable style="display:block;cursor:auto">无可选项</div>
      `, () => h`
      ${ifElse(isEmpty(this.groupData), () => h`
        <ce-scroller wheel-step="80" @scroll="${this.onScroll}" direction="v" s-height="${this.listHeight}" .showTrack="${this.showTrack}">
          <ce-list class="ce-list-picker-list-container" nav selectable gap="${this.gap}px" style="min-width: var(--ce-list-picker-min-width, 100px);" ${model(this.selectedValue, 'select')}
          @select="${this.onSelect}" @mutate.child.debounce:100="${this.onListReady}" ?multiple="${this.multiple}">
            <div id="vpillar"></div>
            ${forEach(range(this.vCachedRows), (row, i) => i, (row, i) => h`
              <ce-list-item hoverable appearance="pale" style="height:${this.rowHeight}px;font-size:var(--ce-font-sm);padding-inline:var(--ce-spacing-md)">
                <span class="ce-list-picker-label"></span>
                <span class="ce-list-picker-check-icon" slot="append">
                  <ce-icon .svg="${Check}" size="lg"></ce-icon>
                </span>
              </ce-list-item>
            `)}
          </ce-list>
        </ce-scroller>
      `, () => h`
        ${forEach((this.filteredData), (gd, k) => k, (gd, k) => h`
          <ce-panel title="${k}" shadow="never" style="--padding:0.5rem">
            <ce-list size="sm" space="compact" max-rows="${this.maxRows}" selectable gap=".1rem" appearance="text">
            ${forEach(gd, li => li.key ?? li.label, (li) => h`
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
      `)}
      `)}
      </main>
    </selection>
    <slot style="display:none"></slot>
    `;
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
    // 与同族 onListReady 一致：销毁后 isMounted 为 false，离场动画的 freeze 窗口由 isDestroyed 挡掉
    if (!this.isMounted || this.isDestroyed) return;
    // 与 #updateScrollH 处同一守卫：container 是 @query('.ce-list-picker-list-container')，
    // 首个 mutate.child 早于 ce-scroller 把子节点就位时解析为 null，
    // 无守卫会抛未捕获 TypeError（ListPicker.ts onListReady）并中断后面的 ready 收尾。
    if (!this.container) return;

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
      // 虚拟化行填充时才可靠得知 rowData.value（watchSelect 首次触发时行的 value 尚未填充，
      // ce-list._resetSelectItem 数组分支匹配不到任何行），此处随行填充把预选项同步进
      // selection 集合，否则首次点击新项时 _toggleSelect 从空集开始计算，预选值全部丢失
      if (show && rowData && this.listEl) this.listEl.selection.add(rowData.value)
      // let checkbox = rowEl.querySelector('.ce-list-picker-checkbox') as Checkbox
      // checkbox.toggleCheck(show)
    } else {
      // show 必须兜成布尔值：rowData 为空（虚拟化占位行尚未填数据）时
      // `rowData && ...` 求值为 undefined，而 toggleAttribute(name, undefined)
      // 按规范是「切换」⇒ 空行被误打上 active（蓝底 + 勾选图标的空行，
      // 2026-10-18 实测 8 项列表渲染出 7 个空 active 行）。
      let show = !!rowData && this.selectLabelAry.includes(rowData.label)
      rowEl.toggleAttribute('active', show)
    }

    if (rowData) {
      rowEl.toggleAttribute(AVAILABLE_ROW_TAG, true)
      rowEl.setAttribute('value', rowData.value)
      // ; (rowEl as any).updateProps({value:rowData.value})

      rowEl.setAttribute('tooltip', rowData.tooltip ?? '')

      let optionFn = this.slotHooks.option
      if (isDefined(optionFn)) {
        // 钩子可返回 Template（经 slot() 登记、有 provenance）或直接返回 HTML 字符串。
        // 走 Template 分支时 getSubViewNodes + nodesToHTML 是 outerHTML 序列化，
        // 属性绑定（prop binding）会丢失，且子模板内的结构指令不生效，
        // 故需要图标/属性等真实属性时由钩子自行拼字符串。
        let r = optionFn(rowData)
        labelEl.innerHTML = isString(r) ? r : nodesToHTML(this.getSubViewNodes(optionFn, rowData))
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
      // 虚拟化窗口从 scrollTop=0 开始铺行，选中行（受控 value 对应项）可能
      // 落在视口外 ⇒ 看不见 active 行与勾选图标，用户以为"没有选中项"。
      // 打开 / 过滤后把选中行滚进视口中部（列表短到无滚动条时 scrollYTo
      // 自然空转，无需特判）。
      this.scrollSelectedIntoView()
    }, 0);

  }
  /**
   * 把选中行滚进视口中部。
   *
   * 分组数据拍平后查找；多选（value 为数组）不处理 —— 调用方 ce-select 的
   * 列选择场景全是单选。已在视口内则保留当前滚动位置不动。
   */
  scrollSelectedIntoView() {
    console.log("[SSIV] called", JSON.stringify({
      selectedValue: this.selectedValue,
      filteredLen: size(this.filteredData),
      scrollerY: this.scroller?.y,
      vh: this.__viewportH(),
      dataLen: size(this.data),
    }));
    if (!this.scroller) return
    const data: Option[] = isArray(this.filteredData)
      ? this.filteredData as Option[]
      : concat(...values<Option[]>(this.filteredData as Record<string, Option[]>))
    if (size(data) < 1) return
    const idx = data.findIndex((d) => d.value === this.selectedValue)
    if (idx < 0) return
    const rowH = this.vRowHeight + this.vRowGap
    const top = idx * rowH
    const vh = this.__viewportH()
    if (top >= this.scroller.y && top + rowH <= this.scroller.y + vh) return
    // 选中行落在视口中部；视口比行高还矮时至少让顶端可见
    const target = Math.max(0, top - Math.max(0, (vh - rowH) / 2))
    this.scroller.scrollYTo(target)
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