import { classes, computed, csscope, Csscope, emits, forEach, h, ifTrue, prop, query, queryAll, state, styles, tag, Template, watch } from "compelem";
import { find, flatMap, isEmpty, map, range, toFixed } from "myfx";
import { tooltip } from "../../../directives/tooltip/Tooltip";
import { getOpacityColor } from "../../../utils/color";
import { FormControl } from "../FormControl";
import formStyle from "../style.scss?tmpl";
import style from "./style.scss?tmpl";
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
 *  prepend
 *  append
 *  thumb
 * 
 * @events
 * 
 *
 * @author holyhigh2
 */
@emits('update:value')
@tag("ce-slider")
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
    type: Number, isValid(value: any, props?: Record<string, any>) {
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

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyle, style];
  }

  @query('.ce-form-slider-track')
  trackEl: HTMLElement
  @query('.ce-form-slider-track-filled')
  trackFilledEl: HTMLElement
  @query('.ce-form-slider-thumb')
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
    return this.plaintext ? h`${this.value}` : h`
      <div
        class="ce-form-slider"
        ${classes({
      "is-disabled": this.disabled,
      "is-vertical": this.vertical
    })}
        ${styles({
      color: this.color,
      cursor: this.hideThumb ? '' : 'pointer'
    })}
      >
        <div
          class="ce-form-slider-prepend"
          ${styles({
      'margin-inline-end': this.slots.prepend ? '1rem' : ''
    })}
        >
          <slot name="prepend"></slot>
        </div>
        <div class="ce-form-slider-control" @mousedown="${this.onMousedown}">
          <div
            class="ce-form-slider-track"
            ${styles({
      height: this.trackSize + 'px',
      'border-radius': this.round ? 'var(--ce-round-lg)' : '',
      'background-color': getOpacityColor(this.trackColor, .5),
    })}
          >
            <div
              class="ce-form-slider-track-filled"
              ${styles({
      left: this.filled + 'px',
      'background': this.trackFilledColor,
      'transition': this.hideThumb ? 'all .3s' : '',
      'border-radius': this.round ? 'var(--ce-round-lg)' : ''
    })}
            >
            </div>
            ${forEach(this.showTicks ? this.segments : [], (p, i) => i, (p, i) => h`
              <div
                class="ce-form-slider-tick"
                data-perc="${p}"
                ${styles({
      left: p + '%',
      width: this.tickSize + 'px',
      height: this.tickSize + 'px'
    })}
              >
              </div>
            `)}
          </div>
          <div
            class="ce-form-slider-thumb"
            ${tooltip({ content: this.__innerValue + '', placement: 'top', alwaysShow: this.tooltip == 'always', disabled: !this.tooltip || this.disabled, dragFollow: true })}
            ${styles({
      'min-width': this.thumbSize + 'px',
      'min-height': this.thumbSize + 'px',
      display: this.hideThumb ? 'none' : '',
      'background-color': this.thumbColor,
      'border-radius': parseFloat(this.thumbRadius + '') == this.thumbRadius ? this.thumbRadius + 'px' : this.thumbRadius + ''
    })}
          >
            <slot name="thumb"></slot>
          </div>
        </div>
        <div
          class="ce-form-slider-append"
          ${styles({
      'margin-inline-start': this.slots.append ? '1rem' : ''
    })}
        >
          <slot name="append"></slot>
        </div>
        <div class="ce-form-slider-bottom-tip">
          ${forEach(!isEmpty(this.marks) ? this.markLabels : [], (x, i) => i, ([p, label], i) => h`
            <div
              class="ce-form-slider-mark"
              data-perc="${p}"
              ${styles({
      left: p + '%',
    })}
            >
              ${label}
            </div>
          `)}
          ${ifTrue(!isEmpty(this.marks), () => h`<div>&nbsp;</div>`)}
        </div>
      </div>
    `;
  }

  //////////////////////////////////// methods

  onMousedown(e: MouseEvent) {
    if (this.hideThumb || this.disabled) return;
    let thisRect = this.trackEl.getBoundingClientRect()
    let that = this;
    let left = e.clientX - thisRect.x
    that._moveThumbH(left)
    this.renderRoot?.classList.add('is-dragging')
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
      that.renderRoot?.classList.remove('is-dragging')
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
            tick.classList.add('is-filled')
          } else {
            tick.classList.remove('is-filled')
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