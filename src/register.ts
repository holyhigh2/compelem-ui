import { defineComponents } from "compelem";

/**
 * 全量注册入口：
 *   import 'compelem-ui/register'
 * 会注册全部组件标签，适合快速接入 / 本地调试；
 * 生产环境仍推荐 import 'compelem-ui/ce-xxx' 逐组件注册以控制体积。
 *
 * 与生产入口 src/index.ts 的区别：在导出全部组件的同时调用 defineComponents()，
 * 把组件注册进 customElements。
 *
 * 之所以能只靠这一句完成注册：export * from './index' 会求值 ./index，
 * 其所有组件模块顶层的 @tag 装饰器在此之前已把组件登记进 compelem 的注册表，
 * defineComponents() 只是把该注册表落到 customElements。
 */
export * from "./index";

if (typeof customElements !== "undefined") {
  defineComponents();
}