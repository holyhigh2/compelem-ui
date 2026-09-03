import { isString, size } from "myfx";
import { Editable } from "./Editable";
import { Table } from "./Table";
import { ColumnProp } from "./types";

/**
 * 右键菜单
 */
export function getMenuItems(table: Editable) {
    return [
        { text: "粘贴", iconSvg: "c-svg-paste", hotKey: ["ctrl", "v"] },
        null,
        {
            text: "插入行",
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
            text: "删除行",
            children: [
                {
                    text: "删除行",
                    icon: '<svg class="ce-table-icon" width="16px" height="16.00px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M307.2 752.941176c0-36.141176 30.117647-60.235294 60.235294-60.235294h487.905882c24.094118 0 42.164706 18.070588 42.164706 36.141177s-12.047059 36.141176-36.141176 36.141176h-481.882353v66.258824h475.858823c18.070588 0 36.141176 12.047059 36.141177 36.141176v6.02353c0 18.070588-12.047059 36.141176-36.141177 36.141176H367.435294c-36.141176 0-66.258824-24.094118-66.258823-54.211765V752.941176zM307.2 186.729412c0-36.141176 30.117647-60.235294 60.235294-60.235294h487.905882c24.094118 0 36.141176 18.070588 36.141177 36.141176s-12.047059 36.141176-36.141177 36.141177h-481.882352v66.258823h475.858823c18.070588 0 36.141176 12.047059 36.141177 36.141177v6.023529c0 18.070588-12.047059 36.141176-36.141177 36.141176H361.411765c-36.141176 0-66.258824-24.094118-66.258824-54.211764V186.729412z" fill="#1B2231" /><path d="M90.352941 427.670588v180.705883c0 18.070588 12.047059 36.141176 36.141177 36.141176h301.17647c18.070588 0 36.141176-12.047059 36.141177-36.141176v-180.705883c0-18.070588-12.047059-36.141176-36.141177-36.141176h-301.17647c-18.070588 6.023529-36.141176 18.070588-36.141177 36.141176z m66.258824 36.141177h234.917647v114.447059H156.611765V463.811765z" fill="#FF2E2E" /><path d="M156.611765 463.811765h234.917647v114.447059H156.611765z" fill="#FCD5D5" /><path d="M789.082353 379.482353c12.047059-12.047059 36.141176-12.047059 48.188235 0 12.047059 12.047059 12.047059 30.117647 6.02353 42.164706l-6.02353 6.023529-210.823529 210.82353c-12.047059 12.047059-36.141176 12.047059-48.188235 0-6.023529-18.070588-12.047059-36.141176 0-48.188236l6.023529-6.023529 204.8-204.8z" fill="#FF2E2E" /><path d="M584.282353 379.482353c12.047059-12.047059 30.117647-12.047059 42.164706-6.023529l6.023529 6.023529L843.294118 590.305882c12.047059 12.047059 12.047059 36.141176 0 48.188236-12.047059 12.047059-30.117647 12.047059-42.164706 6.023529l-6.02353-6.023529-210.823529-210.82353c-18.070588-18.070588-18.070588-36.141176 0-48.188235z" fill="#FF2E2E" /></svg>',
                },
                {
                    text: "空白行",
                    icon: '<svg class="ce-table-icon" width="16px" height="16.00px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M128 256h682.666667v213.333333H128V256z m700.074667 275.541333l48.256 48.256-81.408 81.365334 81.536 81.578666-48.256 48.256-81.536-81.578666-81.493334 81.578666-48.298666-48.256 81.493333-81.578666-81.365333-81.365334 48.256-48.256 81.408 81.322667 81.408-81.322667zM554.666667 554.666667v213.333333H128v-213.333333h426.666667z m-42.666667 42.666666H170.666667v128h341.333333v-128z m256-298.666666v128H170.666667V298.666667h597.333333z" fill="#333333" /></svg>',
                },
            ],
            cellNeed: true,
        },
        {
            mode: "checkbox",
            checked: true,
            cellNeed: true,
            text: "清除内容",
            hotKey: ["delete"],
            icon: '<svg t="1713889314318" class="ce-table-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15815" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16"><path d="M159.488 256c-52.608 0-96 43.328-96 96v256c0 52.672 43.392 96 96 96h291.264c-1.216 10.624-3.2 21.056-3.2 32 0 158.72 129.28 288 288 288 158.656 0 288-129.28 288-288a288 288 0 0 0-128-239.232V352c0-52.672-43.392-96-96-96h-640z m0 64h640c18.048 0 32 14.016 32 32v113.6a284.352 284.352 0 0 0-96-17.6C610.624 448 504.96 528.512 465.152 640H159.488a31.552 31.552 0 0 1-32-32v-256c0-17.984 14.016-32 32-32z m576 192c124.16 0 224 99.904 224 224s-99.84 224-224 224a223.488 223.488 0 0 1-224-224c0-124.096 99.904-224 224-224z m-160 192v64h320v-64h-320z" fill="#E51E34" p-id="15816"></path></svg>',
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
                list.push({ id: "expandRow", text: "展开详情", iconSvg: isString(hasIndexButton) ? hasIndexButton : "c-svg-expand-diagonal", disabled: !(hasIndexButton && isSingleRow) })
            }
            if (sCol) {
                list.push({ id: "checkRows", text: "选中数据", iconSvg: "c-svg-check-square-solid" })
            }
        }
    }
    if (size(list) > 0) list.push(null)
    // list.push(null)
    if (isSingleRow && isSingleCol) {
        let sCol = table._fieldMap.get(table.leftSelectedCellProp)
        if (sCol?.colorable) {
            list.push({ id: "fillColorByCol", text: "整列填色", iconSvg: "c-svg-fill-color" })
        }
        // if (sCol?.filterable)
        //     list.push({ id: "filterByCellValue", text: "按单元格值筛选", iconSvg: "c-svg-filter-list-light" })
    }
    list.push(null)
    list.push(...[
        // null,
        { id: "copyCells", text: "复制单元格", iconSvg: "c-svg-copy-select", hotKey: ["ctrl", "c"] },
        { id: "copyCellsAndHeader", text: "复制单元格及表头", iconSvg: "c-svg-copy-select-fill", },
        null,
        {
            text: "选择", children: [
                {
                    id: 'select-row',
                    text: "整行",
                    hotKey: ["shift", "空格"],
                    iconSvg: "c-svg-select"
                },
                {
                    id: 'select-col',
                    text: "整列",
                    hotKey: ["ctrl", "空格"],
                    iconSvg: "c-svg-select"
                },
                {
                    id: 'select-all',
                    text: "整表",
                    hotKey: ["ctrl", "a"],
                    iconSvg: "c-svg-Select-all-duo"
                },
            ],
        },
    ])
    return list
}