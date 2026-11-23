// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { FormItem } from "../components/form/FormItem";

// 自注册入口：import 'compelem-ui/ce-form-item' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-form-item")) {
  customElements.define("ce-form-item", FormItem);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-form-item": FormItem;
  }
}

export { FormItem };
export default FormItem;
