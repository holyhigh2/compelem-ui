import { classes, CompElem, html, ifTrue, prop, tag, Template } from "compelem";
import { isEmpty } from "myfx";
import style from "./style.scss";
/**
 * 标签组件
 * @attrs
 *  title {string} 卡片标题
 *  subtitle {string} 卡片子标题
 *  shadow {string} 显示阴影，always / hover / never，默认 always
 *  border {boolean} 是否边框，默认false
 * @events
 *
 * @slots
 *  - 卡片内容可以为空
 *  header 卡片头部信息，取代title及subtitle
 *  title
 *  subtitle
 *  leading header前置内容
 *  trailing header后置内容
 *  actions 卡片底部动作条
 *
 * @author holyhigh2
 */
@tag('l-card')
export class Card extends CompElem {

  //////////////////////////////////// props
  @prop title: string = '';
  @prop subtitle = '';
  @prop border = true;
  @prop shadow = 'always';

  static get styles(): Array<string | CSSStyleSheet> {
    return [style];
  }
  /////////////////////////////////// watches
  get css() {
    return `:host{
      ${this.border ? 'border: 1px solid rgb(var(--l-color-border-secondary)); ' : ''}
    }`
  }
  //////////////////////////////////// lifecycles
  mounted(): void {
  }

  render(): Template {
    return html`
    <div class="c-card ${classes({
      ['__shadow-' + this.shadow]: this.shadow !== 'none'
    })}">
      <header>
        <div class="--leading"><slot name="leading"></slot></div>
        <div class="--content">
          <h3>${this.title}</h3>
          <p>${this.subtitle}</p>
        </div>
        <div class="--trailing"><slot name="trailing"></slot></div>
      </header>
      ${ifTrue(!isEmpty(this.slots.default), () => html`
        <main>
          <slot></slot>
        </main>
        `)}
      ${ifTrue(!isEmpty(this.slots.actions), () => html`
        <footer>
          <slot name="actions"></slot>
        </footer>
        `)}
    </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods
  onClose(e: MouseEvent) {
    this.emit('close', {}, { event: e })
  }
}
