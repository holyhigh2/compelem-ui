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

    ////////////////////////////////////////// methods
    setFillColor(fillColorConditions: Array<FillColorCondition>) {
      if (this.fillColorConditions !== fillColorConditions)
        this.fillColorConditions = fillColorConditions
      //update view
      this.nextTick(() => {
        // ⚠️ 必须先求值再 replaceSync：`this.__updatableFillColor?.replaceSync(this.__getFillColorStyle())`
        // 在 __updatableFillColor 为空时会**短路参数求值**，而 __getFillColorStyle()
        // 同时负责重建 matchConditions ⇒ 条件格式会整体静默失效。
        let cssText = this.__getFillColorStyle()
        this.__updatableFillColor?.replaceSync(cssText)
        // vList 在 onListReady 之前为空/未定义，直接 sort 会抛 TypeError
        let rowEls = (this.vList ?? []).sort((a: HTMLElement, b: HTMLElement) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
        let rowIndexs = rowEls.map((el: HTMLElement) => parseInt(el.dataset.rowIndex!))
        for (let r = 0; r < rowEls.length; r++) {
          const row = rowEls[r]
          const rowIndex = rowIndexs[r]
          // ⚠️ 原来是 `return`：一个空行（回收行池里尚未填充的占位行）会终止整轮着色，
          // 后面的行永远轮不到。这里必须是 continue。
          if (row.children.length < 1) continue
          const rowData = this.renderList[rowIndex]
          if (!rowData) continue
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
          // 默认「不命中」：旧写法是 `() => { }`（返回 undefined），消费处只做真值判断
          let matcher: (v: unknown) => boolean = () => false
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
      // ① 先整体清空上一轮的着色痕迹（行 + 单元格都要清，且类名必须与下方添加的
      //    `fill-color` 一致；旧代码清理用的 `.ce-table-fill-color` 与添加的类名不符，
      //    单元格颜色永远清不掉）。
      rowEl.removeAttribute('fcid')
      rowEl.classList.remove('fill-color')
      each(rowEl.querySelectorAll('.ce-table-cell[fcid], .ce-table-cell.fill-color'), el => {
        el.removeAttribute('fcid')
        el.classList.remove('fill-color')
      })
      // ② 再逐条应用命中的条件。⚠️ 旧实现把"清空"放在 else（未命中）分支里，配置
      //    ≥2 条条件时后一条不命中会把前一条刚上的颜色擦掉。清理与匹配必须分离。
      each(this.matchConditions, condi => {
        let rs = condi.matcher(isArray(rowData[condi.prop]) ? rowData[condi.prop][0] : rowData[condi.prop])
        if (!rs) return
        if (condi.rowType) {
          // 多条行条件命中时后者覆盖 fcid（颜色以最后一条为准），class 保持
          rowEl.setAttribute('fcid', condi.id)
          rowEl.classList.add('fill-color')
        } else {
          //cell
          let cellEl = rowEl.querySelector('.ce-table-cell[column="' + condi.prop + '"]')
          cellEl?.classList.add('fill-color')
          cellEl?.setAttribute('fcid', condi.id)
        }
      })
    }
  }
}