import { classes, csscope, Csscope, emits, forEach, h, show, tag, Template } from "compelem";
import { assign, cloneDeep, each, identity, join, range, size } from "myfx";
import uii, { getRectInContainer } from 'uiik';
import { ParentPortal, USED_WIDGET_MAP } from "./ParentPortal";
import portalStyle from './portal.scss?tmpl';
import { PortalWidgetEditor } from "./PortalWidgetEditor";
const DRAGGING_MAP: Record<string, any> = {}
const DMK_RESIZE_GHOST = 'resizerGhost'
const DMK_RESIZE_START_COORDI = 'resizerStartCoordi'
const DMK_RESIZE_START_FOUNDATION_CELL = 'resizerStartFoundationCell'
const DMK_RESIZE_END_COORDI = 'resizerEndCoordi'
const DMK_DRAGGING_GHOST = 'draggingGhost'
const DMK_DRAGGING_COORDI = 'draggingCoordi'
const DMK_DRAGGING_END_COORDI = 'draggingEndCoordi'
const USED_COORDI_SET: Set<string> = new Set()
const RESIZE_COORDI_SET: Set<string> = new Set()
const DRAGGING_COORDI_SET: Set<string> = new Set()
const WIDGET_BIND_MAP = new WeakMap<HTMLElement, HTMLElement>()
/**
 * @props
 *  widgets {array} 可用挂件数组 [{title:'xxx',size:'1-2',resizable:true,img:'',configurable:false}]
 *  columns {number} 列数
 *  rowHeight {number} 
 * @events
 *  append({el,widget}) 插入挂件时触发，可在el中插入挂件HTML
 */
