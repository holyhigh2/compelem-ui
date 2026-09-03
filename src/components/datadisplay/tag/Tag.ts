import { ICloseable } from "@/interfaces/ICloseable";
import { csscope, Csscope, emits, h, ifTrue, prop, tag, Template } from "compelem";
import { isBlank } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import style from "./style.scss?tmpl";
/**
 * 标签组件
 * @extends AppearanceElem
 * @props
 *  dot {boolean} 是否显示点，默认false
 *  closable {boolean} 是否显示关闭按钮，默认false
 *  iconSize {string} 同size，用于定义icon大小。为空时使用size
 *  icon {string} 图标名称，支持 c-svg-xx
 *  append-icon {string} 图标名称，支持 c-svg-xx
 * 
 * @events
 *  close 点击关闭按钮时触发
 *
 * @slots
 *  - 标签内容
 *
 * @author holyhigh2
 */
@emits('close')
@tag('ce-tag')
export class Tag extends AppearanceElem implements ICloseable {

  //////////////////////////////////// props
  @prop dot = false;
  @prop icon = "";
  @prop appendIcon = "";
  @prop iconSize = '';
  @prop({ type: Boolean }) closable: boolean = false
  appearance = 'pale'
  rounded = true

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
      <div part="root" class="ce-tag">
        <slot name="prepend"></slot>
        ${ifTrue(!isBlank(this.icon), () => h`
          <ce-icon
            part="icon"
            svg="${this.icon}"
            size="${this.iconSize || this.size}"
          >
          </ce-icon>
        `)}
        ${ifTrue(this.dot, () => h`<span part="dot" class="ce-tag-dot"></span>`)}
        <span class="ce-tag-content">
          <slot></slot>
        </span>
        ${ifTrue(!isBlank(this.appendIcon), () => h`
          <ce-icon
            svg="${this.appendIcon}"
            size="${this.iconSize || this.size}"
          >
          </ce-icon>
        `)}
        <slot name="append"></slot>
        ${ifTrue(this.closable, () => h`<ce-icon class="ce-tag-close" size="${this.size}" svg="c-svg-close" @click="${this.onClose}"></ce-icon>`)}
      </div>
      ${super.render()}
    `;
  }
  mounted(): void {
    this.__watchColor(this.color, '')
  }
  //////////////////////////////////// methods
  onClose(e: MouseEvent) {
    this.emit('close', {}, e)
  }
}
