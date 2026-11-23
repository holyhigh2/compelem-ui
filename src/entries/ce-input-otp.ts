// 自动生成 —— 由 scripts/gen.mjs entries 维护，勿手改。
import { InputOTP } from "../components/form/input/InputOTP";

// 自注册入口：import 'compelem-ui/ce-input-otp' 即完成该组件在 customElements 的注册。
// 不在此处调用 defineComponents()，避免无关组件被一并注册（无效注册的来源）。
if (typeof customElements !== "undefined" && !customElements.get("ce-input-otp")) {
  customElements.define("ce-input-otp", InputOTP);
}

declare global {
  interface HTMLElementTagNameMap {
    "ce-input-otp": InputOTP;
  }
}

export { InputOTP };
export default InputOTP;
