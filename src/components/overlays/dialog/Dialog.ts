import { CompElem, csscope, Csscope, emits, h, model, prop, tag, Template, watch } from "compelem";
import tooltipStyle from "../tooltip/style.scss?tmpl";
import style from "./style.scss?tmpl";
/**
 * 对话框容器，用于弹出方式打断提醒操作者
 * @props
 *  visible {boolean} 是否显示，受控model属性
 *  backdrop {boolean} 遮罩背景，true / false，默认true
 *  esc {boolean} 按下ESC按键时关闭Modal，默认true
 *  width {string} 任何合法的css width值，默认280px
 *  height {string} 任何合法的css height值
 *  contained {boolean} 浮动层是否仅在容器内显示，默认false
 *
 * @slots
 *  - 弹框内容
 *  trigger 触发点击弹出对话框的元素
 * @events
 *  beforeopen 动画执行前触发
 *  opened 动画执行完成后触发
 *  closed 动画执行完成后触发
 *
 * @author holyhigh2
 */
@emits('beforeopen', 'opened', 'closed', 'update:visible')
@tag("ce-dialog")
export class Dialog extends CompElem {
  //////////////////////////////////// props
  @prop width = '280px';
  @prop({ type: String }) height: string;
  @prop backdrop: boolean = true;
  @prop esc = true;
  @prop({ type: Boolean, model: true }) visible = false;
  @prop contained = false


  @csscope(Csscope.INNER)
  static get css() {
    return [style, tooltipStyle];
  }

  /////////////////////////////////// watches
  @watch("visible", { immediate: true })
  watchVisible(nv: boolean) {
    if (nv) {
      this.open();
    } else {
      this.close();
    }
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  mounted(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    const overlay = sr.querySelector('ce-overlay') as any;
    if (!overlay) return;

    const tryMove = (): boolean => {
      const contentEl = overlay.contentEl?.current;
      if (!contentEl) return false;
      let surface = contentEl.querySelector('.ce-dialog-surface') as HTMLElement;
      if (!surface) {
        surface = overlay.renderRoot?.querySelector('.ce-dialog-surface');
        if (surface) contentEl.appendChild(surface);
      }
      if (!surface) return false;
      const slot = surface.querySelector('slot');
      const hasContent = slot
        ? slot.assignedElements({ flatten: true }).length > 0
        : surface.childNodes.length > 0;
      if (hasContent) return true;
      const children = Array.from(this.childNodes);
      children.forEach(c => surface.appendChild(c));
      return true;
    };

    if (!tryMove()) {
      const tick = () => { if (!tryMove()) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
  }

  render(): Template {
    return h`
      <ce-overlay ${model(this.visible, 'visible')} placement="center" .esc="${this.esc}" .width="${this.width}" .height="${this.height}" .contained="${this.contained}"
      @beforeopen="${this.onBeforeOpen}" @opened="${this.onOpened}" @closed="${this.onClosed}" .backdrop="${this.backdrop}">
        <div class="ce-dialog-surface">
          <slot></slot>
        </div>
        <slot name="trigger" slot="trigger"></slot>
      </ce-overlay>
    `;
  }
  //////////////////////////////////// methods
  onBeforeOpen() {
    this.emit("beforeopen");
  }
  onOpened() {
    this.emit("opened");
  }
  onClosed() {
    this.emit("closed");
  }
  open() {
    this.visible = true;
  }
  close() {
    this.visible = false;
  }
  onClose() {
    this.close();
  }
}
