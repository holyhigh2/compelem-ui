import { Constructor } from "compelem";
import { concat, each, isEmpty, isNumber, kebabCase, map, range, remove } from "myfx";
import { CellSpan } from "./types";

/**
 * 解析 `__mergedRowCellsMap` / `__mergedColCellsMap` 的键 —— 形状为 `rowIndex-prop`。
 *
 * **不能用 `k.split('-')`**：列 prop 自身可能含 `-`（宿主把列分组/区域前缀拼进 prop 时
 * 很常见，例如 `block-1__c0`、`detail-2024__amount`）。`split('-')` 会把 prop 截成
 * `block`，于是第二圈取 `endIndexMap[截断后的 prop]` 得到 `undefined` ⇒
 * `__getSpanCellStyle()` 抛 `Cannot read properties of undefined (reading 'has')`。
 *
 * 该异常发生在宿主 `data` setter 的 `span` 事件回调里（库 `Table.ts` 在 emit 后紧接着
 * 调 `__spanCells`），一旦抛出，**本次 data 变更的后续合并/样式重算全部中断**，症状是
 * "合并、条件属性、行高、冻结列一起失灵"。
 *
 * 行号恒为非负整数，故按**首个** `-` 切分即可（无 `-` 时视为只有行号）。
 */
function parseSpanKey(k: string): [string, string] {
  const i = k.indexOf('-')
  return i < 0 ? [k, ''] : [k.slice(0, i), k.slice(i + 1)]
}

