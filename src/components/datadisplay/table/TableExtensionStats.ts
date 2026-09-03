import { Constructor, Template } from "compelem";
import { clone, each, filter, find, get, groupBy, isDefined, isString, keys, map, size, subtract, walkTree } from "myfx";
import { DataType, STATS_METRICS, STATS_METRICS_BASE } from "../../../constants";
import { ColumnFoot } from "./ColumnFoot";
import { Table } from "./Table";
import { CellPos, MetricType, TableEvents } from "./types";

/**
 * table扩展混入，提供列统计功能
 * @methods
 * 
 * @author holyhigh2
 */
export function TableExtensionStats<T extends Constructor<any>>(spuerClass: T) {
  return class TableExtensionStats extends spuerClass {

    statsColValueMap: Record<string, string | number> = {}
    statsLabelMap: Record<string, string> = {}
    statsColLabelMap: Record<string, string> = {}
    extStatsMap: Record<string, any> = {}
    extStatsFunctions: Record<string, any> = {}

    constructor(...args: any[]) {
      super(...args)
    }

    ////////////////////////////////////////// methods
    __updateStats(obj: Record<string, any>, statProp?: string) {
      obj.setLabelValue = (prop: string, label: string, value: any) => {
        obj.labels[prop] = label
        obj.values[prop] = value
        if (obj.stats) {
          obj.stats[prop] = ''
        }
      }
      obj.setValue = (prop: string, value: any) => {
        obj.values[prop] = value
        if (obj.stats) {
          obj.stats[prop] = ''
        }
      }
      this.emit(TableEvents.AfterDoStats, obj)
      //recalc stats of columns
      if (!this._columnFootMap || this._columnFootMap.size < 1) return
      // obj.selectedCells = clone(this.__selectedCells)
      if (statProp) {
        this._columnFootMap.get(statProp)?._onStats(obj, this as unknown as Table)
      } else {
        each(this._columnFootMap, (cf: ColumnFoot) => {
          if (!cf.stats) return
          cf._onStats(obj, this as unknown as Table)
        })
      }

    }
    _setStat(statsColStatMap: Record<string, string>, metricsBase: Record<string, {
      k: string;
      v: Function;
    }>, metrics: Record<string, Record<string, {
      k: string;
      v: Function;
    }>>, statProp?: string) {
      const rd = this.renderList.filter((d: Record<string, any>) => !d._groupRoot)
      this.__calcStat(rd, this.statsColValueMap, this._calcFn, statsColStatMap, metricsBase, metrics)

      if (subtract(this.bottomSelectedCellRowIndex, this.topSelectedCellRowIndex) !== 0) {
        let statsColData: Record<string, any> = {}
        let dataList: typeof this.renderList = []
        let rowGroup = groupBy(this.__selectedCells.filter((sc: CellPos) => sc.prop === this.__selectedCells[0].prop), (c: CellPos) => c.rowIndex)
        keys(rowGroup).forEach(rk => {
          let rowData = this.renderList[Number(rk)]
          dataList.push(rowData)
        })

        this.__calcStat(dataList, statsColData as any, this._calcFn, statsColStatMap, STATS_METRICS_BASE, STATS_METRICS)

        const labels = this.statsColLabelMap
        let eventObj = { values: (this.statsColValueMap), selectedValues: statsColData, stats: statsColStatMap, labels }
        this.__updateStats(eventObj, statProp)
        return
      }

      //统计底部
      if (this.grouping) {
        const level = this.groupOrders.length
        walkTree(this.filterTreeData || this.groupedData!, (node, pNode, chain, l) => {
          if (l > level) return false
          let statsColValueMap: Record<string, string | number> = {}
          if (node.children && node._groupRoot) {
            this.__calcStat(node.children, statsColValueMap, this._calcFn, statsColStatMap, metricsBase, metrics)
            each(statsColValueMap, (v, k) => {
              let statType = statsColStatMap[k]
              if (isDefined(statType)) {
                node[k] = v
              }
            })
          }
        })

        //refreshView
        let rowEls = this.vList.sort((a: HTMLElement, b: HTMLElement) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')))
        this.__fillCells(rowEls, rowEls.map((el: HTMLElement) => parseInt(el.dataset.rowIndex!)))
      }
      const labels = this.statsColLabelMap
      let eventObj = { values: (this.statsColValueMap), stats: (statsColStatMap), labels }
      this.__updateStats(eventObj, statProp)
    }
    __calcStat(data: Record<string, any>[], statsColValueMap: Record<string, string | number>, _calcFn: Function, statsColStatMap: Record<string, string>, metricsBase: Record<string, {
      k: string;
      v: Function;
    }>, metrics: Record<string, Record<string, {
      k: string;
      v: Function;
    }>>) {
      if (!!_calcFn) {
        data = clone(data)
        this._columnFootMap.forEach((cf: ColumnFoot) => {
          if (cf.stats && cf.stats !== MetricType.None) {
            let dataType = this._fieldMap.get(cf.prop)?.dataType!
            let colData = dataType === DataType.Number ? map(data, d => parseFloat(get(d, cf.prop))) : map(data, d => get(d, cf.prop))
            let v = _calcFn(cf.prop, colData, data)
            statsColValueMap[cf.prop] = v + ''
          }
        })
      } else {
        data = clone(data)
        each(statsColStatMap, (statType, prop) => {
          let dataType = this._fieldMap.get(prop)?.dataType!
          if (!dataType) return

          if (statType === MetricType.None) {
            statsColValueMap[prop] = ''
            this.statsColLabelMap[prop] = ''
            return
          }
          if (statType === MetricType.Index) {
            statsColValueMap[prop] = size(data)
            return
          }
          if (!metrics[dataType] && !metricsBase[statType]) return

          let metric = metricsBase[statType] ?? metrics[dataType][statType]
          let dataList = dataType === DataType.Number ? map(data, d => parseFloat(get(d, prop))) : map(data, d => get(d, prop))
          let v
          let k = metric?.k
          if (metric?.v) {
            let handler = metric.v || (() => { });
            v = size(data) > 0 ? handler(dataList) : undefined;
          } else {
            this.emit(TableEvents.DoExtStats, {
              data: clone(dataList), setter: (val: any) => {
                v = val
                k = find(this.extStatsMap, esm => esm.value == statType)?.name
                if (!k) {
                  k = this.extStatsFunctions[statType]
                }
              }
            })
          }
          let isFillStat = false
          switch (statType) {
            case MetricType.Filled:
            case MetricType.FilledPercent:
            case MetricType.NotFilled:
            case MetricType.NotFilledPercent:
              isFillStat = true
              break;
          }
          if (dataType == DataType.Number && !isFillStat && isDefined(v)) {
            v = parseFloat(v);
          }
          statsColValueMap[prop] = v
          this.statsLabelMap[statType] = k
          this.statsColLabelMap[prop] = k
        })
      }
    }
    //CellsChange 时调用, TableExtensionOperation
    _reStats(rowCount: number) {
      let eventObj = {}
      if (Math.abs(rowCount) > 1) {
        let dataList: typeof this.renderList = []
        let statsColData: Record<string, any> = {}
        let statsColStatMap: Record<string, string> = {}
        let rowGroup = groupBy(this.__selectedCells.filter((sc: CellPos) => sc.prop === this.__selectedCells[0].prop), (c: CellPos) => c.rowIndex)
        keys(rowGroup).forEach(rk => {
          let rowData = this.renderList[Number(rk)]
          dataList.push(rowData)
        })
        filter(this.__selectedCells, (c: CellPos) => {
          let col = this._columnFootMap.get(c.prop)
          if (col?.stats) {
            if (isString(col.stats)) {
              statsColStatMap[c.prop] = col.stats
            }
            let colData: any[] = []

            statsColData[c.prop] = colData
          }
        })
        this.__calcStat(dataList, statsColData as any, this._calcFn, statsColStatMap, STATS_METRICS_BASE, STATS_METRICS)

        const labels = this.statsColLabelMap
        eventObj = { values: clone(this.statsColValueMap), selectedValues: statsColData, stats: statsColStatMap, labels }
      } else {
        eventObj = { values: clone(this.statsColValueMap), stats: {}, labels: this.statsColLabelMap }
      }
      this.__updateStats(eventObj)
    }

    getStats() {
      return clone(this.statsColValueMap);
    }

    setStats(calcFn: (colProp: string, colData: Array<string | number>, data: Record<string, any>[]) => string | Template) {
      this._calcFn = calcFn
    }
  }
}