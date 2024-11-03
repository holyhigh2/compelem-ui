import { closest } from "myfx";

import { CompElem, event, html, prop, query, state, tag, Template } from "compelem";
import { Dialog } from "../../overlays/dialog/Dialog";
import { MenuPane } from "../menupane/MenuPane";
/**
 * 右键菜单
 * @attrs
 *  target {string} 目标容器选择器，如果为空。默认parentElement
 *  items {array} 字符串数组/{text:,value:,disabled,iconClass}数组，如果数组内容为非对象/字符串则显示为分割条
 *  theme {string} light/dark
 * @events
 *  select({item,index,el}) 菜单项选中时触发
 *  hover({item,index,el}) 菜单项悬浮时触发
 *  beforeopen({event}) 打开前触发
 *  close() 关闭后触发
 *
 * @author holyhigh2
 */
@tag('l-context-menu')
export class ContextMenu extends CompElem {
  #init: boolean;
  #opened: boolean = false;
  @query('l-menu-pane')
  menuPane: MenuPane
  //////////////////////////////////// props
  @prop theme = "light"
  @prop target: HTMLElement
  @prop({ type: Array, required: true }) items: Array<any> = []

  @state({ prop: 'items' }) itemList: Array<any>;


  static get styles(): string[] {
    return []
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return html`
    <nav class="c-context-menu">
      <l-menu-pane @select="${this.onSelect}" @hover="${this.onHover}" .items="${this.items}" theme="${this.theme}" round="true" style="position: fixed;"></l-menu-pane>
    </nav>
    `;
  }

  updated(changed: Record<string, any>): void {
    if (changed.itemList) {
      this.menuPane.setItems(this.itemList)
    }
  }

  connected(): void {
    if (!this.target) {
      this.target = this.parentComponent || this.parentElement!;
    }
  }

  //////////////////////////////////// methods
  onHover(ev: CustomEvent) {
    this.dispatchEvent(new CustomEvent(ev.type, {
      detail: ev.detail
    }))
  }
  onSelect(ev: CustomEvent) {
    this.close()
    this.dispatchEvent(new CustomEvent(ev.type, {
      detail: ev.detail
    }))
  }
  @event('mousedown')
  onMouseDown(e: MouseEvent) {
    let t = e.target as HTMLElement;
    if (t.tagName !== this.tagName) {
      this.close()
    }
  }
  @event('contextmenu', { target: function () { return this.target || this.parentComponent } })
  onContextMenu(e: MouseEvent) {
    if (!(e instanceof MouseEvent)) return;
    let t = e.target as Node;
    let target = this.target
    if (!target?.contains(t)) {
      return;
    }
    let toOpen = true;
    this.emit("beforeopen", {
      cancel: () => {
        toOpen = false;
      }
    }, { event: e });
    if (toOpen)
      this.open(e)
  }

  setItems(items: any[]) {
    this.itemList = items;
    this.#init = false;
  }
  isOpen(): boolean {
    return this.#opened;
  }
  open(e: MouseEvent) {
    e.preventDefault();
    //渲染菜单
    if (!this.#init) {
      (this.renderRoot.firstElementChild as MenuPane).setItems(this.itemList as any);
      this.#init = true;
    }

    //显示菜单
    const { clientX, clientY } = e;
    const list = this.renderRoot.firstElementChild as MenuPane

    let ml = 0, mt = 0;
    //dialog元素检测
    let con = (this.closest('l-dialog') || this.closest('dialog') || closest(this, node => node.tagName == 'L-DIALOG', 'parentComponent'))
    if (con) {
      con = con instanceof HTMLDialogElement ? con : (con as Dialog).renderRoot
      const st = window.getComputedStyle(con)
      ml = parseFloat(st.marginLeft)
      mt = parseFloat(st.marginTop)
    }

    list.open(clientX - ml, clientY - mt)
    this.#opened = true;
  }
  close() {
    this.menuPane.close()
    this.#opened = false;
    this.emit("close", {});
  }
}

