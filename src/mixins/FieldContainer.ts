import { Constructor } from "compelem";
import { clone, every, flatMap, isArray, isNil, parseJSON, remove, toObject } from "myfx";
import { DataType, FilterFunctionMap, FilterType, SortType } from "../constants";

enum FieldConfigType {
  Sort = 'sort',
  Group = 'group',
  Fixed = 'fixed',
  Filter = 'filter',
  Hide = 'hide',
  RowHeight = 'rowheight'
}
export enum FieldContainerEvents {
  Ready = 'ready',
  FilterChange = 'filterchange',
  Hide = 'columnhide',
  FieldChange = 'fieldchange',
  GroupChange = 'groupchange',
  ConfigChange = 'configchange',
  SortChange = 'sortchange',
  //排序时触发，可自定义排序
  Sort = 'sort'
}
/**
 * 只返回**存活**字段组件的 Map（见 `FieldContainer._fieldMap` 注释）。
 *
 * `isDestroyed` 是 compelem 组件实例上的只读标记（`destroy()` 内置位）；
 * 非组件值读不到该属性，按"存活"处理（`undefined` 为假）。
 */
class LiveFieldMap<V = any> extends Map<string, V> {
  get(key: string): V | undefined {
    const v = super.get(key)
    if (v && (v as any).isDestroyed) {
      this.delete(key)
      return undefined
    }
    return v
  }
}

/**
 * 字段容器混入，提供统一的字段控制、排序、筛选等
 * @methods
 * 
 * @author holyhigh2
 */
