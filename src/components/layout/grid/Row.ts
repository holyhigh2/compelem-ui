import { CompElem, html, prop, styles, tag, Template } from "compelem";
import { closest, debounce, each, filter, last, sum } from "myfx";
import { Col } from "./Col";
import { Grid } from "./Grid";
import style from "./style.scss";
/**
 * 格栅布局 - 行
 * 每一行分为24列
 *
 * @slots
 *  default() Col
 *
 * @author holyhigh2
 */
@tag('l-row')
export class Row extends CompElem {
  autoWidthFn: Function
  grid: Grid

  /////////////////////////////////// props
  @prop({ type: String }) gutter: string | number = '0'

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();

    this.autoWidthFn = debounce(this.autoWidth, 10)
  }

  render(): Template {
    return html`<div part="row" class="c-grid-row" style="${styles({ columnGap: isNaN(this.gutter as any) ? this.gutter + '' : this.gutter + 'rem' })}"><slot @slotchange="${this.onSlotChange}"></slot></div>`;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.grid = closest(this.parentComponent!, (node) => node instanceof Grid, "parentComponent")!
    if (this.grid && this.grid.fluid) {
      this.renderRoot.style.height = '100%'
    }
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods
  onSlotChange(e: Event) {
    let slot = e.currentTarget as HTMLSlotElement
    let els = slot.assignedElements()
    if (els.length < 1) return;

    this.autoWidthFn(els);
  }

  autoWidth(els: Element[]) {
    let declaredSpan = 0;
    let noSpanCol = 0;
    const cols = filter(els, el => el instanceof Col)
    const spanAry: number[] = []
    const offsetAry: number[] = []
    each(cols, col => {
      let colSpan = col.attributes.getNamedItem('span')
      if (colSpan && colSpan.value) {
        let cs = parseInt(colSpan.value)
        spanAry.push(cs)
        declaredSpan += cs
      } else {
        noSpanCol++
        spanAry.push(-1)
      }

      let colOffset = col.attributes.getNamedItem('offset')
      if (colOffset) {
        let co = parseInt(colOffset.value)
        offsetAry.push(co)
      } else {
        offsetAry.push(0)
      }
    })
    //计算平均宽度
    let avgSpan = (24 - declaredSpan - sum(...offsetAry)) / noSpanCol >> 0
    let remainder = (24 - declaredSpan - sum(...offsetAry)) % noSpanCol

    let lastColIndex = 1
    each(cols, (col: Col, i: number) => {
      let colSpan = spanAry[i]
      if (colSpan < 0) colSpan = avgSpan
      let colOffset = offsetAry[i]

      lastColIndex += colOffset

      col.style.gridColumn = `${lastColIndex} / ${colSpan + lastColIndex}`
      lastColIndex = colSpan + lastColIndex
    })

    if (remainder > 0) {
      let style = (last(cols) as Col).style
      style.gridColumn = style.gridColumn.split('/')[0] + '/' + (avgSpan + remainder)
    }
  }
}
