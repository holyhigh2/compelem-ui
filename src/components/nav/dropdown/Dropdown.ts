import { CompElem, html, prop, query, tag, Template } from "compelem";
import { identity, insert, remove } from "myfx";
import { MenuPane } from "../menupane/MenuPane";
import style from "./style.scss";
/**
 * 下拉菜单
 * @attrs
 *  items {array} 菜单项数组，详见 MenuPane
 *  theme {string} light/dark
 *  trigger {string} hover/click，默认hover
 *
 * @events
 *  select({item,index,el}) 菜单项选中时触发
 *  hover({item,index,el}) 菜单项悬浮时触发
 *  close() 关闭时触发
 * @slots
 *  trigger 触发菜单的元素
 *
 * @author holyhigh2
 */
@tag('l-dropdown')
export class Dropdown extends CompElem {
  #mousedownHook: any;
  #timer_hide: any;
  #opened: boolean = false;

  @query('l-menu-pane')
  menuPane: MenuPane

  //////////////////////////////////// props
  @prop hideOnClick = true
  @prop theme = "light"
  @prop trigger = "hover"
  @prop({ type: Array, required: true }) items: Array<any> = []

  //////////////////////////////////// state

  static get styles(): string[] {
    return [style];
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();

    this.#mousedownHook = this.onMouseDown.bind(this);
  }

  render(): Template {
    return html`
    <nav class="c-dropdown"  @mouseleave="${this.onMouseLeaveAnchor}">
      <div class="c-dropdown-anchor" @click="${this.onClickAnchor}" @mouseenter="${this.onMouseEnterAnchor}">
        <slot name="trigger"></slot>
      </div>
      <l-menu-pane .items="${this.items}" theme="${this.theme}" .round="${true}" @select="${this.onSelect}" @hover="${this.onHover}"></l-menu-pane>
    </nav>
    <slot style="display:none"></slot>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.menuPane.setItems(this.items)
  }

  disconnectedCallback() {
    document.removeEventListener("mousedown", this.#mousedownHook);
  }

  slotchange(slot: HTMLSlotElement, name: string): void {

  }
  //////////////////////////////////// methods
  onHover(ev: CustomEvent) {
    // this.dispatchEvent(
    //   new CustomEvent(ev.type, {
    //     detail: ev.detail,
    //   })
    // );
    this.emit(ev.type, ev.detail, { event: ev.detail.event })
  }
  onSelect(ev: CustomEvent) {
    if (this.hideOnClick) {
      this.close();
    }

    // this.dispatchEvent(
    //   new CustomEvent(ev.type, {
    //     detail: ev.detail,
    //   })
    // );
    this.emit(ev.type, ev.detail, { event: ev.detail.event })
  }
  onMouseDown(e: MouseEvent) {
    let t = e.target as HTMLElement;

    if (!(t instanceof Dropdown)) {
      this.close();
    }
  }
  onClickAnchor(e: MouseEvent) {
    if (this.trigger !== 'click') return;
    this.open(e);
  }
  onMouseEnterAnchor(e: MouseEvent) {
    if (this.trigger !== 'hover') return;
    this.open(e);
  }
  onMouseLeaveAnchor(e: MouseEvent) {
    if (this.trigger !== 'hover') return;
    this.#timer_hide = setTimeout(() => {
      this.close();
    }, 300);
  }
  setItems(items: any[]) {
    remove(this.items, identity)
    insert(this.items, 0, ...items)
    // this.items = items;
  }
  getItems() {
    return this.items
  }
  getCheckedItems() {
    return this.menuPane.getCheckedItems()
  }
  isOpen(): boolean {
    return this.#opened;
  }
  open(e: MouseEvent) {
    e.preventDefault();
    if (this.#opened) {
      clearTimeout(this.#timer_hide);
      return;
    }

    this.emit("open", {}, { event: e, bubbles: true })

    let x = this.renderRoot.firstElementChild?.clientWidth!;
    let y = this.renderRoot.firstElementChild?.clientHeight!;
    let menu = this.renderRoot.lastElementChild as MenuPane;

    menu.open(x - menu.renderRoot.clientWidth, y);
    this.#opened = true;

    //开启监听
    document.addEventListener("mousedown", this.#mousedownHook);
  }
  close() {
    (this.renderRoot.lastElementChild as MenuPane).close();
    this.#opened = false;
    document.removeEventListener("mousedown", this.#mousedownHook);

    this.emit("close", {})
  }
}
