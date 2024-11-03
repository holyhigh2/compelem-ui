
import { classes, CompElem, html, prop, show, state, styles, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 线性进度条
 * @attrs
 *  value {number} 进度数值，支持小数，最大100。默认0
 *  height {number} 进度条高度
 *  indeterminate {boolean} 模糊状态，显示loading效果。默认false
 *  round {boolean} 圆角进度条，默认true
 *  color {string} 进度条颜色
 *
 * @slots
 *  - 默认内容，居中显示
 *
 * @author holyhigh2
 */
@tag('l-progress-linear')
export class ProgressLinear extends CompElem {

  //////////////////////////////////// props
  @prop height = 5;
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
        display: block;
      }
    `];
  }

  /////////////////////////////////// computed

  //////////////////////////////////// lifecycles

  render(): Template {
    return html`
    <div class="c-progress-linear ${classes({
      __indeterminate: this.indeterminate
    })}" style="${styles({
      height: this.height + 'px',
      color: this.color,
      'border-radius': this.round ? 'var(--l-border-radius-lg)' : ''
    })}">
      <div class="--track" style="${styles({
      'border-radius': this.round ? 'var(--l-border-radius-lg)' : '',
      'background': this.hideTrack ? 'none' : ''
    })}">
      </div>
      <div class="--thumb" style="${styles({
      'width': this.__innerValue + '%',
      'border-radius': this.round ? 'var(--l-border-radius-lg)' : ''
    })}">
      </div>
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
