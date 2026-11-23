// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { Tooltip } from "../components/overlays/tooltip/Tooltip";

// 自注册入口：import 'compelem-ui/ce-tooltip' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-tooltip")) {
  customElements.define("ce-tooltip", Tooltip);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-tooltip": Tooltip;
  }
}

export { Tooltip };
export default Tooltip;
