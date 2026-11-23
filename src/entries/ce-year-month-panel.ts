// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { YearMonthPanel } from "../components/picker/datepicker/YearMonthPanel";

// 自注册入口：import 'compelem-ui/ce-year-month-panel' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-year-month-panel")) {
  customElements.define("ce-year-month-panel", YearMonthPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-year-month-panel": YearMonthPanel;
  }
}

export { YearMonthPanel };
export default YearMonthPanel;
