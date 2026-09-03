import { classes, css, csscope, Csscope, debounced, emits, forEach, h, ifTrue, prop, query, QueryCache, state, tag, Template, watch } from "compelem";
import { formatDate, identity, isBlank, range, size } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { Virtualized } from "../../../mixins/Virtualized";
import { Scroller } from "../../datadisplay/scroller/Scroller";
import style from "./yearStyle.scss?tmpl";
const MIN_YEAR = 1970
const MAX_YEAR = 2100
const COLUMN_SIZE = 4
/**
 * 年月选择面板
 * @props
 *  show-month {boolean} 是否显示月选择，默认false
 *  min {string|number} 最小年月，可以是任何合法的年月字符串或年份数字
 *  value {string} 选中的日期，格式为 'yyyy-MM'，受控
 *  pattern {string} 值格式，默认'yyyy-MM'
 *  monthUnit {string} 月单位，默认''
 *  month {string|number} 月
 *  year {string|number} 年
 *  
 * @events
 *  change({value,type}) 日期变更时触发，type值 y/m
 *  dblclick({value,type}) 双击年份时触发
 * @slots
 * 
 *
 * @author holyhigh2
 */
@emits('change', 'dblclick')
@tag("ce-year-month-panel")
export class YearMonthPanel extends Virtualized(AppearanceElem) {
  static YEAR_LIST: Array<number[]> = []
  static {
    let r = Math.ceil((MAX_YEAR - MIN_YEAR) / COLUMN_SIZE)
    let sy = MIN_YEAR
    while (r > 0) {
      let col = [sy, sy + 1, sy + 2, sy + 3]
      YearMonthPanel.YEAR_LIST.push(col)
      sy = sy + COLUMN_SIZE
      r--
    }
  }

  //////////////////////////////////// props
  @prop showMonth = false
  @prop pattern = 'yyyy-MM'
  @prop monthUnit = ''
  @prop month = ''
  @prop year = ''

  @state vRowHeight = 60
  @state vScrollHeight = 0
  @state selectedyear: number
  @state selectedMon: number
  //虚拟化
  @state vCachedRows = 0
  @query('ce-scroller', QueryCache.ONCE) scroller: Scroller
  @query('#vpillar') declare vPillar: HTMLElement
  @query('.ce-date-picker-year-container') container: HTMLElement

  maxRow = 5
  maxCol = 4
  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  get cssVars() {
    return {
      ympRowHeight: `${this.vRowHeight}px`
    }
  }
  //////////////////////////////////// computed

  /////////////////////////////////// watches
  @watch(['year', 'month'], { immediate: true })
  watchYearMonth(nv: string, ov: any, src: string) {
    if (isBlank(nv)) {
      nv = formatDate(Date.now(), 'yyyy-MM')
    }
    if (this.showMonth && src == 'month') {
      this.selectedMon = parseInt(nv)
    }
    if (src == 'year') {
      this.selectedyear = parseInt(nv)
    }
  }

