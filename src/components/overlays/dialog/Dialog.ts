import { CompElem, csscope, Csscope, emits, h, ifTrue, prop, tag, Template, watch } from "compelem";
import tooltipStyle from "../tooltip/style.scss?tmpl";
import style from "./style.scss?tmpl";
import { captureFocus, restoreFocus } from "../overlay/layerHost";
import { Close } from "../../../icons/icons";
/**
 * 对话框容器，用于弹出方式打断提醒操作者
 * @attrs
 *  visible {boolean} 是否显示，受控model属性
 *  backdrop {boolean} 遮罩背景，true / false，默认true
 *  esc {boolean} 按下ESC按键时关闭Modal，默认true
 *  width {string} 任何合法的css width值，默认280px
 *  height {string} 任何合法的css height值
 *  contained {boolean} 浮动层是否仅在容器内显示，默认false
 *  showClose {boolean} 是否在面板右上角显示关闭按钮，默认false
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
  @prop showClose = false

  /** 与 ce-drawer 对齐：打开时记下焦点来源，关闭时归还（layerHost 的 WeakMap 配对） */
  private __focusCaptured = false;


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
      // 仅搬默认内容进 surface；slot="trigger" 的触发元素必须留在宿主
      // light DOM 参与原生 slot 分发，否则触发按钮被卷进隐藏的 surface 永远不可见
      const children = Array.from(this.childNodes).filter(
        (c) => !(c.nodeType === Node.ELEMENT_NODE && (c as Element).getAttribute?.("slot") === "trigger")
      );
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
      <ce-overlay .visible="${this.visible}" placement="center" .esc="${this.esc}" .width="${this.width}" .height="${this.height}" .contained="${this.contained}"
      @update:visible="${this.onOverlayUpdate}"
      @beforeopen="${this.onBeforeOpen}" @opened="${this.onOpened}" @closed="${this.onClosed}" .backdrop="${this.backdrop}">
        <div class="ce-dialog-surface" role="dialog" aria-modal="${this.backdrop ? 'true' : 'false'}" tabindex="-1">
          ${ifTrue(this.showClose, () => h`<ce-icon
            class="ce-dialog-close"
            .svg="${Close}"
            @click="${this.onClose}"
          ></ce-icon>`)}
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
  /**
   * overlay 内部状态变化（trigger 点击 / esc / 点击遮罩）回写宿主 visible，
   * 保持双向同步。不可依赖 model 指令：其回调经 prop setter（model prop 只 emit 不落值）会丢失
   */
  onOverlayUpdate(arg: Record<string, any>) {
    this.updateProps({ visible: !!arg?.value });
  }
  open() {
    // ESC / outside-click / 层栈已由 ce-overlay → layerHost 统一分发；
    // 这里只补 ce-drawer 同款的焦点配对。加标记防止 open() 被
    // watchVisible 与命令式 open 重复调用时把「来源」覆盖成浮层自身。
    if (!this.__focusCaptured) {
      captureFocus(this);
      this.__focusCaptured = true;
    }
    // prop setter 对 model prop 只 emit 不落值，须走 updateProps 写入内部值
    // 再 emit update:visible 同步外部受控绑定
    this.updateProps({ visible: true });
    this.emit('update:visible', { value: true });
  }
  close() {
    if (this.__focusCaptured) {
      restoreFocus(this);
      this.__focusCaptured = false;
    }
    this.updateProps({ visible: false });
    this.emit('update:visible', { value: false });
  }
  onClose() {
    this.close();
  }
}
