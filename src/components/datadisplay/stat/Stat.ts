import { classes, csscope, Csscope, h, ifElse, prop, show, tag, Template } from "compelem";
import { formatNumber, isBlank, isEmpty } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import style from "./style.scss?tmpl";
/**
 * 统计组件
 * 
 * @props
 *  title {string} 统计标题
 *  value {string|number} 统计值
 *  pattern {string} 统计值格式化，默认 ',###.##'
 *  valueDesc {string} 值说明
 *  trend {string} 变化趋势，可选 'up / down'
 *  trendValue {string} 变化值
 *  trendTag {boolean} 通过tag方式显示trend，默认false
 *  icon {string} 统计图标
 *
 * @slots
 *  icon 自定义图标
 *
 * @author holyhigh2
 */
@tag('ce-stat')
export class Stat extends AppearanceElem {

  //////////////////////////////////// props
  @prop({ type: String, required: true }) title: string;
  @prop({ type: [String, Number], required: true }) value: string | number;
  @prop pattern = ',###.##'
  @prop icon = ''
  @prop trendValue = ''
  @prop valueDesc = ''
  @prop trend = ''
  @prop trendTag = false

  appearance = 'pale'

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
    <div part="root" class="ce-stat">
      <div class="ce-stat-icon" ${show(!!this.icon || !isEmpty(this.slots.icon))}>
        <ce-icon icon="${this.icon}" svg="${this.icon}" ${show(isEmpty(this.slots.icon))}></ce-icon >
        <slot name="icon"></slot>
      </div>
      <dl style="flex: 1;">
        <dt class="ce-stat-title">
          ${this.title}
        </dt>
        <dd class="ce-stat-value">
          <span style="white-space: nowrap;">
            ${this.pattern ? formatNumber(this.value, this.pattern) : this.value}
            <span class="is-desc">${this.valueDesc}</span>
          </span>
          <span class="ce-stat-trend" ${classes([this.trend])} ${show(!isBlank(this.trendValue))}>
            ${ifElse(this.trendTag, () => h`<ce-tag color="${this.trend == 'up' ? 'success' : 'error'}"><ce-icon svg="c-svg-arrow-${this.trend}"></ce-icon>${this.trendValue}</ce-tag>`, () => h`<ce-icon svg="c-svg-arrow-${this.trend}"></ce-icon>${this.trendValue}`)}
          </span>
        </dd>
      </dl>
    </div>
    `;
  }

  //////////////////////////////////// methods

}
