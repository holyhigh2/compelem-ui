import { CompElem, csscope, Csscope, prop, state, tag, Template, watch } from "compelem";
import { isFunction, isString, pascalCase, trim } from "myfx";
import { IconMap } from '../../../icons/icons';
import style from './style.scss?tmpl';
const SVG_PRIFFX = 'c-svg-'
/**
 * 图标组件，可封装svg
 * @props
 *  rotate {number} 旋转角度
 *  spin {boolean} 旋转动画
 *  spin-speed {string} 旋转速度 fast/normal/slow
 *  svg {function|string} svg模板函数，如果存在则忽略icon属性。通过c-svg-xxx
 *  icon {string} 字体图标class。通过createIcons函数安装后使用
 *  size {string} xs/sm/md/lg/xl
 *
 * @slots
 *  default() 链接内容
 *
 * @author holyhigh2
 */
@tag('ce-icon')
export class Icon extends CompElem<null> {
  //////////////////////////////////// props
  @prop rotate = 0;
  @prop spin = false;
  @prop spinSpeed = 'normal';
  @prop({ type: String }) icon: string;//用于字体图标的class引用
  @prop({
    type: [Function, String], attribute: false, hasChanged(nv, ov) {
      return nv !== ov
    }
  }) svg: string | (() => Template);
  @prop size = 'md'

  @state path = ''

  //////////////////////////////////// styles
  @csscope(Csscope.HOST)
  static get hostCss() {
    return style;
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
  mounted(): void {
    try {
      let path = ''
      if (isString(this.svg)) {
        let name = pascalCase(this.svg.replace(SVG_PRIFFX, ''))
        path = IconMap[name]().strings[0]
      } else if (isFunction(this.svg)) {
        path = this.svg().strings[0]
      }
      this.path = path
      this.innerHTML = this.path
    } catch (error) {
    }

    if (!!this.icon && !this.path) {
      this.classList.add(this.icon)
    }
  }

  //////////////////////////////////// methods
}