@emits('append', 'config')
@tag("ce-portal-editor")
export class PortalEditor extends ParentPortal {

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
      <ce-container style="background: inherit;" class="ce-portal-editor">
        <ce-aside ${classes({ "is-dragging": this.draggingWidget })} style="overflow:auto">
          <ce-accordion gap="5">
            ${forEach(this.widgetGroup, (wRows, k) => k, (wRows, k) => h`
              <ce-accordion-item header="${k + 'x'}" body-style="${'padding-inline:0'}">
                <ce-grid gap="10px">
                ${forEach(range(Math.ceil(wRows.length / 2)), (w, i) => i, (w, i) => h`
                  <ce-row gap="10px">
                    <ce-col>
                      <div class="ce-portal-editor-widget" data-group="${k}" data-title="${wRows[i * 2].title}" data-size="${wRows[i * 2].size.replace('-', ' x ')}" style="background-image:url(${wRows[i * 2]?.img})"></div>
                      <div class="ce-portal-editor-widget-title" data-group="${k}"> ${wRows[i * 2].title}</div>
                    </ce-col>
                    <ce-col>
                      <div class="ce-portal-editor-widget" data-group="${k}" data-title="${wRows[i * 2 + 1] ? wRows[i * 2 + 1].title : ''}" ${show(wRows[i * 2 + 1])} data-size="${wRows[i * 2 + 1]?.size.replace('-', ' x ')}" style="background-image:url(${wRows[i * 2 + 1]?.img})"></div>
                      <div class="ce-portal-editor-widget-title" data-group="${k}">${wRows[i * 2 + 1]?.title}</div>
                    </ce-col>
                  </ce-row>
                `)}
                </ce-grid>
              </ce-accordion-item>
            `)}
          </ce-accordion>
          <slot name="aside"></slot>
        </ce-aside>
        <ce-main @resize.debounce:200="${this.onResize}">
          ${forEach(range(this.foundationRows), identity, (ri) => h`
            <section class="ce-portal-editor-row" >
              ${forEach(range(this.columns), identity, (ci) => h`
                <div class="ce-portal-editor-cell ce-portal-editor-edit" data-col-index="${ci}" data-row-index="${ri}" @mouseenter="${this.onEnterCell}">
                </div>
              `)}
            </section>
          `)}
          <div class="ce-portal-editor-cell-ghost">
          </div>
          <slot></slot>
        </ce-main>
      </ce-container>
    `;
  }

  mounted(): void {
    this.widgetList = []

    this.__bindEdit()
  }

  onEnterCell(e: MouseEvent) {
    if (!this.cellResizing && !this.widgetDragging) return
    let endEl = e.target as HTMLElement
    let col = parseInt(endEl.dataset.colIndex + '')
    let row = parseInt(endEl.dataset.rowIndex + '')

    //check
    let invalid = false

    if (this.cellResizing) {
      let [sRow, sCol] = DRAGGING_MAP[DMK_RESIZE_START_COORDI]

      let startEl = DRAGGING_MAP[DMK_RESIZE_START_FOUNDATION_CELL] as HTMLElement

      let w = endEl.offsetLeft - startEl.offsetLeft + endEl.offsetWidth
      let h = endEl.offsetTop - startEl.offsetTop + endEl.offsetHeight

      DRAGGING_MAP[DMK_RESIZE_GHOST].style.width = w + 'px'
      DRAGGING_MAP[DMK_RESIZE_GHOST].style.height = h + 'px'
      let bindEl = WIDGET_BIND_MAP.get(this.opingWidgetEl)
      if (bindEl) {
        bindEl.style.width = w + 'px'
        bindEl.style.height = h + 'px'
      }

      each(range(sRow, row + 1), r => {
        each(range(sCol, col + 1), c => {
          let coordi = r + ":" + c
          if (RESIZE_COORDI_SET.has(coordi)) return
          if (USED_COORDI_SET.has(coordi)) {
            invalid = true
            return false
          }
        })
        if (invalid) {
          return false
        }
      })
      if (!invalid) {
        DRAGGING_MAP[DMK_RESIZE_END_COORDI] = [row, col]
      }
      DRAGGING_MAP[DMK_RESIZE_GHOST].classList.toggle('invalid', invalid)
    } else if (this.widgetDragging) {
      let dSize = DRAGGING_MAP[DMK_DRAGGING_GHOST].dataset.size?.split(':')!
      let [rowCount, colCount] = [parseInt(dSize[0]), parseInt(dSize[1])]

      each(range(row, row + rowCount), r => {
        each(range(col, col + colCount), c => {
          let coordi = r + ":" + c
          if (DRAGGING_COORDI_SET.has(coordi)) return
          if (USED_COORDI_SET.has(coordi)) {
            invalid = true
            return false
          }
        })
        if (invalid) {
          return false
        }
      })
      if (!invalid) {
        let [availableCol, availableRow] = [this.columns - col - colCount, size(this.renderRoot!.querySelectorAll('.ce-portal-editor-row')) - row - rowCount]
        if (availableCol < 0 || availableRow < 0) {
          invalid = true
        }
      }

      let rect = getRectInContainer(endEl, this.mainEl)
      DRAGGING_MAP[DMK_DRAGGING_GHOST].style.left = rect.x + 'px'
      DRAGGING_MAP[DMK_DRAGGING_GHOST].style.top = rect.y + 'px'
      DRAGGING_MAP[DMK_DRAGGING_GHOST].classList.toggle('invalid', invalid)
      let bindEl = WIDGET_BIND_MAP.get(this.opingWidgetEl)
      if (bindEl) {
        bindEl.style.width = rect.x + 'px'
        bindEl.style.height = rect.y + 'px'
      }
      if (!invalid) {
        DRAGGING_MAP[DMK_DRAGGING_END_COORDI] = [row, col]
      }
    }

  }
  //////////////////////////////////// methods
  __bindEdit() {
    this.__inited = true
    const that = this
    //panel split
    uii.newSplittable(this.renderRoot!, {
      handleSize: 6,
      minSize: 200,
      sticky: [true, false],
    });
    //drag & drop
    let ghostWidget: HTMLElement;
    let __moveInAside = true
    let inited = false
    uii.newDraggable(this.renderRoot!.querySelectorAll('ce-aside .ce-portal-editor-widget'), {
      type: 'stage',
      ghost: true,
      ghostTo: this.renderRoot!.querySelector('ce-aside') as HTMLElement,
      scroll: false,
      cursor: {
        active: 'not-allowed',
        over: 'copy'
      },
      onEnd(t) {
        that.draggingWidget = false
        inited = false
        return false;
      },
      onClone: ({ clone, draggable }, ev) => {
        clone.style.zIndex = '9'
        clone.style.width = (draggable as HTMLElement).offsetWidth + 'px'
        clone.style.left = ev.clientX + 'px'
        clone.style.top = ev.clientY + 'px'
      },
      onStart({ draggable }) {
        //插入
        const shape = that.renderRoot!.querySelector('ce-main .ce-portal-editor-cell-ghost') as HTMLElement;
        ghostWidget = shape
        ghostWidget.dataset.colIndex = draggable.dataset.size?.replace(/.*?x/, '').trim()
        ghostWidget.dataset.rowIndex = draggable.dataset.group
        ghostWidget.dataset.title = draggable.dataset.title
        ghostWidget.textContent = draggable.dataset.title!
        // ghostWidget.style.backgroundImage = window.getComputedStyle(draggable).backgroundImage
        that.draggingWidget = true
      },
      onDrag({ y }) {
        if (__moveInAside) {
          ghostWidget.style.top = y + 'px'
        }
      }
    });
    uii.newDroppable(this.mainEl, {
      accepts: 'stage',
      onEnter(t, ev) {
        if (!inited) {
          //触发事件
          var customEv = new MouseEvent('mousedown', {
            bubbles: true,
            composed: true,
            cancelable: false,
          });
          ghostWidget.dispatchEvent(customEv);
        }

        __moveInAside = false
        inited = true
      },
      onLeave({ draggable, droppable }, ev) {
        let relatedTarget = ev.relatedTarget as Element
        if (!relatedTarget.parentNode || relatedTarget.parentNode instanceof HTMLDocument) {
          return
        }
        ghostWidget.style.left = "0"
        __moveInAside = true
        isAvailable = false
      }
    });

    let dropCoordi: number[] = []
    let widgetSize: number[] = []
    let isAvailable = true
    uii.newDraggable(this.renderRoot!.querySelector('ce-main .ce-portal-editor-cell-ghost') as HTMLElement, {
      type: 'widget',
      scroll: false,
      cursor: {
        over: 'copy'
      },
      onDrag() {
        return false
      },
      onEnd({ draggable }) {
        ghostWidget.style.display = 'none'
        ghostWidget.style.left = '0'
        setTimeout(() => {
          ghostWidget.style.display = 'block'
        }, 200)

        if (isAvailable) {
          that.__appendWidget([dropCoordi[0], dropCoordi[1]], [widgetSize[0], widgetSize[1]], draggable.dataset.title! + ":" + draggable.dataset.rowIndex! + '-' + draggable.dataset.colIndex!, {})
        }

        return false;
      }
    });
    uii.newDroppable(this.renderRoot!.querySelectorAll('ce-main .ce-portal-editor-cell'), {
      accepts: "widget",
      hoverClass: "enter",
      activeClass: "active",
      onEnter({ draggable, droppable }) {
        dropCoordi = [parseInt(droppable.dataset.rowIndex + ''), parseInt(droppable.dataset.colIndex + '')]
        let wCoordi = [parseInt(draggable.dataset.rowIndex + ''), parseInt(draggable.dataset.colIndex + '')]
        let [availableCol, availableRow] = [that.columns - dropCoordi[1], size(that.renderRoot!.querySelectorAll('.ce-portal-editor-row')) - dropCoordi[0]]
        let [wh, ww] = widgetSize = [parseInt(wCoordi[0] + ''), parseInt(wCoordi[1] + '')]

        isAvailable = true
        if (availableCol < ww || availableRow < wh) {
          isAvailable = false
        } else {
          each(range(dropCoordi[0], dropCoordi[0] + widgetSize[0]), r => {
            each(range(dropCoordi[1], dropCoordi[1] + widgetSize[1]), c => {
              if (USED_COORDI_SET.has(r + ":" + c)) {
                isAvailable = false
                return false
              }
            })
            if (!isAvailable) {
              return false
            }
          })
        }
        if (isAvailable) {
          ghostWidget.style.opacity = '1'
        } else {
          ghostWidget.style.opacity = '.1'
        }

        let rect = getRectInContainer(droppable, that.mainEl)
        let w = droppable.offsetWidth * ww + (ww - 1) * that.gap

        ghostWidget.style.width = w - 2 * (ww - 1)/*border */ + "px"
        ghostWidget.style.height = droppable.offsetHeight * wh + (wh - 1) * that.gap - 2 * (wh - 1)/*border */ + "px"
        ghostWidget.style.left = rect.x + w + "px"
        ghostWidget.style.top = rect.y + "px"
      }
    });
  }
  __updateWidgetSize(wrapperEl: PortalWidgetEditor, sRow: number, sCol: number, eRow: number, eCol: number) {
    let size = wrapperEl.dataset.size?.split(':')!
    let [rowCount, colCount] = [parseInt(size[0]), parseInt(size[1])]
    range(sRow, sRow + rowCount).forEach(r => {
      range(sCol, sCol + colCount).forEach(c => {
        USED_COORDI_SET.delete(r + ":" + c)
      })
    })

    wrapperEl.dataset.size = (eRow - sRow + 1) + ':' + (eCol - sCol + 1)
    range(sRow, eRow + 1).forEach(r => {
      range(sCol, eCol + 1).forEach(c => {
        USED_COORDI_SET.add(r + ":" + c)
      })
    })
  }
  __updateWidgetCoordi(wrapperEl: PortalWidgetEditor, eRow: number, eCol: number) {
    let size = wrapperEl.dataset.size?.split(':')!
    let [rowCount, colCount] = [parseInt(size[0]), parseInt(size[1])]
    let coordi = wrapperEl.dataset.coordi?.split(':')!
    let sRow = parseInt(coordi[0])
    let sCol = parseInt(coordi[1])

    range(sRow, sRow + rowCount).forEach(r => {
      range(sCol, sCol + colCount).forEach(c => {
        USED_COORDI_SET.delete(r + ":" + c)
      })
    })

    wrapperEl.dataset.coordi = eRow + ':' + eCol
    range(eRow, eRow + rowCount).forEach(r => {
      range(eCol, eCol + colCount).forEach(c => {
        USED_COORDI_SET.add(r + ":" + c)
      })
    })
  }

  //插入挂件
  __appendWidget(dropCoordi: number[], widgetSize: number[], selectable‌WidgetId: string, widgetProps: Record<string, any>) {
    let wrapperEl = document.createElement('ce-portal-widget-editor') as PortalWidgetEditor
    wrapperEl.classList.add('widget-wrapper')

    let widget = this.selectable‌WidgetsMap[selectable‌WidgetId]

    let startEl = this.__relocateTo(wrapperEl, dropCoordi[0], dropCoordi[1])
    if (!startEl) return false

    let endEl = this.mainEl.querySelector<HTMLElement>(`.foundation-cell[data-col-index="${dropCoordi[1] + widgetSize[1] - 1}"][data-row-index="${dropCoordi[0] + widgetSize[0] - 1}"]`)
    if (!endEl) return false

    let w = endEl.offsetLeft - startEl.offsetLeft + endEl.offsetWidth
    let h = endEl.offsetTop - startEl.offsetTop + endEl.offsetHeight

    wrapperEl.style.height = h + 'px'
    wrapperEl.style.width = w + 'px'
    wrapperEl.resizable = widget.resizable ?? false
    wrapperEl.configurable = widget.configurable ?? false
    wrapperEl.dataset.size = join(widgetSize, ':')
    wrapperEl.dataset.coordi = dropCoordi[0] + ':' + dropCoordi[1]
    wrapperEl.title = widgetProps.title

    widget = assign(cloneDeep(widget), widgetProps)
    USED_WIDGET_MAP.set(wrapperEl, widget)
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
  _onWidgetResizeStart(ghost: any, target: HTMLElement) {
    this.cellResizing = true
    this.opingWidgetEl = target
    DRAGGING_MAP[DMK_RESIZE_GHOST] = ghost
    let coordi = target.dataset.coordi?.split(':')!
    let sRow = parseInt(coordi[0])
    let sCol = parseInt(coordi[1])
    DRAGGING_MAP[DMK_RESIZE_START_COORDI] = [sRow, sCol]
    DRAGGING_MAP[DMK_RESIZE_START_FOUNDATION_CELL] = this.mainEl.querySelector<HTMLElement>(`.foundation-cell[data-col-index="${sCol}"][data-row-index="${sRow}"]`)
    let [rowCount, colCount] = target.dataset.size?.split(':')!

    RESIZE_COORDI_SET.clear()
    range(sRow, sRow + parseInt(rowCount)).forEach(r => {
      range(sCol, sCol + parseInt(colCount)).forEach(c => {
        RESIZE_COORDI_SET.add(r + ":" + c)
      })
    })
  }
  _onWidgetResizeEnd(handle: HTMLElement, cancel: Function, target: PortalWidgetEditor) {
    this.cellResizing = false
    handle.style.pointerEvents = 'auto'

    let invalid = DRAGGING_MAP[DMK_RESIZE_GHOST].classList.contains('invalid')

    if (invalid) cancel()

    let [sRow, sCol] = DRAGGING_MAP[DMK_RESIZE_START_COORDI]
    let [eRow, eCol] = DRAGGING_MAP[DMK_RESIZE_END_COORDI]

    this.__updateWidgetSize(target, sRow, sCol, eRow, eCol)
  }
  _onWidgetConfig(widget: any) {
    this.emit('config', { widgetEl: widget, widget: USED_WIDGET_MAP.get(widget) })
  }
  _onWidgetClose(target: PortalWidgetEditor) {
    //todo 这里可以删除到缓存池
    target.parentElement?.removeChild(target)

    let size = target.dataset.size?.split(':')!
    let [rowCount, colCount] = [parseInt(size[0]), parseInt(size[1])]
    let coordi = target.dataset.coordi?.split(':')!
    let sRow = parseInt(coordi[0])
    let sCol = parseInt(coordi[1])

    range(sRow, sRow + rowCount).forEach(r => {
      range(sCol, sCol + colCount).forEach(c => {
        USED_COORDI_SET.delete(r + ":" + c)
      })
    })
  }
  _onWidgetDragStart(draggable: HTMLElement) {
    this.widgetDragging = true
    this.opingWidgetEl = draggable
    let coordi = draggable.dataset.coordi?.split(':')!
    let sRow = parseInt(coordi[0])
    let sCol = parseInt(coordi[1])
    DRAGGING_MAP[DMK_DRAGGING_COORDI] = [sRow, sCol]
    let rect = getRectInContainer(draggable, this.mainEl)
    DRAGGING_MAP[DMK_DRAGGING_GHOST].style.left = rect.x + 'px'
    DRAGGING_MAP[DMK_DRAGGING_GHOST].style.top = rect.y + 'px'

    DRAGGING_COORDI_SET.clear()
    let [rowCount, colCount] = draggable.dataset.size?.split(':')!
    range(sRow, sRow + parseInt(rowCount)).forEach(r => {
      range(sCol, sCol + parseInt(colCount)).forEach(c => {
        DRAGGING_COORDI_SET.add(r + ":" + c)
      })
    })
  }
  _onWidgetDragClone(clone: Element) {
    DRAGGING_MAP[DMK_DRAGGING_GHOST] = clone
  }
  _onWidgetDragEnd(draggable: PortalWidgetEditor) {
    this.widgetDragging = false
    let invalid = DRAGGING_MAP[DMK_DRAGGING_GHOST].classList.contains('invalid')
    if (!invalid) {
      let [row, col] = DRAGGING_MAP[DMK_DRAGGING_END_COORDI]
      this.__updateWidgetCoordi(draggable, row, col)
      this.__relocateTo(draggable, row, col)
    }
  }
}
