import { Constructor } from "compelem"
import { last } from "myfx"
export const TransYReg = /translateY\((.*?)\)/
/**
 * 虚拟化循环混入，提供统一的状态及逻辑管理
 * 与 Virtualized 的区别在于不支持滚动条定位，并支持循环滚动
 * 用法：
 * 1. 需要初始化状态包括，行高、虚拟元素列表、缓冲区大小、数据行数
 * 2. 调用prepare初始化
 * 3. 绑定滚动事件并调用scroll
 * @author holyhigh2
 */
export function VirtualLoop<T extends Constructor<any>>(spuerClass: T) {
    return class VirtualLoop extends spuerClass {
        rowHeight: number
        vViewHeight: number
        vBufferSize: number = 3
        //滚动步长
        vStep: number = 100
        //数据长度
        vDataSize: number
        //dom rows
        vList: HTMLElement[]
        //窗口可显示的最大行数
        //包含上下缓存的虚拟行数，>= vViewRows
        vCachedRows: number

        constructor(...args: any[]) {
            super(...args)
        }

        scrolling = false
        scrollV(delta: number, cbk: (rowEl: HTMLElement, rowIndex: number) => void) {
            if (!this.vList) return;
            if (this.scrolling) return
            let maxTop = 0
            let minTop = 999999
            let toBottoms: HTMLElement[] = []
            let toTops: HTMLElement[] = []
            let sortedList = this.vList.sort((a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
            this.scrolling = true

            let maxRowIndex = parseInt(last(sortedList).dataset.rowIndex!)
            let minRowIndex = parseInt(sortedList[0].dataset.rowIndex!)
            this.vList.forEach((li, i) => {
                let newTop = parseFloat(li.style.transform.replace(TransYReg, '$1')) - this.vStep * delta
                if (delta > 0) {
                    if (newTop > maxTop) {
                        maxTop = newTop
                    }
                    if (newTop < -this.rowHeight * 3) {
                        toBottoms.push(li)
                    }
                } else if (delta < 0) {
                    if (newTop < minTop) {
                        minTop = newTop
                    }
                    if (newTop > this.vViewHeight + this.rowHeight * 3) {
                        toTops.push(li)
                    }
                }

                li.style.transform = `translateY(${newTop}px)`;
            })
            if (toBottoms.length) {
                toBottoms.forEach(li => {
                    li.style.transition = 'none'
                })
                this.nextTick(() => {
                    toBottoms.forEach((li, i) => {
                        li.style.transform = `translateY(${maxTop + this.rowHeight + (this.gap * (i + 1))}px)`;
                        li.dataset.rowIndex = String(++maxRowIndex)
                        cbk(li, maxRowIndex)
                        maxTop = maxTop + this.rowHeight
                        setTimeout(() => {
                            li.style.transition = 'transform .3s'
                        }, 40);
                    })
                    this.scrolling = false
                })
            } else if (toTops.length) {
                toTops.forEach(li => {
                    li.style.transition = 'none'
                })
                this.nextTick(() => {
                    toTops.forEach((li, i) => {
                        li.style.transform = `translateY(${minTop - this.rowHeight - (this.gap * (i + 1))}px)`;
                        --minRowIndex
                        if (minRowIndex < 0) {
                            minRowIndex = this.vDataSize + minRowIndex
                        }
                        li.dataset.rowIndex = minRowIndex + ''
                        cbk(li, minRowIndex)
                        minTop = minTop - this.rowHeight
                        setTimeout(() => {
                            li.style.transition = 'transform .3s'
                        }, 40);
                    })
                    this.scrolling = false
                })
            } else {
                this.scrolling = false
            }
        }
        /**
         * 更新虚拟参数
         * @param viewHeight 窗口高度
         * @param dataLength 数据长度
         */
        updateV(viewHeight: number, dataLength: number) {
            this.vViewHeight = viewHeight
            let count = Math.ceil(viewHeight / this.rowHeight)
            this.vCachedRows = count + this.vBufferSize * 2
            this.vDataSize = dataLength
        }
    }
}