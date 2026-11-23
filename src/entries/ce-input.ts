// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { Input } from "../components/form/input/Input";

// 自注册入口：import 'compelem-ui/ce-input' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-input")) {
  customElements.define("ce-input", Input);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-input": Input;
  }
}

export { Input };
export default Input;
