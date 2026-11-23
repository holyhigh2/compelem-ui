import { prop } from "compelem";
import { isBlank, isNumber } from "myfx";

import { ControlBox } from "../../../base/ControlBox";
/**
 * 输入框基类，提供input常用参数
 *
 * @author holyhigh2
 */
export abstract class BaseInput extends ControlBox {

  //////////////////////////////////// props
  @prop({ type: [Number, String] }) maxlength: string | number = NaN;
  @prop({ type: [Number, String] }) minlength: string | number = NaN;
  @prop({ type: [Number, String] }) max: string | number = NaN;
  @prop({ type: [Number, String] }) min: string | number = NaN;

  //////////////////////////////////// 模板适配
  // NaN/空值哨兵 → null：配合框架 wAttr 的「null 移除属性」语义（Lit 风格条件属性），
  // 供模板绑定原生 maxlength/minlength，避免出现 maxlength="NaN" 脏属性。
  // min/max 仅用于 JS 逻辑（clamp/比较），不需要 DOM 属性，故无需适配。
  protected get __maxlengthAttr(): string | number | null {
    return isBlank(this.maxlength) || (isNumber(this.maxlength) && isNaN(this.maxlength)) ? null : this.maxlength;
  }
  protected get __minlengthAttr(): string | number | null {
    return isBlank(this.minlength) || (isNumber(this.minlength) && isNaN(this.minlength)) ? null : this.minlength;
  }

}
