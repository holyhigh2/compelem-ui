import { describe, expect, it } from 'vitest'
import { getColLetter } from '../src/utils/excel'

describe('getColLetter', () => {
  it('1-based 下标 → Excel 列字母', () => {
    const cases: Array<[number, string]> = [
      [1, 'A'],
      [2, 'B'],
      [25, 'Y'],
      [26, 'Z'],
      [27, 'AA'],
      [28, 'AB'],
      [52, 'AZ'],
      [53, 'BA'],
      [78, 'BZ'],
      [79, 'CA'],
      [702, 'ZZ'],
      [703, 'AAA'],
    ]
    for (const [col, letter] of cases) {
      expect(getColLetter(col), `col=${col}`).toBe(letter)
    }
  })

  it('0 与负数返回空串（双射 26 进制没有 0 位）', () => {
    expect(getColLetter(0)).toBe('')
    expect(getColLetter(-1)).toBe('')
  })

  it('与 Table 的 0-based 变体口径等价：getColLetter(i + 1)', () => {
    const zeroBased = (i: number) => getColLetter(i + 1)
    expect(zeroBased(0)).toBe('A')
    expect(zeroBased(25)).toBe('Z')
    expect(zeroBased(26)).toBe('AA')
    expect(zeroBased(51)).toBe('AZ')
    expect(zeroBased(52)).toBe('BA')
  })

  it('严格递增、无重复（1..200 全覆盖）', () => {
    const seen = new Set<string>()
    for (let i = 1; i <= 200; i++) {
      const s = getColLetter(i)
      expect(s).toMatch(/^[A-Z]+$/)
      expect(seen.has(s)).toBe(false)
      seen.add(s)
    }
    expect(seen.size).toBe(200)
  })
})

/**
 * 与下游（compelem-report-builder）**旧实现**的对拍。
 *
 * rb 的 `utils/grid.ts` 曾自写一份 0-based 列名（do-while 版），注释称
 * 「库的 `Editable._getColumnChar` 对 >26 列支持有限」—— 那条认知已过时。
 * 现在 rb 改为 `getColLetter(index + 1)`；这里把它的旧实现当作 silver master，
 * 逐位证明迁移前后输出一致（1970 行 COBOL 式的回归保险）。
 */
function legacyColLabel(index: number): string {
  let n = Math.floor(index)
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

describe('getColLetter 与下游旧实现对拍', () => {
  it('0..2000 逐位一致（rb 的 colLabel(index) === getColLetter(index + 1)）', () => {
    const diffs: string[] = []
    for (let i = 0; i <= 2000; i++) {
      const a = legacyColLabel(i)
      const b = getColLetter(i + 1)
      if (a !== b) diffs.push(`${i}: legacy=${a} lib=${b}`)
    }
    expect(diffs.slice(0, 5)).toEqual([])
  })

  it('关键点位：0/25/26/51/52/701/702', () => {
    const cases: Array<[number, string]> = [
      [0, 'A'],
      [25, 'Z'],
      [26, 'AA'],
      [51, 'AZ'],
      [52, 'BA'],
      [701, 'ZZ'],
      [702, 'AAA'],
    ]
    for (const [i, want] of cases) {
      expect(getColLetter(i + 1), `index=${i}`).toBe(want)
      expect(getColLetter(i + 1), `index=${i}`).toBe(legacyColLabel(i))
    }
  })
})
