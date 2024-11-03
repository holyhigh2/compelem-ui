
import { classes, CompElem, computed, html, prop, show, state, styles, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 环形进度条
 * @attrs
 *  value {number} 进度数值，支持小数，最大100。默认0
 *  width {number} 进度条宽度
 *  r {number} 圆形半径
 *  indeterminate {boolean} 模糊状态，显示loading效果。默认false
 *  round {boolean} 圆角进度条，默认true
 *  color {string} 进度条颜色
 *  hide-track {boolean} 隐藏轨道，默认false
 *
 * @slots
 *  - 默认内容，居中显示
 *
 * @author holyhigh2
 */
@tag('l-progress-circular')
export class ProgressCircular extends CompElem {

  //////////////////////////////////// props
  @prop width = 5;
  @prop r = 16;
  @prop color = '';
  @prop indeterminate = false;
  @prop round = true;
  @prop hideTrack = false;
  @prop({ type: Number })
  get value() {
    return this.__innerValue
  }
  set value(v: any) {
    if (v > 100) v = 100
    if (v < 0) v = 0
    this.__innerValue = v
  }
  @state __innerValue = 0;

  static get styles(): string[] {
    return [style, `
      :host {
        display: inline-block;
      }
    `];
  }

  get css() {
    return `
      @keyframes progress-circular-dash {
        0% {
          stroke-dasharray: 1, ${this.perimeter * 1};
          stroke-dashoffset: 0px;
        }

        100% {
          stroke-dasharray: ${this.perimeter * 0.8}, ${this.perimeter * 1};
          stroke-dashoffset: -${this.perimeter * 0.2 * 0.1}px;
        }
      }
    `
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

  render(): Template {
    return html`
    <div class="c-progress-circular ${classes({
      __indeterminate: this.indeterminate
    })}" style="${styles({
      width: this.size + 'px',
      height: this.size + 'px',
      color: this.color
    })}">
      <svg xmlns="http://www.w3.org/2000/svg" *view-box:camel="${'0 0 ' + (this.size + this.width + 2) + ' ' + (this.size + this.width + 2)}">
        <g fill="none" stroke="gray" stroke-width="${this.width}">
          <circle cx="50%" cy="50%" *r="${this.r}" class="--track" style="${this.hideTrack ? 'stroke:none' : ''}"/>
          <circle cx="50%" cy="50%" *r="${this.r}" stroke-dashoffset="${this.perimeter - this.perimeter * ((this.__innerValue > 99.99 ? 99.99 : this.__innerValue) % 100) / 100}" 
          style="${styles({
      'stroke-linecap': this.round ? 'round' : ''
    })}"
          stroke-dasharray="${this.perimeter}" class="--thumb"/>
        </g>
      </svg>
      <div class="--content" ${show(!this.indeterminate)}>
        <slot></slot>
      </div>
    </div>
    `;
  }

  //////////////////////////////////// methods
  onAction(e: Event) {
    this.emit('action', {}, { event: e })
  }
}
