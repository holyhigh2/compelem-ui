
import { TipPlacement } from "@/constants";
import { classes, CompElem, css, csscope, Csscope, h, ifTrue, prop, state, styles, tag, Template, watch } from "compelem";
import { lowerCase } from "myfx";
import { ColorHelper } from "../../../utils/color";
import style from "./style.scss?tmpl";

/**
 * 线性进度条
 * @props
 *  value {number} 进度数值，支持小数，最大100。默认0
 *  height {number} 进度条高度
 *  indeterminate {boolean} 模糊状态，显示loading效果。默认false
 *  alternate {boolean} 模糊状态下，动画交替移动，默认false
 *  rounded {boolean} 圆角进度条，默认true
 *  active {boolean} 控制动画效果，默认false
 *  color {string} 进度条颜色，默认 currentColor
 *  bgColor {string} 进度条轨道背景色，默认 currentColor 10% 透明度
 *  striped {boolean} 斜纹效果(动画)，默认false
 *  tipPlacement {string} 提示内容位置start/insidestart/center/insideend/end，默认end
 * @slots
 *  - 提示内容
 *
 * @author holyhigh2
 */
@tag('ce-progress-linear')
export class ProgressLinear extends CompElem {

  //////////////////////////////////// props
  @prop height = 5;
  @prop({ type: String }) color: string;
  @prop({ type: String }) bgColor: string;
  @prop indeterminate = false;
  @prop rounded = true;
  @prop active = false;
  @prop alternate = false
  @prop hideTrack = false
  @prop striped = false
  @prop tipPlacement = TipPlacement.End
  @prop({ type: Number }) value = 0
  @state __innerValue = 0;

  @csscope(Csscope.INNER)
  static get css() {
    return [style, css`
      :host {
        display: block;
      }
    `];
  }
  get cssVars() {
    return {
      '--progress-striped-size': `${this.height - 1}px`,
      '--pl-thumb-alternate': `${this.alternate ? 'alternate' : 'normal'}`
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

  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <div class="ce-progress-linear" ${classes({
      "ce-progress-indeterminate": this.indeterminate,
      "is-active": this.active
    })}>
      ${ifTrue(this.tipPlacement == TipPlacement.Start, () => h`<slot></slot>`)}
      <div class="ce-progress-bar" ${styles({
      height: this.height + 'px',
      'border-radius': this.rounded ? 'var(--ce-round-pill)' : ''
    })}>
        <div class="ce-progress-track" ${styles({
      'border-radius': this.rounded ? 'var(--ce-round-pill)' : '',
      'background': this.hideTrack ? 'none' : this.bgColor ?? 'currentColor'
    })}>
        </div>
        <div class="ce-progress-thumb" ${classes({ 'is-striped': this.striped })} ${styles({
      'width': this.__innerValue + '%',
      'border-radius': this.rounded ? 'var(--ce-round-pill)' : ''
    })}>
        </div>
        <div class="ce-progress-content" ${classes({ ['align-' + lowerCase(this.tipPlacement)]: true })}>
          ${ifTrue(this.tipPlacement == TipPlacement.Center || this.tipPlacement == TipPlacement.InsideStart || this.tipPlacement == TipPlacement.InsideEnd, () => h`<slot></slot>`)}
        </div>
      </div>
      ${ifTrue(this.tipPlacement == TipPlacement.End, () => h`<slot></slot>`)}
    </div>
    `;
  }

  //////////////////////////////////// methods
}
