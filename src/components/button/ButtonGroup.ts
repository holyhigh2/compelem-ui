import { CompElem, html, tag, Template } from "compelem";
import { each, findTreeNodes } from "myfx";
import { Button } from "./Button";
import style from "./group.scss";
/**
 * 按钮组
 * @attrs
 *  任意Button属性
 * @slots
 *  - 按钮组件
 *
 * @author holyhigh2
 */
@tag("l-button-group")
export class ButtonGroup extends CompElem {

  //////////////////////////////////// props

  //////////////////////////////////// styles
  static get styles(): Array<string | CSSStyleSheet> {
    return [style];
  }
  /////////////////////////////////// watches

  //////////////////////////////////// lifecycles
  render(): Template {
    return html`<div class="c-button-group"><slot></slot></div>`;
  }
  slotchange(slot: HTMLSlotElement, name: string): void {
    let nodes = slot.assignedElements({ flatten: true })
    let btns = findTreeNodes<Button>(nodes, n => n instanceof Button)
    let lastI = btns.length - 1
    let attrs = this.attrs;
    each(btns, (btn, i) => {
      each(attrs, (v, k: string) => {
        btn.setAttribute(k, v)
      })
      if (!btn.renderRoot) return;

      if (i === 0) {
        btn.renderRoot.style.borderTopRightRadius = '0'
        btn.renderRoot.style.borderBottomRightRadius = '0'
      } else if (i === lastI) {
        btn.renderRoot.style.borderTopLeftRadius = btn.renderRoot.style.borderBottomLeftRadius = '0'
      } else {
        btn.renderRoot.style.borderRadius = '0'
      }
      btn.renderRoot.style.height = '100%';

    })
  }
  //////////////////////////////////// methods
}
