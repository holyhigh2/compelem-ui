// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { ContextMenu } from "../components/nav/contextmenu/ContextMenu";

// 自注册入口：import 'compelem-ui/ce-context-menu' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-context-menu")) {
  customElements.define("ce-context-menu", ContextMenu);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-context-menu": ContextMenu;
  }
}

export { ContextMenu };
export default ContextMenu;
