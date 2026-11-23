import { Constructor } from "compelem";
import { each } from "myfx";

export const NOTE_ATTR = '__note'

/**
 * table扩展混入，提供单元格标注功能
 * @methods
 * 
 * @author holyhigh2
 */
export function TableExtensionCellNote<T extends Constructor<any>>(spuerClass: T) {
  return class TableExtensionCellNote extends spuerClass {

    notes: Record<string, any> = {}
    keyNotes: Record<string, any> = {}


    ////////////////////////////////////////// 监控鼠标进入
    onMouseEnterNoteContainer(ev: MouseEvent) {
      if ((ev.target as HTMLElement)?.matches('[' + NOTE_ATTR + ']')) {
        this.onEnterCell(ev.target as HTMLElement)
      }
    }
    onMouseLeaveNoteContainer({ target }: MouseEvent) {
      if (!(target as HTMLElement)?.matches('[' + NOTE_ATTR + ']')) return
      this.onLeaveCell(target as HTMLElement);
    }
    onEnterCell(cell: HTMLElement) {
      let cellContent: HTMLElement | null = cell
      if (!cell.classList.contains('c-table-cell-content')) {
        cellContent = cell?.querySelector('.ce-table-cell-content') || null
      }

      if (cell) {
        if (cellContent && cellContent.scrollWidth > cellContent.clientWidth) {
          // cell.setAttribute('title', cellContent.innerText)
        }
        let keyNote = cell.hasAttribute(NOTE_ATTR)
        if (keyNote) {
          let prop = cell.getAttribute('column')
          let rowIndex = parseInt((cell.closest('.ce-table-row') as HTMLElement).dataset.rowIndex!)

          const row = this.renderList[rowIndex]
          let rowKey = row ? row[this.rowKey] : null

          // 顺序不能反：浮层的默认槽内容会在**首次展开**时才挂进 overlay 的 content，
          // 那一刻 ce-message 才 mount，并按标签上的属性重新初始化 prop ——
          // 先写 msgDescr 会让模板刚 patch 进去的 `.descr` 被这次初始化清掉，
          // 而下次悬停 msgDescr 值没变 ⇒ 不再触发渲染，批注文案永远显示不出来。
          this.msgOverlay.openBy(cell)
          this.msgDescr = this.keyNotes[rowKey + '_' + prop] || this.notes[rowIndex + '_' + prop]
        }
      }
    }
    onLeaveCell(cell: HTMLElement) {
      this.msgOverlay.close()
    }

    ///////////////////////////////////////////////////////// APIs
    setNoteByKey(rowKey: string, prop: string, message: string) {
      this.keyNotes[rowKey + '_' + prop] = message
    }
    setNote(rowIndex: number, prop: string, message: string) {
      this.notes[rowIndex + '_' + prop] = message
    }
    removeNote(rowIndex: number, prop: string) {
      this.notes[rowIndex + '_' + prop] = null
      delete this.notes[rowIndex + '_' + prop]
    }
    removeNoteAll() {
      this.notes = {}
      this.keyNotes = {}
    }
    getNotes() {
      let rs: Array<[string | number, string, string]> = []
      let keyMap: Record<string, number> = {}
      each(this.innerData, (r: Record<string, any>, i) => {
        let k = r[this.rowKey]
        keyMap[k] = i
      })
      each(this.notes, (v, k) => {
        let [rowIndex, prop] = k.split('_')
        rs.push([rowIndex, prop, v])
      })
      each(this.keyNotes, (v, k) => {
        let [rowKey, prop] = k.split('_')
        rs.push([keyMap[rowKey], prop, v])
      })

      return rs
    }
  }
}