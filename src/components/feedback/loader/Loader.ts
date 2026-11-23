
import { classes, CompElem, h, prop, tag, Template, watch, csscope, Csscope } from "compelem";
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
  /**
   * 是否显示遮罩。
   *
   * `backdrop` 是默认 `true` 的布尔 prop：dev 构建下会被字段初始化器遮蔽，
   * `backdrop="false"` 读不回来；同时未写属性时默认值也不会出现在 DOM 属性上。
   * 因此按「属性优先（"false" 视为关闭）、prop 兜底」计算，模板用类名落状态。
   */
  get showBackdrop(): boolean {
    const attr = this.getAttribute('backdrop');
    if (attr !== null) return attr !== 'false';
    return this.backdrop !== false;
  }
  /////////////////////////////////// watches
  @watch(['backdrop'])
  syncMaskClass() {
    // 遮罩模式下宿主需要铺满父级（父级需 position:relative），否则宿主
    // 作为 inline 元素尺寸为 0，绝对定位的遮罩按宿主算 100% 也会变成 0。
    this.classList.toggle('ce-loader-mask', this.showBackdrop)
  }
  //////////////////////////////////// lifecycles
  mounted(): void {
    this.syncMaskClass()
  }
  constructor() {
    super();
  }

  render(): Template {
    return h`
    <div class="ce-loader" ${classes({
      ["ce-loader-size-" + this.size]: true,
      "is-center": this.center || this.hasAttribute('center'),
      "ce-loader-fullscreen": this.fullscreen
    })}>
      <ce-icon spin spin-speed="${this.speed}" .svg="${Loading}" ></ce-icon> ${this.content}
    </div>
    <div class="ce-loader-backdrop" ${classes({ "is-shown": this.showBackdrop })}></div>
    `;
  }

  //////////////////////////////////// methods
  show() {
    this.style.display = 'inline-block'
  }
  close() {
    this.style.display = 'none'
  }
}
