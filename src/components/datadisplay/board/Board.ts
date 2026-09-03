import { classes, CompElem, computed, css, Csscope, csscope, debounced, emits, forEach, h, html, ifElse, ifTrue, prop, query, QueryCache, show, state, styles, tag, Template, watch } from "compelem";
import { clone, compact, filter, find, flatMap, formatNumber, get, has, identity, intersect, isArray, isBlank, isEmpty, isNil, isObject, map, size } from "myfx";
import { DataType } from "../../../constants";
import { FieldContainer, FieldContainerEvents } from "../../../mixins/FieldContainer";
import { Field } from "../../base/Field";
import { Scroller } from "../scroller/Scroller";
import { ColumnConfigPane } from "../table/ColumnConfigPane";
import { BoardBar } from "./BoardBar";
import style from "./style.scss?tmpl";
const PROG_TAG_VALUE = 'progress-value'
const PROG_TAG_UNIT = 'progress-unit'
const PROG_TAG_LABEL = 'progress-label'
const PROG_TAG_COLOR = 'progress-color'
const PROG_TAG_ERROR = 'progress-error'
const CARD_TAG = 'data-state'
const DEFAULT_PROG_COLOR = '#c1e65c'
let BoardConfigPane: ColumnConfigPane
/**
 * 看板组件
 * @attrs
 *  data {array} 数据列表{字段:字段值,...}，支持专用字段 progress-value(进度值，默认0)，progress-color(默认#c1e65c)，progress-error，progress-label(显示值，如果空使用progress-value), data-state(设置卡片data-state属性)
 *  rowKey {string} 行唯一标识字段，调用更新方法时必须指定
 *  gap {number} 看板卡片间距，默认10px
 *  columns {number} 看板列数，如果未设置则根据列宽自动填充
 *  minColumnWidth {number} 最小列宽，默认200。单位px
 *  showProgress {boolean} 卡片是否显示加载进度条，默认false
 *  progressHeight {number} 进度条高度，默认12
 *  showLabel {boolean} 卡片项是否显示标签，默认true
 *  showLabelMargin {boolean} 是否显示标签外边距，默认true
 *  inlineLabel {boolean} 行模式显示label
 *  labelWidth {number} label宽度，默认自动 
 *  showCompact {boolean} 卡片项是否紧凑显示，默认false
 *  titleField {string} 卡片标题字段prop
 *  showFields {array} 卡片显示字段prop列表
 * @events
 *  load({cancel()}) 滚动到底部时触发，调用cancel取消加载条显示
 *  rendertitle({row,setContent(html)}) 渲染title时触发，可设置html内容
 *  clickcard(data) 点击卡片后触发
 *  scrollend 滚动停止后触发
 * @methods
 *  appendData(data:Array<Record<string,any>>) 追加数据
 *  updateData(data:Array<Record<string,any>>) 更新数据
 *  getCardsInView(objectInfo?):{cards,rows} 获取可视区内的卡片id或对象信息，以及可视行号
 * @parts
 *  root 根元素
 *  card 所有卡片元素
 * @slots
 *  - Field字段定义
 *  title 卡片标题定义
 * @author holyhigh2
 */
@emits(FieldContainerEvents.Ready, FieldContainerEvents.FieldChange, 'load', 'rendertitle', 'clickcard', 'scrollend')
@tag('ce-board')
export class Board extends FieldContainer(CompElem) {
  //////////////////////////////////// props
  @prop gap = 10;
  @prop({ type: Number }) columns: number | undefined;
  @prop minColumnWidth = 200
  @prop({ type: Array }) data: Array<Record<string, any>> = []
  @prop showProgress = false;
  @prop progressHeight = 12
  @prop({ type: Number }) labelWidth: number
  @prop showLabel = true;
  @prop showLabelMargin = true
  @prop inlineLabel = false
  @prop showCompact = false;
  @prop({ type: String, required: true }) titleField: string;
  @prop({ type: Array }) showFields: Array<string>;
  @prop({ type: String }) groupField = '';
  @prop grouped = false;
  @prop rowKey = "id";
  @prop scrollerSize = 10

