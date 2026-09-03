import { Csscope, Template, classes, computed, csscope, h, ifTrue, prop, show, tag, watch } from 'compelem';
import { isBlank, isEmpty } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { ripples } from "../../../directives/ripples/Ripples";
import style from "./style.scss?tmpl";
/**
 * 标签组件
 * @props
 *  title {string} 卡片标题
 *  subtitle {string} 卡片子标题
 *  title-icon {string} 
 *  link {boolean} 链接样式，为true时，卡片会有hover效果，并且点击时会跳转到href或to指定的地址。设置href或to属性后该属性自动为true
 *  href {string} 链接地址
 *  target {string} 链接打开方式，默认_blank
 *  to {string} compelem-router路由跳转地址
 *  image {string} 卡片背景图片地址
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
  shadowed: string | boolean = true
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
  get isLinked() {
    return this.link || !!this.href || !!this.to
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
        ${classes({ "is-disabled": this.disabled })}
        ${ripples({ disabled: this.disabled || !this.isLinked, refer: () => this })}
        @click="${this.onClick}"
      >
        <header ?visible="${this.hasHeader}">
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
        <div class="ce-card-slot">
          <slot></slot>
        </div>
        <main ${show(!isEmpty(this.slots.text))}>
          <slot name="text"></slot>
        </main>
        <footer ${show(!isEmpty(this.slots.actions))}>
          <slot name="actions"></slot>
        </footer>
      </div>
      <div class="ce-card-image">
        <ce-img ${show(!isEmpty(this.image))} fit="cover" .src="${this.image}"></ce-img>
        <slot name="image"></slot>
      </div>
      ${super.render()}
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
