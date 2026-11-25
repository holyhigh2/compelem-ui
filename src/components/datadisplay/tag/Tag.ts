import { ICloseable } from "@/interfaces/ICloseable";
import { csscope, Csscope, emits, h, html, ifTrue, prop, tag, Template } from "compelem";
import { isBlank } from "myfx";
import { Close } from "../../../icons/icons";
import type { IconFactory } from "../../../icons/registry";
import { APPEARANCE_LAYER, AppearanceElem } from "../../../base/Appearance";
import style from "./style.scss?tmpl";
/**
 * 标签组件
 * @extends AppearanceElem
 * @attrs
 *  dot {boolean} 是否显示点，默认false
 *  closable {boolean} 是否显示关闭按钮，默认false
 *  iconSize {string} 同size，用于定义icon大小。为空时与标签文字同号（1em）
 *  icon {string|function} 图标名称（支持 c-svg-xx）或图标工厂
 *  append-icon {string|function} 图标名称（支持 c-svg-xx）或图标工厂
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
  @prop({ type: [String, Function] }) icon: string | IconFactory = "";
  @prop({ type: [String, Function] }) appendIcon: string | IconFactory = "";
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
            .svg="${this.icon}"
            size="${this.iconSize}"
          >
          </ce-icon>
        `)}
        ${ifTrue(this.dot, () => h`<span part="dot" class="ce-tag-dot"></span>`)}
        <span class="ce-tag-content">
          <slot></slot>
        </span>
        ${ifTrue(!isBlank(this.appendIcon), () => h`
          <ce-icon
            .svg="${this.appendIcon}"
            size="${this.iconSize}"
          >
          </ce-icon>
        `)}
        <slot name="append"></slot>
        ${ifTrue(this.closable, () => h`<ce-icon class="ce-tag-close" .svg="${Close}" @click="${this.onClose}"></ce-icon>`)}
      </div>
      ${html(APPEARANCE_LAYER)}
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
