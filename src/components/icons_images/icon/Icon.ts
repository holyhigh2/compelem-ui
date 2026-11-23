import { CompElem, csscope, Csscope, prop, state, tag, Template, watch } from "compelem";
import { isFunction, isNumeric, isString, pascalCase, trim } from "myfx";
import { getIcon } from '../../../icons/registry';
import style from './style.scss?tmpl';
const SVG_PRIFFX = 'c-svg-'
/**
 * 图标组件，可封装svg
 * @attrs
 *  rotate {number} 旋转角度
 *  spin {boolean} 旋转动画
 *  spin-speed {string} 旋转速度 fast/normal/slow
 *  svg {function|string} svg模板函数；字符串形式为已注册的图标名（c-svg-xxx），需先经 registerIcons 注册
 *  icon {string} 字体图标class。通过createIcons函数安装后使用
 *  size {string} xs/sm/md/lg/xl，或纯数字（按px设置图标尺寸）。为空时按 1em 跟随宿主文字大小
 *  flip {string} 镜像翻转方向 x/y/xy
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
  @prop({ type: [Function, String], attribute: false }) svg: string | (() => Template);
  // 默认不指定档位 ⇒ 不输出 size 属性，图标按 1em 继承宿主文字大小。
  // 写成 'md' 会固定为 1.25em：按钮里图标 17.5px / 文字 14px，视觉上永远大一号。
  @prop size = ''
  @prop flip = ''

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
  @watch('size', { immediate: true })
  watchSize(nv: any) {
    if (isNumeric(nv)) this.style.fontSize = nv + 'px';
    else this.style.removeProperty('font-size');
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
        const factory = getIcon(name)
        if (factory) {
          path = factory().strings[0]
        }
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
