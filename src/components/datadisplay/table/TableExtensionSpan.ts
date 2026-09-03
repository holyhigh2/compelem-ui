import { Constructor } from "compelem";
import { concat, each, isNumber, kebabCase, map, range, remove } from "myfx";
import { CellSpan } from "./types";

/**
 * table扩展混入，提供合并管理
 * @methods
 * 
 * @author holyhigh2
 */
export function TableExtensionSpan<T extends Constructor<any>>(spuerClass: T) {
  return class TableExtensionSpan extends spuerClass {

    //行合并隐藏单元格 rowIndex-prop
    __hideRowCellsMap: Record<string, any[]> = {}
    __mergedRowCellsMap: Record<string, number> = {}
    __mergedColCellsMap: Record<string, number> = {}
    __middleIndexMap!: Record<string, Set<number>>
    __endIndexMap!: Record<string, Set<number>>

    __rowCellClassMap: Record<string, string[]> = {}
    __rowCellWidthMap: Record<string, string> = {}
    __rowCellOldWidthMap: Record<string, string> = {}

    constructor(...args: any[]) {
      super(...args)
    }

    __spanCells(spanObj: Record<string, any> | null) {
      this.__mergedRowCellsMap = {}
      this.__mergedColCellsMap = {}
      this.__hideRowCellsMap = {}
      each(spanObj!, (mergeAry: CellSpan[], prop) => {
        mergeAry.forEach(({ rowIndex, rowSpan, colSpan }) => {
          if (isNumber(rowSpan) && rowSpan > 1) {
            this.__mergedRowCellsMap[rowIndex + "-" + prop] = rowSpan
            if (!this.__hideRowCellsMap[prop]) {
              this.__hideRowCellsMap[prop] = []
            }
            range(rowIndex, rowIndex + rowSpan).forEach(hideRowIndex => {
              this.__hideRowCellsMap[prop].push([hideRowIndex, rowIndex % 2])
            })
          }
          if (isNumber(colSpan) && colSpan > 1) {
            this.__mergedColCellsMap[rowIndex + "-" + prop] = colSpan

            if (isNumber(rowSpan) && rowSpan > 1) {
              range(rowIndex + 1, rowIndex + rowSpan).forEach(rIndex => {
                this.__mergedColCellsMap[rIndex + "-" + prop] = colSpan
              })
            }
          }
        })
      })

      this.__updatableStyleSpan.replaceSync(this.__getSpanCellStyle())
    }
    __getSpanCellStyle() {
      let styles= `
        .ce-table-hide-span-cell{
          display:none !important;
        }
        .ce-table-hide-span-cell-content .ce-table-cell-content{
          display:none !important;
        }
        .ce-table-block-span-cell-content .ce-table-cell-content{
          display:block !important;
        }
        .ce-table-transparent-span-cell{
          background-color: transparent !important;
        }
        .ce-table-striped-span-cell{
          background-color: var(--table-color-stripe) !important;
        }
        .ce-table-no-border-span-cell{
          border-bottom:0 !important;
        }
      `
      this.__rowCellClassMap = {}
      this.__rowCellWidthMap = {}
      this.__rowCellOldWidthMap = {}
      let middleIndexMap: Record<string, Set<number>> = this.__middleIndexMap = {}
      let endIndexMap: Record<string, Set<number>> = this.__endIndexMap = {}
      each(this.__mergedRowCellsMap, (rowSpan, k) => {
        let [rIndex, prop] = k.split('-')
        let mIndex = rowSpan < 3 ? 1 : Math.ceil(rowSpan / 2)
        if (!middleIndexMap[prop]) {
          middleIndexMap[prop] = new Set()
          endIndexMap[prop] = new Set()
        }
        middleIndexMap[prop].add(parseInt(rIndex) + mIndex - 1)
        endIndexMap[prop].add(parseInt(rIndex) + Math.ceil(rowSpan) - 1)

        let cls = this.__rowCellClassMap[mIndex + ":" + prop] = [] as string[]
        cls.push('block-span-cell-content')

      })

      each(this.__hideRowCellsMap, (iList, prop) => {
        let mIndexAry = middleIndexMap[prop]
        iList.forEach(([rIndex, applyStripe], i) => {

          let cls = this.__rowCellClassMap[rIndex + ":" + prop]
          if (!cls) {
            cls = this.__rowCellClassMap[rIndex + ":" + prop] = [] as string[]
          }
          if (!endIndexMap[prop].has(rIndex)) {
            cls.push('no-border-span-cell')
          }
          if (this.striped) {
            if (applyStripe === 1) {
              cls.push('striped-span-cell')
            } else {
              cls.push('transparent-span-cell')
            }
          }
          if (!mIndexAry.has(rIndex)) {
            cls.push('hide-span-cell-content')
            remove(cls, c => c === 'block-span-cell-content')
          }
        })
      })

      each(this.__mergedColCellsMap, (colSpan, k) => {
        let [rIndex, prop] = k.split('-')
        let i = this.allColumns.findIndex((col: any) => col.prop === prop) + 1
        let props = map(range(colSpan - 1), si => this.allColumns[si + i].prop)
        props.forEach(prop => {
          let cls = this.__rowCellClassMap[rIndex + ":" + prop]
          if (!cls) {
            cls = this.__rowCellClassMap[rIndex + ":" + prop] = [] as string[]
          }
          cls.push('hide-span-cell')
        })
        let widthCss = map(concat(props, [prop]), p => `var(--column-width-${kebabCase(p.replaceAll('.', '-'))})`)
        this.__rowCellWidthMap[rIndex + ":" + prop] = `calc(${widthCss.join(' + ')})`
      })

      return styles
    }
    getSpanData() {
      return this.__spanObj
    }
    __matchSpanStyle(cellEl: HTMLElement, rIndex: number, prop: string) {
      let cellCls = this.__rowCellClassMap[rIndex + ":" + prop]
      let cellWidth = this.__rowCellWidthMap[rIndex + ":" + prop]

      cellEl.classList.remove(...['hide-span-cell', 'hide-span-cell-content', 'block-span-cell-content', 'transparent-span-cell', 'striped-span-cell', 'no-border-span-cell'])
      if (cellCls) {
        cellEl.classList.add(...cellCls)
        if (cellCls.includes('striped-span-cell')) {
          cellEl.classList.add('striped-span-cell')
        } else {
          cellEl.classList.add('transparent-span-cell')
        }
      }

      if (cellWidth) {
        this.__rowCellOldWidthMap[rIndex + ":" + prop] = cellEl.style.width
        cellEl.style.width = cellWidth
      } else {
        cellEl.style.width = this.__rowCellOldWidthMap[rIndex + ":" + prop]
      }
    }
  }
}