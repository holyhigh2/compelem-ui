// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { InputTimeRange } from "../components/form/input/InputTimeRange";

// 自注册入口：import 'compelem-ui/ce-input-time-range' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-input-time-range")) {
  customElements.define("ce-input-time-range", InputTimeRange);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-input-time-range": InputTimeRange;
  }
}

export { InputTimeRange };
export default InputTimeRange;