  @state filterData: typeof this.data | undefined = undefined
  @state sortOrders: Array<{ prop: string, sort: string }> = [] //排序状态
  @state innerData: typeof this.data = []
  @state({ prop: 'showFields' }) __showFields: typeof this.showFields = []

  @state loading = false

  @state _isReady = false
  dataTypeMap = new Map<string, string>()
  labelMap = new Map<string, string>()
  //prop,colors
  tagMap = new Map<string, string | Record<string, string>>()
  declare _fieldMap: Map<string, Field>

  rowObserver: IntersectionObserver
  inViewRows: WeakSet<HTMLElement> = new WeakSet()

  @query('ce-scroller', QueryCache.ONCE) scroller!: Scroller
  @query('.ce-board-grid-container', QueryCache.ONCE) gridCon!: HTMLElement

  __allFields: string[]
  __updatableStyleHidden!: CSSStyleSheet | null;
  __updatableStyleGridAndGap!: CSSStyleSheet | null;

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  get cssVars() {
    return {
      boardListItemTitleWidth: `${this.labelWidth ? this.labelWidth : 'auto'}px`
    }
  }
  /////////////////////////////////// watches
  @watch('filterData')
  watchFilterData() {
    setTimeout(() => {
      this.updateData(this.filterData!)
    }, 100);
  }
  @watch('data')
  watchRenderList(nv: typeof this.data) {
    this.innerData = clone(nv)
    this.checkLoad(true)
  }
  /////////////////////////////////// computed
  @computed
  get renderList() {

    let data = this.filterData || this.innerData
    if (this.sortOrders && this.sortOrders.length > 0) {
      data = this._sortFields(data)
    }

    return data;
  }

