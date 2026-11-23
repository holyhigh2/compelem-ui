// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { InputDate } from "../components/form/input/InputDate";

// 自注册入口：import 'compelem-ui/ce-input-date' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-input-date")) {
  customElements.define("ce-input-date", InputDate);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-input-date": InputDate;
  }
}

export { InputDate };
export default InputDate;
