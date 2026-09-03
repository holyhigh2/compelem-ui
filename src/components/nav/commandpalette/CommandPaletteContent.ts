import { bind, csscope, Csscope, emits, h, prop, tag, Template } from "compelem";
import { AppearanceElem } from "../../../base/Appearance";
import { Search } from "../../../icons/icons";
import style from "./style.scss?tmpl";
/**
 * 命令面板内容
 * @props
 *  placeholder 输入框占位符，默认 "Type to search..."
 * @events
 *  search({value}) 搜索时触发
 *  clear 搜索框清除时触发
 *  input({value}) 搜索框输入时触发
 * @slots
 *  - 主体内容
 *  header 头部内容
 *  footer 底部内容
 *
 * @author holyhigh2
 */
@emits('search', 'clear', 'input')
@tag('ce-command-palette-content')
export class CommandPaletteContent extends AppearanceElem {

  //////////////////////////////////// props
  @prop placeholder = 'Type to search...'

  //////////////////////////////////// state

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }
  @csscope(Csscope.GLOBAL)
  static get globalCss() {
    return style;
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
    <div part="content" class="ce-command-palette-pane" ${bind(this.attrs)}>
      <header part="search">
        <ce-input placeholder="${this.placeholder}" bordered="false" clearable @change="${this.onSearch}" @clear="${this.onClear}" @input="${this.onInput}">
          <ce-icon .svg="${Search}" slot="prepend" class="ce-command-palette-search" size="sm"></ce-icon>
          <span slot="append" class="ce-command-palette-esc">Esc</span>
        </ce-input>
        <slot name="header"></slot>
      </header>
      <main>
        <slot></slot>
      </main>
      <footer >
        <slot name="footer" ></slot>
      </footer>
    </div>
    `;
  }
  //////////////////////////////////// methods
  onSearch(obj: Record<string, any>) {
    this.emit('search', obj)
  }
  onClear() {
    this.emit('clear')
  }
  onInput(obj: Record<string, any>) {
    this.emit('input', obj)
  }
  focus(): void {
    const input = this.renderRoot?.querySelector('ce-input') as HTMLElement;
    input?.focus();
  }
}
