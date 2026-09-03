
import { classes, CompElem, h, prop, tag, Template, csscope, Csscope } from "compelem";
import { Loading } from "../../../icons/icons";
import style from "./style.scss?tmpl";
/**
 * 加载器动画
 * @attrs
 *  backdrop {boolean} 是否显示遮罩，默认true
 *  center {boolean} 是否居中显示
 *  fullscreen {boolean} 是否全屏显示，默认false。
 *  content {string} 加载信息，默认“加载中...”
 *  speed {string} fast/normal/slow
 *  size {string} 尺寸可选 lg/md/sm/xs，默认md
 *
 *
 * @events
 *  close() 关闭时触发
 *
 * @author holyhigh2
 */
@tag('ce-loader')
export class Loader extends CompElem {

  //////////////////////////////////// props
  @prop backdrop = true;
  @prop center = false;
  @prop fullscreen = false;
  @prop content = '加载中...';
  @prop speed = 'normal';
  @prop size = "md"; //lg, md, sm, xs

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    let tmpl = h`
    <div class="ce-loader" ${classes({
      ["ce-loader-size-" + this.size]: true,
      "is-center": this.center,
      "ce-loader-fullscreen": this.fullscreen
    })}>
      <ce-icon spin spin-speed="${this.speed}" .svg="${Loading}" ></ce-icon> ${this.content}
    </div>
    <div class="ce-loader-backdrop"></div>
    `;
    return tmpl;
  }

  //////////////////////////////////// methods
  show() {
    this.style.display = 'inline-block'
  }
  close() {
    this.style.display = 'none'
  }
}
