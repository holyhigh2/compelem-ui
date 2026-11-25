import { classes, csscope, Csscope, h, ifElse, prop, show, state, tag, Template, watch } from "compelem";
import { clamp, formatNumber, isBlank, isEmpty, isString, lerp } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { ArrowDown, ArrowUp } from "../../../icons/icons";
import type { IconFactory } from "../../../icons/registry";
import style from "./style.scss?tmpl";

/**
 * 趋势箭头直接用图标工厂，**不走 `c-svg-arrow-up` 字符串查找**：
 * 字符串名要求宿主先 `registerIcons({ ArrowUp, ArrowDown })`，没注册时 `ce-icon`
 * 静默渲染空白 —— 组件自己硬编码的图标不该依赖宿主注册。
 */
const TREND_ICONS: Record<string, () => Template> = { up: ArrowUp, down: ArrowDown };
/**
 * 统计组件
 * 
 * @attrs
 *  title {string} 统计标题
 *  value {string|number} 统计值
 *  valueDesc {string} 值说明
 *  trend {string} 变化趋势，可选 'up / down'
 *  trendValue {string} 变化值
 *  trendTag {boolean} 通过tag方式显示trend，默认false
 *  icon {string|function} 图标名称或图标工厂
 *  pattern {string} 数字格式，默认 ',###.##'；置空时直接渲染 value 原文（视为调用方已格式化，不参与补间）
 *  valueFirst {boolean} 值在标题上方，默认 false（标题在上）；用于"数字为主、标签为辅"的看板卡片
 *  trendTone {string} 环比配色口径：auto（默认，涨=success 绿 / 跌=error 红）/ inverse（涨=error 红 / 跌=success 绿）
 *  trendPlacement {string} 环比位置：right（默认，数值右侧）/ below（数值下方独占一行）
 *  animationDuration {number} 数值动画时长（毫秒），0 表示关闭动画
 *  valueFrom {string|number} 入场动画起始值，仅在挂载时生效
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
  @prop({ type: [String, Function] }) icon: string | IconFactory = ''
  @prop trendValue = ''
  @prop valueDesc = ''
  @prop trend = ''
  @prop trendTag = false
  /**
   * 值在标题上方（默认标题在上）。
   * 看板类指标卡通常"数字大、标签小"，用 valueFirst 让数字占据第一视觉位。
   */
  @prop({ type: Boolean }) valueFirst = false
  /**
   * 环比配色口径：
   *  - auto（默认）：涨 = success 绿、跌 = error 红（业务增长为正向）
   *  - inverse：涨 = error 红、跌 = success 绿（金融/行情类「红涨绿跌」习惯）
   */
  @prop trendTone = 'auto'
  /**
   * 环比位置：
   *  - right（默认）：与数值同一行、靠右。数值和环比能放进一行时最省高度。
   *  - below：独占一行、置于数值下方。窄格子里「数值 + 环比」本来就并排放不下，
   *    硬塞会折成两行（箭头一行、百分比一行）甚至被裁掉；换行后贴左与数值同起点，
   *    读起来仍是「这个数字涨了 3.2%」。
   */
  @prop trendPlacement = 'right'
  /**
   * 数值补间动画时长（毫秒）。0（默认）表示关闭 —— 数值直接显示，零额外开销。
   * 大于 0 时：挂载从 valueFrom 补间到 value；此后 value 变化从「当前显示值」补间到新值。
   */
  @prop({ type: [String, Number] }) animationDuration: string | number = 0
  /**
   * 入场动画起始值。仅在挂载时的首次补间中使用。
   */
  @prop({ type: [String, Number] }) valueFrom: string | number = 0

  /////////////////////////////////// states
  //动画期间的实时显示值；每帧更新只会命中其所属的那一个文本更新点
  @state displayValue: string | number = 0

  appearance = 'pale'

  /////////////////////////////////// internals
  private __rafId = 0
  //当前显示值对应的数字，作为下次补间的起点（保证轮询更新时不回退）
  private __curNum = 0
  private __mounted = false
  private __warned = false

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  __watchValue(nv: string | number) {
    const to = Stat.__numeric(nv)
    if (to === null) {
      //带货币符号/百分号/单位的写法无法参与插值 —— 保持原样直出
      this.__warn(nv)
      this.__stopAnim()
      this.__curNum = 0
      this.displayValue = nv
      return
    }
    if (!this.__mounted) {
      //首次：只定起点（valueFrom），真正入场交给 mounted，避免首渲染闪现终值
      this.__curNum = Stat.__numeric(this.valueFrom) ?? 0
      this.displayValue = this.__curNum
      return
    }
    this.__animate(this.__curNum, to)
  }

  //////////////////////////////////// lifecycles
  mounted(): void {
    this.__mounted = true
    const to = Stat.__numeric(this.value)
    if (to === null || this.__duration() <= 0) return
    //入场动画：valueFrom -> value
    this.__animate(this.__curNum, to)
  }

  destroyed(): void {
    this.__stopAnim()
  }

  render(): Template {
    return h`
    <div part="root" ${classes({
      'ce-stat': true,
      'is-value-first': this.valueFirst,
      'is-trend-inverse': this.trendTone === 'inverse',
      'is-trend-below': this.trendPlacement === 'below',
    })}>
      <div class="ce-stat-icon" ${show(!!this.icon || !isEmpty(this.slots.icon))}>
        <ce-icon icon="${isString(this.icon) ? this.icon : ''}" .svg="${this.icon}" ${show(isEmpty(this.slots.icon))}></ce-icon >
        <slot name="icon"></slot>
      </div>
      <dl style="flex: 1;">
        <dt class="ce-stat-title">
          ${this.title}
        </dt>
        <dd class="ce-stat-value">
          <span style="white-space: nowrap;">
            ${this.pattern ? formatNumber(this.displayValue, this.pattern) : this.value}
            <span class="ce-stat-value-desc">${this.valueDesc}</span>
          </span>
          <span class="ce-stat-trend" ${classes([this.trend && `ce-stat-${this.trend}`])} ${show(!isBlank(this.trendValue))}>
            ${ifElse(this.trendTag, () => h`<ce-tag color="${this.__tagColor()}"><ce-icon .svg="${TREND_ICONS[this.trend]}"></ce-icon>${this.trendValue}</ce-tag>`, () => h`<ce-icon .svg="${TREND_ICONS[this.trend]}"></ce-icon>${this.trendValue}`)}
          </span>
        </dd>
      </dl>
    </div>
    `;
  }

  //////////////////////////////////// methods
  /** trendTag 的颜色；inverse 口径下红涨绿跌 */
  private __tagColor() {
    const inverse = this.trendTone === 'inverse'
    if (this.trend === 'up') return inverse ? 'error' : 'success'
    return inverse ? 'success' : 'error'
  }

  /**
   * 补间：from -> to。动画期间新值到来时会取消上一轮并从当前显示值续接，
   * 避免回滚重播；同时尊重 prefers-reduced-motion（直接定格终值）。
   */
  private __animate(from: number, to: number) {
    this.__stopAnim()
    const duration = this.__duration()
    const settle = (v: number) => { this.__curNum = v; this.displayValue = v }
    if (duration <= 0 || from === to || Stat.__reducedMotion()) {
      settle(to)
      return
    }
    //整数值补间时按整数推进，避免中间帧出现小数抖动
    const decimals = Math.max(Stat.__decimals(from), Stat.__decimals(to))
    const t0 = performance.now()
    const step = (now: number) => {
      const t = clamp((now - t0) / duration, 0, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = lerp(from, to, eased)
      settle(decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v))
      this.__rafId = t < 1 ? requestAnimationFrame(step) : 0
    }
    this.__rafId = requestAnimationFrame(step)
  }

  private __stopAnim() {
    if (this.__rafId) {
      cancelAnimationFrame(this.__rafId)
      this.__rafId = 0
    }
  }

  private __duration() {
    return Math.max(Number(this.animationDuration) || 0, 0)
  }

  /**
   * 严格判定可否参与补间：number，或纯数字字符串。
   * 不支持带货币符号、百分号、千分位逗号的写法 —— 这些交给原样直出。
   */
  private static __numeric(v: string | number): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    if (v === null || v === undefined || v === '') return null
    const s = String(v).trim()
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null
  }

  private static __decimals(v: number) {
    const s = String(v)
    const i = s.indexOf('.')
    return i < 0 ? 0 : s.length - i - 1
  }

  private static __reducedMotion() {
    return typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private __warn(v: string | number) {
    if (this.__warned) return
    this.__warned = true
    const isDev = typeof process !== 'undefined' && process.env && process.env.DEV
    if (isDev && this.__duration() > 0) {
      console.warn(`ce-stat: animation-duration is set, but value "${v}" is not a plain number — animation skipped`)
    }
  }
}
