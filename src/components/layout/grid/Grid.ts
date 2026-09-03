import { CompElem, csscope, Csscope, event, prop, query, tag, watch } from "compelem";
import { each } from "myfx";
import { Row } from "./Row";
import { styleSheet } from "./styleSheets";

export enum Breakpoints {
  XXS = 576,
  XS = 576,
  SM = 768,
  MD = 992,
  LG = 1200,
  XL = 1400,
  XXL = 1920
}

/**
 * 格栅布局 - 容器
 * @props
 *  gap {string|number} 行间距，默认0
 *  rows {string} grid内所有顶级row的高度值，支持百分比。每行通过空格分隔，如'100px 1fr 20%'
 *  fluid {boolean} 流体高度，默认false
 *
 * @slots
 *  default() Row
 *
 * @author holyhigh2
 */
@tag('ce-grid')
export class Grid extends CompElem<null> {
  @prop({ type: String }) gap: string | number = '0'
  @prop rows = '';
  @prop fluid = false

  @query('slot')
  rowSlot: HTMLSlotElement;

  static getBP(w: number) {
    if (w >= Breakpoints.XXL) {
      return 'xxl'
    } else if (w >= Breakpoints.XL) {
      return 'xl'
    } else if (w >= Breakpoints.LG) {
      return 'lg'
    } else if (w >= Breakpoints.MD) {
      return 'md'
    } else if (w >= Breakpoints.SM) {
      return 'sm'
    } else if (w >= Breakpoints.XS) {
      return 'xs'
    } else {
      return 'xxs'
    }
  }

  @csscope(Csscope.HOST)
  static get hostCss() {
    return styleSheet;
  }
  /////////////////////////////////// watches
  @watch('gap', { immediate: true })
  watchGap(nv: string | number) {
    this.style.rowGap = isNaN(nv as any) ? this.gap + '' : this.gap + 'rem'
  }
  @watch('rows', { immediate: true })
  watchRows(nv: string) {
    this.style.gridTemplateRows = nv
  }
  //////////////////////////////////// lifecycles
  mounted(): void {
    this.onResize()
  }
  beforeDestroyed(): void {
    let rows = this.querySelectorAll('ce-row')
    rows.forEach((r) => {
      (r as Row).destroy()
    })
  }
  //////////////////////////////////// methods
  relayout() {
    this.onResize()
  }
  @event('resize.debounce:100')
  onResize() {
    let w = this.offsetWidth

    this.dataset.bp = Grid.getBP(w)

    let els = this.children
    each(els, el => {
      if (el instanceof Row) {
        el.calcColWidth()
      }
    })
  }
}
