// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { InputMask } from "../components/form/input/InputMask";

// 自注册入口：import 'compelem-ui/ce-input-mask' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-input-mask")) {
  customElements.define("ce-input-mask", InputMask);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-input-mask": InputMask;
  }
}

export { InputMask };
export default InputMask;
