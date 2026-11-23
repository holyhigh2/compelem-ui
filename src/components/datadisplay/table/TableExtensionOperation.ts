import { Constructor } from "compelem";
import { clone, each, eachRight, find, isEmpty, range, size, test, throttle, trimStart } from "myfx";
import { THRESHOLD } from "uiik";
import { KeyboardKey } from "../../../constants";
import { beginDrag } from "../../../utils/dragSession";
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
    /**
     * 按坐标反查表格单元（2026-10-28 修，2026-10-30 恢复）。
     *
     * 为什么不能只靠 `e.target.closest('.ce-table-cell')`：合并区里除"内容格"以外的
     * 副本格带 `pointer-events: none`（要给内容层与填充柄让路），右键 / 按下时 target
     * 会落到行容器 `ce-table-column-scroll` 上 ⇒ closest 拿不到格子 ⇒ 三行合并区只有
     * 中间那行能弹菜单，其余两行右键毫无反应。
     *
     * 为什么不用 `_getCellDom`：它定义在 `Editable`（子类），本扩展同时混入**基础
     * Table**（只读预览用的 `ce-table`），那里没有这个方法 —— 直接调会抛
     * `is not a function`。这里改用「可见行矩形 + 列矩形」反查，两套表都能用。
     *
     * ⚠️ 跳过 `data-row-index="-1"`（库里的**测量行**，不在可视区内）。
     */
    __cellAtPoint(e: MouseEvent): HTMLElement | null {
      const body = this.tableBody as HTMLElement | undefined
      const rows = body?.querySelectorAll('.ce-table-row')
      if (!rows || !rows.length) return null
      const x = e.clientX
      const y = e.clientY
      for (const row of Array.from(rows) as HTMLElement[]) {
        if (row.getAttribute('data-row-index') === '-1') continue
        const rb = row.getBoundingClientRect()
        if (rb.height <= 0 || y < rb.top || y > rb.bottom) continue
        const cells = row.querySelectorAll('.ce-table-cell')
        for (const cell of Array.from(cells) as HTMLElement[]) {
          const cb = cell.getBoundingClientRect()
          if (cb.width <= 0) continue
          if (x >= cb.left && x <= cb.right) return cell
        }
        return null
      }
      return null
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

      // 合并区副本格（pointer-events:none）会让 target 落到行容器上，closest 拿不到格子
      // ⇒ 按坐标兜一层；仍拿不到才算真的按在表体外
      let cellEl = t.closest('.ce-table-cell') || this.__cellAtPoint(e)
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
      this._onContextMenu?.({ items: this.contextMenu.itemList, cells: this.__selectedCells })
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
      // 右键菜单 filterByCellValue 仍挂在这里，但按值筛选并未实现（旧实现取了值却没用）
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
      if (!startTd
        && this.rightSelectedCellColIndex >= 0
        && this.bottomSelectedCellRowIndex >= 0) {
        // 选区右下角格在样式里带 `pointer-events:none`（只放行 content 与 ::after）：
        // 按在它身上但没按中 content 时，e.target 是行内滚动容器，closest 拿不到格子
        // ⇒ 走到这里会把按下整个吞掉并清空选区（用户表现为"再框选没反应"）。
        // 按坐标回退解析为选区右下角格，恢复普通框选语义
        // （是否进入填充拖拽仍由 onBeforeSelect 的角格命中区判定把关）。
        // ⚠️ `_getCellDom` 定义在 `Editable`（子类）：本扩展同时混入**基础 Table**
        // （只读预览用的 `ce-table`），那里没有这个方法 —— 不能用 `this._getCellDom(...)`
        // 直接调，否则按空处时会抛 `is not a function`。
        const getCellDom = (this as any)._getCellDom
        const rbCell = (typeof getCellDom === 'function'
          ? getCellDom.call(this, this.bottomSelectedCellRowIndex, this.rightSelectedCellColIndex)
          : null) as HTMLElement | null
        const rbBox = rbCell?.getBoundingClientRect()
        if (rbCell && rbBox
          && e.clientX >= rbBox.x && e.clientX <= rbBox.x + rbBox.width
          && e.clientY >= rbBox.y && e.clientY <= rbBox.y + rbBox.height) {
          startTd = rbCell
        }
      }
      if (!startTd) {
        // 合并区副本格同样按不中内容层：在"只认右下角"那层之后再加一层通用坐标兜底
        //（仍拿不到才算真的按在空白处，此时才清空选区）
        startTd = this.__cellAtPoint(e)
      }
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
      let scroller = this.scroller
      let root = this.renderRoot;
      let rect = root.getBoundingClientRect();
      let sx = e.clientX, sy = e.clientY
      let posMap: Record<number, number> = {};
      let startPos = this.fixedLeftConHead.previousElementSibling ? this.fixedLeftConHead.previousElementSibling.offsetWidth : 0;
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

      const throttledMove = throttle(mouseMove!, 100);
      beginDrag(this as unknown as Element, { pointerId: (this as any).__bodyPointerId, clientX: e.clientX, clientY: e.clientY }, {
        onMove: (ev) => {
          // 只响应左键拖动（与按下时 `e.button === 0` 的口径一致）
          if (ev.buttons !== 1) return
          let cx = ev.clientX,
            cy = ev.clientY;
          if (Math.abs(cx - sx) < THRESHOLD && Math.abs(cy - sy) < THRESHOLD) return;

          let xInTable = ev.clientX - rect.x
          let yInTable = ev.clientY - rect.y

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
          throttledMove(ev, startCellPos, endCellPos, moveX, moveY);

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
        },
        onEnd: () => {
          throttledMove.cancel()
          mouseUp(e, checking, startCellPos, endCellPos);
        }
      })
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

      this.onSelectorChange?.()
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

          //__locateSelector 只更新选中状态/索引字段并重绘，既不派发 select 事件，
          //也不写 selectedCellsPos；而 Sn 行拖拽、Sn 列拖拽、填充拖拽三条路径
          //都额外调用了 _selectedCells。行体框选是主路径却遗漏了这一步，
          //导致「框选结束后触发 select({cellsPos})」的文档约定在行体框选下失效
          //（selectedCellsPos 也恒为 null）。此处补齐以与其余路径一致。
          //
          //⚠️⚠️ `_selectedCells` / `selectedCellsPos` 只存在于 `Editable`（子类），
          //   本扩展却同时混入**基础 Table** —— 只读预览用的 `<ce-table>` 就是一个
          //   基础 Table（`ReportDoc` 预览不开放编辑）。在那里直接调会抛
          //   `that._selectedCells is not a function`（2026-10-21 预览界面报障，
          //   栈顶就在本行），且发生在 document 的 mouseup 上 ⇒ 拖选后整页报错。
          //   基础表本来就没有「单元格坐标矩阵」语义（`TableEvents` 里也没有 select），
          //   所以只在方法存在时补发。
          const syncSelectedCells = (that as any)._selectedCells
          if (typeof syncSelectedCells === 'function') syncSelectedCells.call(that, startPos, endPos)
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
    /**
     * 这次键盘事件是否发生在本组件**之外**的输入态里（别的输入框 / textarea /
     * contenteditable），是则全局键盘处理一律让路。
     *
     * ⚠️ 为什么必须有这条守卫：`onGlobalKeydown` 绑在 `document.body` 上
     * （`@event('keydown', () => document.body)`，见 `Editable.onGlobalKeydown`），
     * 整页任何位置的按键都会进来。只要表里**有选区**，宿主页面里别的输入框就会遭殃：
     *   · `Ctrl+C` 被这里改成"复制表格"（宿主输入框里的选区被抢走 ⇒ 复制不出来）；
     *   · 可打印字符被当成"开始编辑单元格"（`activeInput("")` 直接把焦点搬进表格，
     *     宿主输入框丢掉正在输入的那个字符）。
     * 实测：AI 助手输入框里敲 `/`，焦点会跳到 `.ce-table-cell-input__text`、`/` 丢失；
     * `Ctrl+C` 会走一次 `doCopy()`。
     *
     * 判定方式：沿 `composedPath()` 往外走，遇到自己就停；途中第一个"输入态"元素
     * 只要不是**本站自己的单元格编辑器**（`inputCell`），即判为外部输入态。
     * 用 `composedPath` 而不是 `document.activeElement`：后者在外层只能拿到宿主
     * 元素（如 `ce-input` 的多行模式），真实焦点在内层 `<textarea>` 上。
     */
    __isForeignEditableKey(e: KeyboardEvent): boolean {
      const path: EventTarget[] =
        typeof (e as any).composedPath === "function" ? ((e as any).composedPath() as EventTarget[]) : []
      // `inputCell` 只存在于 Editable 一侧（Table 没有编辑框）⇒ 宽容取值
      const own = (this as any).inputCell as HTMLElement | null | undefined
      for (const node of path) {
        if ((node as any) === this) break
        const el = node as HTMLElement
        if (!el || !el.tagName) continue
        // 本站自己的单元格编辑器：放行（表内编辑态照旧由各自的 if 链处理）
        if (own && el === own) break
        const tag = el.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return true
      }
      return false
    }
    onGlobalKeydown(e: KeyboardEvent) {
      // 表外输入态（AI 输入框 / 公式栏 / 设置对话框…）里按键不属于表格
      if (this.__isForeignEditableKey(e)) return
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