export function FieldContainer<T extends Constructor<any>>(spuerClass: T) {
  return class FieldContainer extends spuerClass {
    _hiddenFieldList: string[] = []
    /**
     * 字段映射（prop → 字段组件实例）。
     *
     * 字段的销毁可能**先于**容器：容器被整体替换时子先父后，容器侧的迟到回调
     * （`@mutate.child.debounce:100` 的 `onListReady`、`@debounced(100)` 的
     * `__fillCells`）仍会遍历本表；此时死字段的内部结构（`slots` / `slotHooks`）
     * 已随 `__data_` 一起被置空，读它就会抛
     * `Cannot read properties of null (reading 'cell')`。
     *
     * 守卫收敛在 `get()` 本身：死字段一律视为"不存在"并从表中剔除，
     * 调用方沿用既有的 `if (!col) return` 分支即可。
     */
    _fieldMap: Map<string, any> = new LiveFieldMap()
    //<field,fieldColorMap>
    _tagColorMap = new Map<string, Record<string, string>>()
    __sortQueue: Array<{ prop: string, sort: string }> = []
    //数据源（由子类的 `@state innerData` 提供存储，这里只声明类型）
    declare innerData: Array<Record<string, any>>
    //隐藏列
    declare invisibleFields: string[]
    declare sortOrders: Array<{ prop: string, sort: string }>
    declare filterData: Array<Record<string, any>> | undefined

    ////////////////////////////////////////// 字段隐藏/显示控制
    toggleFieldHide(colProp: string) {
      if (this._hiddenFieldList.includes(colProp)) {
        remove(this._hiddenFieldList, c => c === colProp)
      } else {
        this._hiddenFieldList.push(colProp)
      }
      this.hideFields(this._hiddenFieldList)
    }
    //仅供field初始化调用
    _hideField(colProp: string) {
      this._hiddenFieldList.push(colProp)
      this.hideFields(this._hiddenFieldList)
    }
    hideFields(colProps: string | string[], cancelEmit = false) {
      let colAry = isArray(colProps) ? colProps : [colProps]
      if (colAry !== this._hiddenFieldList) {
        this._hiddenFieldList = colAry
      }
      this.invisibleFields = Array.from(colAry)

      this.emit(FieldContainerEvents.Hide, { columns: Array.from(colAry) })
      this.__onFieldHideChange?.(Array.from(colAry))
      if (!cancelEmit)
        this.emit(FieldContainerEvents.ConfigChange, { type: FieldConfigType.Hide })
    }

    ////////////////////////////////////////// 字段过滤控制
    __filterFillMap: Record<string, string> = {}
    _setFilterFill(prop: string, filledOrNot: string) {
      this.__filterFillMap[prop] = filledOrNot

      this._setFilter(prop, this.__filterMap[prop], this.__filterConditionMap[prop])
    }
    __filterMap: Record<string, FilterType> = {}
    __filterConditionMap: Record<string, string> = {}
    _setFilter(prop: string, filter: null | FilterType, filterCondition: string, cancelEmit = false, customFilter?: (baseFilter?: () => void) => void) {
      if (filter) {
        this.__filterMap[prop] = filter
        this.__filterConditionMap[prop] = filterCondition
      } else if (this.__filterMap[prop]) {
        delete this.__filterMap[prop]
        delete this.__filterConditionMap[prop]
      }

      let autoFilter = true;
      let filters = toObject(this.__filterConditionMap)
      this.emit(FieldContainerEvents.FilterChange, { filters, cancel() { autoFilter = false } })
      this.__onFilterChange?.(filters)
      if (autoFilter) {
        if (customFilter) {
          customFilter.call(this, this.__baseFilter)
        } else {
          this.__baseFilter()
        }
      }
      if (!cancelEmit)
        this.emit(FieldContainerEvents.ConfigChange, { type: FieldConfigType.Filter })
    }
    __baseFilter() {
      let filterData = flatMap(this.innerData, r => {
        if (isNil(r)) {
          return []
        }
        let rs = every(this.__filterMap, (fType, k) => {
          let value: string | Record<string, any> = this.__filterConditionMap[k]!
          try {
            value = parseJSON(value + "")
          } catch (error) { }
          const f = FilterFunctionMap[fType]
          return f(r, k, value!)
        })
        let rs2 = every(this.__filterFillMap as any, (fType: FilterType, k: string) => {
          const f = FilterFunctionMap[fType]
          return f ? f(r, k, '') : true
        })
        return rs && rs2 ? r : []
      })
      this.filterData = filterData
    }
    _clearFilterData() {
      this.__filterConditionMap = {}
      this.__filterMap = {}
      this.filterData = undefined
      this.__filterFillMap = {}
    }
    _clearFilter() {
      this._clearFilterData()
      this.emit(FieldContainerEvents.FilterChange, { filters: {}, cancel() { } })
      this.__onFilterChange?.()
      if (this.groupedData) {
        //更新分组数据
        this.__groupData()
      }
      this.emit(FieldContainerEvents.ConfigChange, { type: FieldConfigType.Filter })
    }
    ////////////////////////////////////////// 字段排序控制
    _setSort(prop: string, sort: string | null, cancelEmit = false) {
      if (sort) {
        let existing = this.__sortQueue.find(s => s.prop === prop)
        if (existing) {
          existing.sort = sort
        }
        else {
          if (this.singleSort) {
            this.__sortQueue = [{ prop, sort }]
          } else {
            this.__sortQueue.push({ prop, sort })
          }
        }
      } else {
        this.__sortQueue = this.__sortQueue.filter(s => s.prop !== prop)
      }

      let autoSort = true;
      let orders = clone(this.__sortQueue)
      this.emit(FieldContainerEvents.SortChange, { orders, cancel() { autoSort = false } })
      this.__onSortChange?.(orders, prop)
      if (!cancelEmit) {
        this.emit(FieldContainerEvents.ConfigChange, { type: FieldConfigType.Sort })
      }

      if (autoSort) {
        this.sortOrders = clone(this.__sortQueue)
      }
    }
    _clearSort() {
      this.sortOrders = []
      this.__sortQueue = []
      this.emit(FieldContainerEvents.SortChange, { orders: [], cancel() { } })
      this.emit(FieldContainerEvents.ConfigChange, { type: FieldConfigType.Sort })
    }
    _sortFields(data: Record<string, any>[]) {
      if (this.sortOrders && this.sortOrders.length > 0) {
        let d = clone(data)
        let autoSort = true
        this.emit(FieldContainerEvents.Sort, {
          sortOrders: clone(this.sortOrders),
          sort(sorter: (a: Record<string, any>, b: Record<string, any>) => number) {
            d.sort(sorter)
            autoSort = false
          }
        })
        if (autoSort)
          this.sortOrders.forEach(s => {
            let dt = this._fieldMap.get(s.prop)?.dataType
            let isDateTime = dt === DataType.Date || dt === DataType.DateTime
            let isNumber = dt === DataType.Number
            d = d.sort((a, b) => {
              if (isNil(a)) return -1
              if (isNil(b)) return 1

              let va = a[s.prop]
              let vb = b[s.prop]
              if (isDateTime) {
                va = Date.parse(va) || 0
                vb = Date.parse(vb) || 0
              } else if (isNumber) {
                va = +va || 0
                vb = +vb || 0
              }
              if (va === vb) return 0;
              if (isNil(va)) return -1;
              if (isNil(vb)) return 1;
              if (s.sort === SortType.Asc) {
                return va < vb ? -1 : 1
              } else {
                return va > vb ? -1 : 1
              }
            })
          })
        data = d
      }
      return data
    }
  }
}