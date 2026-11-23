/**
 * 库构建把 compelem-router 标记为 external，测试环境用这个空替身，
 * 避免测试用例意外拉起路由实现。
 */
export const router = {
  push: () => Promise.resolve(),
  replace: () => Promise.resolve(),
  back: () => {},
  current: () => ''
}

export default router
