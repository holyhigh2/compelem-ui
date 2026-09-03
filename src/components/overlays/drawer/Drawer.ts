import { classes, CompElem, csscope, Csscope, emits, h, ifElse, ifTrue, prop, styles, tag, Template, watch } from "compelem";
import { find, isEmpty } from "myfx";
import { Close } from "../../../icons/icons";
import { ensurePx } from "../../../utils/utils";
import style from "./style.scss?tmpl";
const STACK: Drawer[] = [];
/**
 * 抽屉面板
 * @attrs
 *  visible {boolean} 是否显示
 *  title {string} 标题
 *  round {boolean} 圆角，默认false
 *  backdrop {string} 遮罩背景，可选值 static/initial/none。默认initial
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
@emits('opened', 'closed', 'update:visible')
@tag("ce-drawer")
export class Drawer extends CompElem {
  hook_click: any;
  //////////////////////////////////// props
  @prop width = '280px';
  @prop height = '100%';
  @prop placement: string = 'right';
  @prop backdrop: string = "initial"; //static/none
  @prop esc = true;
  @prop round = false;
  @prop showClose = true;
  @prop({ type: String }) title: string;
  @prop({ type: Boolean, model: true }) visible = false;

  //-1:close, 1:open
  transiting = 0;

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  #timer: any;

  /////////////////////////////////// watches
  @watch("visible", { immediate: false })
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
    return h`
      <dialog
        class="ce-drawer"
        ${classes({
      "ce-drawer-round": this.round,
      "ce-drawer-no-backdrop": this.backdrop == 'none',
      ["ce-drawer-placement-" + this.placement]: true,
    })}
        ${styles({
      width: ensurePx(this.width),
      height: ensurePx(this.height)
    })}
        @transitionend.debounce="${this.onTransitionEnd}"
        @animationend="${this.onAnimationEnd}"
      >
        <ce-panel class="ce-drawer-wrapper" shadow="never">
          <div slot="header">
          ${ifElse(isEmpty(this.slots.header), () => h`<div>${this.title}${ifTrue(
      this.showClose,
      () => h`<ce-icon
                      class="ce-drawer-close ce-btn-close"
                      .svg="${Close}"
                      @click="${this.onClose}"
                      style="color:var(--color-gray-400)"
                    ></ce-icon></div>`
    )}`, () => h`<slot name="title"></slot>`)}
            
          </div>
          <main><slot @slotchange="${this.onSlotChange}"></slot></main>
          <footer><slot name="footer"></slot></footer>
        </ce-panel>
      </dialog>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.renderRoot?.addEventListener("click", this.hook_click);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.renderRoot?.removeEventListener("click", this.hook_click);
  }
  mounted(): void {
    if (this.visible) {
      this.open();
    } else {
      this.close();
    }
  }

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
    STACK.unshift(this);
    this.#timer = setTimeout(() => {
      this.transiting = 1;
      dialog.classList.add("ce-drawer-visible");
      this.#timer = null;
    }, 0);
  }
  close() {
    let dialog = <HTMLDialogElement>this.renderRoot;
    if (!dialog) return;
    dialog.classList.remove("ce-drawer-visible");
    this.transiting = -1;
    if (this.#timer) {
      clearTimeout(this.#timer)
    }
    this.#timer = setTimeout(() => {
      this.visible = false;
      dialog.close();
      STACK.unshift(this);
      this.#timer = null;
    }, 300);
  }
  onClick(e: MouseEvent) {
    let t = e.target;
    if (t === this.renderRoot) {
      if (this.backdrop === "static") {
        this.renderRoot.classList.add("ce-drawer-shake");
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
      if (this.renderRoot!.scrollHeight > this.renderRoot!.clientHeight) {
        this.renderRoot!.style.height = 'auto';
      }
    } else {
      this.emit("closed");
      this.renderRoot!.style.height = this.height ?? '';
    }
  }
  onAnimationEnd() {
    this.renderRoot?.classList.remove("ce-drawer-shake");
  }
  onSlotChange() {
    if (this.renderRoot!.scrollHeight > this.renderRoot!.clientHeight) {
      this.renderRoot!.style.height = 'auto';
    } else {
      this.renderRoot!.style.height = this.height ?? '';
    }
  }
}

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  if (STACK.length < 1) return;
  let visibleDialog = find(STACK, (d) => d.visible);
  if (!visibleDialog) return;

  e.preventDefault();
  e.stopPropagation();

  if (visibleDialog.esc) {
    visibleDialog.close();
  } else {
    visibleDialog.renderRoot?.classList.add("ce-drawer-shake");
  }
});