import { classes, computed, forEach, html, ifTrue, prop, query, queryAll, state, styles, tag, Template, watch } from "compelem";
import { find, flatMap, isEmpty, map, range, toFixed } from "myfx";
import { tooltip } from "../../../directives/tooltip/Tooltip";
import { getOpacityColor } from "../../../utils";
import { FormControl } from "../FormControl";
import formStyle from "../style.scss";
import style from "./style.scss";
/**
 * 滑杆组件
 * @attrs
 *  thumb-radius {number|string} 滑动按钮圆角半径，默认2
 *  thumb-size {number} 滑动按钮尺寸，默认18
 *  vertical {boolean} 是否垂直显示，默认false
 *  min {number} 最小值，默认0
 *  max {number} 最大值，默认100
 *  step {number} 滑动步长，默认0
 *  show-ticks {boolean|string} 显示由step确定的分割点 
 *  hide-thumb {boolean} 隐藏滑动按钮
 *  tick-size {number} 默认3 
 *  marks {object} 在min ~ max范围内标记的标尺标签
 *  value {number} 滑动值，总会在 min ~ max 之间。
 *  thumb-color {string} 活动按钮颜色
 *  track-color {string} 轨道颜色
 *  track-size {number} 默认5 
 *  track-filled-color {string} 已填充轨道颜色
 *  tooltip {boolean|string} 是否在滑动按钮上显示tooltip，默认true。如果是字符串always则保持显示
 *  
 *  其他FormControl属性
 * @slots
 *  leading
 *  trailing
 *  thumb
 * 
 * @events
 * 
 *
 * @author holyhigh2
 */
