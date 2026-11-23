/**
 * scripts/lib/files.mjs —— 各生成器 / 检查器共享的源文件遍历工具。
 *
 * 遍历顺序保持 `readdirSync` 的原始顺序，与合并前的独立脚本一致；
 * 谓词各自独立，避免把「组件入口」与「检查目标」的筛选口径混在一起。
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 递归收集目录下满足谓词的文件（不进入符号链接目录之外的特殊处理，与旧脚本一致）。
 * @param {string} dir
 * @param {(name: string) => boolean} predicate 以文件名（不含目录）判定
 * @returns {string[]}
 */
export function walkFiles(dir, predicate) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) files.push(...walkFiles(full, predicate))
    else if (predicate(name)) files.push(full)
  }
  return files
}

/** 组件入口扫描：.ts 全收（含 .d.ts，与 gen.mjs entries 原逻辑一致） */
export const isEntrySource = (name) => name.endsWith('.ts')

/** 类型 / 契约 / 字段检查：.ts，排除 .d.ts */
export const isSource = (name) => name.endsWith('.ts') && !name.endsWith('.d.ts')

const STYLE_EXT = new Set(['.ts', '.tsx', '.scss', '.css', '.vue'])

/** 字号 / 颜色检查：.ts / .tsx / .scss / .css / .vue */
export const isStyleSource = (name) => STYLE_EXT.has(name.slice(name.lastIndexOf('.')))
