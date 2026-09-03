import { prop, state, watch } from "compelem";

import { ControlBox } from "../../../base/ControlBox";
/**
 * 范围输入框容器，允许插入2个Input组件用于最小、最大值输入
 * @attrs
 *  min {number} 最小值，会传递给第一个Input组件
 *  max {number} 最大值，会传递给第二个Input组件
 *  clearable {boolean} 支持清除，默认false
 *  separator {string} 分隔符，默认 '~'
 *  rangeCheck {string} 起始值大于结束值时的处理模式，默认fit
 *      none      —— 不校验
 *      validate  —— 保留输入值，标记错误并提示 rangeMessage
 *      clamp     —— 回滚「刚编辑的那一端」到上一个有效值
 *      fit       —— 另一端让位，始终保持 rangeGap 的间隔
 *  rangeGap {number} fit 模式下的间隔。数字范围为数值；日期范围为时间量，单位由 type 决定。默认0
 *  rangeMessage {string} validate 模式下的提示文案
 *  inside {boolean} 显示内部输入框轮廓，隐藏范围框轮廓，默认false
 *  dual {boolean} 双框模式，默认false。false=一个外框（宿主带边框，内部两框去边框）；
 *      true=两个独立圆角输入框（宿主去外框，每个子输入框各自带边框，中间保留 separator）
 * @slots
 *  - 可插入2个Input组件，如数字、日期、时间
 *  prepend
 *  append
 * @events
 *  change 值变更
 *
 * @author holyhigh2
 */

/**
 * 范围校验模式
 */
export type RangeCheckMode = 'none' | 'validate' | 'clamp' | 'fit'

export abstract class RangeInput extends ControlBox {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  //////////////////////////////////// props
  @prop({ type: [Number, String] }) min: number | string;
  @prop({ type: [Number, String] }) max: number | string;
  @prop inside = false;
  /** 双框模式：true=两个独立圆角输入框；false=一个外框（默认） */
  @prop dual = false;
  @prop({ type: Array, model: true }) value: any[] = []
  @prop separator = '~'
  /**
   * 起始 > 结束 时的处理模式（原 linked 属性）
   */
  @prop({ type: String }) rangeCheck: RangeCheckMode = 'fit'
  /**
   * fit 模式下的最小间隔
   */
  @prop({ type: Number }) rangeGap = 0
  /**
   * validate 模式下的提示文案
   */
  @prop({ type: String }) rangeMessage = ''

  abstract inputMin: any
  abstract inputMax: any

  /**
   * 范围级错误，与组件自身 error 属性分开管理，避免互相覆盖
   */
  @state __rangeError = false
  /**
   * 最后一次通过校验的值，clamp 模式回滚用。
   * 连续非法输入时始终回滚到同一个值（不会把上一次的非法值记成有效值）
   */
  __lastValidStart: any = undefined
  __lastValidEnd: any = undefined

  /////////////////////////////////// 子类原语
  abstract getStart(): any
  abstract setStart(v: any): void
  abstract getEnd(): any
  abstract setEnd(v: any): void
  /** 空值判断：数字为 NaN/undefined，日期为空串 */
  abstract isRangeEmpty(v: any): boolean
  /** 返回值 >0 表示 a 大于 b */
  abstract compareRange(a: any, b: any): number
  /** 给定 start，返回 end 应被设置成的值（start + rangeGap） */
  abstract fitFromStart(start: any): any
  /** 给定 end，返回 start 应被设置成的值（end - rangeGap） */
  abstract fitFromEnd(end: any): any
  /** clamp 到 min/max 全局边界；无约束时原样返回 */
  abstract clampToBounds(v: any): any

  /////////////////////////////////// lifecycles

  //////////////////////////////////// methods
  onChangeMin(obj: Record<string, any>) {
    this.__checkRange('start')
  }
  onChangeMax(obj: Record<string, any>) {
    this.__checkRange('end')
  }

