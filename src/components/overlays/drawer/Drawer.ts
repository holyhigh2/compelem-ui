import { classes, CompElem, html, ifElse, ifTrue, prop, styles, tag, Template, watch } from "compelem";
import { find, isEmpty } from "myfx";
import { Close } from "../../../icons/icons";
import style from "./style.scss";
/**
 * 抽屉面板
 * @attrs
 *  visible {boolean} 是否显示
 *  title {string} 标题
 *  round {boolean} 圆角，默认false
 *  backdrop {string} 遮罩背景，可选值 static/initial/none。默认initial
 *  appendToBody {boolean} 以body为容器，默认true。false时使用Modal父元素为容器
 *  esc {boolean} 按下ESC按键时关闭Modal，默认true
 *  showClose {boolean} 在头部显示关闭按钮，默认true
 *  width {string} 任何合法的css width值，默认280px
 *  placement {string} 显示位置 top/right/bottom/left，默认right
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
@tag("l-drawer")
export class Drawer extends CompElem {
  static stack: Drawer[] = [];
  static {
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (Drawer.stack.length < 1) return;
      let visibleDialog = find(Drawer.stack, (d) => d.visible);
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
  @prop placement: string = 'right';
  @prop backdrop: string = "initial"; //static/none
  @prop esc = true;
  @prop round = false;
  @prop appendToBody = true; //在body上时，使用fixed定位
  @prop showClose = true;
  @prop({ type: String }) title: string;
  @prop({ type: Boolean, sync: true }) visible = false;

  //-1:close, 1:open
  transiting = 0;

  static get styles(): string[] {
    return [style];
  }

  #timer: any;

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
        class="c-drawer ${classes({
      __round: this.round,
      '__no-backdrop': this.backdrop == 'none',
      ["placement-" + this.placement]: true,
    })}"
        style="${styles({
      width: this.width,
      height: this.height
    })}"
        @transitionend.debounce="${this.onTransitionEnd}"
        @animationend="${this.onAnimationEnd}"
      >
        <l-panel class="--wrapper" shadow="never">
          <div slot="header">
          ${ifElse(isEmpty(this.slots.header), () => html`<div xxx>${this.title}${ifTrue(
      this.showClose,
      () => html`<l-icon
                      class="--close c-btn-close"
                      .svg="${Close}"
                      @click="${this.onClose}"
                      style="color:var(--color-gray-400)"
                    ></l-icon></div>`
    )}`, () => html`<slot name="title"></slot>`)}
            
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
    if (this.#timer) {
      clearTimeout(this.#timer)
    }
    Drawer.stack.unshift(this);
    this.#timer = setTimeout(() => {
      this.transiting = 1;
      dialog.classList.add("__visible");
      this.#timer = null;
    }, 0);
  }
  close() {
    let dialog = <HTMLDialogElement>this.renderRoot;
    dialog.classList.remove("__visible");
    this.transiting = -1;
    if (this.#timer) {
      clearTimeout(this.#timer)
    }
    this.#timer = setTimeout(() => {
      this.visible = false;
      dialog.close();
      Drawer.stack.unshift(this);
      this.#timer = null;
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
