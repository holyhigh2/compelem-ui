// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { Tabs } from "../components/nav/tabs/Tabs";

// 自注册入口：import 'compelem-ui/ce-tabs' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-tabs")) {
  customElements.define("ce-tabs", Tabs);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-tabs": Tabs;
  }
}

export { Tabs };
export default Tabs;
