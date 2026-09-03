import { Constructor } from "compelem";
import { each, eq, gt, isArray, isBlank, isNil, lt, remove, test } from "myfx";
import { FillColorCondition } from "./types";

/**
 * table扩展混入，提供行/列/单元格填色功能
 * @methods
 * 
 * @author holyhigh2
 */
export function TableExtensionFillColor<T extends Constructor<any>>(spuerClass: T) {
  return class TableExtensionFillColor extends spuerClass {

    fillColorConditions: Array<FillColorCondition> = []

    matchConditions: Array<any> = []
    constructor(...args: any[]) {
      super(...args)
    }

    ////////////////////////////////////////// methods
    setFillColor(fillColorConditions: Array<FillColorCondition>) {
      if (this.fillColorConditions !== fillColorConditions)
        this.fillColorConditions = fillColorConditions
      //update view
      this.nextTick(() => {
        this.__updatableFillColor?.replaceSync(this.__getFillColorStyle())
        let rowEls = this.vList.sort((a: HTMLElement, b: HTMLElement) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
        let rowIndexs = rowEls.map((el: HTMLElement) => parseInt(el.dataset.rowIndex!))
        for (let r = 0; r < rowEls.length; r++) {
          const row = rowEls[r]
          const rowIndex = rowIndexs[r]
          if (row.children.length < 1) return
          const rowData = this.renderList[rowIndex]
          this.__matchFillColor(row.firstElementChild as HTMLElement, rowData)
        }
      })
      this.__onFillColorChange(this.fillColorConditions)
    }
    clearFillColor() {
      this.fillColorConditions = []
      this.__onFillColorChange(this.fillColorConditions)
    }
    addFillCondition(condition: FillColorCondition) {
      this.fillColorConditions.push(condition)
      this.__onFillColorChange(this.fillColorConditions)
    }
    delFillColorCondition(id: string) {
      remove(this.fillColorConditions, condi => condi.id === id)
      this.__onFillColorChange(this.fillColorConditions)
    }

    //table invoke
    __getFillColorStyle() {
      let styles= ``
      this.matchConditions = []
      each(this.fillColorConditions, condi => {
        styles+= `
            .ce-table-body-container .ce-table-row.fill-color[fcid="${condi.id}"] .ce-table-cell,
            .ce-table-body-container .ce-table-row.fill-color[fcid="${condi.id}"] .ce-table-column-fixed .ce-table-cell{
              background-color:${condi.color} !important;
            }
            .ce-table-body-container .ce-table-row .ce-table-cell[fcid="${condi.id}"],
            .ce-table-body-container .ce-table-row .ce-table-column-fixed .ce-table-cell[fcid="${condi.id}"]{
              background-color:${condi.color} !important;
            }
          `
        if (condi.type == 'col') {
          styles+= `
            .ce-table-body-container .ce-table-cell[column="${condi.column}"]{
              background-color:${condi.color} !important;
            }
          `
        } else {
          let matcher: Function = () => { }
          switch (condi.operator) {
            case '=':
              matcher = (v: any) => eq(v, condi.values)
              break
            case '≠':
              matcher = (v: any) => !eq(v, condi.values)
              break
            case '>':
              matcher = (v: any) => gt(v, condi.values)
              break
            case '<':
              matcher = (v: any) => lt(v, condi.values)
              break
            case '><':
              matcher = (v: any) => gt(v, condi.values[0]) && lt(v, condi.values[1])
              break
            case '⊇':
              matcher = (v: any) => test(v, condi.values, 'i')
              break
            case '⊉':
              matcher = (v: any) => !test(v, condi.values, 'i')
              break
            case '∄':
              matcher = (v: any) => isNil(v) || isBlank(v)
              break
            case '∃':
              matcher = (v: any) => !isNil(v) && !isBlank(v)
              break
          }
          this.matchConditions.push({
            id: condi.id,
            matcher,
            prop: condi.column,
            rowType: condi.type == 'row'
          })
        }
      })
      return styles
    }
    __matchFillColor(rowEl: HTMLElement, rowData: Record<string, any>) {
      rowEl.removeAttribute('fcid')
      each(rowEl.querySelectorAll('.ce-table-cell[fcid]'), el => el.removeAttribute('fcid'))
      each(this.matchConditions, condi => {
        let rs = condi.matcher(isArray(rowData[condi.prop]) ? rowData[condi.prop][0] : rowData[condi.prop])
        if (rs) {
          if (condi.rowType) {
            rowEl.setAttribute('fcid', condi.id)
            rowEl.classList.add('fill-color')
          } else {
            //cell
            let cellEl = rowEl.querySelector('.ce-table-cell[column="' + condi.prop + '"]')
            cellEl?.classList.add('fill-color')
            cellEl?.setAttribute('fcid', condi.id)
          }
        } else {
          rowEl.classList.remove('fill-color')
          each(rowEl.querySelectorAll('.ce-table-cell.ce-table-fill-color'), el => el.classList.remove('fill-color'))
        }
      })
    }
  }
}