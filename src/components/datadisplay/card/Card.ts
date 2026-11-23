import { Csscope, Template, classes, computed, csscope, h, html, ifTrue, prop, show, tag, watch } from 'compelem';
import { isBlank, isEmpty } from "myfx";
import { APPEARANCE_LAYER, AppearanceElem } from "../../../base/Appearance";
import { ripples } from "../../../directives/ripples/Ripples";
import style from "./style.scss?tmpl";
/**
 * 标签组件
 * @attrs
 *  title {string} 卡片标题
 *  subtitle {string} 卡片子标题
 *  title-icon {string} 
 *  link {boolean} 链接样式，为true时，卡片会有hover效果，并且点击时会跳转到href或to指定的地址。设置href或to属性后该属性自动为true
 *  href {string} 链接地址
 *  target {string} 链接打开方式，默认_blank
 *  to {string} compelem-router路由跳转地址
 *  image {string} 卡片背景图片地址
 *  image-mask {string} 图片遮罩与图上文字配色：auto（默认，仅 image 属性时启用）| none | dark | light。另有 CSS 变量 --ce-card-image-mask（遮罩背景，默认底部重顶部轻的深色渐变）与 --ce-card-image-fg（图上文字色，默认白色）
 *  flush {boolean} 紧凑模式，去掉卡片内边距，默认 false
 * @events
 *
 * @slots
 *  - 卡片内容
 *  header 卡片头部信息，取代title及subtitle
 *  title
 *  subtitle
 *  prepend header前置内容
 *  append header后置内容
 *  text 卡片正文内容
 *  actions 卡片底部动作条
 *  image 卡片背景图片，取代image属性
 *
 * @author holyhigh2
 */
@tag('ce-card')
export class Card extends AppearanceElem {

  //////////////////////////////////// props
  @prop({ type: String }) title: string;
  @prop({ type: String }) titleIcon: string;
  @prop({ type: String }) subtitle: string;
  @prop({ type: Boolean }) link: boolean = false;
  @prop({ type: String }) href: string;
  @prop({ type: String }) target: string = "_blank";
  @prop({ type: String }) to: string;
  @prop({ type: String }) image: string
  /**
   * 图片遮罩与图上文字配色。背景图上的文字不能沿用主题前景色（浅色主题下深灰字
   * 压在深色照片上等于不可读），因此有图时改走「遮罩 + 图上专用字色」这条通道。
   *
   * - `auto`（默认）：仅 `image` 属性生效；`image` 插槽视为完全自定义，不干预
   * - `none`：关闭
   * - `dark` / `light`：强制启用（插槽场景也生效），分别配白字 / 深字
   * @default 'auto'
   */
  @prop({ type: String }) imageMask: string = 'auto'
  // 默认开启阴影：卡片底色与页面底色同为背景色，缺少这层描边/投影就没有边界。
  // Board 等内部卡片通过 shadow="xs" 指定投影级别，仍依赖该开关生效。
  shadowed: string | boolean = true
  /**
   * 紧凑模式：去掉卡片内边距。与 `ce-list` 组合使用时可进一步收紧垂直间距
   * @default false
   */
  @prop({ type: Boolean }) flush: boolean = false

  appearance: string = "subtle"


  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  /////////////////////////////////// computed
  @computed
  get hasHeader() {
    return !isEmpty(this.slots.prepend) || !isEmpty(this.slots.append) || !isBlank(this.title) || !isBlank(this.subtitle)
  }
  @computed
  get hasBody() {
    return !isEmpty(this.slots.default) || !isEmpty(this.slots.text)
  }
  @computed
  get isLinked() {
    return this.link || !!this.href || !!this.to
  }
  @computed
  get imageMasked() {
    const m = this.imageMask
    if (m === 'none') return false
    // auto 只认内置背景图；image 插槽是「完全自定义图片区域」，不替用户决定配色
    if (m === 'auto') return !isEmpty(this.image)
    return true
  }
  /////////////////////////////////// watches
  @watch(['link', 'href', 'to'], { immediate: true })
  watchName(v: string | boolean) {
    this.toggleAttribute('hoverable', this.link || !!this.href || !!this.to)
  }
  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args);
  }

  render(): Template {
    return h`
      <div
        part="root"
        class="ce-card"
        ${classes({ "is-disabled": this.disabled, "on-image": this.imageMasked })}
        ${ripples({ disabled: this.disabled || !this.isLinked, refer: () => this })}
        @click="${this.onClick}"
      >
        <header ?visible="${this.hasHeader}" ?bodyless="${!this.hasBody}">
          <div class="ce-card-prepend" ${show(!isBlank(this.titleIcon) || !isEmpty(this.slots.prepend))}>
            ${ifTrue(!isBlank(this.titleIcon), () => h`<ce-icon part="icon" svg="${this.titleIcon}"></ce-icon>`)}
            <slot name="prepend"></slot>
          </div>
          <div class="ce-card-content">
            <h3>${this.title}</h3>
            <p>${this.subtitle}</p>
            <slot name="title"></slot>
            <slot name="subtitle"></slot>
          </div>
          <div class="ce-card-append">
            <slot name="append"></slot>
          </div>
        </header>
        <div class="ce-card-slot" ${classes({ bodyless: !this.hasBody })}>
          <slot></slot>
        </div>
        <main ${show(!isEmpty(this.slots.text))}>
          <slot name="text"></slot>
        </main>
        <footer ${show(!isEmpty(this.slots.actions))}>
          <slot name="actions"></slot>
        </footer>
      </div>
      <div class="ce-card-image" ?masked="${this.imageMasked}">
        <ce-img ${show(!isEmpty(this.image))} fit="cover" .src="${this.image}"></ce-img>
        <slot name="image"></slot>
      </div>
      ${html(APPEARANCE_LAYER)}
    `;
  }

  //////////////////////////////////// methods
  async onClick() {
    if (this.href) {
      window.open(this.href, this.target)
    } else if (this.to) {
      try {
        const lib = await import('compelem-router'!);
        const router = lib.useRouter();
        if (!router) {
          console.error('compelem-router: no router instance. Ensure createRouter() is called before using `to`.');
          return;
        }
        await router.push(this.to);
      } catch (error) {
        console.error(`compelem-router navigation failed for '${this.to}':`, error);
      }
    }
  }
}
