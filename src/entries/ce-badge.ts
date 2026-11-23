// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { Badge } from "../components/feedback/badge/Badge";

// 自注册入口：import 'compelem-ui/ce-badge' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-badge")) {
  customElements.define("ce-badge", Badge);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-badge": Badge;
  }
}

export { Badge };
export default Badge;
