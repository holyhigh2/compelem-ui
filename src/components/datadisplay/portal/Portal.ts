import { classes, csscope, Csscope, emits, forEach, h, prop, tag, Template } from "compelem";
import { assign, cloneDeep, identity, join, range } from "myfx";
import { ParentPortal, USED_WIDGET_MAP } from "./ParentPortal";
import portalStyle from './portal.scss?tmpl';
import { PortalWidget } from "./PortalWidget";
const USED_COORDI_SET: Set<string> = new Set()
const WIDGET_BIND_MAP = new WeakMap<HTMLElement, HTMLElement>()
/**
 * @props
 *  widgets {array} 可用挂件数组 [{title:'xxx',size:'1-2',resizable:true,img:''}]
 *  columns {number} 列数
 *  rowHeight {number} 行高
 *  gap {number} 单元格间距
 *  overflow {string} 单元格溢出处理方式 visible/hidden
 * @events
 *  append({el,widget}) 插入挂件时触发，可在el中插入挂件HTML
 */
@emits('append')
@tag("ce-portal")
export class Portal extends ParentPortal {

  @prop overflow: string = 'visible'

  @csscope(Csscope.INNER)
  static get css() {
    return [portalStyle]
  }

  get cssVars() {
    return {
      '--protal-gap': this.gap ? this.gap + 'px' : 'var(--ce-spacing-md)'
    }
  }


  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
      <ce-container style="background: inherit;" ${classes({
      "is-overflowed": this.overflow
    })}>
        <ce-main @resize.debounce:200="${this.onResize}">
          ${forEach(range(this.foundationRows), identity, (ri) => h`
            <section class="ce-portal-editor-row">
              ${forEach(range(this.columns), identity, (ci) => h`
                <div class="ce-portal-editor-cell" data-col-index="${ci}" data-row-index="${ri}" >
                </div>
              `)}
            </section>
          `)}
          <div class="ce-portal-editor-cell-ghost">
          </div>
        </ce-main>
      </ce-container>
    `;
  }

  mounted(): void {
    this.widgetList = []
  }

  //////////////////////////////////// methods
  //插入挂件
  __appendWidget(dropCoordi: number[], widgetSize: number[], selectable‌WidgetTag: string, widgetProps: Record<string, any>) {
    let wrapperEl = document.createElement('ce-portal-widget') as PortalWidget
    wrapperEl.classList.add('widget-wrapper')

    let widget = this.selectable‌WidgetsMap[selectable‌WidgetTag]
    USED_WIDGET_MAP.set(wrapperEl, widget)

    let startEl = this.__relocateTo(wrapperEl, dropCoordi[0], dropCoordi[1])
    if (!startEl) return false

    let colGaps = widgetSize[1] - 1
    let rowGaps = widgetSize[0] - 1
    let cols = widgetSize[1]
    let rows = widgetSize[0]
    let w = colGaps * this.gap + cols * startEl.offsetWidth - 2 * colGaps/*border */
    let h = rowGaps * this.gap + rows * startEl.offsetHeight - 2 * rowGaps/*border */

    wrapperEl.style.height = h + 'px'
    wrapperEl.style.width = w + 'px'
    wrapperEl.dataset.size = join(widgetSize, ':')
    wrapperEl.dataset.coordi = dropCoordi[0] + ':' + dropCoordi[1]
    wrapperEl.title = widget.title

    widget = assign(cloneDeep(widget), widgetProps)
    setTimeout(() => {
      this.emit('append', {
        el: wrapperEl.getContent(), widget, bind(el: HTMLElement) {
          WIDGET_BIND_MAP.set(wrapperEl, el)
        }
      })
    }, 100);
    this.mainEl.appendChild(wrapperEl)

    this.widgetList.push({ colIndex: dropCoordi[1], rowIndex: dropCoordi[0], widget })

    range(dropCoordi[0], dropCoordi[0] + widgetSize[0]).forEach(r => {
      range(dropCoordi[1], dropCoordi[1] + widgetSize[1]).forEach(c => {
        USED_COORDI_SET.add(r + ":" + c)
      })
    })
  }
}
