import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routerMock = vi.hoisted(() => ({
  mode: 'ready' as 'ready' | 'uninitialized' | 'unavailable',
  push: vi.fn()
}))

vi.mock('compelem-router', () => ({
  useRouter: () => {
    if (routerMock.mode === 'unavailable') throw new Error('Cannot find package compelem-router')
    if (routerMock.mode === 'uninitialized') return null
    return { push: routerMock.push }
  }
}))

import '../.generated/entries/ce-card'

describe('ce-card 可选路由', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    routerMock.mode = 'ready'
    routerMock.push.mockReset().mockResolvedValue(undefined)
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  function cardWithTo() {
    const card = document.createElement('ce-card') as any
    card.to = '/detail'
    return card
  }

  it('宿主安装并初始化 router 时调用 push', async () => {
    await cardWithTo().onClick()
    expect(routerMock.push).toHaveBeenCalledWith('/detail')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('router 未初始化时静默不跳转', async () => {
    routerMock.mode = 'uninitialized'
    await expect(cardWithTo().onClick()).resolves.toBeUndefined()
    expect(routerMock.push).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('router 包不可用时静默不跳转', async () => {
    routerMock.mode = 'unavailable'
    await expect(cardWithTo().onClick()).resolves.toBeUndefined()
    expect(routerMock.push).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('已加载 router 的真实跳转失败仍输出错误', async () => {
    const error = new Error('navigation aborted')
    routerMock.push.mockRejectedValue(error)
    await expect(cardWithTo().onClick()).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledWith("compelem-router navigation failed for '/detail':", error)
  })
})
