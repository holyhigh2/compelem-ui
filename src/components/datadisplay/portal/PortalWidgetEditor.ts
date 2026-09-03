import { classes, CompElem, csscope, Csscope, emits, h, ifTrue, prop, query, show, tag, Template, watch } from "compelem";
import { closest } from "myfx";
import uii from 'uiik';
import { AppearanceElem } from "../../../base/Appearance";
import { DragVertical } from "../../../icons/icons";
import { PortalEditor } from "./PortalEditor";
import widgetStyle from './portalWidget.scss?tmpl';

/**
 * 门户挂件
 * @props
 *  resizable {boolean}
 *  configurable {boolean}
 * @events
 *  resizestart({handle, ghost})
 *  resizeend({handle, ghost})
 *  close()
 *  dragstart({draggable})
 *  dragclone({clone})
 *  dragend({draggable})
 *  config()
 * @methods
 *  getContent()
 */
@emits('close', 'config')
@tag("ce-portal-widget-editor")
export class PortalWidgetEditor extends AppearanceElem {

  @prop resizable = false
  @prop configurable = false

  @query('.ce-portal-editor-resize')
  handleEl: HTMLElement
  @query('.ce-portal-editor-content')
  contentEl: HTMLElement

  shadow = 'md'

  __inited = false

  @csscope(Csscope.INNER)
  static get css() {
    return [widgetStyle]
  }

  get cssVars() {
    return {
      '--portal-widget-resizable': this.resizable ? 'both' : 'none'
    }
  }

  @watch('editable')
  watchEditable(nv: boolean) {
    if (nv && !this.__inited) {
      this.nextTick(() => {
        this.__bindEdit()
      })
    }
  }

  render(): Template {
    return h`
      <div class="ce-portal-editor-widget" ${classes({
      "is-resizable": this.resizable
    })}>
        <div class="ce-portal-editor-content is-editable"></div>
          ${ifTrue(this.resizable, () => h`<div class="ce-portal-editor-resize uii-resizable-handle-se"></div>`)}
          <ce-icon .svg="${DragVertical}" size="md" class="uii-draggable-handle"></ce-icon>
          <ce-button class="ce-portal-editor-close" size="sm" color="#666" appearance="pale" shadowed icon="c-svg-times" @click="${this.onClose}"></ce-button>
          <ce-button ${show(this.configurable)} class="ce-portal-editor-config" size="sm" color="#666" appearance="pale" shadowed icon="c-svg-gear" @click="${this.onConfig}"></ce-button>
      </div>
    `;
  }
  resizableInited = false
  portal: PortalEditor
  mounted(): void {
    this.__bindEdit()
    this.portal = closest(this, n => n instanceof PortalEditor, 'parentComponent')!
  }
  //////////////////////////////////// methods
  __bindEdit() {
    this.__inited = true
    const that = this
    uii.newDraggable(this.renderRoot!, {
      handle: this.renderRoot!.querySelector('.uii-draggable-handle') as HTMLElement,
      ghost: (panel: HTMLElement | SVGGraphicsElement) => {
        let rs = that as HTMLElement
        rs = rs.cloneNode() as HTMLElement
        rs.style.left = (panel as HTMLElement).style.left
        rs.style.top = (panel as HTMLElement).style.top
        return rs
      },
      ghostTo: this.parentElement!,
      onStart({ draggable }) {
        that.emit('dragstart', { draggable: that })
        that.toggleAttribute('shadowed', true)
        if (that.portal) {
          that.portal._onWidgetDragStart(that)
        }
      },
      onClone({ clone }) {
        that.emit('dragclone', { clone })
        if (that.portal) {
          that.portal._onWidgetDragClone(clone)
        }
      },
      onDrag() {
        return false
      },
      onEnd({ draggable }) {
        that.emit('dragend', { draggable: that })
        if (that.portal) {
          that.portal._onWidgetDragEnd(that)
        }
        that.toggleAttribute('shadowed', false)
        return false
      }
    })

    if (this.resizable) {
      uii.newResizable(this, {
        handle: this.handleEl,
        ghost: (panel: HTMLElement | SVGGraphicsElement) => {
          let rs = (panel as CompElem).renderRoot!.querySelector('.ce-portal-editor-content') as HTMLElement
          rs = rs.cloneNode() as HTMLElement
          rs.style.left = (panel as CompElem).style.left
          rs.style.top = (panel as CompElem).style.top
          return rs
        },
        onStart({ handle, ghost }, ev) {
          handle.style.pointerEvents = 'none'
          that.emit('resizestart', { handle, ghost })
          if (that.portal) {
            that.portal._onWidgetResizeStart(ghost, that)
          }
          that.toggleAttribute('shadowed', true)
        },
        onResize() {
          return false
        },
        onEnd({ handle, ghost }) {
          handle.style.pointerEvents = 'auto'
          let doDefault = true
          let obj = { handle, ghost, cancel() { doDefault = false } }
          that.emit('resizeend', obj)
          if (that.portal) {
            that.portal._onWidgetResizeEnd(handle as any, obj.cancel, that)
          }
          that.toggleAttribute('shadowed', false)
          return doDefault
        }
      })
    }
  }

  getContent() {
    return this.contentEl
  }
  onClose() {
    this.emit('close')
    if (this.portal) {
      this.portal._onWidgetClose(this)
    }
  }
  onConfig() {
    this.emit('config')
    if (this.portal) {
      this.portal._onWidgetConfig(this)
    }
  }
}
