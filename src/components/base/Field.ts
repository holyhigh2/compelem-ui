import { CompElem, ifElse, prop, tag, Template, h } from "compelem";
import { isEmpty } from "myfx";
import { DataType } from "../../constants";

/**
 * 字段类，子类包括Column
 * @attrs
 *  label {string} 列名
 *  prop {string} 列属性
 *  dataType {string} 数据类型，可选值：text/currency/number/time/date/datetime/tag/label，默认text
 *  pattern {string} 数据格式化模式，当dataType为currency，number，time，date，datetime时有效，各类型默认模式如下
 *    currency: ',###.00'
 *    number: '###.00'
 *    time: 'HH:mm'
 *    date: 'yyyy-MM-dd'
 *    datetime: 'yyyy-MM-dd HH:mm'
 *  tagColors {object|string} 当列的数据类型为tag时，可配置内容对应的color，规则见tag组件。
 *  movable {boolean} 是否可拖动列顺序，默认false
 *  hidable {boolean} 是否可隐藏，默认true
 *  filterable {boolean} 是否可过滤数据，默认false
 *  sortable {boolean} 是否可排序，默认false
 *  groupable {boolean} 是否可分组数据，默认false
 *  colorable {boolean} 是否可填色，默认false
 * @slots
 *  - label内容
 *
 * @author holyhigh2
 */
@tag('ce-field')
export class Field extends CompElem {
  //////////////////////////////////// props
  @prop({ type: String, required: false }) label: string;
  @prop({ type: String, required: false, model: true }) prop: string;
  @prop({ type: [Object, String] }) tagColors: Record<string, string> | string;
  /**
   * text 文本
   * currency 金额 
   * number 数字
   * time 时间
   * date 日期
   * datetime 日期时间
   * tag 符号
   * label 标签
   */
  @prop({ type: String }) dataType: string = DataType.Text;
  @prop({ type: String, model: true }) pattern: string;

  @prop filterable = false;
  @prop movable = false;
  @prop sortable = false;
  @prop hidable = true;
  @prop groupable = false;
  @prop colorable = false;

  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args)
  }
  render(): Template {
    return h`<div>
      ${ifElse(isEmpty(this.slots.default), () => h`${this.label}`, () => h`<slot></slot>`)}
    </div>
    `
  }

  //////////////////////////////////// methods

}