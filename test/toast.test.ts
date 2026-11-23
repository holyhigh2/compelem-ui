import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../src/entries/ce-message'
import '../src/entries/ce-notification'
import { ToastPostion, useToast } from '../src/components/overlays/toast/toast'

const toast = useToast()

function messageById(id: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-toast-id="${id}"]`)
}

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    document.querySelectorAll('ce-message, ce-notification').forEach(node => node.remove())
    document.body.innerHTML = ''
  })

  it('返回同一个单例', () => {
    expect(useToast()).toBe(toast)
  })

  it('pushMessage 默认挂到 top-center，并返回可回查的 toast id', () => {
    const id = toast.pushMessage('hello')
    const msg = document.querySelector<HTMLElement>('.ce-toast-top-center ce-message')

    expect(id).toBeTypeOf('number')
    expect(msg).toBeTruthy()
    expect(msg!.dataset.toastId).toBe(String(id))
  })

  it('position 选项决定落点容器', () => {
    toast.pushMessage('left', { position: ToastPostion.TopLeft })
    toast.pushMessage('right', { position: ToastPostion.BottomRight })

    expect(document.querySelector('.ce-toast-top-left ce-message')).toBeTruthy()
    expect(document.querySelector('.ce-toast-bottom-right ce-message')).toBeTruthy()
  })

  it('duration 到点后移除，鼠标悬停期间暂停计时', () => {
    const id = toast.pushMessage('hello', { duration: 1000 })
    const msg = messageById(id)!

    vi.advanceTimersByTime(1)
    expect(msg.classList.contains('ce-toast-toasted')).toBe(true)

    msg.dispatchEvent(new Event('mouseenter'))
    vi.advanceTimersByTime(5000)
    expect(msg.isConnected).toBe(true)

    msg.dispatchEvent(new Event('mouseleave'))
    vi.advanceTimersByTime(1000)
    expect(msg.classList.contains('ce-toast-toasted')).toBe(false)
    expect(msg.isConnected).toBe(false)
  })

  it('duration <= 0 时不自动移除', () => {
    const id = toast.pushMessage('stay', { duration: 0 })
    const msg = messageById(id)!

    vi.advanceTimersByTime(1)
    vi.advanceTimersByTime(10000)
    expect(msg.isConnected).toBe(true)
  })

  it('remove 按 id 立即收掉节点', () => {
    const id = toast.pushMessage('bye')
    const msg = messageById(id)!

    vi.advanceTimersByTime(1)
    toast.remove(id)
    expect(msg.classList.contains('ce-toast-toasted')).toBe(false)
    expect(msg.isConnected).toBe(false)
  })

  it('消息自身 close 时自动收掉', () => {
    const id = toast.pushMessage('close')
    const msg = messageById(id)!

    vi.advanceTimersByTime(1)
    msg.dispatchEvent(new Event('close'))
    expect(msg.isConnected).toBe(false)
  })

  it('pushNotice 默认落在 bottom-right，clear 同时清理消息与通知', () => {
    toast.pushMessage('message')
    toast.pushNotice('notice')
    vi.advanceTimersByTime(0)

    expect(document.querySelector('.ce-toast-bottom-right ce-notification')).toBeTruthy()

    toast.clear()
    expect(document.querySelector('ce-message, ce-notification')).toBeNull()
  })

  it('info / success / warn / error 走同一套消息通道', () => {
    expect(toast.info('i')).toBeTypeOf('number')
    expect(toast.success('s')).toBeTypeOf('number')
    expect(toast.warn('w')).toBeTypeOf('number')
    expect(toast.error('e')).toBeTypeOf('number')
    expect(document.querySelectorAll('ce-message')).toHaveLength(4)
  })

  it('push 无效消息返回 0', () => {
    expect(toast.push(undefined as any)).toBe(0)
  })
})
