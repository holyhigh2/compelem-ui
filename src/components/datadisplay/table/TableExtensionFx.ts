import { Constructor } from "compelem";
import { compact, concat, flat, isArray, isDefined, isNumeric, lowerCase, map, sum } from "myfx";
import { showError } from "../../../utils/utils";

const FORMULA_EXP = /(?:([a-zA-Z])+\d+)|(?:([a-zA-Z]+)\(([a-zA-Z0-9,:]+)\))/mg
const CELL_ADDR_RANGE = /^[a-zA-Z]+\d+\s*:\s*[a-zA-Z]+\d+$/m
const CELL_ADDR_SPLIT = /^([a-zA-Z]+\d+,?)+$/
/**
 * table扩展混入，提供公式计算功能
 * @methods
 * 
 * @author holyhigh2
 */
export function TableExtensionFx<T extends Constructor<any>>(spuerClass: T) {
  return class TableExtensionFx extends spuerClass {

    //fx cache <fxStr,fxFn>
    formulaFnMap: Map<string, Function> = new Map()
    //value cache <cellPos,any>
    valueMap: Map<string, any> = new Map()
    //trace cells {cellPos:[cellPos...]}-> {d9:[b4, b5]}
    traceCells: Map<string, Set<string>> = new Map()

    constructor(...args: any[]) {
      super(...args)
    }

    ////////////////////////////////////////// methods
    _pushFxQueue(fxStr: string, rowIndex: number, prop: string, force = false) {
      let valKey = prop + "@" + rowIndex
      if (!force && this.valueMap.has(valKey)) {
        return this.valueMap.get(valKey)
      }
      let colIndex = this.allColumns.findIndex((c: Record<string, any>) => c.prop === prop)
      let [fn, args, cellChar] = this._getFormulaFn(lowerCase(fxStr), this.getColumnCharByIndex(colIndex) + (rowIndex + 1))
      return new Promise((resolve) => {
        let mappedArgs = map(args, arg => {
          if (isArray(arg)) {
            return map(arg, a => this.__getCellData(a, cellChar, fxStr))
          } else {
            return this.__getCellData(arg, cellChar, fxStr)
          }
        })
        //bind fx
        mappedArgs.unshift(sum)

        let v = fn.call(this, ...mappedArgs)
        resolve(v)
      }).then(v => {
        this.valueMap.set(prop + "@" + rowIndex, v)
        this.updateCell(prop, rowIndex, v)
      })
    }
    _getFormulaFn(fnStr: string, cellChar: string): [Function, any, string] {
      let fn = this.formulaFnMap.get(fnStr)!
      const args: any[] = []
      const argChars: string[] = []
      let i = 0
      let fnStr2 = fnStr.replace(FORMULA_EXP, (a: string, b: string, fName: string, fArgs: string) => {
        if (fName) {
          let adds = flat<string>(this.__parseAddress(fArgs))
          args.push(adds)
          if (!fn) {
            let argChar = this.getColumnCharByIndex(i++)
            argChars.push(argChar)
            return fName + "(" + argChar + ")"
          }
        } else {
          args.push(a)
          if (!fn) {
            let argChar = this.getColumnCharByIndex(i++)
            argChars.push(argChar)
            return argChar
          }
        }

        return ''
      })
      if (!fn) {
        fn = new Function(concat(['sum'], argChars).join(','), fnStr2.replace('=', 'return '))
        this.formulaFnMap.set(fnStr, fn)
      }
      return [fn, args, cellChar]//.call(this, ...args)
    }
    __getCellData(pos: string, posChar: string, f?: string) {
      let colChar = pos.replace(/\d+/, '')
      let prop = this.getColumnPropByChar(colChar)
      let rIndex = parseInt(pos.replace(colChar, ''))
      if (rIndex < 1) {
        showError('ce-table', 'The row index cannot less than 1 , "' + pos + '"')
        return ''
      }

      let traceList = this.traceCells.get(pos.toLowerCase())
      if (!traceList) {
        traceList = new Set()
        this.traceCells.set(pos.toLowerCase(), traceList)
      }
      traceList.add(posChar)

      let cellVal = this.innerData[rIndex - 1][prop]
      if (cellVal === f) return cellVal
      return this._getValue(rIndex - 1, prop)
    }
    //type1 -> a:b
    //type2 -> a,b
    __parseAddress(args: string) {
      let posAry: any[] = []

      if (CELL_ADDR_RANGE.test(args)) {
        let [sPos, ePos] = args.split(':')
        let sColChar = sPos.replace(/\d+/, '')
        let startColIndex = this.getColumnIndex(this.getColumnPropByChar(sColChar))
        let eColChar = ePos.replace(/\d+/, '')
        let endColIndex = this.getColumnIndex(this.getColumnPropByChar(eColChar))
        let sRowIndex = parseInt(sPos.replace(sColChar, ''))
        let eRowIndex = parseInt(ePos.replace(eColChar, ''))

        posAry = this.getAddress(sRowIndex, startColIndex, eRowIndex, endColIndex)
      } else if (CELL_ADDR_SPLIT.test(args)) {
        posAry = args.split(',')
      }
      return posAry
    }
    getAddress(rowIndex: number, prop: string | number, rowIndex2?: number, prop2?: string | number) {
      let startColIndex = isNumeric(prop) ? prop : this.allColumns[prop]?.prop
      let endColIndex = startColIndex
      let startRowIndex = rowIndex
      let endRowIndex = startRowIndex
      if (isNumeric(rowIndex2) && isDefined(prop2)) {
        endColIndex = isNumeric(prop2) ? prop2 : this.getColumnIndex(prop2 ?? '')
        endRowIndex = rowIndex2
      }

      let minCol = Math.min(parseInt(startColIndex + ""), parseInt(endColIndex + ""))
      let minRow = Math.min(parseInt(startRowIndex + ""), parseInt(endRowIndex + ""))
      let maxCol = Math.max(parseInt(startColIndex + ""), parseInt(endColIndex + ""))
      let maxRow = Math.max(parseInt(startRowIndex + ""), parseInt(endRowIndex + ""))

      if (minCol < 0 || maxCol > (this.allColumns.length - 1) || minRow < 0 || maxRow > (this.renderList.length)) {
        throw new Error('cell index is out of range')
      }
      let rowCells = [];
      for (let rIndex = minRow; rIndex <= maxRow; rIndex++) {
        let colCells: string[] = [];
        for (let cIndex = minCol; cIndex <= maxCol; cIndex++) {
          let colChar = this.getColumnCharByIndex(cIndex)
          colCells.push(colChar + rIndex);
        }
        rowCells.push(colCells);
      }
      return compact(rowCells);
    }
  }
}