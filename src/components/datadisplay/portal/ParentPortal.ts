import { CompElem, computed, prop, query, state, watch } from "compelem";
import { each, groupBy, map, size } from "myfx";
import { getRectInContainer } from "uiik";
import { showError } from "../../../utils/utils";

export const USED_WIDGET_MAP = new WeakMap<HTMLElement, Record<string, any>>()
/**
 * 基类
 * @props
 *  widgets {array} 可用挂件数组 [{title:'xxx',size:'1-2',resizable:true,img:''}]
 *  columns {number} 列数
 *  rowHeight {number} 行高
 *  gap {number} 单元格间距
 *  overflow {string} 单元格溢出处理方式 visible/hidden
 * @events
 *  append({el,widget}) 插入挂件时触发，可在el中插入挂件HTML
 */
export class ParentPortal extends CompElem {

  @prop({ type: Number, converter: (v) => parseInt(v) }) gap = 10
  @prop widgets: any[] = []
  @prop columns = 8
  @prop rowHeight = 100

  @state draggingWidget = false
  @state widgetGroup = {}

  widgetList: Record<string, any>[]
  opingWidgetEl: HTMLElement

  @query('ce-main')
  mainEl: HTMLElement

  @computed
  get foundationRows() {
    return window.innerHeight / (this.rowHeight + this.gap / 2)
  }
  @computed
  get widgetRows() {
    return Math.ceil(size(this.widgets) / 2)
  }

  selectableWidgetsMap: Record<string, any> = {}
  @watch('widgets', { immediate: true })
  watchWidgets(nv: any[]) {
    this.widgetGroup = groupBy(nv, w => w.size[0])
    each(this.widgetGroup, (g: any[], i) => {
      each(g, (w, j) => {
        if (this.selectableWidgetsMap[w.title + ":" + w.size]) {
          showError(this.tagName, 'Duplicate widget data')
          return
        }
        this.selectableWidgetsMap[w.title + ":" + w.size] = w
      })
    })
  }

  __inited = false
  //////////////////////////////////// lifecycles
  cellResizing = false
  widgetDragging = false
  __moveInAside = true

  onResize() {
    each(this.mainEl.querySelectorAll('.ce-portal-editor-widget'), (el: HTMLElement) => {
      let size = el.dataset.size?.split(':')!
      let [rowCount, colCount] = [parseInt(size[0]), parseInt(size[1])]
      let coordi = el.dataset.coordi?.split(':')!

      let startEl = this.__relocateTo(el, coordi[0], coordi[1])
      let endEl = this.mainEl.querySelector<HTMLElement>(`.foundation-cell[data-col-index="${parseInt(coordi[1]) + colCount - 1}"][data-row-index="${parseInt(coordi[0]) + rowCount - 1}"]`)!

      let w = endEl.offsetLeft - startEl.offsetLeft + endEl.offsetWidth
      let h = endEl.offsetTop - startEl.offsetTop + endEl.offsetHeight

      el.style.width = w + 'px'
      el.style.height = h + 'px'
    })
  }
  //////////////////////////////////// methods
  __relocateTo(wrapperEl: HTMLElement, sRow: number | string, sCol: number | string) {
    let startEl = this.mainEl.querySelector(`.foundation-cell[data-col-index="${sCol}"][data-row-index="${sRow}"]`) as HTMLElement
    if (!startEl) return startEl
    let rect = getRectInContainer(startEl, this.mainEl)
    wrapperEl.style.left = rect.x + 'px'
    wrapperEl.style.top = rect.y + 'px'
    return startEl
  }
  //插入挂件
  __appendWidget(dropCoordi: number[], widgetSize: number[], selectable‌WidgetTag: string, widgetProps: Record<string, any>) {

  }
  getConfigData() {
    let widgets = this.mainEl.querySelectorAll('.ce-portal-editor-widget')
    return map(widgets, w => {
      let coordi = w.dataset.coordi?.split(':')!
      let size = w.dataset.size?.split(':')!
      return {
        rowIndex: coordi[0],
        colIndex: coordi[1],
        cols: size[1],
        rows: size[0],
        widget: USED_WIDGET_MAP.get(w)
      }
    })
  }
  setConfigData(data: Array<{ rowIndex: string | number, colIndex: string | number, cols: string | number, rows: string | number, widget: Record<string, any> }>) {
    each(data, config => {
      this.__appendWidget([parseInt(config.rowIndex + ''), parseInt(config.colIndex + '')], [parseInt(config.rows + ''), parseInt(config.cols + '')], config.widget.title + ":" + config.widget.size, config.widget)
    })
  }
}