/** 合并格的样式类，`__matchSpanStyle` 每轮都要从格子上摘掉再按需加回。 */
const SPAN_CELL_CLASSES: string[] = ['hide-span-cell', 'keep-span-cell', 'hide-span-cell-content', 'block-span-cell-content', 'transparent-span-cell', 'striped-span-cell', 'no-border-span-cell']
const SPAN_CELL_SELECTOR = SPAN_CELL_CLASSES.map(c => '.' + c).join(',')
/** 合并格标记：存在即代表上一轮写过 span 样式，本轮若没有就说明需要清理。 */
const SPAN_MARK = 'data-span'

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
    /**
     * 纵向合并块内**非锚行 → 锚行**：`"行号:prop"` → 锚行号（含可见行与所有被吞行）。
     *
     * 库没有真正的 rowspan，所以合并块在 DOM 里仍是 N 个独立的格。要让 N 个格表现得
     * 像**一个格**，内容与样式都得回到锚行：
     *  - **内容**：可见行是块内中间行（做法见 `__getSpanCellStyle` 的 `mIndex`），
     *    中间行的行数据通常是空的（业务值只写在左上角）⇒ 取值必须回落锚行，
     *    否则"居中"变成"整块空白"（2026-09-15 就是把可见行改回首行绕开这个问题的）；
     *  - **样式**：宿主按"格"下发样式，只写锚格 ⇒ 续行会拼出"锚行有色 + 下面几行白色"
     *    的条子，看起来根本不像合并（2026-10-21 报障）。
     *
     * 由 `Table._fillRow` 消费；宿主若给某一续行**自己**写了样式，则以宿主为准。
     */
    __spanTopRowMap: Record<string, number> = {}

    __rowCellClassMap: Record<string, string[]> = {}
    __rowCellWidthMap: Record<string, string> = {}
    __rowCellOldWidthMap: Record<string, string> = {}
    /**
     * 当前数据里是否存在任何合并格。为 false 时 `__matchSpanStyle` 直接把全部格子
     * 跳过 —— 没有合并是绝大多数表格的常态，而逐格清理 7 个 class 占了单行填充
     * 四分之一的时间。
     */
    __hasSpan = false


    __spanCells(spanObj: Record<string, any> | null) {
      this.__mergedRowCellsMap = {}
      this.__mergedColCellsMap = {}
      this.__hideRowCellsMap = {}
      this.__spanTopRowMap = {}
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
      // 合并从「有」变「无」时，DOM 上还留着上一轮的 span class 和内联宽度，
      // 而 `__matchSpanStyle` 已经整体跳过（见 `__hasSpan`），只能在这里一次性清掉。
      const hasSpan = !isEmpty(this.__rowCellClassMap) || !isEmpty(this.__rowCellWidthMap)
      if (this.__hasSpan && !hasSpan) this.__clearSpanMarks()
      this.__hasSpan = hasSpan
    }
    /**
     * 列所在的分槽区：`left` 左固定 / `scroll` 滚动区 / `right` 右固定。
     *
     * 冻结列不是 `position:sticky`，而是把这批 `ce-column` 搬到**另一个 slot 容器**
     * （`.ce-table-column-fixed.is-left`，`position:absolute`）里，行内因此有两个
     * 互相独立的 flex 流。合并横跨这两个容器时，隐藏被吞格必须用**不同手段**
     * （见 `__getSpanCellStyle` 里 colSpan 那段）。
     *
     * 索引口径与 `allColumns` 一致（`[...fixedLeft, ...scroll, ...fixedRight]`，
     * 末尾那个 `__scroller` 占位列算在右固定里）。`fixColumns` 还没跑过时两个数组
     * 都是空 ⇒ 全部算 scroll，退化成老行为。
     */
    __zoneOfColumn(index: number): "left" | "scroll" | "right" {
      const left = this.fixedLeftColumns?.length ?? 0
      const right = this.fixedRightColumns?.length ?? 0
      const total = this.allColumns?.length ?? 0
      if (index < left) return "left"
      if (right > 0 && index >= total - right) return "right"
      return "scroll"
    }
    /**
     * 按**当前**分槽区重算合并的隐藏策略 + 样式表。
     *
     * 为什么需要：`__getSpanCellStyle()` 是"数据变更时才重算"的（由 `__spanCells` 调）。
     * 但隐藏策略现在取决于列落在哪个槽（见 `__zoneOfColumn`），而槽是 `fixColumns`
     * 后来才建的 —— 预览态就是"先设 data（此时还没冻结）→ 再 fixColumns"，
     * 若不在分槽后重算，跨冻结边界的合并会一直按"全部同区"渲染 ⇒ 整行左移。
     * `__setDataColumns()` 在重建分槽后调用本方法。
     */
    __refreshSpanStyle() {
      if (!this.__updatableStyleSpan) return
      this.__updatableStyleSpan.replaceSync(this.__getSpanCellStyle())
    }
    __getSpanCellStyle() {
      // 注意：span 标记 class（hide-span-cell 等）在 __matchSpanStyle 中是**无前缀**的，
      // 此处选择器必须同步无前缀，否则整张样式表永不匹配（旧版误写为 .ce-table-xxx）。
      // 而后代 .ce-table-cell-content 是真实存在的单元格内容容器 class，必须保留前缀。
      let styles= `
        .hide-span-cell{
          display:none !important;
        }
        /*
         * 跨分槽区（冻结边界）的被吞列：**保布局、只隐藏**。
         */
        .keep-span-cell{
          visibility:hidden !important;
        }
        .hide-span-cell-content .ce-table-cell-content{
          display:none !important;
        }
        .block-span-cell-content .ce-table-cell-content{
          display:block !important;
        }
        .transparent-span-cell{
          background-color: transparent !important;
        }
        .striped-span-cell{
          background-color: var(--table-color-stripe) !important;
        }
        .no-border-span-cell{
          border-bottom:0 !important;
        }
      `
      this.__rowCellClassMap = {}
      this.__rowCellWidthMap = {}
      this.__rowCellOldWidthMap = {}
      this.__spanTopRowMap = {}
      let middleIndexMap: Record<string, Set<number>> = this.__middleIndexMap = {}
      let endIndexMap: Record<string, Set<number>> = this.__endIndexMap = {}
      each(this.__mergedRowCellsMap, (rowSpan, k) => {
        let [rIndex, prop] = parseSpanKey(k)
        /**
         * 内容可见行在块内的**相对行号**（1 基）—— 即"垂直居中"的落点。
         *
         * 库没有真正的 rowspan：纵向合并只做两件事 —— 藏掉非可见行的内容
         * （`.hide-span-cell-content`）、去掉块内横线（`.no-border-span-cell`），
         * 于是**内容画在哪一行，视觉重心就在哪里**。取中间行是唯一能让文字
         * 在整块里垂直居中的办法：
         *   rowSpan=1 → 1（不适用）；rowSpan=2 → 1（两行没有中间格）；
         *   rowSpan=3 → 2；rowSpan=4 → 2；rowSpan=5 → 3 …
         */
        let mIndex = rowSpan < 3 ? 1 : Math.ceil(rowSpan / 2)
        if (!middleIndexMap[prop]) {
          middleIndexMap[prop] = new Set()
          endIndexMap[prop] = new Set()
        }
        // 内容可见行的**绝对行号**。旧版误把 mIndex（相对偏移）当 key 用，
        // 导致 block-span-cell-content 打到错误行（rowSpan=2 时甚至落到合并区之外）。
        const topRow = parseInt(rIndex)
        let midRow = topRow + mIndex - 1
        middleIndexMap[prop].add(midRow)
        endIndexMap[prop].add(topRow + Math.ceil(rowSpan) - 1)
        // 块内其余行（可见行 + 被吞行）都指向锚行：让 N 个格表现成一个格
        for (let r = topRow + 1; r < topRow + Math.ceil(rowSpan); r++) {
          this.__spanTopRowMap[r + ":" + prop] = topRow
        }

        let cls = this.__rowCellClassMap[midRow + ":" + prop] = [] as string[]
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
        let [rIndex, prop] = parseSpanKey(k)
        let idx = this.allColumns.findIndex((col: any) => col.prop === prop)
        // 找不到锚列（列还没渲染出来 / 数据里的 prop 与列对不上）时整块跳过。
        //    旧实现直接 `findIndex(...) + 1` 当起点，`findIndex` 返回 -1 ⇒ `i = 0`，
        //    接着 `allColumns[si + i]` 在越界处抛
        //    `TypeError: Cannot read properties of undefined (reading 'prop')`。
        //    这条路径由 `.data` setter 派发的 `@span` 驱动，而 span 与列渲染的先后
        //    不保证（0.30 起模板取值与列渲染分属不同 effect 轮次）⇒ 必须按"取不到就跳过"处理。
        if (idx < 0) return
        let i = idx + 1
        // 横跨的列同样可能越过末列（span 数据来自模型，列数可能比它少）⇒ 按实有列裁剪。
        let rest = this.allColumns.slice(i, i + colSpan - 1)
        if (!rest.length) return
        const anchorZone = this.__zoneOfColumn(idx)
        let props = rest.map((col: any) => col.prop)
        props.forEach((prop: string, n: number) => {
          let cls = this.__rowCellClassMap[rIndex + ":" + prop]
          if (!cls) {
            cls = this.__rowCellClassMap[rIndex + ":" + prop] = [] as string[]
          }
          // 同一个容器里 display:none 是对的（锚格宽度已含这段；留着会双计宽度）；
          // 跨容器（合并越过冻结边界）必须保布局，否则会把同容器的其余列挤位。
          cls.push(this.__zoneOfColumn(i + n) === anchorZone ? 'hide-span-cell' : 'keep-span-cell')
        })
        let widthCss = map(concat(props, [prop]), p => `var(--column-width-${kebabCase(p.replaceAll('.', '-'))})`)
        this.__rowCellWidthMap[rIndex + ":" + prop] = `calc(${widthCss.join(' + ')})`
      })

      return styles
    }
    getSpanData() {
      return this.__spanObj
    }
    /**
     * 一次清掉所有合并痕迹（span class + 内联宽度 + `SPAN_MARK`）。只在合并配置
     * 从「有」变「无」时调用 —— 那时 `__matchSpanStyle` 已因 `__hasSpan=false`
     * 整体跳过，上一轮写进 DOM 的 class 与 width 没人回收。
     */
    __clearSpanMarks() {
      const cells = this.renderRoot?.querySelectorAll(SPAN_CELL_SELECTOR) as NodeListOf<HTMLElement> | undefined
      if (!cells) return
      for (let i = 0; i < cells.length; i++) {
        cells[i].classList.remove(...SPAN_CELL_CLASSES)
        cells[i].style.removeProperty('width')
        cells[i].removeAttribute(SPAN_MARK)
      }
    }
    /**
     * @param force 无视 `__hasSpan` 强制走一遍清理，用于 `Table.__legacyFill` 压测路径
     */
    __matchSpanStyle(cellEl: HTMLElement, rIndex: number, prop: string, force = false) {
      if (!force && !this.__hasSpan) return
      const key = rIndex + ":" + prop
      let cellCls = this.__rowCellClassMap[key]
      let cellWidth = this.__rowCellWidthMap[key]

      // 没有合并样式的格子占绝大多数：只有上一轮留过 `SPAN_MARK` 的才需要清理。
      if (!cellCls && !cellWidth) {
        if (force || cellEl.hasAttribute(SPAN_MARK)) {
          cellEl.classList.remove(...SPAN_CELL_CLASSES)
          cellEl.style.width = this.__rowCellOldWidthMap[key] ?? ''
          cellEl.removeAttribute(SPAN_MARK)
        }
        return
      }

      cellEl.setAttribute(SPAN_MARK, '')
      cellEl.classList.remove(...SPAN_CELL_CLASSES)
      if (cellCls) {
        // 只加 `__getSpanCellStyle` 算好的 class。这里**不要**再补
        // `transparent-span-cell`：条纹关闭时那块格子也应保留自己的底色，
        // 否则合并块会变成"锚行有色、其余格全透明"（旧实现在这里无条件补，
        // 靠宿主内联样式才压得住，属于隐形依赖）。
        cellEl.classList.add(...cellCls)
      }

      if (cellWidth) {
        this.__rowCellOldWidthMap[key] = cellEl.style.width
        cellEl.style.width = cellWidth
      }
    }
  }
}