// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { InputNumberRange } from "../components/form/input/InputNumberRange";

// 自注册入口：import 'compelem-ui/ce-input-number-range' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-input-number-range")) {
  customElements.define("ce-input-number-range", InputNumberRange);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-input-number-range": InputNumberRange;
  }
}

export { InputNumberRange };
export default InputNumberRange;
