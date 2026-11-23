/**
 * 测试公共工具：用渲染帧代替固定睡眠。
 * compelem 的首次渲染和更新都排在 rAF 队列里，等待帧即可覆盖一次渲染周期；
 * 固定 setTimeout 只是碰运气，CI 负载高时容易偶发失败。
 */
export function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

export async function flush(frames = 3): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await nextFrame()
    await Promise.resolve()
  }
}
