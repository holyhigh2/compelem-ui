// 全局测试环境准备：
// 1. polyfills 必须最先导入（ES import 按序执行），补齐 jsdom 缺失的浏览器 API
// 2. 全量导入并注册组件——组件模板常引用其他 ce-* 组件（如 ce-alert 引用 ce-dialog
//    的 .prop 绑定），未注册标签上的 .prop 会解析出无标志位的 UpdatePoint 并在渲染时崩溃
// 3. 每条用例结束后清空 body，隔离 overlay/toast 类组件挂在 body 上的节点
// 4. 跟踪测试期间创建的 setTimeout 定时器，每条用例结束即清除——
//    组件内部防抖（如 ce-tree 的 @mutate.debounce:100）会在用例结束后触发：
//    此时组件已脱离文档（compelem 的 disconnectedCallback 为空，isMounted 仍为 true），
//    渲染队列在 detached 状态创建的自定义元素不会升级，回调访问其方法即抛错；
//    jsdom 环境销毁后触发则抛 ReferenceError
import './polyfills'
import { afterEach } from 'vitest'
import { defineComponents } from 'compelem'
import * as CompelemUI from '../src/index'

void CompelemUI
defineComponents()

const pendingTimers = new Set<ReturnType<typeof setTimeout>>()
const rawSetTimeout = globalThis.setTimeout
;(globalThis as any).setTimeout = function (fn: unknown, ms?: unknown, ...args: unknown[]) {
  if (typeof fn !== 'function') {
    return rawSetTimeout(fn as any, ms as any, ...(args as any[]))
  }
  const holder: { id?: ReturnType<typeof setTimeout> } = {}
  const wrapped = (...a: unknown[]) => {
    if (holder.id !== undefined) pendingTimers.delete(holder.id)
    return (fn as (...x: unknown[]) => unknown)(...a)
  }
  holder.id = rawSetTimeout(wrapped, ms as any, ...(args as any[]))
  pendingTimers.add(holder.id)
  return holder.id
} as typeof setTimeout

afterEach(async () => {
  document.body.innerHTML = ''
  // 多轮宏任务等待：组件渲染队列中存在 setTimeout 链（如 updated 钩子内的
  // setTimeout(0) → setTimeout(100)），每轮清除一轮已调度的定时器，
  // 覆盖 detached 状态下继续产生的防抖/延迟回调
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => rawSetTimeout(r, 0))
    for (const id of pendingTimers) clearTimeout(id)
    pendingTimers.clear()
  }
})
