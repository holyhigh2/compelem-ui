// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { CommandPaletteContent } from "../components/nav/commandpalette/CommandPaletteContent";

// 自注册入口：import 'compelem-ui/ce-command-palette-content' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-command-palette-content")) {
  customElements.define("ce-command-palette-content", CommandPaletteContent);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-command-palette-content": CommandPaletteContent;
  }
}

export { CommandPaletteContent };
export default CommandPaletteContent;
