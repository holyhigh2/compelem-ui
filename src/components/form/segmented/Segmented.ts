import { classes, csscope, Csscope, emits, forEach, h, ifElse, ifTrue, prop, styles, tag, Template, watch } from "compelem";
import { findIndex, isEqual } from "myfx";
import { FormControl } from "../FormControl";
import style from "./style.scss?tmpl";

/** 分段控制器的单个选项 */
export interface SegmentOption {
  /** 显示文本 */
  label: string;
  /** 选项值（与 value model 比较） */
  value: string | number;
  /** 图标：svg 函数，或已注册图标名（c-svg-xxx） */
  icon?: (() => Template) | string;
  /** 图片地址（位图/头像）。指定时优先于 icon 渲染为圆形图片 */
  image?: string;
  /** 是否禁用该项 */
  disabled?: boolean;
}

/**
 * 分段控制器
 * @attrs
 *  value {string|number} 当前选中值，受控 model 属性
 *  options {SegmentOption[]} 选项数组，每项 { label, value, icon?, image?, disabled? }
 *  block {boolean} 是否撑满整行，默认false
 *  divided {boolean} 在相邻选项之间显示分隔符（水平排列为竖线，垂直排列为横线），默认false
 *  vertical {boolean} 垂直排列（一列选项），默认false
 *  stacked {boolean} 图标/图片与文字上下堆叠，与 vertical 正交，默认false
 *  size {string} 尺寸 lg/md/sm/xs，默认 md
 *  name {string} 属性名词，匹配 formModel 的 key（FormControl）
 *  其他 FormControl 属性：disabled / readonly / plaintext
 * @models
 *  value 默认绑定属性
 * @events
 *  change({value, index, option}) 选中项变更
 *  update:value {value} value model 变更
 *
 * @author holyhigh2
 */
@emits('change', 'update:value')
@tag("ce-segmented")
export class Segmented extends FormControl {
  //////////////////////////////////// props
  @prop({ type: [String, Number], model: true }) value: string | number = '';
  @prop({ type: Array }) options: SegmentOption[] = [];
  @prop block = false;
  @prop divided = false;
  /** 垂直排列：主轴由水平改为垂直，滑块位移轴随之改变 */
  @prop vertical = false;
  /** 堆叠排列：选项内图标/图片与文字上下堆叠（需配合 icon 或 image 才有意义） */
  @prop stacked = false;

  @csscope(Csscope.INNER)
  static get css() {
    return style;
  }

  /////////////////////////////////// computed
  /** 当前选中项索引：-1 表示无匹配项 */
  get activeIndex(): number {
    return findIndex(this.options, (o: SegmentOption) => isEqual(o.value, this.value));
  }

  /** plaintext 模式下显示的选中项文本 */
  get currentLabel(): string {
    const cur = this.options.find(o => isEqual(o.value, this.value));
    return cur ? cur.label : '';
  }

  /** 滑块的位置/尺寸（等分百分比），无选中项时隐藏。垂直排列时改走 top/height */
  get thumbStyles(): Record<string, string> {
    const n = this.options.length;
    const idx = this.activeIndex;
    const cellPct = n > 0 ? 100 / n : 0;
    if (idx < 0) return { left: '0', top: '0', width: '0', height: '0', opacity: '0' };
    const pos = idx * cellPct + '%';
    const size = cellPct + '%';
    // 水平：left/width 表达位移，height 撑满内容区；垂直：top/height 表达位移，width 撑满。
    // 两个轴都显式给全，避开绝对定位的 over-constrained 计算（top/height/bottom 同时非 auto 时 bottom 会被忽略）。
    return this.vertical
      ? { left: '0', top: pos, width: '100%', height: size, opacity: '1' }
      : { left: pos, top: '0', width: size, height: '100%', opacity: '1' };
  }

  /////////////////////////////////// watches
  @watch('value')
  watchValue() {
    // 值变化时由响应式重渲染驱动滑块位移（activeIndex 参与模板计算），无需手工写 DOM
  }

  //////////////////////////////////// lifecycles
  render(): Template {
    return h`${ifElse(
      this.plaintext,
      () => h`${this.currentLabel}`,
      () => h`
    <div
      class="ce-segmented"
      role="radiogroup"
      aria-orientation="${this.vertical ? 'vertical' : 'horizontal'}"
      ${classes({
        'is-block': this.block,
        'is-divided': this.divided,
        'is-vertical': this.vertical,
        'is-stacked': this.stacked,
        'is-disabled': this.disabled,
        'is-readonly': this.readonly,
      })}
    >
      <div class="ce-segmented-items">
        <div class="ce-segmented-thumb" ${styles(this.thumbStyles)}></div>
        ${forEach(this.options, (o: SegmentOption) => String(o.value), (o: SegmentOption, i: number) => h`
          <div
            class="ce-segmented-item"
            role="radio"
            aria-checked="${isEqual(o.value, this.value)}"
            aria-disabled="${!!o.disabled}"
            ${classes({ 'is-active': isEqual(o.value, this.value), 'is-disabled': !!o.disabled || this.disabled })}
            @click="${(e: Event) => this.onSelect(o, e)}"
          >
            ${ifTrue(!!o.image, () => h`<img class="ce-segmented-image" src="${o.image}" alt="" aria-hidden="true">`)}
            ${ifTrue(!o.image && !!o.icon, () => h`<ce-icon class="ce-segmented-icon" .svg="${o.icon}"></ce-icon>`)}
            <span class="ce-segmented-label">${o.label}</span>
          </div>
        `)}
      </div>
    </div>`)}`;
  }

  //////////////////////////////////// methods
  onSelect(option: SegmentOption, event?: Event) {
    if (this.disabled || this.readonly || option.disabled) return;
    if (isEqual(option.value, this.value)) return;
    const index = findIndex(this.options, (o: SegmentOption) => o === option);
    this.value = option.value;
    this.emit('change', { value: option.value, index, option }, event);
  }
}
