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
    /**
     * 这三个字段**必须**是 `declare`（纯类型声明，零运行期发射）。
     *
     * 它们的真实存储由**子类 Table** 的同名装饰器提供（`@state groupOrders` /
     * `@state groupedData` / `@state filterTreeData` —— 见
     * `Table.ts` 的 tree/分组段）。编译器把访问器装在**原型**上，读写走 `this.__s.<k>.value`。
     *
     * 若这里写成无初始化器的普通类字段，`target: ESNext` 下 `useDefineForClassFields`
     * 默认为 true，esbuild 会发射 `Object.defineProperty(this,'groupOrders',{value:undefined})`
     * —— **实例自有属性遮蔽原型访问器**：`this.groupOrders === undefined` 而
     * `this.__s.groupOrders.value` 有真值 ⇒ 分组（`table.groupOrders` 读不到，列配置面板
     * 勾不上分组）、树过滤（`arrayToTree(filterTreeData, …)` 恒得到空数组）全部静默失效。
     */
    declare groupOrders: Array<{ prop: string, condition?: string, name?: string }> | undefined
    declare groupedData: Record<string, any>[] | undefined
    grouping: boolean = false

    declare filterTreeData: Record<string, any>[] | undefined


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
      // 性能：`this.vRowHeight = h` 走 @state setter，**同值赋值会被 setterValue 的
      //    `Object.is` 短路**（连派发都不会发生）。
      //    副作用（__onRowHeightChange 的 emit / tableBar 同步）保持无条件执行。
      const typeChanged = this.__rowHeightType !== rowHeightType
      this.__rowHeightType = rowHeightType
      let h: number
      switch (rowHeightType) {
        case RowHeightType.Compact:
          h = this.__fontSize * 1.5/* lineheight */ + this.__fontSize * 0.75 /* padding */
          break;
        case RowHeightType.Medium:
          h = this.__fontSize * 1.5 * 3/* lineheight */ + this.__fontSize * 0.65  /* padding */
          break;
        case RowHeightType.Loose:
          h = this.__fontSize * 1.5 * 5/* lineheight */ + this.__fontSize * 0.65  /* padding */
          break;
        default:
          // 非三档（如应用侧覆写后的 'custom'）：保持当前行高不变（与原 switch 无命中时一致）
          h = this.vRowHeight
          break;
      }
      // 行高与控件高度同源（Compact = 2.25 × 表格正文字号，与 --ce-control-h-md 一致）。
      // 只保留一个触控下限，不用绝对 36px 兜底：那会让 14px 根字号下出现
      // 14px 的字配 36px 的行，行内余量随字号变小而变大。
      if (h < 26) {
        h = 26
      }
      const heightChanged = this.vRowHeight !== h
      this.vRowHeight = h
      this.__onRowHeightChange(rowHeightType)
      if (!cancelEmit) {
        this.emit(TableEvents.ConfigChange, { type: ConfigType.RowHeight })
      }
      if (typeChanged || heightChanged) this.forceUpdate()
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
          let rs = every(this.__filterMap, (fType: string, k: string) => {
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

      // shift() 会真的消费掉分组列，必须保留调用，只解构用到的 prop
      let { prop } = groupColProps!.shift()!
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