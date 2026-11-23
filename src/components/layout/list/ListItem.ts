import { classes, csscope, Csscope, h, html, ifTrue, prop, tag, Template } from "compelem";
import { closest, isBlank, isEmpty, isString } from "myfx";
import { APPEARANCE_LAYER, AppearanceElem, AppearanceSpace } from "../../../base/Appearance";

import { ripples } from "../../../directives/ripples/Ripples";
import { tooltip } from "../../../directives/tooltip/Tooltip";
import { IActivatable } from "../../../interfaces/IActivatable";
import { List } from "./List";
import style from "./style-item.scss?tmpl";
import { FADE_CSS } from "../../../css/transition";

/**
 * 两行列表项的间距档位表：`space` → [padding-block, subtitle-gap]
 *
 * `space` 同时决定行高下限（见 style-item.scss 的 `:host([space="..."])` →
 * `--list-item-min-height`：compact 24px / default 32px / loose 40px），
 * 所以两处必须同步调整，否则会出现「行高变了但内边距没变」的错位。
 *
 * ⚠️ 24/32/40 是**单行项**的行高基准；两行项实际高度 = padding-block +
 * 标题 + 间距 + 副标题，恒大于此值，min-height 只当**下限**不会压矮两行项。
 * 需要整体抬高行高（如设置面板卡片行）用公开 token `--ce-list-item-min-height`，
 * 不要覆盖 min-height 属性。
 *
 * Default 的 16px/12px 与官网文档一致。若要改 Card（`ce-card flush`）与
 * `ce-list` + `ce-list-item` 的组合间距，**先**改这里。
 */
const TWO_LINE_SPACING: Record<string, [string, string]> = {
  [AppearanceSpace.Compact]: ['var(--ce-spacing-sm)', 'var(--ce-spacing-xs)'],
  [AppearanceSpace.Default]: ['var(--ce-spacing-xl)', 'var(--ce-spacing-lg)'],
  [AppearanceSpace.Loose]: [
    'calc(var(--ce-spacing-xl) + var(--ce-spacing-xs))',
    'var(--ce-spacing-xl)',
  ],
};
/**
 * 列表项组件，可以单独使用
 * @attrs
 *  ripple {boolean|string} 是否启用水波效果，默认true
 *  heading {string} 主标题
 *  subheading {string} 次标题
 *  subheading-lines {number} 次标题最大展示行数，默认1 
 *  center {boolean} 内容居中，默认false
 *  active {boolean} 是否激活状态
 *  href {string} 点击后跳转的URL地址（`#` 开头按页内锚点滚动）
 *  target {string} 跳转方式，默认 `_blank`（新窗口打开）
 *  value {string} 当ce-list开启selectable后，列表项选中时的值
 *  link {boolean} 是否连接，会开启悬浮效果，默认false
 *  collapsed {boolean} 是否折叠，折叠后仅显示列表项图标且鼠标悬浮后会显示title，默认false
 *  disabled {boolean} 是否禁用，禁用后不可点击，默认false
 *  selectable {boolean} 是否可选择，禁用后点击不会切换激活状态
 *  tooltip {string} tooltip信息，默认空；折叠态未设置时自动回落为主标题
 *  tooltipPlacement {string} 提示框方位，默认 `right`（左侧栏向右弹出；右侧栏传 `left`）
 *  space {string} 间距档位，决定最小高度与两行间距：
 *        default（16px/12px）/ compact（6px/4px）/ loose（20px/16px）
 *        取值 0 时按 `space` 从 `TWO_LINE_SPACING` 查表
 *  
 * @parts
 *  root 根元素
 *  prepend 左侧容器（折叠态只剩它，居中图标从这里控制）
 *  content 内容包装容器
 *  heading 主标题
 *  subheading 次标题
 *  append 右侧容器
 * @cssvars
 *  --ce-list-item-heading-size 主标题字号，默认 --ce-font-lg-em（两行项）/ 1em（单行项）
 *  --ce-list-item-heading-color 主标题色，默认 --ce-color-text（单行项默认继承条目色）
 *  --ce-list-item-heading-line-height 两行项主标题行高，默认 1.35
 *  --ce-list-item-line-height 单行项行盒系数，默认 1.5；置 1 恢复紧凑行盒
 *  --ce-list-item-subheading-size 副标题字号，默认 --ce-font-sm-em
 *  --ce-list-item-subtitle-color 副标题色，默认 --ce-color-text-secondary
 *  --ce-list-item-subtitle-opacity 副标题不透明度，默认 1（0.6 即旧版压暗观感）
 *  --ce-list-item-padding-inline / --ce-list-item-padding-block / --ce-list-item-subtitle-gap 行内/行间内距与主副间距
 *  --ce-list-item-min-height 行高下限，覆盖 space 档位（compact 24 / default 32 / loose 40）
 *  --ce-list-item-extra-gap 附加行与副标题的间距，默认 8px
 *  --ce-list-item-hover-transition-duration hover 底色渐变时长，默认 .3s；
 *        折叠几何动画走列表侧的 --ce-list-transition-duration（见 ce-list），两者互不牵连
 * @slots
 *  - 主标题内容
 *  subheading 次标题内容
 *  prepend 左侧内容
 *  append 右侧内容
 *  extra 附加行内容（主/副标题**下方**的整行区域，宽度 = 内容列 100%。
 *        用于设置面板这类"描述在上、宽控件独占一行"的条目；行内普通控件仍走 append。
 *        槽内子元素默认拉满行宽（width:100%），不需要的自行覆盖）
 *
 *
 * @author holyhigh2
 */
