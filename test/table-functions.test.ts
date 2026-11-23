import { describe, expect, it } from 'vitest'
import { AVG, MAX, MIN, SUM } from '../src/components/datadisplay/table/Functions'

describe('table 统计函数', () => {
  it('SUM 累加数值，非数值按 0 计', () => {
    expect(SUM([1, '2', 3.5])).toBe(6.5)
    expect(SUM([1, null, 'abc', undefined])).toBe(1)
    expect(SUM([])).toBe(0)
  })

  it('AVG 以全部行数为分母', () => {
    expect(AVG([1, 2, 3])).toBe(2)
    expect(AVG(['1', 3])).toBe(2)
    expect(AVG([1, 'abc'])).toBe(0.5)
  })

  it('MAX / MIN 取数值极值', () => {
    expect(MAX([1, 5, 3])).toBe(5)
    expect(MIN([1, 5, 3])).toBe(1)
  })
})
