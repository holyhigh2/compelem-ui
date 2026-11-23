import { beforeEach, describe, expect, it } from 'vitest'
import { getLocale, getMessages, setLocale, t } from '../src/locale'

beforeEach(() => {
  setLocale('zh-CN')
})

describe('locale', () => {
  it('默认使用 zh-CN', () => {
    expect(getLocale()).toBe('zh-CN')
    expect(t('actions.confirm')).toBe('确定')
  })

  it('支持 {param} 插值', () => {
    expect(t('pagination.total', { total: 42 })).toBe('共 42 条')
    expect(t('pagination.perPage', { size: 20 })).toBe('20 条/页')
  })

  it('切换 en-US 后读取英文文案', () => {
    setLocale('en-US')
    expect(t('actions.cancel')).toBe('Cancel')
    expect(t('pagination.total', { total: 3 })).toBe('Total 3')
  })

  it('未知 key 原样返回，便于发现漏配', () => {
    expect(t('not.exists')).toBe('not.exists')
  })

  it('可以为语言追加自定义覆盖', () => {
    setLocale('zh-CN', { 'form.required': '{label} 不能为空' })
    expect(t('form.required', { label: '用户名' })).toBe('用户名 不能为空')
    expect(getMessages()['form.required']).toBe('{label} 不能为空')
  })

  it('zh-CN 与 en-US 的 key 集合一致', () => {
    const zhKeys = Object.keys(getMessages('zh-CN')).sort()
    const enKeys = Object.keys(getMessages('en-US')).sort()
    expect(enKeys).toEqual(zhKeys)
  })
})
