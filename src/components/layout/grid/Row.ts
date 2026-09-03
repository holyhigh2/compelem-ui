import { CompElem, csscope, Csscope, prop, tag } from "compelem";
import { closest, each, filter } from "myfx";
import { Col } from "./Col";
import { Grid } from "./Grid";
import { styleSheet } from "./styleSheets";
const COL_COUNT = 24
/**
 * 格栅布局 - 行
 * 每一行分为24列
 * @props
 *  gap {string|number} 列间距，默认0。类型为数字时单位为px
 *
 * @slots
 *  default() Col
 *
 * @author holyhigh2
 */
@tag('ce-row')
export class Row extends CompElem<null> {
  grid: Grid

  /////////////////////////////////// props
  @prop({ type: String }) gap: string | number = '0'

  /////////////////////////////////// styles
  get cssVars(): Record<string, string | number | undefined> {
    return {
      gridColGap: isNaN(this.gap as any) ? this.gap + '' : this.gap + 'px'
    }
  }
  @csscope(Csscope.HOST)
  static get hostCss() {
    return styleSheet;
  }

  /////////////////////////////////// watches

  /////////////////////////////////// computed

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  beforeMount(): void {
    this.grid = closest(this.parentComponent!, (node) => node instanceof Grid, "parentComponent")!
    if (this.grid && this.grid.fluid) {
      this.style.height = '100%'
    }
  }

  mounted(): void {
    this.nextTick(() => {
      this.calcColWidth();
    })
  }
  beforeDestroyed(): void {
    each(this.children, (col: Col) => {
      col.destroy()
    })
    this.grid = null as any
  }

  //////////////////////////////////// methods
  calcColWidth() {
    const bp = this.grid ? this.grid.dataset.bp! : Grid.getBP(this.offsetWidth)

    let lastColIndex = 1
    const cols = filter<Col>(this.children, el => el instanceof Col) ?? []
    let hasOffset = false
    let spanSum = 0
    let colSpanAry: Array<number[]> = []
    let noSpanCount = 0
    each(cols, (col: Col) => {
      let span = col.getSpan(bp) ?? 0
      let offset = col.offset ?? parseInt(col.getAttribute('offset') || '0')
      if (offset > 0) hasOffset = true
      spanSum += span
      if (span < 1) {
        noSpanCount++
      }

      let startColIndex = lastColIndex + offset
      let endColIndex = startColIndex + span
      colSpanAry.push([startColIndex, endColIndex])
      lastColIndex = endColIndex
    })

    if (!hasOffset) {
      let restSpan = COL_COUNT - spanSum
      let avgSpan = restSpan / noSpanCount
      cols.forEach(col => {
        let span = col.getSpan(bp) ?? 0
        col.style.setProperty('--grid-col-span', `span ${span || avgSpan}`)
      })
    } else {
      colSpanAry.forEach((spanAry, i) => {
        let col = cols[i]
        let startColIndex = spanAry[0]
        let endColIndex = spanAry[1]
        col.style.setProperty('--grid-col-span', `${startColIndex} / ${endColIndex}`)
      })
    }
  }
}
