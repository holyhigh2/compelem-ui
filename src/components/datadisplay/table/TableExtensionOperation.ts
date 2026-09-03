import { Constructor } from "compelem";
import { clone, each, eachRight, find, isEmpty, range, size, test, throttle, trimStart } from "myfx";
import { THRESHOLD } from "uiik";
import { KeyboardKey } from "../../../constants";
import { ColumnConfigPane } from "./ColumnConfigPane";
import { getContextMenuItems } from "./contextmenu";
import { CellPos, TableEvents } from "./types";

export const CELL_CLASS_SELECTED = 'ce-table-selected-cell'
export const CELL_CLASS_SELECTED_TOP = 'ce-table-selected-cell-top'
export const CELL_CLASS_SELECTED_BOTTOM = 'ce-table-selected-cell-bottom'
export const CELL_CLASS_SELECTED_LEFT = 'ce-table-selected-cell-left'
export const CELL_CLASS_SELECTED_RIGHT = 'ce-table-selected-cell-right'

const SCROLLER_EDGE = 30

enum SelectType {
  Row = 'row',
  Col = 'col',
  All = 'all'
}

/**
 * table扩展混入，提供框选、右键菜单、键盘操作等功能
 * @methods
 * 
 * @author holyhigh2
 */
export function TableExtensionOperation<T extends Constructor<any>>(spuerClass: T) {
  return class TableExtensionOperation extends spuerClass {

    //是否开启扩展
    declare extended: boolean

    __lastStartCellPos: CellPos | null = null
    __lastEndCellPos: CellPos | null = null//被选中的单元格
    __selectedCells: Array<CellPos> = []

    leftSelectedCellColIndex: number = -1
    rightSelectedCellColIndex: number = -1
    topSelectedCellRowIndex: number = -1
    bottomSelectedCellRowIndex: number = -1

    constructor(...args: any[]) {
      super(...args)
    }

    ////////////////////////////////////////// 右键菜单
    onContextMenuSelect(obj: Record<string, any>) {
      let { item, index, el } = obj
      switch (item.id) {
        case 'copyCells':
          this.doCopy();
          break
        case 'filterByCellValue':
          this.doFilterByCellValue();
          break
        case 'copyCellsAndHeader':
          this.doCopy(true);
          break
        case 'checkRows':
          this.doCheckRows();
          break
        case 'expandRow':
          this.doExpandRow()
          break
        case 'select-row':
          this.doSelect(SelectType.Row)
          break
        case 'select-col':
          this.doSelect(SelectType.Col)
          break
        case 'select-all':
          this.doSelect(SelectType.All)
          break
        case 'fillColorByCol':
          this.doFillColorCol()
          break
      }
      this.emit('contextmenuselect', { item, index, el })
    }
    onContextMenu(e: MouseEvent) {
      if (!this.extended) return
      let t = e.target as HTMLElement
      if (!this.tableBody.contains(t)) {
        e.preventDefault()
        this.contextMenu.setItems([])
        return
      }
      e.stopPropagation();

      let cellEl = t.closest('.ce-table-cell')
      if (!cellEl) {
        e.preventDefault()
        return
      }

      this.contextMenu.setItems(getContextMenuItems(this as any))

      let showMenu = true;
      this.emit('contextmenu', { items: this.contextMenu.itemList, cells: this.__selectedCells, cancel: () => { showMenu = false } }, { event: e })
      if (showMenu) {
        this.onStartSelect(e)
        this.contextMenu.open(e)
      }
      this._onContextMenu && this._onContextMenu({ items: this.contextMenu.itemList, cells: this.__selectedCells })
    }
    doExpandRow() {
      const row = this.renderList[this.topSelectedCellRowIndex]
      this.emit(TableEvents.Detailclick, { row, rowIndex: this.topSelectedCellRowIndex })
    }
    doCheckRows() {
      let rowKeys: string[] = []
      range(this.topSelectedCellRowIndex, this.bottomSelectedCellRowIndex + 1).forEach(rowIndex => {
        const row = this.renderList[rowIndex]
        let rowKey = row ? row[this.rowKey] : null
        rowKeys.push(rowKey)
      })

      this.toggleRowSelection(rowKeys, true)
    }
    doFilterByCellValue() {
      let prop = this.getRenderColumns()[this.leftSelectedCellColIndex].prop
      let val = this.__getRenderValue(prop, this.topSelectedCellRowIndex)
      // this._setFilter(prop, FilterType.Time, this.filterCondition)
    }
    doFillColorCol() {
      let colData = this.getRenderColumns()[this.leftSelectedCellColIndex]
      let colEl = this._fieldMap.get(colData.prop)
      this.TableConfigPane.open(this, colData.prop, colData.dataType, ColumnConfigPane.FillColor, colEl)
      this.TableConfigPane.addFillCondition(colData.prop)
    }
    doCopy(withHeader = false) {
      let text = "";
      range(this.topSelectedCellRowIndex, this.bottomSelectedCellRowIndex + 1).forEach(rowIndex => {
        let rowText = "";
        range(this.leftSelectedCellColIndex, this.rightSelectedCellColIndex + 1).forEach(colIndex => {
          let prop = this.getRenderColumns()[colIndex].prop
          rowText += "\t" + this.__getRenderValue(prop, rowIndex)
        })
        text += "\r\n" + rowText.replace(/^\t/, '');
      })
      if (withHeader) {
        let header = ''
        range(this.leftSelectedCellColIndex, this.rightSelectedCellColIndex + 1).forEach(colIndex => {
          let prop = this.getRenderColumns()[colIndex].prop
          header += "\t" + ((this._fieldMap.get(prop)?.label) ?? prop)
        })
        text = trimStart(header) + text
      }

      if (!navigator.clipboard) {
        let input = document.createElement("textarea");
        input.value = text.replace(/^\r\n/, "");
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      } else {
        navigator.clipboard.writeText(text.replace(/^\r\n/, ""));
      }
    }
    doSelect(type: string) {
      let startColIndex = this.leftSelectedCellColIndex
      let endColIndex = this.rightSelectedCellColIndex
      let startRowIndex = this.topSelectedCellRowIndex
      let endRowIndex = this.bottomSelectedCellRowIndex

      let rcols = this.getRenderColumns()
      switch (type) {
        case SelectType.Row:
          startColIndex = 0
          endColIndex = size(rcols) - 1
          break;
        case SelectType.Col:
          startRowIndex = 0
          endRowIndex = this.renderList.length - 1
          break;
        case SelectType.All:
          startColIndex = 0
          endColIndex = size(rcols) - 1
          startRowIndex = 0
          endRowIndex = this.renderList.length - 1
          break;
        default:
          break;
      }

      let startColProp = rcols[startColIndex].prop
      let endColProp = rcols[endColIndex].prop
      let sPos = { colIndex: startColIndex, rowIndex: startRowIndex, prop: startColProp }
      let endPos = { colIndex: endColIndex, rowIndex: endRowIndex, prop: endColProp }
      this.__locateSelector(sPos, endPos)
    }
    ////////////////////////////////////////// 框选
    onStartSelect(e: MouseEvent) {
      if (!this.extended) return

      let t = e.target as HTMLElement

      let handles: any
      if (this.onBeforeSelect) {
        handles = this.onBeforeSelect(t, e)
      }
      if (handles === true) return

      let { mouseMove, mouseUp } = handles ? handles : this.__getSelectDragHandles(e)

      let startTd = t.closest<HTMLElement>('.ce-table-cell')
      if (!startTd) {
        this.__clearSelector()
        return
      }
      let contentEl = t.closest('.ce-table-cell-content')
      if (contentEl) {
        let afterContent = window.getComputedStyle(contentEl, ':after').content
        if (test(afterContent, '#@#')) {
          return
        }
      }

      let checking = false;
      let rowHeight = this.vRowHeight;
      let maxRowIndex = this.renderList.length
      let moved = false;
      let scroller = this.scroller
      let root = this.renderRoot;
      let rect = root.getBoundingClientRect();
      let sx = e.clientX, sy = e.clientY
      let posMap: Record<number, number> = {};
      let startPos = this.fixedLeftConHead.previousElementSibling ? this.fixedLeftConHead.previousElementSibling.offsetWidth : 0;
      let startPosRight = 0;
      // let propMap: Record<number, string> = {}
      let fixedRightCols: any = []
      each(this.getRenderColumns(), (c: Record<string, any>, i: number) => {
        posMap[startPos] = i;
        // propMap[i] = c.prop
        startPos += c.width ?? c.minWidth;
        if (this._fieldMap.get(c.prop).fixed === 'right') {
          fixedRightCols.push([c, i])
        }
      });
      let viewWidth = this.offsetWidth
      let headerHeight = this.tableHead.offsetHeight
      let headerLeft = this.fixedLeftConHead.offsetWidth
      if (this.fixedLeftConHead.previousElementSibling) {
        headerLeft += this.fixedLeftConHead.previousElementSibling.offsetWidth
      }
      let headerRight = viewWidth - this.fixedRightConHead.offsetWidth
      let startColIndex = this.getColIndex(startTd)
      let startRowIndex = this.getRowIndex(startTd)
      let startCellPos: CellPos = { colIndex: startColIndex, rowIndex: startRowIndex, prop: startTd?.getAttribute('column')! }
      let endCellPos: CellPos = { colIndex: startColIndex, rowIndex: startRowIndex, prop: startTd?.getAttribute('column')! };
      const that = this
      if (!this.__lastStartCellPos) {
        this.__lastStartCellPos = clone(startCellPos)
        this.__lastEndCellPos = clone(endCellPos)
      } else {
        if (this.__lastStartCellPos.colIndex !== startCellPos.colIndex || this.__lastStartCellPos.rowIndex !== startCellPos.rowIndex) {
          this.__lastStartCellPos = clone(startCellPos)
          this.__lastEndCellPos = clone(endCellPos)
        }
      }
      this.emit(TableEvents.CellsChange, { cells: this.__selectedCells, rowCount: 1, colCount: 1 })
      if (this._reStats) {
        this._reStats(1)
      }

      let throttledMove = throttle(mouseMove!, 100);
      // mouseUp(e, checking, startCellPos, endCellPos);
      if (e.button === 0) {
        document.onmousemove = function (e: MouseEvent) {
          let cx = e.clientX,
            cy = e.clientY;
          if (Math.abs(cx - sx) < THRESHOLD && Math.abs(cy - sy) < THRESHOLD) return;

          moved = true;
          let xInTable = e.clientX - rect.x
          let yInTable = e.clientY - rect.y

          let moveX = xInTable + scroller.x;
          let moveY = yInTable + scroller.y - headerHeight;

          let colIndex = 0,
            rowIndex = Math.ceil(moveY / rowHeight) - 1;
          if (rowIndex < 0) rowIndex = 0;
          if (rowIndex >= maxRowIndex) rowIndex = maxRowIndex - 1;

          if (xInTable < headerLeft) {
            moveX = xInTable
          } else if (xInTable > headerRight) {
            moveX = moveX + that.vScrollWidth - viewWidth - scroller.x
          }
          eachRight(posMap, (v, k: number) => {
            // if (propMap[v] === ColumnProp.Index || propMap[v] === ColumnProp.Selection) {
            //   colIndex = v + 1;
            //   return false
            // }
            if (moveX > k && v > colIndex) {
              colIndex = v;
              return false;
            }
          });
          endCellPos.colIndex = colIndex;
          endCellPos.rowIndex = rowIndex;
          throttledMove(e, startCellPos, endCellPos, moveX, moveY);

          //自动边界滚动
          if (xInTable < SCROLLER_EDGE) {
            scroller.scrollXBy(-10);
          } else if (xInTable > rect.width - SCROLLER_EDGE) {
            scroller.scrollXBy(10);
          } else if (yInTable < SCROLLER_EDGE) {
            scroller.scrollYBy(-10);
          } else if (yInTable > rect.height - SCROLLER_EDGE) {
            scroller.scrollYBy(10);
          }
        };
      }

      window.onblur = document.onmouseup = () => {
        window.onblur = document.onmousemove = document.onmouseup = null;
        mouseUp(e, checking, startCellPos, endCellPos);
      };
    }
    __lastStartPos: CellPos
    __lastEndPos: CellPos
    __locateSelector(startPos: CellPos, endPos: CellPos) {
      let scs: CellPos[] = []
      if (startPos) {
        this.__lastStartPos = startPos
        this.__lastEndPos = endPos
      } else if (this.__lastStartPos) {
        startPos = this.__lastStartPos
        endPos = this.__lastEndPos
      }
      let minR = Math.min(startPos.rowIndex, endPos.rowIndex)
      let minC = Math.min(startPos.colIndex, endPos.colIndex)
      let maxR = Math.max(startPos.rowIndex, endPos.rowIndex)
      let maxC = Math.max(startPos.colIndex, endPos.colIndex)
      range(minR, maxR + 1).forEach(r => {
        range(minC, maxC + 1).forEach(c => {
          let colProp = this.getRenderColumns()[c].prop
          scs.push({
            rowIndex: r,
            colIndex: c,
            prop: colProp,
          })
        })
      })
      this.__selectedCells = scs

      this.topSelectedCellRowIndex = minR
      this.bottomSelectedCellRowIndex = maxR
      this.leftSelectedCellColIndex = minC
      this.rightSelectedCellColIndex = maxC
      this.leftSelectedCellProp = this.getRenderColumns()[minC].prop
      this.rightSelectedCellProp = this.getRenderColumns()[maxC].prop
      this.startSelectedCellCss = '.ce-table-row[data-row-index="' + startPos.rowIndex + '"] .ce-table-cell[column="' + startPos.prop + '"]{background:inherit !important;}'

      this.__renderSelector()

      this.onSelectorChange && this.onSelectorChange()
    }
    __clearSelector() {
      this.__selectedCells = []
      this.__renderSelector()
      // this._reStats(0)
      // each(this._columnFootMap, (v: ColumnFoot, k) => {
      //   v.selected = false
      // })
    }
    __getSelectDragHandles(se: MouseEvent) {
      let that = this;
      return {
        mouseMove: function (
          moe: MouseEvent,
          startPos: CellPos,
          endPos: CellPos,
          moveX: number,
          moveY: number
        ) {
          that.__locateSelector(startPos, endPos)

          if (that.__lastEndCellPos?.colIndex !== endPos.colIndex || that.__lastEndCellPos?.rowIndex !== endPos.rowIndex) {
            let rowCount = Math.abs(endPos.rowIndex - startPos.rowIndex) + 1
            that.emit(TableEvents.CellsChange, { cells: that.__selectedCells, rowCount, colCount: Math.abs(endPos.colIndex - startPos.colIndex) + 1 })
            that.__lastEndCellPos = clone(endPos)
            if (that._reStats) {
              that._reStats(rowCount)
            }
          }
        },
        mouseUp: function (e: MouseEvent, checking: boolean, startPos: CellPos,
          endPos: CellPos) {
          if (e.button === 2) {
            let sc = find(that.__selectedCells, (sc: any) => sc.rowIndex === startPos.rowIndex && sc.prop === startPos.prop)
            if (sc) {
              return
            }
          }

          that.__locateSelector(startPos, endPos)
        },
      };
    }
    __renderSelector() {
      let list = this.bodyCon.querySelectorAll('.ce-table-cell.' + CELL_CLASS_SELECTED)
      each(list, (el: Element) => {
        el.classList.remove(CELL_CLASS_SELECTED, CELL_CLASS_SELECTED_TOP, CELL_CLASS_SELECTED_BOTTOM, CELL_CLASS_SELECTED_LEFT, CELL_CLASS_SELECTED_RIGHT)
      })
      each(this.__selectedCells, (cell: CellPos) => {
        let el = this.bodyCon.querySelector('.ce-table-row[data-row-index="' + cell.rowIndex + '"] .ce-table-cell[column="' + cell.prop + '"]') as HTMLElement
        if (!el) return

        el.classList.add(CELL_CLASS_SELECTED)
        if (cell.rowIndex === this.topSelectedCellRowIndex) {
          el.classList.add(CELL_CLASS_SELECTED_TOP)
        }
        if (cell.rowIndex === this.bottomSelectedCellRowIndex) {
          el.classList.add(CELL_CLASS_SELECTED_BOTTOM)
        }
        if (cell.prop === this.leftSelectedCellProp) {
          el.classList.add(CELL_CLASS_SELECTED_LEFT)
        }
        if (cell.prop === this.rightSelectedCellProp) {
          el.classList.add(CELL_CLASS_SELECTED_RIGHT)
        }
      })
    }
    _renderCellSelector(cellEl: HTMLElement, rowIndex: number, prop: string) {
      if (cellEl.classList.contains(CELL_CLASS_SELECTED)) {
        cellEl.classList.remove(CELL_CLASS_SELECTED, CELL_CLASS_SELECTED_TOP, CELL_CLASS_SELECTED_BOTTOM, CELL_CLASS_SELECTED_LEFT, CELL_CLASS_SELECTED_RIGHT)
      }
      let sc = find(this.__selectedCells, (sc: CellPos) => sc.rowIndex === rowIndex && sc.prop === prop)
      if (sc) {
        cellEl.classList.add(CELL_CLASS_SELECTED)
        if (rowIndex === this.topSelectedCellRowIndex) {
          cellEl.classList.add(CELL_CLASS_SELECTED_TOP)
        }
        if (rowIndex === this.bottomSelectedCellRowIndex) {
          cellEl.classList.add(CELL_CLASS_SELECTED_BOTTOM)
        }
        if (prop === this.leftSelectedCellProp) {
          cellEl.classList.add(CELL_CLASS_SELECTED_LEFT)
        }
        if (prop === this.rightSelectedCellProp) {
          cellEl.classList.add(CELL_CLASS_SELECTED_RIGHT)
        }
      }
    }
    ////////////////////////////////////////// 键盘
    onGlobalKeydown(e: KeyboardEvent) {
      if (isEmpty(this.__selectedCells)) return

      if (e.ctrlKey && e.key.toLocaleLowerCase() === "c") {
        this.doCopy();
      } else if (e.ctrlKey && e.key === KeyboardKey.Backspace) {
        this.doSelect(SelectType.Col)
      } else if (e.shiftKey && e.key === KeyboardKey.Backspace) {
        this.doSelect(SelectType.Row)
      } else if (e.ctrlKey && e.key.toLocaleLowerCase() === "a") {
        this.doSelect(SelectType.All)
      }
    }
    ////////////////////////////////////////// API
    //获取选中框范围
    getSelectionRange() {
      return {
        topLeft: {
          rowIndex: this.topSelectedCellRowIndex,
          colIndex: this.leftSelectedCellColIndex,
          prop: this.getRenderColumns()[this.leftSelectedCellColIndex].prop
        },
        bottomRight: {
          rowIndex: this.bottomSelectedCellRowIndex,
          colIndex: this.rightSelectedCellColIndex,
          prop: this.getRenderColumns()[this.rightSelectedCellColIndex].prop
        }
      }
    }
  }

}