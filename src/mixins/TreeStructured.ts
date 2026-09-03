import { Constructor } from "compelem";
import { each, isEmpty, walkTree } from "myfx";

export const CLASS_EXPAND = "__expanded";
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

        constructor(...args: any[]) {
            super(...args)
        }

        toggleExpand(node: Element) {
            const rowEl = node.closest('[data-row-index]') as HTMLElement
            const i = parseInt(rowEl.dataset.rowIndex!)
            const rowData = this.renderList[i]
            let key = rowData[this.nodeKey]
            if (this.expandedIdMap[key]) {
                node.classList.remove(CLASS_EXPAND)
                this.expandedIdMap[key] = false
            } else {
                node.classList.add(CLASS_EXPAND)
                this.expandedIdMap[key] = true
            }

            this.refreshRenderSeed = Math.random()

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

            setTimeout(() => {
                this.resetVirtualList()
                this.refreshView()
            }, 20)
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