import { concat, each, fill, findKey, get, groupBy, isArray, isEmpty, join, reject, upperCase } from "myfx";
import XLSX from "xlsx-js-style";
import { Table } from "../components/datadisplay/table/Table";

export function exportExcel(vtable: Table, fileName: string = 'cui-table-export', sheetName = 'Sheet1', options: Record<string, any> = {}) {
  let table = vtable
  let cols = table.getRenderColumns()
  let exportData: any = []
  let headerBgColor = "f4f4f4"
  let borderColor = '333333'

  let omitColumns = options.omitColumns
  let columns = options.columns

  let utils = XLSX.utils
  if (columns) {
    cols = table.allColumns.filter(col => columns.includes(col.prop))
  } else if (omitColumns) {
    cols = reject(cols, col => omitColumns.includes(col.prop))
  }

  let headerAry: string[][] = []
  cols.forEach(c => {
    // set(obj, c.label ?? '', v)
    fillHeader(headerAry, table._fieldMap.get(c.prop)!)
  })
  headerAry = headerAry.reverse()
  let mergeHeaderAry: any[] = []
  let mergeHeaderCol = true//合并列头
  let rowSpan: Record<string, Record<string, number>> = {}
  cols.forEach((c, cIndex) => {
    let colValueSize = 0
    headerAry.forEach((ary, rIndex) => {
      if (!ary[cIndex]) {
        ary[cIndex] = ''
      } else {
        let spanRow = rowSpan[rIndex]
        if (!spanRow) {
          spanRow = rowSpan[rIndex] = {}
        }
        let label = ary[cIndex]
        if (spanRow[label] && label === ary[cIndex - 1]) {
          spanRow[label]++
        } else {
          spanRow[label] = 1
        }
        colValueSize++
      }
    })
    if (!mergeHeaderCol) return

    if (colValueSize < 2) {
      headerAry[0][cIndex] = headerAry[headerAry.length - 1][cIndex]
      let startColName = utils.encode_col(cIndex)
      let startRowIndex = 1
      let endRowIndex = headerAry.length
      mergeHeaderAry.push(utils.decode_range(`${startColName}${startRowIndex}:${startColName}${endRowIndex}`))
    }
  })
  each(rowSpan, (obj, rIndex) => {
    each(obj, (colSize, colLabel) => {
      if (colSize > 1) {
        let cIndex = headerAry[parseInt(rIndex)].findIndex(t => t === colLabel)
        let startColName = utils.encode_col(cIndex)
        let endColName = utils.encode_col(cIndex + colSize - 1)
        let startRowIndex = 1 + parseInt(rIndex)
        mergeHeaderAry.push(utils.decode_range(`${startColName}${startRowIndex}:${endColName}${startRowIndex}`));
      }
    })
  })
  let headerRows = headerAry.length
  exportData.push(...headerAry)
  let data = table.getData()
  each(data, (item, i) => {
    let rIndex = i + 1
    let obj: any[] = []//{}
    cols.forEach(c => {
      let v = get(item, c.prop, '')
      //todo 这里需要自定义列内容，比如数组用，分割
      if (isArray(v)) {
        v = join(v, ',')
      }
      //index/selection
      if (c.prop === '__index' || c.prop === '__selection') {
        v = rIndex
      }
      obj.push(v)
      // set(obj, c.label ?? '', v)
    })
    exportData.push(obj)
  })
  exportData.push([''])
  // exportData.push({})
  //stats row
  if (table.showFooter) {
    exportData.push([''])
    exportData.push([''])
    exportData.push([''])
    // exportData.push({})
    // exportData.push({})
  }

  const ws = utils.aoa_to_sheet(exportData, { cellStyles: true, cellDates: true })!;
  //合并
  let spanObj = table.getSpanData()
  let mergeAry: any[] = []
  //body
  each(spanObj, (ary: Record<string, any>[], prop) => {
    //start
    let startColIndex = cols.findIndex((v) => v.prop === prop)
    let startColName = utils.encode_col(startColIndex)
    let endColName = startColName
    each(ary, ({ rowIndex, rowSpan, colSpan }) => {
      if (colSpan > 1) {
        let endColIndex = startColIndex + colSpan - 1
        let endCol = cols[endColIndex]
        if (endCol) {
          endColName = utils.encode_col(endColIndex)
        }
      } else {
        endColName = startColName
      }
      let startRowIndex = rowIndex + 1 + headerRows//header
      let endRowIndex = rowSpan > 1 ? startRowIndex + rowSpan - 1 : startRowIndex
      mergeAry.push(utils.decode_range(`${startColName}${startRowIndex}:${endColName}${endRowIndex}`))
    })
  })
  ws["!merges"] = concat(mergeHeaderAry, mergeAry)
  //列宽
  if (!ws["!cols"]) ws["!cols"] = [];
  cols.forEach((c, i) => {
    if (!ws["!cols"]![i]) ws["!cols"]![i] = { wpx: c.width ?? 40 };
  })
  //行高
  if (!ws["!rows"]) ws["!rows"] = [];
  //header
  for (let i = 0; i < headerRows; i++) {
    ws["!rows"]![i] = { hpt: getPound(table.headerHeight) };
  }

  //body
  each(data, (item, i) => {
    let rIndex = i + headerRows
    if (!ws["!rows"]![rIndex]) ws["!rows"]![rIndex] = { hpt: getPound(table.rowHeight) };
  })
  //单元格样式
  //1. 对其
  cols.forEach((c, colIndex) => {
    let colName = utils.encode_col(colIndex)
    let startRowIndex = 1 + headerRows//header
    let range = utils.decode_range(colName + startRowIndex + ":" + colName + (startRowIndex + data.length))
    //header
    for (let i = 1; i < headerRows + 1; i++) {
      if (!ws[colName + i].s) ws[colName + i].s = {};
      ws[colName + i].s.alignment = {
        horizontal: c.headerAlign,
        vertical: 'center',
      };
      ws[colName + i].s.fill = {
        fgColor: { rgb: headerBgColor }
      };
      ws[colName + i].s.font = {
        bold: true
      };
      let label = headerAry[i - 1][colIndex]
      if (i == headerRows || rowSpan[i - 1][label] > 1) {
        ws[colName + i].s.border = {
          bottom: { style: 'thin', color: { rgb: borderColor } }
        };
      }
    }

    //body
    for (let R = range.s.r; R <= range.e.r; ++R) {
      if (!ws[utils.encode_cell({ r: R, c: colIndex })]) continue;
      const cell_address = { c: colIndex, r: R };
      const cell_ref = utils.encode_cell(cell_address);
      if (!ws[cell_ref].s) ws[cell_ref].s = {};
      ws[cell_ref].s.alignment = {
        horizontal: c.align,
        vertical: 'center',
        wrapText: true
      };

      if (c.dataType === 'number') {
        ws[cell_ref].t = 'n'
        let pt = c.pattern
        if (pt) {
          //excel compatible
          if (pt[0] === ',') {
            pt = '#' + pt
          }
          //for excel number
          pt += `;-${pt};0;`
          ws[cell_ref].z = pt
        }

      }
      if (c.dataType === 'date' || c.dataType === 'datetime') {
        ws[cell_ref].t = 'd'
        ws[cell_ref].z = c.pattern
      }
    }
  })

  //统计
  if (table.showFooter) {
    if (!isEmpty(table.statsLabelMap)) {
      cols.forEach((c, colIndex) => {
        let statKey = table.statsColLabelMap[c.prop]
        let colName = utils.encode_col(colIndex)
        let groupRowStartIndex = data.length + headerRows + 2
        ws[colName + groupRowStartIndex] = { v: '' }
        if (!ws[colName + (groupRowStartIndex + 1)])
          ws[colName + (groupRowStartIndex + 1)] = { v: '' }

        if (statKey) {
          let fnName = findKey(table.statsLabelMap, v => v == statKey)
          ws[colName + (groupRowStartIndex + 1)].v = statKey
          let statFn = table.TableConfigPane.statsColStatMap[c.prop]

          let startRowIndex = 1 + headerRows//header
          let endRowIndex = data.length + headerRows
          //函数转换
          if (statFn) {
            if (fnName === 'mean') {
              fnName = 'AVERAGE'
            } else if (fnName === 'notfilled') {
              fnName = 'COUNTBLANK'
            }
            let fStr = `${upperCase(fnName)}(${colName}${startRowIndex}:${colName}${endRowIndex})`
            if (fnName === 'range') {
              fStr = `MAX(${colName}${startRowIndex}:${colName}${endRowIndex}) - MIN(${colName}${startRowIndex}:${colName}${endRowIndex})`
            } else if (fnName === 'filled') {
              fStr = `SUMPRODUCT(N(LEN(${colName}${startRowIndex}:${colName}${endRowIndex})>0))`
            }
            let t = 'n'
            let z = c.pattern
            if (c.dataType === 'number') {
              //excel compatible
              if (z[0] === ',') {
                z = '#' + z
              }
              //for excel number
              z += `;-${z};0;`
            }
            ws[colName + groupRowStartIndex] = { t, f: fStr, D: 1, z }
          } else {
            ws[colName + groupRowStartIndex] = { v: table._columnFootMap.get(c.prop)?.statValue ?? '-' }
          }

        }
        ws[colName + groupRowStartIndex].s = {
          fill: {
            fgColor: { rgb: headerBgColor }
          }
        }
        ws[colName + (groupRowStartIndex + 1)].s = {
          fill: {
            fgColor: { rgb: headerBgColor }
          },
          border: {
            top: { style: 'thin', color: { rgb: borderColor } }
          }
        }
      })
    }
  }

  //批注
  let allNotes = table.getNotes()
  let noteGroup = groupBy(allNotes, n => n[1])
  cols.forEach((c, colIndex) => {
    let ns = noteGroup[c.prop]
    if (ns) {
      ns.forEach(([rowIndex, prop, cmt]) => {
        let rIndex = parseInt(rowIndex + '') + 1 + headerRows//header
        let colName = utils.encode_col(colIndex)
        let cell = ws[colName + rIndex];
        if (!cell) cell = ws[colName + rIndex] = { t: cmt };
        if (!cell.c) cell.c = [];
        cell.c.hidden = true;
        cell.c.push({ t: cmt });
      })
    }
  })

  /* create workbook and append worksheet */
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  /* export to XLSX */
  XLSX.writeFile(wb, fileName + ".xlsx", { bookType: 'xlsx', type: 'binary' });
}
function getDPI() {
  const div = document.createElement('div')
  div.style.cssText = 'height: 1in; left: -100%; position: absolute; top: -100%; width: 1in;'
  document.body.appendChild(div)
  const devicePixelRatio = window.devicePixelRatio || 1,
    dpi = div.offsetWidth * devicePixelRatio;
  return dpi
}
function getPound(pxValue: number) {
  return pxValue * 72 / getDPI()
}
let spaceBeforeMerge = -1
function fillHeader(headerAry: string[][], col: any, level = 0) {
  let ary = headerAry[level]
  if (!ary) {
    ary = headerAry[level] = level > 0 ? fill([], '', 0, spaceBeforeMerge) : []
  }
  if (col.parentComponent.constructor.name === 'Column') {
    if (spaceBeforeMerge < 0) {
      spaceBeforeMerge = ary.length
    }
    fillHeader(headerAry, col.parentComponent, level + 1)
  } else if (spaceBeforeMerge > -1 && level === 0) {
    spaceBeforeMerge = -1
  }
  // if (spaceBeforeMerge > -1 && level > 0) {
  //   ary[spaceBeforeMerge] = col.label ?? ''
  // } else {
  ary.push(col.label ?? '')
  // }
}