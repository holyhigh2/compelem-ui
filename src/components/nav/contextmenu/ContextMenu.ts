
import { CompElem, csscope, Csscope, emits, event, h, prop, query, state, tag, Template } from "compelem";
import { isEmpty } from "myfx";
import { isCompoundLayer } from "../../../utils/utils";
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
@emits('select', 'beforeopen', 'close')
@tag('ce-context-menu')
export class ContextMenu extends CompElem {
  #init: boolean;
  #opened: boolean = false;
  @query('ce-menu-pane')
  menuPane: MenuPane
  //////////////////////////////////// props
  @prop theme = "light"
  @prop({ type: String }) target = ''
  @prop({ type: Array, required: true }) items: Array<any> = []

  @state({ prop: 'items' }) itemList: Array<any>;

  targetEl: HTMLElement | undefined

  @csscope(Csscope.INNER)
  static get css() {
    return []
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <nav class="ce-context-menu">
      <ce-menu-pane @select="${this.onSelect}" @hover="${this.emit}" .items="${this.items}" theme="${this.theme}" round="true" style="position: fixed;"></ce-menu-pane>
    </nav>
    `;
  }

  updated(changed: Record<string, any>): void {
    if (changed.itemList) {
      this.menuPane.setItems(this.itemList)
    }
  }

  mounted(): void {
    if (!this.target) {
      this.targetEl = this.parentComponent || this.parentElement!;
    }
  }

  //////////////////////////////////// methods
  onSelect(obj: Record<string, any>) {
    this.close()
    this.emit('select', obj)
  }
  // @event('mousedown', () => document.body)
  onMouseDown(e: MouseEvent) {
    let t = e.target as HTMLElement;
    if (t.tagName !== this.tagName) {
      this.close()
    }
    if (this._bodyClick) {
      document.body.removeEventListener('mousedown', this._bodyClick as any)
      this._bodyClick = null as any
    }
  }
  @event('contextmenu', (thisComp: any) => thisComp.targetEl! || thisComp.parentComponent)
  onContextMenu(e: MouseEvent) {
    if (!(e instanceof MouseEvent)) return;
    let t = e.target as Node;
    let target = this.targetEl
    if (!target?.contains(t)) {
      return;
    }

    let toOpen = true;
    this.emit("beforeopen", {
      cancel: () => {
        toOpen = false;
      }
    }, e);
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
  _bodyClick: Function
  open(e: MouseEvent) {
    e.preventDefault();
    if (isEmpty(this.itemList)) return
    //渲染菜单
    if (!this.#init) {
      (this.renderRoot!.firstElementChild as MenuPane).setItems(this.itemList as any);
      this.#init = true;
    }

    //显示菜单
    const { clientX, clientY } = e;
    const list = this.renderRoot!.firstElementChild as MenuPane

    let ml = 0, mt = 0;

    let pNode = this.parentNode!
    let con = null
    while (pNode.nodeName != 'BODY') {
      if (pNode instanceof ShadowRoot) {
        pNode = pNode.host
      }
      if (isCompoundLayer(pNode as HTMLElement)) {
        con = pNode
        break
      }

      pNode = pNode.parentNode!

    }
    if (con) {
      let rect = (con as HTMLElement).getBoundingClientRect()
      ml = rect.left
      mt = rect.top
    }

    list.open(clientX - ml, clientY - mt)
    this.#opened = true;

    this._bodyClick = this.onMouseDown.bind(this)
    document.body.addEventListener('mousedown', this._bodyClick as any)
  }
  close() {
    this.menuPane.close()
    this.#opened = false;
    this.emit("close", {});
  }
}

