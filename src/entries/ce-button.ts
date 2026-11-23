// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { Button } from "../components/button/Button";

// 自注册入口：import 'compelem-ui/ce-button' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-button")) {
  customElements.define("ce-button", Button);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-button": Button;
  }
}

export { Button };
export default Button;
