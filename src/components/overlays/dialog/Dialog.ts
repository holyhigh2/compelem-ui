import { classes, CompElem, html, ifTrue, prop, styles, tag, Template, watch } from "compelem";
import { find } from "myfx";
import { Close } from "../../../icons/icons";
import tooltipStyle from "../tooltip/style.scss";
import style from "./style.scss";
/**
 * 对话框
 * @attrs
 *  visible {boolean} 是否显示
 *  title {string} 标题
 *  backdrop {string} 遮罩背景，可选值 static/initial/none。默认initial
 *  appendToBody {boolean} 以body为容器，默认true。false时使用Modal父元素为容器
 *  esc {boolean} 按下ESC按键时关闭Modal，默认true
 *  showClose {boolean} 在头部显示关闭按钮，默认true
 *  width {string} 任何合法的css width值，默认280px
 *  height {string} 任何合法的css height值
 *
 * @slots
 *  default 弹框内容
 *  title 标题
 *  footer 底部内容
 * @events
 *  opened 动画执行完成后触发
 *  closed 动画执行完成后触发
 *
 * @author holyhigh2
 */
@tag("l-dialog")
export class Dialog extends CompElem {
  static stack: Dialog[] = [];
  static {
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (Dialog.stack.length < 1) return;
      let visibleDialog = find(Dialog.stack, (d) => d.visible);
      if (!visibleDialog) return;

      e.preventDefault();
      e.stopPropagation();

      if (visibleDialog.esc) {
        visibleDialog.close();
      } else {
        visibleDialog.renderRoot.classList.add("__shake");
      }
    });
  }
  hook_click: any;
  //////////////////////////////////// props
  @prop width = '280px';
  @prop({ type: String }) height: string;
  @prop backdrop: string = "initial"; //static/none
  @prop esc = true;
  @prop appendToBody = true; //在body上时，使用fixed定位
  @prop showClose = true;
  @prop({ type: String }) title: string;
  @prop({ type: Boolean, sync: true }) visible = false;

  //-1:close, 1:open
  transiting = 0;

  static get styles(): string[] {
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

    this.hook_click = this.onClick.bind(this);
  }

  render(): Template {
    return html`
      <dialog
        class="c-dialog ${classes({
      '__no-backdrop': this.backdrop == 'none'
    })}"
        style="${styles({
      width: this.width,
      'max-height': this.height
    })}"
        @transitionend.debounce="${this.onTransitionEnd}"
        @animationend="${this.onAnimationEnd}"
      >
        <l-panel class="--wrapper" shadow="never">
          <div slot="header">
            ${this.title} <slot name="title"></slot>
            ${ifTrue(
      this.showClose,
      () => html`<l-icon
                        class="--close"
                        .svg="${Close}"
                        @click="${this.onClose}"
                        style="color:var(--color-gray-400)"
                      ></l-icon>`
    )}
          </div>
          <main><slot @slotchange="${this.onSlotChange}"></slot></main>
          <footer><slot name="footer"></slot></footer>
        </l-panel>
      </dialog>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.renderRoot.addEventListener("click", this.hook_click);
  }

  disconnectedCallback() { }
  //////////////////////////////////// methods
  open() {
    let dialog = <HTMLDialogElement>this.renderRoot;
    if (this.backdrop === "none") {
      dialog.show();
    } else {
      dialog.showModal();
    }
    Dialog.stack.unshift(this);
    setTimeout(() => {
      this.transiting = 1;
      dialog.classList.add("__visible");
    }, 0);
  }
  close() {
    let dialog = <HTMLDialogElement>this.renderRoot;
    dialog.classList.remove("__visible");
    this.transiting = -1;
    setTimeout(() => {
      this.visible = false;
      dialog.close();
      Dialog.stack.unshift(this);
    }, 300);
  }
  onClick(e: MouseEvent) {
    let t = e.target;
    if (t === this.renderRoot) {
      if (this.backdrop === "static") {
        this.renderRoot.classList.add("__shake");
      } else if (this.backdrop === "initial") {
        this.close();
      }
    }
  }
  onClose() {
    this.close();
  }
  onTransitionEnd(e: Event) {
    if (this.transiting > 0) {
      this.emit("opened");
      if (this.renderRoot.scrollHeight > this.renderRoot.clientHeight) {
        this.renderRoot.style.height = 'auto';
      }
    } else {
      this.emit("closed");
      this.renderRoot.style.height = '';
    }
  }
  onAnimationEnd() {
    this.renderRoot.classList.remove("__shake");
  }
  onSlotChange() {
    if (this.renderRoot.scrollHeight > this.renderRoot.clientHeight) {
      this.renderRoot.style.height = 'auto';
    } else {
      this.renderRoot.style.height = '';
    }
  }
}
