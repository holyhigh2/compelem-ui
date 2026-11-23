// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { Panel } from "../components/datadisplay/panel/Panel";

// 自注册入口：import 'compelem-ui/ce-panel' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-panel")) {
  customElements.define("ce-panel", Panel);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-panel": Panel;
  }
}

export { Panel };
export default Panel;
