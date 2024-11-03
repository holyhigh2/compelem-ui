import { CompElem, html, prop, tag, Template } from "compelem";
import style from "./style.scss";
/**
 * 页签
 * @attrs
 *  index {string} 当前页签索引
 *  label {string} 当前页签对应的tabs名称
 *
 * @slots
 *  - 默认插槽，显示内容
 *
 * @author holyhigh2
 */
@tag("l-tabs-tab")
export class Tab extends CompElem {
  el_slot: HTMLSlotElement;
  //////////////////////////////////// props
  @prop({ type: String }) index: string;
  @prop({ type: String }) label: string;

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
      <div class="c-tab">
        <slot></slot>
      </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods

  onSelect(e: CustomEvent) {
    debugger
  }
}