  @watch('selectedyear')
  watchSelectedyear(nv: string) {
    this.__updatableStyleSelectedyear.replaceSync(`
      .ce-date-picker-year-cell[data-year="${this.selectedyear}"] .ce-date-picker-item{
        background: var(--ce-color-text-active);
        color: #fff;
        border-radius: 50%;
      }
      `)
  }
  //////////////////////////////////// lifecycles
  shouldUpdate(): boolean {
    return document.body.contains(this)
  }
  mounted(): void {
    this.updateV(size(YearMonthPanel.YEAR_LIST), this.renderRoot!.offsetHeight)

    this.__updatableStyleSelectedyear = this.insertStyleSheet(css`
      .ce-date-picker-year-cell[data-year="${this.selectedyear}"] .ce-date-picker-item{
        background: var(--ce-color-text-active);
        color: #fff;
        border-radius: 50%;
      }
      `)
  }
  render(): Template {
    return h`
    <section class="ce-year-month" @resize.debounce:200="${this.onResize}">
      <ce-scroller wheel-step="80" .s-height="${this.vScrollHeight}" @scroll="${this.onScroll}" style="min-width:260px" show-track="false">
        <div class="ce-date-picker-year-container" virtualized @mutate.child.debounce:100="${this.onListReady}" @click="${this.changeYear}" @dblclick="${this.onDblClick}">
          <div id="vpillar"></div>
          ${forEach(range(this.vCachedRows), (row, i) => i, (row, i) => h`
            <div class="ce-date-picker-v-wrapper" data-row-index="${i}">
              ${forEach(range(COLUMN_SIZE), identity, (j) => h`
                  <div class="ce-date-picker-year-cell">
                    <div class="ce-date-picker-item"></div>
                  </div>
              `)}
            </div>
          `)}
        </div>
      </ce-scroller>
      ${ifTrue(this.showMonth, () => h`
        <ce-divider vertical style="margin-inline:var(--ce-spacing-xs)"></ce-divider>
        <ce-grid style="min-width:10em" @click="${this.changeMonth}">
          ${forEach(range(1, this.maxRow), r => `m-r-${r}`, (r) => h`
            <ce-row>
              ${forEach(range(1, this.maxCol), c => `m-c-${c}`, (c) => h`
                <ce-col>
                  <div class="ce-date-picker-month-cell" ${classes({ "selected": this.selectedMon == ((r - 1) * 3 + c) })} data-month="${(r - 1) * 3 + c}">
                    <div class="ce-date-picker-item">${(r - 1) * 3 + c}${this.monthUnit}</div>
                  </div>
                </ce-col>
              `)}
            </ce-row>
          `)}
        </ce-grid>  
      `)}
    </section>
    `;
  }

  //////////////////////////////////// methods
  lastOH = 0
  onResize() {
    let roh = this.renderRoot?.offsetHeight!
    if (roh === this.lastOH) return

    this.updateV(size(YearMonthPanel.YEAR_LIST), roh)
    this.lastOH = roh
  }
  onDblClick() {
    this.emit('dblclick', { value: this.value })
  }
  onListReady() {
    if (!this.isMounted) return;

    this.vList = Array.from(this.container.querySelectorAll('.ce-date-picker-v-wrapper'))

    //1. 查询行号列表
    let firstRowNoInView = this.scroller.y / this.vRowHeight >> 0

    let rowIndexAry: number[] = []
    this.vList.forEach((row, i) => {
      let rowIndex = firstRowNoInView + i

      row.style.transform = `translateY(${rowIndex * this.vRowHeight}px)`
      row.dataset.rowIndex = rowIndex + ''

      rowIndexAry.push(rowIndex)
    })
    this.__fillCells(this.vList, rowIndexAry)
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
    const cells = rowEl.querySelectorAll('.ce-date-picker-year-cell .ce-date-picker-item')!
    const rowData = YearMonthPanel.YEAR_LIST[rowIndex]
    for (let i = 0; i < COLUMN_SIZE; i++) {
      let year = rowData[i] + ''
      cells[i].textContent = year
      cells[i].parentElement?.setAttribute('data-year', year)
    }
  }
  changeYear(ev: MouseEvent) {
    let t = ev.target as HTMLElement
    t = t.closest('.ce-date-picker-year-cell')!
    if (!t) return
    this.selectedyear = parseInt(t.dataset.year!)

    let year = this.selectedyear
    let mon = this.selectedMon
    let value = this.showMonth ? formatDate(year + '-' + mon, this.pattern) : year + ''
    this.emit('change', { value: value, type: 'y' })
  }
  changeMonth(ev: Record<string, any>) {
    let t = ev.target as HTMLElement
    t = t.closest('.ce-date-picker-month-cell')!
    if (!t) return
    this.selectedMon = parseInt(t.dataset.month!)

    let year = this.selectedyear
    let mon = this.selectedMon
    let value = this.showMonth ? formatDate(year + '-' + mon, this.pattern) : year + ''
    this.emit('change', { value: value, type: 'm' })
  }
  __lastYTo = -1
  onScroll(obj: Record<string, any>) {
    let { to, direction, edge, preventDefault } = obj

    if (direction === 'v') {
      if (to === this.__lastYTo) return;

      this.__lastYTo = to;
      this.scrollV(to, (rowEl, rowIndex) => {
        if (rowIndex < 0 || rowIndex >= YearMonthPanel.YEAR_LIST.length) return;
        rowEl.firstElementChild?.setAttribute('data-row-index', rowIndex + '')

        //填充行数据
        this._fillRow(rowEl, rowIndex)
      })
    }
  }
}