  /**
   * dual 模式切换：用宿主 [dual] 属性驱动 :host([dual]) 选择器去外框。
   * compelem 的 prop 只在初始化阶段反射 attribute，事后赋值写不出 [dual]，
   * 故这里手动 toggleAttribute（默认 false 即无属性，保持一个外框的现状）
   */
  @watch('dual')
  watchDual() {
    this.toggleAttribute('dual', !!this.dual)
  }

  /**
   * 范围校验主流程。只在 change/blur 时调用 ——
   * 绝不能在 input 时纠正：用户想输 15，先输 1 就会被改掉
   * @param which 本次被编辑的那一端
   */
  protected __checkRange(which: 'start' | 'end') {
    const mode = this.rangeCheck
    // 从原语读值，而不是 inputMin.value —— 后者的 model 回写可能晚于 change 事件
    const start = this.getStart()
    const end = this.getEnd()

    if (mode === 'none') {
      this.__lastValidStart = start
      this.__lastValidEnd = end
      this.__setRangeError(false)
      return
    }

    // 任一端为空不参与校验，但仍记录有效值
    if (this.isRangeEmpty(start) || this.isRangeEmpty(end)) {
      if (which === 'start') this.__lastValidStart = start
      else this.__lastValidEnd = end
      this.__setRangeError(false)
      return
    }

    // 合法：刷新有效值基线
    if (this.compareRange(start, end) <= 0) {
      this.__lastValidStart = start
      this.__lastValidEnd = end
      this.__setRangeError(false)
      return
    }

    // ——— 以下为 start > end 的越界处理 ———
    if (mode === 'validate') {
      this.__setRangeError(true)
      return
    }

    if (mode === 'clamp') {
      // 回滚刚编辑的那一端
      if (which === 'start') this.setStart(this.__lastValidStart)
      else this.setEnd(this.__lastValidEnd)
      this.__setRangeError(false)
      return
    }

    // fit：另一端让位
    if (which === 'start') {
      const newEnd = this.clampToBounds(this.fitFromStart(start))
      if (!this.isRangeEmpty(newEnd) && this.compareRange(start, newEnd) <= 0) {
        this.setEnd(newEnd)
        this.__lastValidStart = start
        this.__lastValidEnd = newEnd
      } else {
        // 区间塞不下（撞到 max）→ 退化为回滚刚编辑的这一端
        this.setStart(this.__lastValidStart)
      }
    } else {
      const newStart = this.clampToBounds(this.fitFromEnd(end))
      if (!this.isRangeEmpty(newStart) && this.compareRange(newStart, end) <= 0) {
        this.setStart(newStart)
        this.__lastValidStart = newStart
        this.__lastValidEnd = end
      } else {
        this.setEnd(this.__lastValidEnd)
      }
    }
    this.__setRangeError(false)
  }

  /**
   * 用当前值刷新「上一个有效值」基线。
   * 外部赋值（初始值 / v-model 回写）不走 change 事件，基线不会自动更新，
   * 若不在这里补一次，clamp 模式会回滚到一个早已过期的值。
   * 当前值非法时**不**更新基线，保持最后一次真正有效的值
   */
  protected __syncLastValid() {
    const s = this.getStart()
    const e = this.getEnd()
    if (this.isRangeEmpty(s) || this.isRangeEmpty(e)) {
      // 一端为空不构成范围，直接以当前值为基线
      this.__lastValidStart = s
      this.__lastValidEnd = e
      return
    }
    if (this.compareRange(s, e) <= 0) {
      this.__lastValidStart = s
      this.__lastValidEnd = e
    }
  }

  protected __setRangeError(on: boolean) {
    // 用 class 而非 attribute：compelem 的 prop 只在初始化阶段反射 attribute，
    // 事后赋值写不出 [error]，:host([error]) 选择器永远匹配不到
    this.classList.toggle('ce-range-error', on)
    if (this.__rangeError === on) return
    this.__rangeError = on
  }

  clear(): void {
    if (this.inputMin?.clear) this.inputMin.clear()
    if (this.inputMax?.clear) this.inputMax.clear()
    this.__lastValidStart = undefined
    this.__lastValidEnd = undefined
    this.__setRangeError(false)
  }
}
