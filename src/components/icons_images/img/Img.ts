import { csscope, Csscope, emits, h, prop, show, state, styles, tag, Template } from "compelem";
import { AppearanceElem } from "../../../base/Appearance";

import style from "./style.scss?tmpl";
enum ImgFit {
  Fill = 'fill',
  Contain = 'contain',
  Cover = 'cover',
  None = 'none',
  ScaleDown = 'scale-down'
}
/**
 * 图像组件
 * @props
 *  src {string} 图像地址
 *  low-src {string} 低精度图像地址
 *  alt {string} 备用文本描述
 *  crossorigin {string} 跨域设置，可选值anonymous / use-credentials
 *  fit {string} 图像适应方式，可选值：fill(默认) / contain / cover / none / scale-down
 *  lazy-loading {boolean} 延迟加载图像直到元素出现在视窗内，默认false
 * 
 * @events
 *  load({img}) 图像加载成功后触发
 *  error({img}) 图像加载失败后触发
 * @slots
 *  - 默认插槽，悬浮在图像上的内容，永久显示
 *  placeholder 占位插槽，仅在图像加载期间显示，成功加载后消失
 * 
 * @author holyhigh2
 */
@emits('load', 'error')
@tag('ce-img')
export class Img extends AppearanceElem {

  //////////////////////////////////// props
  @prop({ type: String }) src: string;
  @prop({ type: String }) lowsrc: string;
  @prop({ type: String }) alt: string;
  @prop({ type: String }) crossorigin: string;//anonymous / use-credentials
  @prop({ type: String }) fit: ImgFit = ImgFit.Fill;
  @prop lazyLoading = false

  @state showImg = false

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches

  /////////////////////////////////// computed

  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
      <div class="ce-img">
        <img class="ce-img-src-img"
          ${styles({
      'object-fit': this.fit,
      display: this.showImg ? 'block' : 'none'
    })}
          src="${this.src}"
          ?alt="${this.alt}"
          ?crossorigin="${this.crossorigin}"
          @error="${this.onError}"
          @load="${this.onLoad}"
          loading="${this.lazyLoading ? 'lazy' : 'eager'}"
        />
        <img
          ${styles({
      'object-fit': this.fit,
      display: this.showImg ? 'none' : 'block'
    })}
          src="${this.lowsrc}"
          ?crossorigin="${this.crossorigin}"
          loading="${this.lazyLoading ? 'lazy' : 'eager'}"
        />
        <div class="ce-img-placeholder" ${show(!this.showImg)}>
          <slot name="placeholder"></slot>
        </div>
        <div class="ce-img-content">
          <slot></slot>
        </div>
      </div>
    `
  }

  //////////////////////////////////// methods
  onError(e: Event) {
    if (this.src) {
      this.emit('error', { img: e.target }, e)
    }
  }
  onLoad(e: Event) {
    this.showImg = true
    this.emit('load', { img: e.target }, e)
  }
}
