import { h, ifTrue, prop, show, state, styles, tag, Template, csscope, Csscope } from "compelem";
import { isBlank, isEmpty } from 'myfx';
import { AppearanceElem, AppearanceSize } from "../../../base/Appearance";

import { AvatarDefault } from "../../../icons/icons";
import style from "./style.scss?tmpl";
/**
 * 头像
 * @props
 *  size {string} xs/sm/md/lg/xl/xxl，默认md
 *  round {string} 默认circle
 *  color {string} 指定color时不会显示默认图标，默认空
 *  image {string} 图片地址，如果无效地址会显示slot内容，如果slot内容为空会显示默认图标
 *  image-fit {string} object-fit属性，默认 cover
 *
 * @slots
 *  default() 
 *
 * @author holyhigh2
 */
@tag('ce-avatar')
export class Avatar extends AppearanceElem {

  //////////////////////////////////// props
  round = 'circle'
  size = AppearanceSize.MD
  @prop({ type: String }) image: string;
  @prop imageFit = 'cover'

  @state showImage = false;

  forced = false;
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
    return h`
    <div class="ce-avatar " ${styles({ 'background-color': this.color ? 'var(--color, var(--ce-color-gray-400))' : '' })}>
    ${ifTrue(!isBlank(this.image), () => h`
      <img src="${this.image}" class="ce-avatar-img" @load="${() => this.showImage = true}" @error="${this.onLoadError}" ${styles({
      'object-fit': this.imageFit
    })}>
    `)}
      <slot ${show(!this.image)}></slot>
      ${ifTrue(isEmpty(this.slots.default) && !this.showImage, () => h`
        <div class="ce-avatar-default">
          <ce-icon part="icon" .svg="${AvatarDefault}" ></ce-icon>
        </div>
      `)}
    </div>
    `;
  }

  mounted(): void {
    if (this.forced) {
      this.nextTick(() => {
        this.forced = false
        let color = this.color;
        this.color = ''; //trigger color update
        this.forceUpdate();
        this.nextTick(() => {
          this.color = color;
        });
      });
    }
  }
  //////////////////////////////////// methods
  onLoadError() {
    this.showImage = false;
  }
  slotChange(slot: HTMLSlotElement, name: string): void {
    if (!name) {
      this.forceUpdate();
      if (!this.isMounted)
        this.forced = true
    }
  }
}
