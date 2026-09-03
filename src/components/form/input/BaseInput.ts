import { prop } from "compelem";

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

}