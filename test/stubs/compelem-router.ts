// compelem-router 的测试替身：Card.ts 等组件通过动态 import 引用它做路由跳转，
// 测试环境无真实路由，仅提供可空转的最小实现。
export function useRouter() {
  return {
    push: async (_to: string) => {}
  }
}
