import { classes, csscope, Csscope, emits, h, prop, query, show, tag, Template } from "compelem";
import { isBlank, isEmpty } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import style from "./style.scss?tmpl";
/**
 * 工具条组件，提供两端对齐的水平容器
 * @attrs
 *  title {string} 工具条标题
 *  shadow {string} 显示阴影，always / hover / never，默认 always
 *  image {string} 背景图
 * @events
 *  overflow({overflow:boolean}) 内容宽度大于/小于组件时触发
 * @slots
 *  - 默认内容
 *  title
 *  prepend toolbar前置内容
 *  image toolbar背景图
 *
 * @author holyhigh2
 */
@emits('overflow')
@tag('ce-toolbar')
export class Toolbar extends AppearanceElem {

  //////////////////////////////////// props
  height = '3rem'
  @prop({ type: String }) title: string
  @prop({ type: String }) image: string

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  @query('.ce-toolbar-title')
  leftDiv: HTMLElement
  @query('.ce-toolbar-content')
  contentDiv: HTMLElement
  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
      <header class="ce-toolbar" @resize.debounce:100="${this.onResize}">
        <div class="ce-toolbar-image">
          <ce-img ${show(!isEmpty(this.image))} fit="cover" .src="${this.image}"></ce-img>
          <slot name="image"></slot>
        </div>
        <div class="ce-toolbar-prepend">
          <slot name="prepend"></slot>
        </div>
        <div class="ce-toolbar-title" ${show(!isBlank(this.title) || !isEmpty(this.slots.title))}>
          ${this.title}
          <slot name="title"></slot>
        </div>
        <div class="is-left">
          <slot name="left"></slot>
        </div>
        <div ${classes({ 'ce-toolbar-content': true, 'is-right': !isBlank(this.title) || !isEmpty(this.slots.title) })}>
          <slot></slot>
        </div>
      </header>
    `;
  }

  //////////////////////////////////// methods
  __lastOverflowRootWidth = -1
  __lastOverflow = false
  onResize() {
    // resize 走 debounce，迟到回调里 @query 已解析为 undefined
    if (!this.isMounted || this.isDestroyed || !this.leftDiv || !this.contentDiv) return
    let overflow = false
    if (this.leftDiv.scrollWidth + this.contentDiv.scrollWidth > this.offsetWidth) {
      overflow = true
    }

    if (this.__lastOverflow === overflow) return

    if (overflow) {
      this.__lastOverflowRootWidth = this.offsetWidth
    } else {
      if (this.offsetWidth <= this.__lastOverflowRootWidth) {
        return
      }
    }

    this.__lastOverflow = overflow
    this.emit('overflow', { overflow })
  }
}
