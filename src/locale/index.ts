/**
 * 轻量国际化层。
 *
 * 目标不是完整 i18n 方案，而是把组件内置文案收口到一处，让宿主可以覆盖：
 *   import { setLocale } from 'compelem-ui/locale'
 *   setLocale('en-US')
 *   setLocale('zh-CN', { 'form.required': '{label} 不能为空' })
 *
 * 约定：内置文案默认 zh-CN；未命中的 key 依次回退 zh-CN → key 本身。
 */

export type LocaleName = 'zh-CN' | 'en-US' | (string & {})

export type LocaleMessages = Record<string, string>

const zhCN: LocaleMessages = {
  'actions.confirm': '确定',
  'actions.cancel': '取消',
  'actions.clear': '清空',
  'actions.close': '关闭',
  'tabs.scrollPrev': '向前滚动页签',
  'tabs.scrollNext': '向后滚动页签',
  'loader.loading': '加载中...',
  'pagination.label': '分页',
  'pagination.prev': '上一页',
  'pagination.next': '下一页',
  'pagination.page': '第 {page} 页',
  'pagination.jumpTo': '跳至',
  'pagination.pageUnit': '页',
  'pagination.total': '共 {total} 条',
  'pagination.perPage': '{size} 条/页',
  'form.required': '{label} 为必填项',
  'board.hideAll': '隐藏全部',
  'board.showAll': '显示全部',
  'commandPalette.placeholder': '输入以搜索...',
  'table.constraintMismatch': '输入内容与限制选项不符',
  'table.menu.paste': '粘贴',
  'table.menu.insertRow': '插入行',
  'table.menu.deleteRow': '删除行',
  'table.menu.blankRow': '空白行',
  'table.menu.clearContent': '清除内容',
  'table.menu.expandRow': '展开详情',
  'table.menu.checkRows': '选中数据',
  'table.menu.fillColumn': '整列填色',
  'table.menu.copyCells': '复制单元格',
  'table.menu.copyCellsAndHeader': '复制单元格及表头',
  'table.menu.select': '选择',
  'table.menu.selectRow': '整行',
  'table.menu.selectCol': '整列',
  'table.menu.selectAll': '整表'
}

const enUS: LocaleMessages = {
  'actions.confirm': 'OK',
  'actions.cancel': 'Cancel',
  'actions.clear': 'Clear',
  'actions.close': 'Close',
  'tabs.scrollPrev': 'Scroll tabs backward',
  'tabs.scrollNext': 'Scroll tabs forward',
  'loader.loading': 'Loading...',
  'pagination.label': 'Pagination',
  'pagination.prev': 'Previous page',
  'pagination.next': 'Next page',
  'pagination.page': 'Page {page}',
  'pagination.jumpTo': 'Go to',
  'pagination.pageUnit': '',
  'pagination.total': 'Total {total}',
  'pagination.perPage': '{size} / page',
  'form.required': '{label} is required.',
  'board.hideAll': 'Hide all',
  'board.showAll': 'Show all',
  'commandPalette.placeholder': 'Type to search...',
  'table.constraintMismatch': 'The input does not match the allowed options',
  'table.menu.paste': 'Paste',
  'table.menu.insertRow': 'Insert row',
  'table.menu.deleteRow': 'Delete row',
  'table.menu.blankRow': 'Blank row',
  'table.menu.clearContent': 'Clear content',
  'table.menu.expandRow': 'Expand details',
  'table.menu.checkRows': 'Select rows',
  'table.menu.fillColumn': 'Fill column color',
  'table.menu.copyCells': 'Copy cells',
  'table.menu.copyCellsAndHeader': 'Copy cells with header',
  'table.menu.select': 'Select',
  'table.menu.selectRow': 'Row',
  'table.menu.selectCol': 'Column',
  'table.menu.selectAll': 'All'
}

const builtin: Record<string, LocaleMessages> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

let currentLocale: LocaleName = 'zh-CN'
const customMessages: Record<string, LocaleMessages> = {}

/**
 * 设置当前语言，并可覆盖该语言的文案。
 * @param locale 语言标识，内置 zh-CN / en-US；其他标识可用 overrides 补齐
 * @param overrides 覆盖或补充的文案（扁平 key）
 */
export function setLocale(locale: LocaleName, overrides?: LocaleMessages): void {
  currentLocale = locale
  if (overrides) {
    customMessages[locale] = { ...(customMessages[locale] ?? {}), ...overrides }
  }
}

export function getLocale(): LocaleName {
  return currentLocale
}

/**
 * 读取文案并做 {param} 插值。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const message = customMessages[currentLocale]?.[key]
    ?? builtin[currentLocale]?.[key]
    ?? zhCN[key]
    ?? key
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match
  )
}

/** 便捷方法：取当前语言下的完整文案表（含覆盖），主要用于调试。 */
export function getMessages(locale: LocaleName = currentLocale): LocaleMessages {
  return { ...zhCN, ...builtin[locale], ...customMessages[locale] }
}
