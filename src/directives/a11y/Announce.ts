/**
 * 播报角色：按消息类型决定读屏是「立即打断播报」还是「等空闲再播报」。
 *
 * error / warning 是需要立刻知道的坏消息 → alert（assertive）；
 * info / success 是状态更新 → status（polite）。
 *
 * 收口在一处而不是各组件里各写一遍三元：Message / Notification 以及后续任何
 * 带 type 的播报组件都必须给出同一套判定，散点写必然漂移。
 */
export function announceRole(type: string): 'alert' | 'status' {
  return type === 'error' || type === 'warning' ? 'alert' : 'status'
}