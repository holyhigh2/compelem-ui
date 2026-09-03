
import { classes, CompElem, csscope, Csscope, emits, forEach, h, html, ifTrue, prop, state, tag, Template } from "compelem";
import { defaultTo, identity, range } from "myfx";
import { IActivatable } from "../../../interfaces/IActivatable";
import { IClearable } from "../../../interfaces/IClearable";
import { IColorable } from "../../../interfaces/IColorable";
import style from "./style.scss?tmpl";
/**
 * 评价组件
 * @attrs
 *  activeColor {string} 激活状态颜色，默认 #ffb300
 *  color {string} 组件默认颜色，currentColor
 *  round {number} 图标圆角，可选0 ~ 20。默认0
 *  ratio {number} 图标内径比率，可选 0.1 ~ 1。默认0.5
 *  size {number} 图标尺寸，默认24
 *  length {number} 1-n的整数，默认5
 *  gap {number} 图标间隔，默认5
 *  value {number} 激活图标个数，受控
 *  allowHalf {boolean} 是否支持半选，默认false
 *  hover {boolean} 是否支持悬浮显示，默认true
 *  readOnly {boolean} 是否只读
 *  filled {boolean} 默认图标是否填充，默认true
 *  stroked {boolean} 显示图标边框，默认true
 *  strokeColor {string} 边框颜色，默认 #ddd
 *  activeStrokeColor {string} 激活状态边框颜色，默认 #FFB300
 *  clearable {boolean} 是否可清除，双击同一个图标时可清除value。默认true
 *
 * @events
 *  change({value}) value变更时触发
 *
 * @author holyhigh2
 */
@emits('change', 'update:value')
@tag('ce-rate')
export class Rate extends CompElem implements IColorable, IActivatable, IClearable {

  //////////////////////////////////// props
  @prop active = true;
  @prop round = 0;
  @prop activeColor = '#FFD54F';
  @prop color = '#ddd';
  @prop ratio = 0.5;
  @prop size = 24;
  @prop length = 5;
  @prop gap = 5;
  @prop({ type: Number, model: true }) value = 0;
  @prop allowHalf = false;
  @prop hover = true;
  @prop filled = true;
  @prop stroked = true;
  @prop readOnly = false;
  @prop strokeColor = '#ddd'
  @prop activeStrokeColor = '#FFB300'
  @prop clearable: boolean = true

  @state svgPath = ''
  @state hoverValue: undefined | number

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  get cssVars() {
    return {
      rateSvgFillColor: this.filled ? this.color : 'transparent',
      rateSvgFillActiveColor: this.activeColor,
      rateSvgStrokeColor: this.strokeColor,
      rateSvgStrokeActiveColor: this.activeStrokeColor,
      rateIconPaddingRight: `${this.gap}px`
    }
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <div class="ce-rate" ${classes({
      "is-stroked": this.stroked
    })} @mouseleave="${this.onMouseLeave}" @mouseenter.capture="${this.onMouseEnterIcon}" @click="${this.onClick}">
      ${forEach(range(1, this.length + 1), identity, (i) => h`
        <div part="icon" n="${i}">
          ${ifTrue(this.allowHalf, () => h`
            <svg n="${i - 0.5}" class="ce-rate ce-rate-before" ?active="${i - 0.5 <= defaultTo(this.hoverValue, this.value)!}" *width="${this.size / 2}" *height="${this.size}" *viewBox="${'0 0 ' + this.size + ' ' + this.size}" ${html(this.svgPath)}></svg>  
          `)}
          <svg n="${i}" class="ce-rate" ?active="${i <= defaultTo(this.hoverValue, this.value)!}" *width="${this.size}" *height="${this.size}" *viewBox="${'0 0 ' + this.size + ' ' + this.size}" ${html(this.svgPath)}></svg>
        </div>
      `)}
    </div>
    `
  }
  mounted(): void {
    this.__setPath()
  }
  //////////////////////////////////// methods
  onMouseEnterIcon(ev: MouseEvent) {
    let t = ev.target as Element
    let icon = t.closest('svg.ce-rate[n]')

    if (!icon) {
      icon = t.closest('div[part="icon"]')
    }
    let n = icon?.getAttribute('n')

    if (this.hover) {
      this.hoverValue = Number(n)
    }
  }
  onClick(ev: MouseEvent) {
    let t = ev.target as Element
    let icon = t.closest('svg.ce-rate[n]')
    if (!icon) return

    let n = icon?.getAttribute('n')
    let nn = Number(n)
    if (this.clearable && this.value === nn) {
      this.value = 0
      this.emit('change', { value: 0 })
      return
    }
    this.value = nn
    this.emit('change', { value: nn })
  }
  onMouseLeave(ev: MouseEvent) {
    this.hoverValue = undefined
  }
  __setPath() {
    const cx = this.size / 2, cy = this.size / 2;
    const pts = this.starPoints(cx, cy);
    const pathD = this.roundedStarPath(pts, this.round);
    this.svgPath = '<path d="' + pathD + '" />';
  }
  starPoints(cx: number, cy: number, pts = 5, rotationDeg = -90) {
    const points = [];
    const outerR = this.size * 0.45
    const ir = this.ratio
    for (let i = 0; i < pts * 2; i++) {
      const r = (i % 2 === 0) ? outerR : outerR * ir;
      const angle = (rotationDeg + i * (180 / pts)) * Math.PI / 180;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    return points;
  }
  roundedStarPath(points: number[][], round: number) {
    const N = points.length;
    if (!round || round <= 0) {
      return 'M ' + points.map(p => p.join(',')).join(' L ') + ' Z';
    }
    const pA = new Array(N), pB = new Array(N);
    for (let i = 0; i < N; i++) {
      const prev = points[(i - 1 + N) % N];
      const cur = points[i];
      const next = points[(i + 1) % N];
      const dPrev = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      const dNext = Math.hypot(cur[0] - next[0], cur[1] - next[1]);
      const tPrev = (dPrev === 0) ? 0 : Math.min(round, dPrev / 2) / dPrev;
      const tNext = (dNext === 0) ? 0 : Math.min(round, dNext / 2) / dNext;
      pA[i] = [cur[0] + (prev[0] - cur[0]) * tPrev, cur[1] + (prev[1] - cur[1]) * tPrev];
      pB[i] = [cur[0] + (next[0] - cur[0]) * tNext, cur[1] + (next[1] - cur[1]) * tNext];
    }

    let d = 'M ' + pB[0][0] + ',' + pB[0][1];
    for (let i = 0; i < N; i++) {
      const nextIdx = (i + 1) % N;
      d += ' L ' + pA[nextIdx][0] + ',' + pA[nextIdx][1];
      // 用顶点做控制点，pB[next] 为终点，形成圆滑的拐角
      d += ' Q ' + points[nextIdx][0] + ',' + points[nextIdx][1] + ' ' + pB[nextIdx][0] + ',' + pB[nextIdx][1];
    }
    d += ' Z';
    return d;
  }
}