@tag("l-slider")
export class Slider extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop({ type: [Boolean, String] }) tooltip: boolean | string = true;
  @prop({ type: [String, Number] }) thumbRadius: string | number = 2;
  @prop thumbSize = 18;
  @prop thumbColor: string = '';
  @prop trackColor: string = '';
  @prop trackSize = 5;
  @prop trackFilledColor: string = '';
  @prop marks = {}
  @prop min = 0;
  @prop max = 100;
  @prop({
    type: Number, isValid(value: any, props: Record<string, any>) {
      return value >= 0;
    }
  }) step = 0;
  @prop tickSize = 3;
  @prop showTicks = false;
  @prop vertical = false;
  @prop hideThumb = false
  @prop({ type: Number }) value: number;

  @state private filled = 0;
  @state({ prop: 'value' }) private __innerValue = 0

  private lastLeft = 0;
  private interval = 0;

  static get styles(): string[] {
    return [formStyle, style];
  }

  @query('.track')
  trackEl: HTMLElement
  @query('.track-filled')
  trackFilledEl: HTMLElement
  @query('.thumb')
  thumbEl: HTMLElement
  @queryAll('.track .tick')
  allTicks: HTMLElement[]
  /////////////////////////////////// watches
  @watch('value')
  watchValue(nv: number) {
    let left = this.trackEl.offsetWidth * (nv / this.max)
    this._moveThumbH(left)
    this.lastLeft = left
  }
  @watch('segments')
  function(nv: number[]) {
    this.nextTick(() => {
      this._moveThumbH(this.lastLeft)
    })
  }
  /////////////////////////////////// computed
  @computed
  get segments(): number[] {
    let segments = (this.max - this.min) / this.step
    let interval = this.interval = 100 / segments
    if (this.step == 0) return []
    return map(range(1, Math.ceil(segments)), p => {
      return p * interval
    })
  }

  @computed
  get markLabels(): Array<number | string>[] {
    let min = this.min
    let max = this.max
    let len = max - min
    if (isEmpty(this.marks)) return []
    return flatMap(this.marks, (m, k) => {
      let kn = parseFloat(k)
      if (kn < min) return [];
      if (kn > max) return [];
      return [[((kn - min) / len * 100).toFixed(2), m]]
    })
  }

  //////////////////////////////////// lifecycles
  render(): Template {
    return this.plaintext ? html`${this.checked ? this.activeText : this.inactiveText}` : html`
      <div class="c-form-slider ${classes({
      __disabled: this.disabled,
      __vertical: this.vertical
    })}" style="${styles({
      color: this.color,
      cursor: this.hideThumb ? '' : 'pointer'
    })}">
        <div class="leading" style="${styles({
      'margin-inline-end': this.slots.leading ? '1rem' : ''
    })}">
          <slot name="leading"></slot>
        </div>
        <div class="control" @mousedown="${this.onMousedown}">
          <div class="track" style="${styles({
      height: this.trackSize + 'px',
      'border-radius': this.round ? 'var(--l-border-radius-lg)' : '',
      'background-color': getOpacityColor(this.trackColor, .5),
    })}">
            <div class="track-filled" style="${styles({
      left: this.filled + 'px',
      'background': this.trackFilledColor,
      'transition': this.hideThumb ? 'all .3s' : '',
      'border-radius': this.round ? 'var(--l-border-radius-lg)' : ''
    })}">
            </div>
            ${forEach(this.showTicks ? this.segments : [], (p, i) => html`
              <div key="${i}" class="tick" data-perc="${p}" style="${styles({
      left: p + '%',
      width: this.tickSize + 'px',
      height: this.tickSize + 'px'
    })}"></div>
            `)}
          </div>
          <div ${tooltip({ content: this.__innerValue + '', placement: 'top', alwaysShow: this.tooltip == 'always', disabled: !this.tooltip || this.disabled })} class="thumb" style="${styles({
      'min-width': this.thumbSize + 'px',
      'min-height': this.thumbSize + 'px',
      display: this.hideThumb ? 'none' : '',
      'background-color': this.thumbColor,
      'border-radius': parseFloat(this.thumbRadius + '') == this.thumbRadius ? this.thumbRadius + 'px' : this.thumbRadius + ''
    })}" >
          <slot name="thumb"></slot>
          </div>
        </div>
        <div class="trailing" style="${styles({
      'margin-inline-start': this.slots.trailing ? '1rem' : ''
    })}">
          <slot name="trailing"></slot>
        </div>
        <div class="bottom-tip">
        ${forEach(!isEmpty(this.marks) ? this.markLabels : [], ([p, label], i) => html`
          <div key="${i}" class="mark" data-perc="${p}" style="${styles({
      left: p + '%',
    })}">${label}</div>
        `)}
        ${ifTrue(!isEmpty(this.marks), () => html`<div>&nbsp;</div>`)}
        </div>
      </div>`;
  }

  //////////////////////////////////// methods

  onMousedown(e: MouseEvent) {
    if (this.hideThumb) return;
    let thisRect = this.trackEl.getBoundingClientRect()
    let that = this;
    let left = e.clientX - thisRect.x
    that._moveThumbH(left)
    this.renderRoot.classList.add('__dragging')
    e.preventDefault();
    this.lastLeft = left;

    document.onmousemove = function (ev: MouseEvent) {
      thisRect = that.trackEl.getBoundingClientRect()
      let left = ev.clientX - thisRect.x
      that._moveThumbH(left)
      that.lastLeft = left;
    }
    document.onmouseup = document.onblur = function () {
      document.onmousemove = document.onmouseup = document.onblur = null;
      that.renderRoot.classList.remove('__dragging')
    }
  }
  _moveThumbH(left: number) {
    let totalLen = this.trackEl.offsetWidth
    if (left < 0) left = 0;
    if (left > totalLen) left = totalLen
    let perc = left / totalLen * 100

    if (this.step > 0) {
      let nextSeg = find(this.segments, seg => seg > perc) ?? 100
      let midValue = nextSeg - this.interval / 2
      if (perc < midValue) {
        perc = nextSeg - this.interval
      } else {
        perc = nextSeg
      }

      if (this.showTicks) {
        this.allTicks.forEach(tick => {
          let tickPerc = parseFloat(tick.dataset.perc + '')
          if (tickPerc < perc) {
            tick.classList.add('__filled')
          } else {
            tick.classList.remove('__filled')
          }
        })
      }
    }

    this.thumbEl.style.left = `${perc}%`;
    this.trackFilledEl.style.width = perc + "%";

    //计算value
    this.__innerValue = parseFloat(toFixed((perc / 100) * (this.max - this.min) + this.min, 1))
    this.emit('update:value', { value: this.__innerValue })
  }
  onChange(e: Event) {

  }
}