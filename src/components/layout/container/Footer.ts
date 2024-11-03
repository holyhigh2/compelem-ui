import { CompElem, html, tag, Template } from "compelem";
/**
 * 布局容器 - 底部
 *
 *
 * @author holyhigh2
 */
@tag('l-footer')
export class Footer extends CompElem {

  static get styles(): string[] {
    return [
      `
      :host{
        text-align: center;
        line-height: 56px;
      }
      `
    ];
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
