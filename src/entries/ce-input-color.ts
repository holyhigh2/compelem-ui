// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { InputColor } from "../components/form/input/InputColor";

// 自注册入口：import 'compelem-ui/ce-input-color' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-input-color")) {
  customElements.define("ce-input-color", InputColor);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-input-color": InputColor;
  }
}

export { InputColor };
export default InputColor;