@tag("ce-list-item")
export class ListItem extends AppearanceElem implements IActivatable {
  //////////////////////////////////// props
  @prop({ type: [Boolean, String] }) ripple: boolean | string = true;
  //标题（主要内容）
  @prop heading = '';
  //副标题（次要内容）
  @prop subheading = ''
  @prop active = false
  @prop link = false
  @prop subheadingLines = 1
  @prop({ type: String }) value: string
  @prop({ type: String }) href: string
  // 跳转方式：默认新窗口，与 ce-card 一致
  @prop({ type: String }) target = '_blank'
  @prop collapsed = false
  @prop center = false
  @prop selectable = true
  @prop tooltip = ''
  @prop({ type: String }) tooltipPlacement = 'right'

  parentList: List
  rounded = true

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style, FADE_CSS];
  }
  get cssVars() {
    // 只有存在副标题内容（prop 或 slot 任一）时才走两行间距；单行时全部归 0。
    // 具体档位由 `space` 从 TWO_LINE_SPACING 查表，外层可通过 CSS 变量
    // --ce-list-item-padding-block / -subtitle-gap 覆盖
    const isTwoLine = !(isEmpty(this.subheading) && isEmpty(this.slots.subheading))
    const [paddingBlock, subtitleGap] =
      TWO_LINE_SPACING[this.space] ?? TWO_LINE_SPACING[AppearanceSpace.Default]
    return {
      '--list-item-webkit-line-clamp': this.subheadingLines,
      '--list-item-padding-block': isTwoLine ? `var(--ce-list-item-padding-block, ${paddingBlock})` : '',
      '--list-item-subtitle-gap': isTwoLine ? `var(--ce-list-item-subtitle-gap, ${subtitleGap})` : ''
    }
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super()
  }
  mounted(): void {
    this.parentList = closest<List>(this, node => node instanceof List, 'parentComponent')!
    // 子项可能晚于列表的 slotChange/mounted 才被升级，反过来向父列表拉一次状态
    this.parentList?._syncItem(this)
  }

  render(): Template {
    return h`<div part="root" class="ce-list-item" 
    ${classes({
      [`ce-list-size-` + this.size]: true,
      "ce-list-link": !!this.value || this.link || !!this.href
    })}
    data-action="click"
    @click="${this.onClick}"
    ?disabled="${this.disabled}" 
    ?href="${this.href}" ?value="${this.value}" 
    ${ripples({ disabled: !this.ripple || this.disabled || this.loading, color: isString(this.ripple) ? this.ripple : undefined, refer: () => this })}
    ${tooltip({
      // 折叠后 content 被 CSS 隐藏，功能名只能靠气泡；显式 tooltip 仍按旧行为原样透出。
      content: this.collapsed ? (this.tooltip || this.heading) : this.tooltip,
      placement: this.tooltipPlacement
    })}>
      <div class="ce-list-prepend" part="prepend">
        <slot name="prepend"></slot>
      </div>
      <div part="content" class="ce-list-content" ${classes({
      "is-center": this.center,
      "ce-list-line1": isEmpty(this.subheading) && isEmpty(this.slots.subheading)
    })}>
        <div class="ce-list-heading" part="heading">
          <slot></slot> ${this.heading}
        </div>
        <div class="ce-list-subheading" part="subheading">
          <slot name="subheading"></slot> ${ifTrue(!isBlank(this.subheading), () => h`<span>${this.subheading}</span>`, { enter: "fade", leave: "fade" })}
        </div>
        <!-- ⚠️ extra 容器必须**无条件渲染**：框架的 slots 映射只收「shadow 里已存在的
             <slot>」的分配结果（#updateSlotsAry 按 #slotsEl 的键分组），若把 <slot>
             包在依赖 slots.extra 的 ifTrue 里就死锁了（槽不存在 → 分配永远为空）。
             空态用响应式 is-empty 类隐藏（class 里的 slots 读取会随 slotchange 重算）。 -->
        <div class="ce-list-extra" part="extra" ${classes({ "is-empty": isEmpty(this.slots.extra) })}>
          <slot name="extra"></slot>
        </div>
      </div>
      <div part="append" class="ce-list-append">
        <slot name="append"></slot>
      </div>
    </div>
    ${html(APPEARANCE_LAYER)}
    `;
  }

  //////////////////////////////////// methods
  /**
   * 列表项跳转：`href` 是文档承诺的能力，实现上补齐导航。
   * `#` 开头走页内锚点，其余按 `target` 打开（默认新窗口且不交出 opener）。
   * `disabled` 时不跳转；作为可选列表项（`selectable`）时仍由 ce-list 负责选中。
   */
  async onClick() {
    if (!this.href || this.disabled) return
    if (this.href.startsWith('#')) {
      // 只认页内锚点：`href="#"` 这类占位链接滚动到顶部（与 <a href="#"> 一致），
      // 不能直接拿 "#" 去 querySelector —— 那是非法选择器，会抛语法错误
      const id = this.href.slice(1)
      if (!id) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }
      return
    }
    window.open(this.href, this.target || '_blank', 'noopener,noreferrer')
  }
}
