import { Constructor } from "compelem";
import { arrayToTree, clone, cloneDeep, concat, each, every, filter, filterTree, find, findTreeNode, groupBy, isEmpty, kebabCase, parseJSON, remove, size, startsWith, tail, uuid } from "myfx";
import { AlignType, FilterFunctionMap, FilterType } from "../../../constants";
import { Column } from "./Column";
import { ColumnConfigPane } from "./ColumnConfigPane";
import { ColumnFoot } from "./ColumnFoot";
import { PRIV_COL_PREF } from "./Table";
import { ColumnType, ConfigType, Operation, RowHeightType, TableEvents } from "./types";

/**
 * table扩展混入，提供列头/列尾配置管理
 * @methods
 * 
 * @author holyhigh2
 */
export function TableExtensionConfig<T extends Constructor<any>>(spuerClass: T) {
  return class TableExtensionConfig extends spuerClass {
    groupOrders: Array<{ prop: string, condition?: string, name?: string }> | undefined
    groupedData: Record<string, any>[] | undefined
    grouping: boolean = false

    filterTreeData: Record<string, any>[] | undefined

    constructor(...args: any[]) {
      super(...args)
    }

    ////////////////////////////////////////// 列头
    doColumnHeadClick(col: Column, action: string) {
      switch (action) {
        case 'config':
          if (col.config && col.type !== ColumnType.Index && col.type !== ColumnType.Selection)
            this.TableConfigPane.open(this as any, col.prop, col.dataType, ColumnConfigPane.Config, col)
          break
        case 'clear':
          this._setSort(col.prop, null)
          break
        case 'filter':
          this.TableConfigPane.open(this as any, col.prop, col.dataType, ColumnConfigPane.Filter, col, this.__filterConditionMap[col.prop], false)
          break
      }
    }

    ////////////////////////////////////////// 列尾
    doColumnFootClick(col: ColumnFoot, action: string) {
      switch (action) {
        case 'stats':
          this._openStats(col.prop, col.dataType, col)
          break
      }
    }

    onClickTableHead(ev: PointerEvent) {
      let t = ev.target
      if (t instanceof Column) {
        let actionEl = find(ev.composedPath(), el => el instanceof Element && el.hasAttribute('data-action')) as Element
        if (!actionEl) return
        this.doColumnHeadClick(t, actionEl.getAttribute('data-action')!)
      }
    }
    onClickTableFoot(ev: PointerEvent) {
      let t = ev.target
      if (t instanceof ColumnFoot) {
        let actionEl = find(ev.composedPath(), el => el instanceof Element && el.hasAttribute('data-action')) as Element
        if (!actionEl) return
        this.doColumnFootClick(t, actionEl.getAttribute('data-action')!)
      }
    }

    /////////////////////////////////////////////////// configs
    __rowHeightType: string
    _setRowHeightType(rowHeightType: string, cancelEmit = false) {
      this.__rowHeightType = rowHeightType
      switch (rowHeightType) {
        case RowHeightType.Compact:
          this.vRowHeight = this.__fontSize * 1.5/* lineheight */ + this.__fontSize * 0.75 /* padding */
          break;
        case RowHeightType.Medium:
          this.vRowHeight = this.__fontSize * 1.5 * 3/* lineheight */ + this.__fontSize * 0.65  /* padding */
          break;
        case RowHeightType.Loose:
          this.vRowHeight = this.__fontSize * 1.5 * 5/* lineheight */ + this.__fontSize * 0.65  /* padding */
          break;
      }
      if (this.vRowHeight < 36) {
        this.vRowHeight = 36
      }
      this.__onRowHeightChange(rowHeightType)
      if (!cancelEmit) {
        this.emit(TableEvents.ConfigChange, { type: ConfigType.RowHeight })
      }
      this.forceUpdate()
    }

    _setSort(prop: string, sort: string | null, cancelEmit = false) {
      super._setSort(prop, sort, cancelEmit)
      this.nextTick(() => {
        this.refreshView()
      })
    }
    _clearSort() {
      super._clearSort()
      if (this.groupedData) {
        //更新分组数据
        this.__groupData()
      }
      this.refreshRenderSeed = Math.random()
      this.nextTick(() => {
        this.refreshView()
      })
    }
    _removeFix(prop: string) {
      remove(this.TableConfigPane.configSettingsMap[prop], x => x === Operation.Freeze)
    }
    /////////////////////////////////////////////////// filters
    //仅供列调用
    _openFilter(prop: string, dataType: string, btn: HTMLElement, side = false) {
      this.TableConfigPane.open(this, prop, dataType, ColumnConfigPane.Filter, btn, this.__filterConditionMap[prop], side)
    }
    _setFilter(prop: string, filter: null | FilterType, filterCondition: string, cancelEmit = false) {
      super._setFilter(prop, filter, filterCondition, cancelEmit, function (this: any, __baseFilter: any) {
        if (this.tree || this.grouping) {
          this.__doFilterTree()

          if (this.groupedData) {
            //更新分组数据
            this.__groupData()
          }
        } else {
          __baseFilter?.call(this)
        }
      })

      this.refreshRenderSeed = Math.random()
      this.nextTick(() => {
        this.resetVirtualList()
        this.scroller.calcBounding()

        this.TableConfigPane.onStat(this)
        this.refreshView()
      })
    }
    __doFilterTree() {
      if (size(this.__filterMap) > 0) {
        const pidMap: Record<string, any> = []
        let filterTreeData = filterTree(this.groupedData || this.innerData, (node, parentNode, chain) => {
          let rs = every(this.__filterMap, (fType: string, k) => {
            const f = FilterFunctionMap[fType]
            let value: string | Record<string, any> = this.__filterConditionMap[k]!
            try {
              value = parseJSON(value + "")
            } catch (error) { }
            return f(node, k, value!)
          })
          if (rs) {
            let p = chain[0]
            if (p) {
              pidMap[p[this.rowKey]] = null
              each(tail(chain), c => {
                pidMap[c[this.rowKey]] = p[this.rowKey] ?? null
                p = c
              })
            }

            pidMap[node[this.rowKey]] = p ? p[this.rowKey] ?? null : null
          }
          return rs
        })
        filterTreeData.forEach(fd => fd.pid = pidMap[fd[this.rowKey]])
        const td = arrayToTree(filterTreeData, 'id', 'pid')
        this.filterTreeData = td
      } else {
        this.filterTreeData = undefined
      }
    }
    _clearFilterData() {
      super._clearFilterData()
      this.filterTreeData = undefined
    }
    _clearFilter() {
      super._clearFilter()

      this.refreshRenderSeed = Math.random()
      this.nextTick(() => {
        this.resetVirtualList()
        this.scroller.calcBounding()
        this.refreshView()
      })
    }
    /////////////////////////////////////////////////// group
    __groupData() {
      if (!this.grouping || !this.groupOrders) return

      const firstColProp = filter<Record<string, any>>(this.allColumns, (c: any) => !startsWith(c.prop, PRIV_COL_PREF))[0].prop

      let groupedData: typeof this.data = this.__groupList(this.innerData, clone(this.groupOrders), firstColProp)

      this.groupedData = groupedData
    }
    __groupList(list: typeof this.data, groupColProps: typeof this.groupOrders, rootColProp: string) {
      if (isEmpty(groupColProps)) return list

      let { prop, condition } = groupColProps!.shift()!
      let grouped = groupBy(list, prop)
      const groupedData: typeof this.data = []
      each(grouped, (subList: typeof this.data, key) => {
        //针对每个分组创建组根节点
        const subGroupedData = size(groupColProps) > 0 ? this.__groupList(subList, concat(groupColProps), rootColProp) : subList
        let id = findTreeNode(this.groupedData!, row => row[rootColProp] === key)?.id
        if (!id) {
          id = uuid()
          this.groupedRootIds.push(id)
        }
        if (key == 'undefined' || key == 'null') {
          key = ''
        }
        const root = { [rootColProp]: key, children: subGroupedData, [this.rowKey]: id, _groupRoot: true, _groupCol: prop }
        groupedData.push(root)
      })
      return groupedData
    }
    //操作列/条专用
    _toggleGroupColumn(colProp: string) {
      let columns = clone(this.groupOrders ?? [])
      if (columns.findIndex(c => c.prop === colProp) >= 0) {
        remove(columns, c => c.prop === colProp)
      } else {
        columns.push({ prop: colProp, name: this._fieldMap.get(colProp)?.label })
      }
      this.setGroup(columns)
    }
    setGroup(columns: Array<{ prop: string, condition?: string, name?: string }>, cancelEmit = false) {
      if (typeof process !== 'undefined' && process.env && process.env.DEV) {
        if (this.tree) {
          console.warn(`Cannot to group data in 'Tree' mode`)
          return
        }
      }
      // if (isEmpty(columns) && isEmpty(this.groupOrders)) return

      this.groupOrders = columns
      this.grouping = false

      this.nextTick(() => {
        this.__doFilterTree()
      })

      if (this.showFooter)
        this.TableConfigPane.onStat(this)

      setTimeout(() => {
        this.nextTick(() => {
          this.expandToLevel(columns.length + 1)
        })
      }, 50)

      this.__onGroupChange(clone(columns))

      if (!cancelEmit) {
        this.emit(TableEvents.ConfigChange, { type: ConfigType.Group })
      }
    }
    _clearGroupData() {
      this.groupedData = undefined
      this.groupOrders = []
      this.grouping = false
    }
    clearGroup() {
      this._clearGroupData()
      setTimeout(() => {
        this.nextTick(() => {
          this.resetVirtualList()
          this.refreshView()
        })
      }, 50)
    }
    /////////////////////////////////////////////////// align
    _setAlign(prop: string, align: string, cancelEmit = false) {
      if (align === AlignType.Justify) {
        this.columnAlign[prop] = null
      } else {
        this.columnAlign[prop] = align
      }

      this.style.setProperty('--column-align-' + kebabCase(prop.replaceAll('.', '-')), align ?? 'initial')

      let justify = 'initial'
      switch (align) {
        case 'left':
          justify = 'flex-start'
          break
        case 'right':
          justify = 'flex-end'
          break
        default:
          justify = 'center'
      }
      this.style.setProperty('--column-align-justify-' + kebabCase(prop.replaceAll('.', '-')), justify)

      this.emit(TableEvents.AlignChange, { prop, align })
      if (!cancelEmit) {
        this.emit(TableEvents.ConfigChange, { type: ConfigType.Align })
      }
    }
    /////////////////////////////////////////////////// fill color

    /////////////////////////////////////////////////// fixed
    //仅供列脚调用
    _openStats(prop: string, dataType: string, btn: HTMLElement) {
      this.TableConfigPane.open(this, prop, dataType, ColumnConfigPane.Stats, btn)
    }
    onStat() {
      this.TableConfigPane.onStat(this)
    }
    getConfig() {
      return {
        fixed: { leftCount: this.fixedLeftColumns.length, rightCount: this.fixedRightColumns.length },
        sortQueue: cloneDeep(this.__sortQueue),
        filterConditions: clone(this.__filterConditionMap),
        filterMap: clone(this.__filterMap),
        rowHeightType: this.__rowHeightType,
        groupOrders: this.groupOrders,
        hiddenList: this._hiddenFieldList,
        alignMap: clone(this.columnAlign),
        fillColorConditions: this.fillColorConditions
      }
    }
    setConfig(config: Record<string, any> = {}) {
      if (!config) return
      if (config.fixed) {
        this.fixColumns(config.fixed.leftCount, config.fixed.rightCount, true)
      }
      if (config.hiddenList) {
        this.hideColumns(config.hiddenList, true)
      }
      if (config.rowHeightType) {
        this._setRowHeightType(config.rowHeightType, true)
      }
      if (config.groupOrders) {
        this.setGroup(config.groupOrders, true)
      }
      if (config.sortQueue) {
        this.__sortQueue = config.sortQueue
        this._setSort(uuid(), null, true) //触发更新
      }
      if (config.alignMap) {
        this.columnAlign = config.alignMap
      }
      if (config.fillColorConditions) {
        this.nextTick(() => {
          this.setFillColor(config.fillColorConditions, true)
        })
      }
      if (config.filterConditions && config.filterMap) {
        this.__filterMap = config.filterMap
        this.__filterConditionMap = config.filterConditions
        this._setFilter(uuid(), null, '', true) //触发更新
      }

      this.nextTick(() => {
        this.refreshView()
      })
    }
  }
}