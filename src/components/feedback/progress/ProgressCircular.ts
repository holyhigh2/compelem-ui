
import { TipPlacement } from "@/constants";
import { ColorHelper } from "@/utils/color";
import { classes, CompElem, computed, css, csscope, Csscope, h, ifTrue, prop, state, styles, tag, Template, watch } from "compelem";
import style from "./style.scss?tmpl";
/**
 * 环形进度条
 * @props
 *  value {number} 进度数值，支持小数，最大100。默认0
 *  width {number} 进度条宽度
 *  r {number} 圆形半径
 *  indeterminate {boolean} 模糊状态，显示loading效果。默认false
 *  rounded {boolean} 圆角进度条，默认true
 *  color {string} 进度条颜色
 *  hide-track {boolean} 隐藏轨道，默认false
 *  tipPlacement {string} 提示内容位置start/insidestart/center/insideend/end，默认end
 *  
 * @slots
 *  - 提示内容
 *
 * @author holyhigh2
 */
@tag('ce-progress-circular')
export class ProgressCircular extends CompElem {

  //////////////////////////////////// props
  @prop width = 5;
  @prop r = 16;
  @prop color = '';
  @prop indeterminate = false;
  @prop rounded = true;
  @prop hideTrack = false;
  @prop({ type: [Number, String] }) value = 0
  @state __innerValue = 0;
  @prop tipPlacement = TipPlacement.Center


  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`
      :host {
        display: inline-block;
      }
    `];
  }
  get cssVars() {
    return {
      '--pc-stroke-dasharray-0': this.perimeter,
      '--pc-stroke-dasharray-100': `${this.perimeter * 0.8}, ${this.perimeter * 1}`,
      '--pc-stroke-dashoffset-100': `-${this.perimeter * 0.2 * 0.1}px`,
    }
  }

  /////////////////////////////////// watch
  @watch("color", { immediate: true })
  __watchColor(nv: any, ov: any) {
    if (nv === ov && nv === undefined) return
    ColorHelper.setColor(nv, this.style, `--color`)
  }
  @watch("bgColor", { immediate: true })
  __watchBgColor(nv: any, ov: any) {
    if (nv === ov && nv === undefined) return
    ColorHelper.setColor(nv, this.style, `--bg-color`)
  }
  @watch('value', { immediate: true })
  watchValue(v: number) {
    if (v > 100) v = 100
    if (v < 0) v = 0
    this.__innerValue = v
  }
  /////////////////////////////////// computed
  @computed
  get size() {
    return this.r * 2
  }
  @computed
  get perimeter() {
    return 2 * Math.PI * this.r
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super()
  }

  render(): Template {
    return h`
      <div
        class="ce-progress-circular"
        ${classes({
      "ce-progress-indeterminate": this.indeterminate
    })}
        ${styles({
      'justify-content': this.tipPlacement == TipPlacement.Center ? 'center' : '',
      color: this.color
    })}
      >
        ${ifTrue(this.tipPlacement == TipPlacement.Start, () => h`
          <div class="ce-progress-outside ce-progress-outside-start">
            <slot></slot>
          </div>
        `)}
        <svg
          ${styles({
      width: this.size + 'px',
      height: this.size + 'px'
    })}
          xmlns="http://www.w3.org/2000/svg"
          *view-box:camel="${'0 0 ' + (this.size + this.width + 2) + ' ' + (this.size + this.width + 2)}"
        >
          <g fill="none" stroke="gray" stroke-width="${this.width}">
            <circle cx="50%" cy="50%" *r="${this.r}" class="ce-progress-track" style="${this.hideTrack ? 'stroke:none' : ''}" />
            <circle
              cx="50%"
              cy="50%"
              *r="${this.r}"
              stroke-dashoffset="${this.perimeter - this.perimeter * ((this.__innerValue > 99.99 ? 99.99 : this.__innerValue) % 100) / 100}"
              ${styles({
      'stroke-linecap': this.rounded ? 'round' : ''
    })}
              stroke-dasharray="${this.perimeter}"
              class="ce-progress-thumb"
            />
          </g>
        </svg>
        ${ifTrue(this.tipPlacement == TipPlacement.Center, () => h`
          <div class="ce-progress-content">
            <slot></slot>
          </div>
        `)}
        ${ifTrue(this.tipPlacement == TipPlacement.End, () => h`<slot></slot>`)}
      </div>
    `;
  }

  //////////////////////////////////// methods

}
