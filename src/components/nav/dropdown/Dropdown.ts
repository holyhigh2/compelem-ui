import { CompElem, csscope, Csscope, emits, h, prop, query, tag, Template } from "compelem";
import { find, identity, insert, isObject, isString, map, remove } from "myfx";
import { ListItem } from "../../layout/list/ListItem";
import { Overlay } from "../../overlays/overlay/Overlay";
import style from "./style.scss?tmpl";
/**
 * 下拉菜单
 * @attrs
 *  items {array} 菜单项数组，详见 @see MenuPane
 *  theme {string} light/dark
 *  trigger {string} hover/click，默认hover
 *
 * @events
 *  select({item,index,el}) 菜单项选中时触发
 *  hover({item,index,el}) 菜单项悬浮时触发
 *  close() 关闭时触发
 *  open() 打开时触发
 * @slots
 *  trigger 触发菜单的元素
 *
 * @author holyhigh2
 */
@emits('select', 'hover')
@tag('ce-dropdown')
export class Dropdown extends CompElem {

  @query('ce-overlay')
  overlay: Overlay

  //////////////////////////////////// props
  @prop hideOnClick = true
  @prop theme = "light"
  @prop trigger = "hover"
  @prop({ type: Array, required: true }) items: Array<any> = []

  //////////////////////////////////// state

  //////////////////////////////////// computed
  get renderItems() {
    return map(this.items, item => {
      if (isObject(item)) return item
      if (isString(item)) return { text: item }
      return null
    })
  }

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
    <nav class="ce-dropdown">
      <ce-overlay close-on-click backdrop="false" placement="bottom-end" auto-active trigger-mode="${this.trigger}">
        <slot name="trigger" slot="trigger"></slot>
        <ce-card class="config-card" style="min-width: 14rem;padding: var(--ce-spacing-xs);" >
          <ce-list-picker .value="${this.items}"></ce-list-picker>
        </ce-card>
      </ce-overlay>
    </nav>
    <slot style="display:none"></slot>
    `;
  }

  //////////////////////////////////// methods
  onSelectMenu(obj: Record<string, any>) {
    this.overlay.close()
    const { item, event } = obj
    let itemData = find(this.renderItems, (it: any) => it && (it.text === item.value))
    this.emit('select', { item: itemData, el: item }, event)
  }
  onHover(ev: MouseEvent) {
    let item = ev.currentTarget as ListItem
    let itemData = find(this.renderItems, (it: any) => it && (it.text === item.value))
    this.emit('hover', { item: itemData, el: item }, ev)
  }
  setItems(items: any[]) {
    remove(this.items, identity)
    insert(this.items, 0, ...items)
  }
  getItems() {
    return this.items
  }
}
