// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { CommandPalette } from "../components/nav/commandpalette/CommandPalette";

// 自注册入口：import 'compelem-ui/ce-command-palette' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-command-palette")) {
  customElements.define("ce-command-palette", CommandPalette);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-command-palette": CommandPalette;
  }
}

export { CommandPalette };
export default CommandPalette;
