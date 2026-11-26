import { Constructor } from "compelem"
import { filter, size } from "myfx"

/**
 * 列表虚拟化混入，提供统一的状态及逻辑管理
 * 用法：
 * 1. 需要初始化状态包括，行高、虚拟元素列表、缓冲区大小、数据行数
 * 2. 调用prepare初始化
 * 3. 绑定滚动事件并调用scroll
 * @author holyhigh2
 */
export function Virtualized<T extends Constructor<any>>(spuerClass: T) {
    return class Virtualized extends spuerClass {
        /**
         * 这些字段**只能**是 `declare`（纯类型声明，零运行期发射）。
         *
         * 它们真正的存储由**子类**的五族装饰器提供：`@state vList` / `@query('#vpillar') vPillar` …
         * 编译器把这些访问器装在**原型**上（读写 `this.__s.<k>.value`）。
         * 若这里写成普通类字段（`vPillar: HTMLElement`），esbuild 会按 define 语义发射
         * `Object.defineProperty(this,'vPillar',{value:undefined})` —— 实例自有属性**遮蔽**原型访问器，
         * 于是 `this.vList === undefined` 而 `this.__s.vList.value` 有真值：
         * Tree 整棵虚拟列表渲染不出节点、ListPicker 显示「无可选项」、Table 只剩 17px 空壳。
         *
         * 不要用「给个初始化器」来绕过（`vPillar: HTMLElement = undefined!`）—— 照样发射 own 属性。
         * 同 `mixins/FieldContainer.ts` 的 `invisibleFields` / `sortOrders` / `filterData` 范式。
         */
        declare vRowHeight: number
        vBufferSize: number = 3
        declare vScrollWidth: number
        declare vScrollHeight: number

        //行间隔
        vRowGap = 0
        declare vPillar: HTMLElement
        //dom rows
        declare vList: HTMLElement[]
        //窗口可显示的最大行数
        declare vViewRows: number
        //包含上下缓存的虚拟行数，>= vViewRows
        declare vCachedRows: number
        //总数据行数
        declare vAllRows: number


        /**
         * 把宿主 prop `rowHeight` 派生进 `vRowHeight`（虚拟列表实际使用的行高）。
         *
         * 边界：`rowHeight > 0` 以 prop 为准；`<= 0` 是 Table 的自动测量档，
         * 必须留给 `TableExtensionConfig#_setRowHeightType` 写入的测量值，不能覆盖。
         * 没有 `rowHeight` prop 的宿主（YearMonthPanel / ColorPicker）读到 undefined，同样不覆盖。
         */
        syncVRowHeight() {
            const rowHeightType = (this as any).__rowHeightType
            if (rowHeightType && rowHeightType !== 'custom') return
            const rh = (this as any).rowHeight
            if (rh > 0 && this.vRowHeight !== rh) this.vRowHeight = rh
        }

        __vLastInViewList: HTMLElement[] = []
        __vLastScrollTop = 0
        __vLastScrollDir = ''
        scrollV(scrollTop: number, cbk: (rowEl: HTMLElement, rowIndex: number) => void) {
            if (!this.vList) return;
            if (this.vList.length < this.vViewRows) return;

            const top = scrollTop

            let offset = top - this.__vLastScrollTop
            this.__vLastScrollTop = top

            let appendList: HTMLElement[] = []
            let prependList: HTMLElement[] = []
            let dir = offset > 0 ? 'up' : 'down'
            let rowH = this.vRowHeight + this.vRowGap
            let startRowIndex = Math.floor(top / rowH)

            let upperLimit = (startRowIndex - this.vBufferSize) * rowH
            let lowerLimit = (startRowIndex + this.vList.length - 1 - this.vBufferSize) * rowH

            let rowIndexMap: Record<string, boolean> = {}
            let tmpList = []
            for (let i = 0; i < this.vList.length; i++) {
                const c = this.vList[i];
                let newTy = parseFloat(c.style.transform.replace(/translateY\((.*?)\)/, '$1'))

                rowIndexMap[c.dataset.rowIndex!] = true

                if (newTy <= lowerLimit && newTy >= upperLimit) {
                    tmpList.push(c)
                }

                //up
                if (newTy < upperLimit && this.__vLastScrollDir === 'up'
                ) {
                    if (!appendList.includes(c))
                        appendList.push(c)
                    continue;
                }
                if (newTy > lowerLimit && this.__vLastScrollDir === 'down'
                ) {
                    if (!prependList.includes(c))
                        prependList.push(c)
                    continue;
                }
            }
            this.__vLastInViewList = tmpList


            if (offset > 0) {
                //滚轮下滚
                if (this.__vLastScrollDir && this.__vLastScrollDir !== 'up') {
                    let prepends = filter<HTMLElement>(this.vList, c => {
                        let ty = parseFloat(c.style.transform.replace(/translateY\((.*?)\)/, '$1'))
                        return ty > lowerLimit || ty < upperLimit
                    })

                    appendList = prepends
                }

                let startR = startRowIndex - this.vBufferSize
                if (startR < 0) startR = 0
                let minRowIndex = 99999;
                for (let i = 0; i < appendList.length; i++) {
                    const c = appendList[i];
                    let r = startR++
                    if (r < minRowIndex) {
                        minRowIndex = r
                    }
                    if (r >= this.vAllRows) {
                        do {
                            r = --minRowIndex
                        } while (rowIndexMap[r]);
                    }

                    if (rowIndexMap[r]) {
                        do {
                            r++
                        } while (rowIndexMap[r]);
                        if (r >= this.vAllRows) continue;
                        rowIndexMap[r] = true
                    }

                    let newTy = r * (this.vRowHeight + this.vRowGap);
                    c.dataset.rowIndex = r + ''
                    c.style.transform = `translateY(${newTy}px)`;
                    cbk(c, r)
                }
            } else {
                //滚轮上滚
                if (this.__vLastScrollDir && this.__vLastScrollDir !== 'down') {
                    let appends = filter<HTMLElement>(this.vList, c => {
                        let ty = parseFloat(c.style.transform.replace(/translateY\((.*?)\)/, '$1'))
                        return ty > lowerLimit || ty < upperLimit
                    })

                    prependList = appends
                }

                let startR = startRowIndex - this.vBufferSize
                let maxRowNoInView = startR + this.vCachedRows
                if (startR < 0) startR = 0

                for (let i = 0; i < prependList.length; i++) {
                    const c = prependList[i];
                    let r = startR//++

                    if (rowIndexMap[r]) {
                        do {
                            r++
                        } while (rowIndexMap[r]);
                        if (r >= this.vAllRows) continue;
                        if (r > maxRowNoInView) continue;
                    }

                    rowIndexMap[r] = true
                    let newTy = r * (this.vRowHeight + this.vRowGap);
                    c.dataset.rowIndex = r + ''
                    c.style.transform = `translateY(${newTy}px)`;
                    cbk(c, r)
                }
            }

            this.__vLastScrollDir = dir;
        }
        /**
         * 更新虚拟参数
         * @param allRows 数据行总数 
         * @param windowHeight 窗口高度
         * @param setVPillar 是否设置支柱高度
         * @param holdCache 当缓存行数小于当前设置时是否忽略
         */
        updateV(allRows: number, windowHeight: number, setVPillar = true, holdCache = false) {
            this.syncVRowHeight()
            this.vAllRows = allRows
            let count = Math.ceil(windowHeight / this.vRowHeight)
            let vCachedRows = count + this.vBufferSize * 2
            if (this.vCachedRows < 1 || !(holdCache && vCachedRows < this.vCachedRows)) {
                this.vCachedRows = vCachedRows;
            } else {
                // let vcr = vCachedRows
                // while(vcr--){
                //     this.vList[vcr].removeAttribute('available')
                // }
            }

            this.vViewRows = count
            this.vScrollHeight = this.vAllRows * (this.vRowHeight + this.vRowGap)
            // vPillar 仅在虚拟列表模式下渲染；分组模式等场景下不存在，需做空值保护
            if (setVPillar && this.vPillar)
                this.vPillar.style.height = this.vScrollHeight + 'px'
            return vCachedRows
        }
        /**
         * 初始化虚拟列表
         * @param vList 虚拟列表DOM元素
         * @param scrollTop 当前视图top
         * @param onRowInit 行初始化钩子
         * @returns 索引数组
         */
        initV(vList: HTMLElement[], scrollTop: number, onRowInit?: (row: HTMLElement, rowIndex: number) => void) {
            // 与 updateV 各调一次：宿主的调用顺序不一致（ListPicker 先 initV 后 updateV，
            // Table 相反），两个几何入口都必须拿到当前行高，否则先跑的那个会用到旧快照。
            this.syncVRowHeight()
            this.vList = vList
            let firstRowNoInView = scrollTop / this.vRowHeight >> 0
            if (firstRowNoInView > this.vAllRows) {
                firstRowNoInView = this.vAllRows - size(vList)
            }
            let rowIndexAry: number[] = []
            let negNum = 1
            let maxIndex = this.vAllRows - 1
            this.vList.forEach((row, i) => {
                let rowIndex = firstRowNoInView + i
                if (rowIndex > maxIndex) {
                    rowIndex = firstRowNoInView - negNum++
                }
                row.dataset.rowIndex = rowIndex + ''
                row.style.transform = `translateY(${rowIndex * (this.vRowHeight + this.vRowGap)}px)`
                if (onRowInit) {
                    onRowInit(row, rowIndex)
                }
                rowIndexAry.push(rowIndex)
            })
            return rowIndexAry
        }
        /**
         * 获取视图区域中的列表并按从上到下的顺序排列
         */
        getInViewList() {
            return this.__vLastInViewList
        }
    }
}