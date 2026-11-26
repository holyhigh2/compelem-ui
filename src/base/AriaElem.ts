import { prop } from "compelem";
import { AppearanceElem } from "./Appearance";

/** prop 名 → 属性名。顺序即铺到原生控件上的顺序 */
const ARIA_ATTRS: Record<string, string> = {
  role: 'role',
  ariaLabel: 'aria-label',
  ariaLabelledby: 'aria-labelledby',
  ariaDescribedby: 'aria-describedby',
  ariaActivedescendant: 'aria-activedescendant',
  ariaControls: 'aria-controls',
  ariaCurrent: 'aria-current',
  ariaAutocomplete: 'aria-autocomplete',
  ariaHaspopup: 'aria-haspopup',
  ariaExpanded: 'aria-expanded',
  ariaPressed: 'aria-pressed',
  ariaDisabled: 'aria-disabled',
  ariaRequired: 'aria-required',
  ariaInvalid: 'aria-invalid',
  ariaBusy: 'aria-busy',
}

const ARIA_KEYS = Object.keys(ARIA_ATTRS)

/**
 * ARIA 透传基类：把宿主上的 role / aria-* 送到 shadow 内的原生控件。
 *
 * 读屏只认原生控件上的语义，写在自定义元素宿主上的 `aria-*` 不会被当成内部
 * 输入框/按钮的属性，所以必须透传一层。
 *
 * 声明成 `@prop` 而不是渲染时读 `getAttribute`：compelem 的 `observedAttributes`
 * 只由 props 推导（`utils.ts:_observedAttrs`），非 prop 的宿主属性变化不触发回调，
 * 分页翻页、下拉展开这类运行期改写就会漏同步。
 *
 * 默认值一律 undefined —— 框架 `wAttr` 对 null/undefined 走 removeAttribute，
 * 未显式给值时不会留下 `aria-label="undefined"` 脏属性。
 *
 * 不能写成 mixin：`@prop` 由编译器实现（运行时是空函数），esbuild 只接受
 * **类声明**上的装饰器语法，类表达式里的 `@prop` 直接编译失败。
 */
export abstract class AriaElem extends AppearanceElem {

  //////////////////////////////////// props
  @prop({ type: String }) role: string
  @prop({ type: String }) ariaLabel: string
  @prop({ type: String }) ariaLabelledby: string
  @prop({ type: String }) ariaDescribedby: string
  @prop({ type: String }) ariaActivedescendant: string
  @prop({ type: String }) ariaControls: string
  @prop({ type: String }) ariaCurrent: string
  @prop({ type: String }) ariaAutocomplete: string
  @prop({ type: String }) ariaHaspopup: string
  @prop({ type: String }) ariaExpanded: string
  @prop({ type: String }) ariaPressed: string
  @prop({ type: String }) ariaDisabled: string
  @prop({ type: String }) ariaRequired: string
  @prop({ type: String }) ariaInvalid: string
  @prop({ type: String }) ariaBusy: string

  /**
   * 供 `bind()` 铺到原生控件上（用法见 Menu.ts 的 aria 对象）。
   *
   * **未给值的键显式留 null 而不是省略**：`bind` 只遍历新对象的键，省略掉的键
   * 不会触发 removeAttribute，于是「先给 aria-label 再清掉」会留下脏属性。
   */
  get ariaAttrs(): any {
    const out: any = {}
    for (const k of ARIA_KEYS) {
      const v = (this as any)[k]
      out[ARIA_ATTRS[k]] = v === undefined || v === '' ? null : v
    }
    return out
  }
}