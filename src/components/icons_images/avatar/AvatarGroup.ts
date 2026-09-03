import { classes, CompElem, css, csscope, Csscope, h, prop, state, tag, Template } from "compelem";
import { filter, isString } from "myfx";
import { AppearanceSize } from "../../../base/Appearance";
import { Avatar } from './Avatar';
import style from "./style.scss?tmpl";
/**
 * 头像组
 * @props
 *  size {string} xs/sm/md/lg/xl/xxl，默认md
 *  round {string} 默认circle
 *  max {number} 最大可见头像数，0表示不限制
 *  expandable {boolean} 鼠标悬浮头像组时是否展开默认false
 *  stack {string|boolean} 是否堆叠显示，默认false。支持 true/bottom、top
 *  gap {string} 头像间距，默认-0.5rem，受控
 *
 * @slots
 *  default()
 *
 * @author holyhigh2
 */
@tag('ce-avatar-group')
export class AvatarGroup extends CompElem {

  //////////////////////////////////// props
  @prop round = 'circle'
  @prop expandable = false
  @prop size = AppearanceSize.MD
  @prop max = 0
  @prop({ type: [Boolean, String] }) stack: boolean | string = true
  @prop gap = '-0.5rem'

  @state showImage = false;
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  @csscope(Csscope.HOST)
  static get hostCss() {
    return css`
    ce-avatar-group{
      display: inline-block;
    }
    `;
  }

  get cssVars() {
    return {
      '--ce-avatar-group-gap': `${this.gap} !important`
    }
  }

  private _slot: HTMLSlotElement | null = null
  private _badge: HTMLElement | null = null
  private _total = 0

  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
    <div class="ce-avatar-group" ${classes(
      {
        'is-expandable': this.expandable,
        ['is-stack-' + (isString(this.stack) ? this.stack : 'top')]: this.stack
      }
    )} @mouseenter="${this.onMouseEnter}" @mouseleave="${this.onMouseLeave}">
      <slot .size="${this.size}" .round="${this.round}"></slot>
    </div>
    `;
  }

  mounted(): void {
    this._slot = this.shadowRoot?.querySelector('slot') ?? null
    if (this._slot) {
      this.syncMax()
    }
  }
  slotChange(slot: HTMLSlotElement, name: string): void {
    this.syncMax()
  }

  //////////////////////////////////// methods
  private getAvatars(): Element[] {
    return filter<Element>(this.slots.default, n => n.nodeName === 'CE-AVATAR')
  }

  private ensureBadge(): HTMLElement {
    if (!this._badge) {
      this._badge = new Avatar()
      this._badge.setAttribute('color', 'var(--ce-color-text-desc-rgb)')
      this._badge.className = 'ce-avatar-group-badge'
      this._badge.textContent = '+0'
    }
    return this._badge
  }

  syncMax(): void {
    const avatars = this.getAvatars()
    const total = avatars.length
    this._total = total
    const group = this.shadowRoot?.querySelector('.ce-avatar-group') as HTMLElement | null
    if (!group) return

    const needTruncate = this.max > 0 && total > this.max

    // 同步 overflow-hidden class
    avatars.forEach((av, i) => {
      av.setAttribute('size', this.size)
      if (needTruncate && i >= this.max) {
        av.classList.add('overflow-hidden')
      } else {
        av.classList.remove('overflow-hidden')
      }
    })

    // 同步 badge
    if (needTruncate) {
      const badge = this.ensureBadge()
      badge.textContent = `+${total - this.max}`
      // 同步 size/round 到 badge
      badge.setAttribute('size', this.size)
      badge.setAttribute('round', this.round)
      if (badge.parentElement !== group) {
        group.appendChild(badge)
      }
      group.classList.add('is-truncated')
    } else {
      if (this._badge?.parentElement) {
        this._badge.parentElement.removeChild(this._badge)
      }
      group.classList.remove('is-truncated')
    }
  }

  private onMouseEnter(): void {
    if (this.expandable && this.max > 0) {
      const group = this.shadowRoot?.querySelector('.ce-avatar-group')
      group?.classList.add('is-hovering')
      // 移除 overflow-hidden，让所有 avatar 显示
      this.getAvatars().forEach(av => av.classList.remove('overflow-hidden'))
    }
  }

  private onMouseLeave(): void {
    if (this.expandable && this.max > 0) {
      const group = this.shadowRoot?.querySelector('.ce-avatar-group')
      group?.classList.remove('is-hovering')
      // 恢复 overflow-hidden
      const avatars = this.getAvatars()
      avatars.forEach((av, i) => {
        if (i >= this.max) av.classList.add('overflow-hidden')
      })
    }
  }
}
