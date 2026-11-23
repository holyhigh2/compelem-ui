// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { Overlay } from "../components/overlays/overlay/Overlay";

// 自注册入口：import 'compelem-ui/ce-overlay' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-overlay")) {
  customElements.define("ce-overlay", Overlay);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-overlay": Overlay;
  }
}

export { Overlay };
export default Overlay;
