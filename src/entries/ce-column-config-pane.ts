// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { ColumnConfigPane } from "../components/datadisplay/table/ColumnConfigPane";

// 自注册入口：import 'compelem-ui/ce-column-config-pane' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-column-config-pane")) {
  customElements.define("ce-column-config-pane", ColumnConfigPane);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-column-config-pane": ColumnConfigPane;
  }
}

export { ColumnConfigPane };
export default ColumnConfigPane;
