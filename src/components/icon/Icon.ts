import { CompElem, html, prop, tag, Template, watch } from "compelem";
import { trim } from "myfx";
import style from "./style.scss";
/**
 * 图标组件，可封装svg
 * @attrs
 *  rotate {number} 旋转角度
 *  spin {boolean} 旋转动画
 *  spin-speed {string} 旋转速度 fast/normal/slow
 *
 * @slots
 *  default() 链接内容
 *
 * @author holyhigh2
 */
@tag('l-icon')
export class Icon extends CompElem {

  //////////////////////////////////// props
  @prop rotate = 0;
  @prop spin = false;
  @prop spinSpeed = 'normal';
  @prop icon: string;//用于字体图标的class引用

  @prop({ type: Function, attribute: false }) svg: () => Template = () => html``;

  //////////////////////////////////// styles
  static get styles(): Array<string | CSSStyleSheet> {
    return [style];
  }
  /////////////////////////////////// watches
  @watch('rotate', { immediate: true })
  watchRotate(nv: any) {
    this.style.transform = trim(this.style.transform.replace(/rotate\([^)]*\)/, '') + ' rotate(' + this.rotate + 'deg)');
  }
  @watch('spin', { immediate: true })
  watchSpin(nv: any) {
    let interval = 1;
    switch (this.spinSpeed) {
      case 'normal':
        interval = 1;
        break;
      case 'fast':
        interval = 0.5;
        break;
      case 'slow':
        interval = 2;
        break;
    }
    this.style.animation = nv ? 'icon-spin ' + interval + 's infinite linear' : '';
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`${this.getSvg(this.svg)}`
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods
  getSvg(svg: Function) {
    return svg();
  }
}
