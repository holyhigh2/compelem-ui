// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { ColorPicker } from "../components/picker/colorpicker/ColorPicker";

// 自注册入口：import 'compelem-ui/ce-color-picker' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-color-picker")) {
  customElements.define("ce-color-picker", ColorPicker);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-color-picker": ColorPicker;
  }
}

export { ColorPicker };
export default ColorPicker;
