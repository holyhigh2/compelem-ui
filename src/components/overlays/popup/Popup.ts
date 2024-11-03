import { CompElem, html, prop, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 弹出框
 * 主要由其他组件调用
 * @prop
 *  title {string} 标题
 *  content {string} 显示内容
 *  width {string} 宽度
 *  placement {string} 显示位置 topLeft/top/topRight/ rightTop/right/rightBottom/ bottomLeft/bottom/bottomRight/ leftTop/left/leftBottom
 *  trigger {string} 触发方式 click/hover/focus/active
 * @slots
 *  default() 内容
 *
 *
 * @events
 *  close() 关闭时触发
 *
 * @author holyhigh2
 */
@tag('l-popup')
export class Popup extends CompElem {

  //////////////////////////////////// props
  @prop appendToBody = false;

  static get styles(): string[] {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }
  render(): Template {
    return html`
    <div class="c-popup">
      <slot></slot>
    </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();

    if (this.appendToBody && this.parentNode !== document.body) {
      this.parentNode?.removeChild(this)
      document.body.appendChild(this)
    }
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods
  /**
   * 根据popup与target元素的位置，自动计算弹出位置
   * @param target 
   */
  open(target: HTMLElement) {
    let rect = target.getBoundingClientRect()
    let style = this.style
    let offsetParent = this.offsetParent;
    //同级
    if (!offsetParent || offsetParent === target.parentNode) {
      style.top = target.offsetTop + rect.height + 10 + 'px'
    }

    style.display = 'block';
    style.minWidth = rect.width + 'px'
  }
  hide() {
    this.renderRoot.style.display = 'none'
  }
}
