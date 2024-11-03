import { CompElem, html, tag, Template } from "compelem";
/**
 * 布局容器 - 主体内容
 *
 * @author holyhigh2
 */
@tag('l-main')
export class Main extends CompElem {

  static get styles(): string[] {
    return [`
      :host {
        display: block;
        flex: 1;
        overflow: hidden;
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