  //////////////////////////////////// lifecycles
  beforeMount(): void {
    this.__updatableStyleHidden = this.insertStyleSheet(
      css`
        ce-card ce-list-item[data-field=""]{
          display:none;
        }
      `
    )
  }
  render(): Template {
    let nullId = 0
    return h`
      <div
        part="root"
        class="ce-board"
        ${classes({
      "is-compacted": this.showCompact,
      "ce-board-inline-label": this.inlineLabel
    })}
      >
        <ce-scroller style="height:100%" direction="v" size="${this.scrollerSize}" @scrollend="${this.onScrollEnd}">
          <div
            class="ce-board-grid-container"
            ${styles({
      'grid-template-columns': isNil(this.columns) ? `repeat(auto-fill, minmax(${this.minColumnWidth}px, 1fr))` : `repeat(${this.columns}, 1fr)`,
      gap: `${this.gap}px`,
      'row-gap': `${this.gap}px`
    })}
            ?no-margin="${!this.showLabelMargin}"
            @mutate.child.debounce:100="${this.onListReady}"
          >
            ${forEach(this.renderList, (data, ri) => data ? data[this.rowKey] : 'null_' + (nullId++), (data, ri) => h`
              <ce-card
                part="card"
                ${classes({ '--empty': isNil(data) })}
                data-row-key="${data ? data[this.rowKey] : ''}"
                shadow="xs"
                @click="${this.onCardClick}"
              >
                ${ifTrue(!isNil(data), () => h`
                  <div slot="title">
                    ${html(this.getItemTmpl(data, this.titleField, true))}
                  </div>
                  <div>
                    ${forEach(this.__showFields, identity, fieldName => h`
                      <ce-list-item ripple="false" data-field="${fieldName}" data-type="${this.dataTypeMap.get(fieldName)}">
                        <span
                          class="ce-board-item-title"
                          ${show(this.showLabel)}
                          ${html(isEmpty(this._fieldMap.get(fieldName)?.slots.default) ? this.labelMap.get(fieldName) : this._fieldMap.get(fieldName)?.innerHTML)}
                        >
                        </span>
                        <span
                          class="ce-board-item-subtitle"
                          slot="subheading"
                          data-field="${this.labelMap.get(fieldName)}"
                          title="${this.labelMap.get(fieldName) + " - " + get(data, [fieldName])}"
                        >
                          ${html(this.getItemTmpl(data, fieldName))}
                        </span>
                      </ce-list-item>
                    `)}
                  </div>
                  <div style="display: flex;justify-content: space-between;align-items: center;" ${show(this.showProgress)}>
                    ${ifElse(isBlank(data[PROG_TAG_ERROR]), () => h`
                      <ProgressLinear
                        active
                        slot="actions"
                        height="${this.progressHeight}"
                        striped
                        .value="${data[PROG_TAG_VALUE]}"
                        color="${data[PROG_TAG_COLOR] ?? DEFAULT_PROG_COLOR}"
                      >
                        <span>${data[PROG_TAG_LABEL] ?? data[PROG_TAG_VALUE]}</span>
                      </ProgressLinear>
                      <span class="ce-board-percent">${data[PROG_TAG_UNIT] ?? ''}</span>
                    `, () => h`<span ${html(data[PROG_TAG_ERROR])}></span>`)}
                  </div>
                `)}
              </ce-card>
            `)}
          </div>
          
            <div ${show(this.loading)} style="text-align: center;margin-block: 1rem;">
              <ce-progress-linear indeterminate striped color="gray" style="width: 30%;display: inline-block;"></ce-progress-linear>
            </div>
        </ce-scroller>
        <div class="ce-board-bottom-sensor"></div>
      </div>
      <slot style="display:none"></slot>
    `;
  }
  mounted(): void {
    if (!BoardConfigPane) {
      BoardConfigPane = new ColumnConfigPane()
      document.body.appendChild(BoardConfigPane)
    }
  }
  slotChange(slot: HTMLSlotElement, name: string): void {
    this.__setFields(slot)
  }
  //////////////////////////////////// methods
  getCardsInView(objectInfo = false) {
    let rect = this.getBoundingClientRect()
    let cards = this.renderRoot!.querySelectorAll<HTMLElement>('ce-card')
    let rs: string[] = []

    const style = getComputedStyle(this.gridCon);
    const gapX = parseFloat(style.columnGap);
    const containerWidth = this.gridCon.clientWidth;
    const cardWidth = cards[0].clientWidth
    const realCols = Math.round(containerWidth / (cardWidth + gapX));
    let rows = new Set()

    cards.forEach((card, i) => {
      let { height, top } = card.getBoundingClientRect()
      if (top > (rect.top + rect.height)) return
      if ((top + height) < rect.top) return

      let rowNum = i / realCols
      rows.add(Math.ceil(rowNum))

      rs.push(card.dataset.rowKey!)
    })
    let data = this.innerData
    return {
      cards: objectInfo ? flatMap(rs, id => find(data, d => d && d[this.rowKey] == id) ?? []) : rs,
      rows: compact(Array.from(rows))
    }
  }
  onListReady() {
    if (!this._isReady) {
      this._isReady = true
      this.__onReady()
    }
    this.nextTick(() => {
      this.scroller.calcBounding()
    })
  }
  #lastDataSize = 0
  @debounced(500)
  checkLoad(overflowCheck = true) {

    const that = this
    if (overflowCheck) {
      if (!this.scroller.isOverflow('v') && this.#lastDataSize !== this.innerData.length) {
        this.#lastDataSize = this.innerData.length
        this.emit('load', {
          load: (v: boolean) => {
            that.loading = v
            if (v) {
              this.nextTick(() => {
                (this.scroller as any).calcBounding_$__()
                this.scroller.scrollYBy(100)
              })
            }
          }
        });
      }
    } else {
      this.emit('load', {
        load: (v: boolean) => {
          that.loading = v
          if (v) {
            this.nextTick(() => {
              (this.scroller as any).calcBounding_$__()
              this.scroller.scrollYBy(100)
            })
          }
        }
      });
    }
  }
  onScrollEnd(obj: Record<string, any>) {
    if (obj.edge == 'bottom') {
      this.checkLoad(false)
    }
    this.emit('scrollend')
  }
  onCardClick(e: MouseEvent) {
    let t = e.currentTarget as HTMLElement
    let key = t.getAttribute('data-row-key') ?? ''

    let data = find(this.innerData, x => x && (x[this.rowKey] == key))
    this.emit('clickcard', { data }, e)
  }
  @debounced(50)
  __setFields(slot: HTMLSlotElement) {
    let nodes = slot.assignedElements({ flatten: true })
    let fields = filter<Field>(nodes, node => node instanceof Field)
    let showFields = fields.flatMap(f => {
      this.labelMap.set(f.prop, f.label)
      this.dataTypeMap.set(f.prop, f.dataType)
      if (f.dataType === DataType.Tag) {
        this.tagMap.set(f.prop, f.tagColors)
      }
      if (f.hidden) {
        this._hideField(f.prop)
        return []
      }

      this._fieldMap.set(f.prop, f)

      return f.prop
    });
    if (!this.showFields || this.showFields.length === 0) {
      this.__showFields = showFields
    }
    this.__allFields = map(fields, f => {
      if (f.dataType === DataType.Tag) {
        this._tagColorMap.set(f.prop, f.tagColors)
      }

      return f.prop
    })

    this.__onFieldChange(map<Field>(fields, f => ({ label: f.label, prop: f.prop, dataType: f.dataType })))
  }
  getItemTmpl(row: Record<string, any>, field: string, isTitle = false) {
    if (!row) return ``
    let content = row[field]
    let isSet = false
    if (isTitle) {
      this.emit('rendertitle', {
        row, setContent(html: string) {
          content = html
          isSet = true
        }
      })
    }

    let f = this._fieldMap.get(field)
    let color
    if (!isSet && this.tagMap.has(field)) {
      color = this.tagMap.get(field)
      if (isObject(color)) {
        color = color[content]
      }

      if (f?.pattern) {
        content = formatNumber(content, f.pattern)
      }
      content = `<ce-tag size="md" pill color="${color}" >${content}</ce-tag>`
    } else {
      if (f?.pattern) {
        content = formatNumber(content, f.pattern)
      }
    }
    return `<div class="ce-board-card"><div style="min-height: 1.75em;" ${isTitle ? 'title' : ''}>${(content)}</div></div>`
  }
  appendData(data: Array<Record<string, any>>) {
    let sameData = intersect(this.innerData, data, (d: Record<string, any>) => d && d[this.rowKey])
    if (size(sameData) > 0) {
      console.warn('重复数据无法追加')
      return
    }
    if (size(data) > 0) {
      this.innerData = this.innerData.concat(data);
      this.checkLoad(true)
    }
  }
  setData(data: Array<Record<string, any>>) {
    this.innerData = data
    this.#lastDataSize = 0
    this.checkLoad(true)
  }
  updateData(data: Array<Record<string, any>>) {
    if (!isArray(data)) return
    //1. check inview range
    let rect = this.getBoundingClientRect()
    let cards = this.renderRoot!.querySelectorAll<HTMLElement>('ce-card')
    let rs: HTMLElement[] = []
    cards.forEach(card => {
      let { height, top } = card.getBoundingClientRect()
      if (top > (rect.top + rect.height)) return
      if ((top + height) < rect.top) return
      rs.push(card)
    })

    rs.forEach((card, ci) => {
      let items = card.querySelectorAll('ce-list-item')
      let cardKey = card.getAttribute('data-row-key')!
      let rowData = data.find(d => d[this.rowKey] == cardKey)
      if (!rowData) return
      let titleEl = card.querySelector('.ce-board-card [title]')
      let content = rowData[this.titleField]
      let isSet = false
      this.emit('rendertitle', {
        row: rowData, setContent(html: string) {
          content = html
          isSet = true
        }
      })
      if (isSet && titleEl) {
        titleEl.innerHTML = content
      }

      items.forEach(item => {
        let field = item.getAttribute('data-field')!
        let cardItem = item.querySelector('.ce-board-card') as HTMLElement
        let content = rowData[field]
        if (!isNil(content)) {
          let f = this._fieldMap.get(field)
          if (f?.pattern) {
            content = formatNumber(content, f.pattern)
          }
          let tag = item.querySelector('ce-tag')
          let changed = false
          if (tag) {
            if (tag.textContent != content) {
              tag.textContent = content
              changed = true
            }
          } else {
            let subtitle = item.querySelector('.ce-board-item-subtitle') as HTMLElement
            if (subtitle.firstElementChild!.firstElementChild!.textContent != content) {
              subtitle.firstElementChild!.firstElementChild!.textContent = content
              subtitle.setAttribute('title', subtitle.dataset.field + " - " + content)
              changed = true
            }
          }
          if (changed) {
            cardItem.classList.add('changed')
            setTimeout(() => {
              cardItem.classList.remove('changed')
            }, 1000);
          }

        }
      })
      //data-card
      if (has(rowData, CARD_TAG)) {
        card.setAttribute(CARD_TAG, rowData[CARD_TAG])
      }
      //progress
      if (has(rowData, PROG_TAG_COLOR) || has(rowData, PROG_TAG_VALUE)) {
        let progressLinear = card.querySelector('ce-progress-linear')
        if (rowData[PROG_TAG_VALUE]) {
          progressLinear?.setAttribute('value', rowData[PROG_TAG_VALUE])
          let label = rowData[PROG_TAG_LABEL] ?? rowData[PROG_TAG_VALUE]
          if (progressLinear && progressLinear.firstElementChild)
            progressLinear.firstElementChild.textContent = label
        }
        if (rowData[PROG_TAG_UNIT]) {
          if (progressLinear?.nextElementSibling) progressLinear.nextElementSibling.textContent = rowData[PROG_TAG_UNIT]
        }
        if (rowData[PROG_TAG_COLOR])
          progressLinear?.setAttribute('color', rowData[PROG_TAG_COLOR])

      }
    })
  }
  /////////////////////////////////////////////////// 隐藏列相关
  toggleFieldHide(colProp: string) {
    super.toggleFieldHide(colProp)
    let hideFields = map(this._hiddenFieldList, f => `ce-card ce-list-item[data-field="${f}"]`).join(',')
    //这个可以通过更新隐藏元素的class实现
    this.__updatableStyleHidden?.replaceSync(`
        ${hideFields}{
          display:none !important;
        }
      `)
  }
  toggleAllFieldHide(props: string[]) {
    if (isEmpty(props)) {
      this.hideFields([], false)
      this.__updatableStyleHidden?.replaceSync(``)
    } else {
      this.hideFields(this.__allFields, false)
      let hideFields = map(this.__allFields, f => `ce-card ce-list-item[data-field="${f}"]`).join(',')
      this.__updatableStyleHidden?.replaceSync(`
        ${hideFields}{
          display:none !important;
        }
      `)
    }
  }
  /////////////////////////////////////////////////// 过滤列相关
  _openFilter(prop: string, dataType: string, btn: HTMLElement, side = false) {
    BoardConfigPane.open(this as any, prop, dataType, ColumnConfigPane.Filter, btn, this.__filterConditionMap[prop], side)
  }
  /////////////////////////////////////////////////// 排序列相关
  _setSort(prop: string, sort: string | null, cancelEmit = false) {
    super._setSort(prop, sort, cancelEmit)
  }
  __boardBar: BoardBar
  _setBoardBar(bar: BoardBar) {
    this.__boardBar = bar
  }
  /////////////////////////////////////////////////// fieldContainer
  __onReady() {
    this.emit(FieldContainerEvents.Ready)
    //update tableBar
    this.__boardBar?._onContainerReady()
  }
  __onFieldChange(fields: Field[]) {
    this.emit(FieldContainerEvents.FieldChange, { fields })
    //update tableBar
    this.__boardBar?._onFieldChange(fields)
  }
  __onFieldHideChange(columns: string[]) {
    //update tableBar
    this.__boardBar?._onHideChange(columns)
  }
  __onSortChange(orders: { prop: string; sort: string; }[]) {
    //update tableBar
    this.__boardBar?._onSortChange(orders)
  }
  __onFilterChange(filters?: Record<string, any>) {
    //update tableBar
    this.__boardBar?._onFilterChange(filters!)
    // this.loading = true
  }
  __onGroupChange(grouped: Record<string, any>[]) {
    //update tableBar
    this.__boardBar?._onGroupChange(grouped)
  }
}
