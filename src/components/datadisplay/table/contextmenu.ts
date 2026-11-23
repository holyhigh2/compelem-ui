import { isString, size } from "myfx";
import { BlankRow, CheckSquareSolid, ClearContent, CopySelect, CopySelectFill, DeleteRow, ExpandDiagonal, FillColor, Paste, Select, SelectAllDuo } from "../../../icons/icons";
import { Editable } from "./Editable";
import { Table } from "./Table";
import { ColumnProp } from "./types";
import { t } from "../../../locale";

/**
 * 右键菜单
 */
export function getMenuItems(table: Editable) {
    return [
        { text: t('table.menu.paste'), iconSvg: Paste, hotKey: ["ctrl", "v"] },
        null,
        {
            text: t('table.menu.insertRow'),
            separate: true,
            children: [
                {
                    text: table.insertAbove.bind(table),
                    iconClass: "bi bi-layer-forward",
                    insert: 'above',
                },
                {
                    text: table.insertUnder.bind(table),
                    iconClass: "bi bi-layer-backward",
                    insert: 'under',
                },
            ],
            insert: 'under',
        },
        {
            text: t('table.menu.deleteRow'),
            children: [
                {
                    text: t('table.menu.deleteRow'),
                    iconSvg: DeleteRow,
                },
                {
                    text: t('table.menu.blankRow'),
                    iconSvg: BlankRow,
                },
            ],
            cellNeed: true,
        },
        {
            mode: "checkbox",
            checked: true,
            cellNeed: true,
            text: t('table.menu.clearContent'),
            hotKey: ["delete"],
            iconSvg: ClearContent,
        },
    ]
}

export function getContextMenuItems(table: Table) {

    let isSingleRow = table.topSelectedCellRowIndex === table.bottomSelectedCellRowIndex
    let isSingleCol = table.leftSelectedCellProp === table.rightSelectedCellProp
    let list: any[] = [
        // { id: "fillColor", text: "填色", iconSvg: "c-svg-fill-color" }
    ]
    if (table._fieldMap.has(ColumnProp.Selection) || table._fieldMap.has(ColumnProp.Index)) {
        let sCol = table._fieldMap.get(ColumnProp.Selection)
        let iCol = table._fieldMap.get(ColumnProp.Index)
        let hasIndexButton = sCol?.indexButton || iCol?.indexButton
        if (hasIndexButton || sCol) {
            if (size(list) > 0) list.push(null)
            if (hasIndexButton) {
                list.push({ id: "expandRow", text: t('table.menu.expandRow'), iconSvg: isString(hasIndexButton) ? hasIndexButton : ExpandDiagonal, disabled: !(hasIndexButton && isSingleRow) })
            }
            if (sCol) {
                list.push({ id: "checkRows", text: t('table.menu.checkRows'), iconSvg: CheckSquareSolid })
            }
        }
    }
    if (size(list) > 0) list.push(null)
    // list.push(null)
    if (isSingleRow && isSingleCol) {
        let sCol = table._fieldMap.get(table.leftSelectedCellProp)
        if (sCol?.colorable) {
            list.push({ id: "fillColorByCol", text: t('table.menu.fillColumn'), iconSvg: FillColor })
        }
        // if (sCol?.filterable)
        //     list.push({ id: "filterByCellValue", text: "按单元格值筛选", iconSvg: "c-svg-filter-list-light" })
    }
    list.push(null)
    list.push(...[
        // null,
        { id: "copyCells", text: t('table.menu.copyCells'), iconSvg: CopySelect, hotKey: ["ctrl", "c"] },
        { id: "copyCellsAndHeader", text: t('table.menu.copyCellsAndHeader'), iconSvg: CopySelectFill, },
        null,
        {
            text: t('table.menu.select'), children: [
                {
                    id: 'select-row',
                    text: t('table.menu.selectRow'),
                    hotKey: ["shift", "空格"],
                    iconSvg: Select
                },
                {
                    id: 'select-col',
                    text: t('table.menu.selectCol'),
                    hotKey: ["ctrl", "空格"],
                    iconSvg: Select
                },
                {
                    id: 'select-all',
                    text: t('table.menu.selectAll'),
                    hotKey: ["ctrl", "a"],
                    iconSvg: SelectAllDuo
                },
            ],
        },
    ])
    return list
}