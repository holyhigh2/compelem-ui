import { classes, computed, csscope, Csscope, emits, forEach, h, ifElse, ifTrue, prop, query, queryAll, state, styles, tag, Template, watch } from "compelem";
import { clamp, find, flatMap, isEmpty, lerp, map, range, toFixed } from "myfx";
import { relocateTooltip, tooltip } from "../../../directives/tooltip/Tooltip";
import { getOpacityColor } from "../../../utils/color";
import { beginDrag, type DragSessionHandle } from "../../../utils/dragSession";
import { FormControl } from "../FormControl";
import formStyle from "../style.scss?tmpl";
import style from "./style.scss?tmpl";

/**
 * `.ce-form-slider-bottom-tip` 的"高度撑子"：mark 全是绝对定位，容器本身
 * 没有在流内容 ⇒ 高度会塌成 0，需要一行不可见文字把行高撑起来。
 *
 * ⚠️⚠️ 不能用 HTML 实体写 `&nbsp;`：`h` 模板的静态文本**不做实体解码**，
 * 会字面渲染出 6 个字符 "&nbsp;"（实测 DOM 文本 = `"0 严谨1 发散0.3 推荐&nbsp;"`，
 * 用户可见且正好压在第一个 mark 上）。也不能写成裸 U+00A0 字符：编译器对静态
 * 文本做 trim 时会把 U+00A0 一起吃掉（`"\u00A0".trim() === ""`），撑子失效。
 * 用**文本位插值**送一个真实的不换行空格最稳（插值不进静态文本处理）。
 */
const MARK_SPACER = "\u00A0";
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
  @prop({ type: Number }) value!: number;

  @state private filled = 0;
  @state private __innerValue = this.value

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
    // ⚠️ plaintext 模式下 render 只输出 value 文本，没有 track/thumb；
    // mounted() 里有 `if (!this.trackEl) return` 守卫，watch 路径却没有 ⇒
    // 切到 plaintext 后再改 value 会 `undefined.offsetWidth` 直接抛 TypeError。
    if (!this.trackEl) return
    // ⚠️ 必须减 min 再归一：min≠0 时（如 4~60 的档位滑杆）直接 nv/max 会把
    // 初始位置算错（24/60=40%，正确 35.7%）。_moveThumbH 里的反向换算
    // （(perc/100)*(max-min)+min）一直是 min-aware 的，只有这里漏了。
    // max===min（退化为单点）时除零会出 NaN，钳到 0。
    const span = this.max - this.min
    const ratio = span > 0 ? (nv - this.min) / span : 0
    let left = this.trackEl.offsetWidth * ratio
    this._moveThumbH(left)
    this.lastLeft = left
    // thumb 被程序化挪走 ⇒ 挂在它上面的 tooltip（alwaysShow）不会自己跟（没有任何事件可听）
    relocateTooltip(this.thumbEl)
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
  /**
   * 挂载后按当前值重钉一次 thumb。
   *
   * 为什么需要：`@watch('value')` 可能在挂载期就触发，那时轨道尚未布局
   * （trackEl.offsetWidth === 0）⇒ left = 0 × ratio = 0，thumb 被钉在
   * 轨道左端；而此后 value  prop 不再变化、watch 不再触发，thumb 永远
   * 停在 0%（实测：value=0.2 的滑杆 thumb 在轨道最左边）。
   *
   * ⚠️ 刻意不走 watchValue / _moveThumbH：那两个结尾会 emit
   * `update:value`，挂载期不该对外广播「值变了」（受控方会收到一次
   * 凭空的变化通知）。这里只做定位 + 同步 __innerValue。
   */
  mounted() {
    this.nextTick(() => {
      if (!this.trackEl || !this.thumbEl) return;
      const span = this.max - this.min;
      const ratio = span > 0 ? (Number(this.value) - this.min) / span : 0;
      this.lastLeft = this.trackEl.offsetWidth * ratio;
      this.thumbEl.style.left = `${ratio * 100}%`;
      if (this.trackFilledEl) this.trackFilledEl.style.width = `${ratio * 100}%`;
      this.__innerValue = Number(this.value);
      // 同上：重钉 thumb 后同步提示框（挂载期 tooltip 往往已经先算过一次坐标）
      relocateTooltip(this.thumbEl);
    });
  }

  render(): Template {
    // 0.30 要求 render() 只有一个主视图 h`` 模板，根级三元会触发 "2 个主视图模板" 阻断
    return h`${ifElse(
      this.plaintext,
      () => h`${this.value}`,
      () => h`
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
        <div class="ce-form-slider-control" @pointerdown="${this.onMousedown}">
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
          ${ifTrue(!isEmpty(this.marks), () => h`<div>${MARK_SPACER}</div>`)}
        </div>
      </div>
    `)}`;
  }

  //////////////////////////////////// methods

  #drag: DragSessionHandle | null = null

  destroyed(): void {
    this.#drag?.end(false)
    this.#drag = null
  }

  onMousedown(e: MouseEvent) {
    if (this.hideThumb || this.disabled) return;
    let thisRect = this.trackEl.getBoundingClientRect()
    let left = e.clientX - thisRect.x
    this._moveThumbH(left)
    this.renderRoot?.classList.add('is-dragging')
    e.preventDefault();
    this.lastLeft = left;

    this.#drag?.end(false)
    this.#drag = beginDrag(this, e as PointerEvent, {
      onMove: (ev) => {
        thisRect = this.trackEl.getBoundingClientRect()
        left = ev.clientX - thisRect.x
        this._moveThumbH(left)
        this.lastLeft = left
      },
      onEnd: () => this.onDragEnd()
    })
  }
  onDragEnd() {
    this.#drag = null
    this.renderRoot?.classList.remove('is-dragging')
  }
  _moveThumbH(left: number) {
    let totalLen = this.trackEl.offsetWidth
    left = clamp(left, 0, totalLen)
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
    this.__innerValue = parseFloat(toFixed(lerp(this.min, this.max, perc / 100), 1))
    this.emit('update:value', { value: this.__innerValue })
  }
  onChange(e: Event) {

  }
}