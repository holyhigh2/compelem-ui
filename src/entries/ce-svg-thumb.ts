// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { SvgThumb } from "../components/icons_images/svgthumb/SvgThumb";

// 自注册入口：import 'compelem-ui/ce-svg-thumb' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-svg-thumb")) {
  customElements.define("ce-svg-thumb", SvgThumb);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-svg-thumb": SvgThumb;
  }
}

export { SvgThumb };
export default SvgThumb;
