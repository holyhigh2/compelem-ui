import { Constructor } from "compelem";
import { each, isEmpty, walkTree } from "myfx";

/**
 * 展开态类名。
 *
 * 必须与样式表里的选择器同名：`tree/style.scss` 与 `table/style.scss` 用的都是
 * `.is-expanded`（`.ce-tree-node.is-expanded > .ce-tree-node-content …` 、
 * `.ce-table-caret.is-expanded ce-icon`）。两边对不上会导致展开后 caret 图标仍是右向（未展开）。
 */
export const CLASS_EXPAND = "is-expanded";
/**
 * 树形结构化混入，提供统一的状态及逻辑管理
 * @methods
 *  expandToLevel(number?) 展开树到指定级别，不传参展开全部
 *  collapseToLevel(number?) 折叠树到指定级别，不传参折叠全部
 *  expandToNodes(keys) 展开指定节点
 *  collapseToNodes(keys) 折叠指定节点
 * @author holyhigh2
 */
export function TreeStructured<T extends Constructor<any>>(spuerClass: T) {
    return class TreeStructured extends spuerClass {
        //展开的节点id，默认节点都是折叠状态
        declare expandedIdMap: Record<string, boolean>;
        declare treeData: Record<string, any>[];
        //过滤后的数据，树形结构
        declare filterTreeData: Record<string, any>[] | undefined
        //用于刷新computed数据显示
        declare refreshRenderSeed: number
        //节点唯一标识
        declare nodeKey: string
        //渲染列表，继承类必须实现
        //get renderList: Record<string, any>[]
        //每个节点的层级
        levelMap: Record<string, number> = {}

        groupedIndexMap: Record<string, number> = {}


        toggleExpand(node: Element) {
            // node 是**事件目标**（caret span / 其中的 ce-icon），而展开态样式是
            // `.ce-tree-node.is-expanded > .ce-tree-node-content …` —— 类必须落在
            // 「带 data-row-index 的行元素」上才可能命中，加在 target 上等于没加。
            const rowEl = node.closest('[data-row-index]') as HTMLElement
            if (!rowEl) return

            const i = parseInt(rowEl.dataset.rowIndex!)
            const rowData = this.renderList[i]
            if (!rowData) return

            let key = rowData[this.nodeKey]
            const expanded = !this.expandedIdMap[key]
            this.expandedIdMap[key] = expanded
            rowEl.classList.toggle(CLASS_EXPAND, expanded)

            this.refreshRenderSeed = Math.random()

            this.__scheduleExpandRefresh()
        }
        /**
         * 展开态变化后的重排入口。默认延迟 20ms 让 `refreshRenderSeed` 驱动的
         * 模板重建先落地；带树动画的组件会覆盖它，换成同帧路径。
         */
        __scheduleExpandRefresh() {
            setTimeout(() => {
                this.resetVirtualList()
                this.refreshView()
            }, 20)
        }
        /**
         * 扁平化tree数据
         * @param data 
         */
        flattenTreeData(data?: typeof this.data) {
            let rs: Record<string, any>[] = []
            let enim = this.expandedIdMap
            //1. 确定展开列表
            walkTree(isEmpty(data) ? this.data : data, (node, parent, chain, level, index) => {
                let key = node[this.nodeKey]
                this.levelMap[key] = level

                if (!node.children) {
                    this.groupedIndexMap[key] = index
                }
                rs.push(node)
                if (!enim[key]) {
                    return -1
                }
            })
            return rs
        }
        /**
         * 展开树到指定级别
         * @param toLevel 默认全部展开
         */
        expandToLevel(toLevel: number = Number.MAX_VALUE) {
            walkTree(this.filterTreeData || this.groupedData || this.data, (node, parent, chain, level, index) => {
                if (level <= toLevel && !isEmpty(node[this.childrenKey])) {
                    let key = node[this.nodeKey]
                    this.expandedIdMap[key] = true
                }
            })
            this.refreshRenderSeed = Math.random()

            this.__scheduleExpandRefresh()
        }
        /**
         * 合并树到指定级别
         * @param toLevel 默认全部合并
         */
        collapseToLevel(toLevel: number = -1) {
            this.expandedIdMap = {}
            this.expandToLevel(toLevel)
        }
        /**
         * 展开指定节点key
         * @param nodeKeys 
         */
        expandToNodes(keys: string[]) {
            each(keys, k => {
                this.expandedIdMap[k] = true
            })
            this.treeData = this.flattenTreeData(this.filterTreeData)
            this.refreshView()
        }
        /**
         * 合并指定节点key
         * @param keys 
         */
        collapseToNodes(keys: string[]) {
            each(keys, k => {
                this.expandedIdMap[k] = false
            })
            this.treeData = this.flattenTreeData(this.filterTreeData)
            this.refreshView()
        }
    }
}