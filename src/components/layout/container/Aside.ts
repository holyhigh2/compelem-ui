import { CompElem, html, tag, Template } from "compelem";
/**
 * 布局容器 - 侧边
 *
 * @author holyhigh2
 */
@tag('l-aside')
export class Aside extends CompElem {

  static get styles(): string[] {
    return [`
      :host {
        display: block;
        flex-shrink:0;
        width: 260px;
        text-align: center;
      }
    `];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`<slot></slot>`;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() {
  }
  //////////////////////////////////// methods

}
