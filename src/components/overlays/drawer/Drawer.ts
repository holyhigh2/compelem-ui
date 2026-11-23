import { classes, CompElem, csscope, Csscope, emits, h, ifTrue, prop, styles, tag, Template, watch } from "compelem";
import { scheduleSettle } from "../../../utils/transition";
import { Close } from "../../../icons/icons";
import { hasIcon, registerIcons } from "../../../icons/registry";
import { ensurePx } from "../../../utils/utils";
import {
  activateLayer, captureFocus, deactivateLayer, isLayerActive,
  popLayer, pushLayer, restoreFocus,
} from "../overlay/layerHost";
import style from "./style.scss?tmpl";

// 关闭按钮走 ce-button 的 icon 通道（字符串名），依赖图标注册表。
// 此处兜底注册，避免宿主未调用 registerIcons 时图标渲染为空。
if (!hasIcon("Close")) registerIcons({ Close });
/**
 * 抽屉面板
 *
 * ## 浮层模型（2026-11-10 改为 div + 统一 layerHost）
 * 原来用 `<dialog>.showModal()`：浏览器把「不在 dialog 子树内」的所有节点判为
 * inert，于是抽屉里的 `ce-overlay` 家族（下拉 / 日期面板 / tooltip）虽然真的
 * 打开并渲染了，却拿不到命中测试和 :hover —— 看得见、点不动。真机探针证明
 * 让容器进 top-layer 或重排 z 序都无效，因为判据是 **DOM 血缘**而非绘制顺序。
 *
 * 现在与 Overlay/Dialog 统一为非模态 `div[popover=manual]`：
 *  - 通过 `layerHost` 的 activate/deactivate 进出 top-layer，不产生 document-blocked；
 *  - open/close/判活/ESC 全部走同一个层栈，接口与 overlay 家族一致；
 *  - 模态感改由 `::backdrop` + `role=dialog` + `aria-modal` + 焦点归还表达，
 *    不再由浏览器按标签强制切分可交互区域；
 *  - 不支持 Popover API 的浏览器降级为 `.ce-drawer-open` + 宿主 z-index。
 *
 * @attrs
 *  visible {boolean} 是否显示
 *  title {string} 标题
 *  round {boolean} 圆角，默认false
 *  backdrop {string} 遮罩背景，可选值 static/initial/none。默认initial
 *  esc {boolean} 按下ESC按键时关闭Modal，默认true
 *  showClose {boolean} 在头部显示关闭按钮，默认true
 *  width {string} 任何合法的css width值，默认280px。仅 left/right 方向生效（主轴厚度）
 *  height {string} 任何合法的css height值，默认100%。仅 top/bottom 方向生效（主轴厚度）；横轴恒撑满视口
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

  /** 本层在栈顶时按 ESC：由 esc 属性决定关闭还是抖动（统一由 layerHost 分发） */
  #onEsc = () => {
    if (this.esc) this.close();
    else this.renderRoot?.classList.add("ce-drawer-shake");
  };

  /**
   * 点击层外：按 backdrop 语义决定关闭还是抖动。
   * 旧版靠 `<dialog>` 的 `::backdrop` 点击派发到 dialog 自身；div[popover] 的
   * ::backdrop 不派发，改由 layerHost 的 outside-click 统一分发到这里。
   *
   * ⚠️ 不要再给 renderRoot 挂 click 兜底：点面板内部空白时 e.target 同样是
   * renderRoot，旧实现会把它误判成「点遮罩」直接关掉抽屉。层内判定统一由
   * layerHost 按 composedPath 是否包含已登记层完成。
   */
  #onOutsideClick = () => {
    if (this.backdrop === "static") this.renderRoot?.classList.add("ce-drawer-shake");
    else if (this.backdrop === "initial") this.close();
  };

  #isHorizontal() {
    return this.placement === "left" || this.placement === "right";
  }
  // 只回写主轴厚度；横轴清空交还给 placement 类（100vh / 100% !important）强制撑满
  #syncThickness() {
    const rs = this.renderRoot;
    if (!rs) return;
    if (this.#isHorizontal()) {
      rs.style.width = ensurePx(this.width);
      rs.style.height = "";
    } else {
      rs.style.width = "";
      rs.style.height = ensurePx(this.height);
    }
  }

  /** 是否真的在屏幕上：top-layer 态优先，降级路径看可见类 */
  #isOpen(): boolean {
    const el = this.renderRoot as HTMLElement | undefined;
    if (!el || !this.isConnected) return false;
    return isLayerActive(el) || el.classList.contains("ce-drawer-open");
  }

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
  /**
   * 头部 / 主体 / 页脚三段由 Drawer 自己渲染，**不再包一层 ce-panel**。
   *
   * 原因：`ce-panel` 只有默认槽与 `title` 槽，`<div slot="header">` 无从投影
   * ⇒ 标题与关闭 X **从不渲染**（实测 X 的 rect 为 0×0）；且 light-DOM 的
   * `main` / `footer` 会被投影进 ce-panel 内部的 body div，
   * `.ce-drawer-wrapper > main { flex: 1 }` 也就失效了（flex 父不是它）。
   *
   * 页脚**无条件**渲染：曾尝试 `ifTrue(!isEmpty(this.slots.footer))` 判空，
   * 但 slots 在首渲染时未必已分配，实测会把已经投影的页脚吞掉（回归）。
   *
   * ⚠️ `popover` 属性刻意不写死在模板里：由 `activateLayer()` 在打开时添加，
   * 这样不支持 Popover API 的浏览器不会因 UA 的 `[popover]{display:none}`
   * 把抽屉藏掉（降级走 `.ce-drawer-open`）。
   */
  render(): Template {
    return h`
      <div
        class="ce-drawer"
        role="dialog"
        tabindex="-1"
        ${classes({
      "ce-drawer-round": this.round,
      "ce-drawer-no-backdrop": this.backdrop == 'none',
      ["ce-drawer-placement-" + this.placement]: true,
    })}
        ${styles(
      this.placement === "left" || this.placement === "right"
        ? { width: ensurePx(this.width) }
        : { height: ensurePx(this.height) }
    )}
        @transitionend.debounce="${this.onTransitionEnd}"
        @animationend="${this.onAnimationEnd}"
      >
        <header class="ce-drawer-head">
          <!--
            标题 = slot[name=title] 的 **fallback**（2026-10-29 改）。
            ifElse 只烤一次，onSlotChange 也不会重跑模板，所以条件判断这条路
            走不通。fallback 是浏览器原生语义：有分配就显示分配的，没有就显示兜底。
          -->
          <slot name="title"><h3 class="ce-drawer-title">${this.title}</h3></slot>
          ${ifTrue(
      this.showClose,
      () => h`<ce-button
              class="ce-drawer-close ce-btn-close"
              appearance="subtle"
              size="md"
              icon="c-svg-close"
              title="关闭"
              @click="${this.onClose}"
            ></ce-button>`
    )}
        </header>
        <main class="ce-drawer-body"><slot @slotchange="${this.onSlotChange}"></slot></main>
        <footer class="ce-drawer-foot"><slot name="footer"></slot></footer>
      </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // 兜底：断开时必须退出层栈，否则 ESC 会派发给一个已销毁的层
    const el = this.renderRoot as HTMLElement | undefined;
    if (el) {
      popLayer(el);
      deactivateLayer(el);
      restoreFocus(el);
    }
  }
  mounted(): void {
    if (this.visible) {
      this.open();
    } else {
      this.close();
    }
  }

  //////////////////////////////////// methods
  /**
   * 打开抽屉（幂等）。
   *
   * ⚠️ 必须幂等：`visible` 是声明式入口（watch → open）、`mounted()` 又会按
   * 初始 `visible` 再 open 一次 —— 两条路都走是**正常用法**。
   * 现在不再有 `showModal()` / `showPopover()` 两套抛错分支，统一由
   * `activateLayer()` 幂等处理。
   */
  open() {
    const el = this.renderRoot as HTMLElement | undefined;
    if (!el) return;
    if (this.#isOpen()) {
      // 已经在屏幕上：只刷新栈序 / 可见类，不重复进出 top-layer
      pushLayer(el, { onEsc: this.#onEsc, onOutsideClick: this.#onOutsideClick });
      el.classList.add("ce-drawer-visible");
      this.transiting = 1;
      return;
    }
    captureFocus(el);
    const inTopLayer = activateLayer(el);
    if (!inTopLayer) el.classList.add("ce-drawer-open");
    // 非模态浮层不再由浏览器推断 aria-modal，组件按 backdrop 明确声明
    el.setAttribute("aria-modal", this.backdrop === "none" ? "false" : "true");
    pushLayer(el, { onEsc: this.#onEsc, onOutsideClick: this.#onOutsideClick });
    if (this.#timer) {
      clearTimeout(this.#timer)
    }
    this.#timer = setTimeout(() => {
      this.transiting = 1;
      el.classList.add("ce-drawer-visible");
      this.#timer = null;
      // 焦点移入抽屉本身；投影内容通过 slot 分发，focus 落在宿主 div 上即可
      try { el.focus({ preventScroll: true }); } catch { /* noop */ }
    }, 0);
  }
  /**
   * 关闭抽屉。
   *
   * ⚠️ 未打开时必须**同步返回**：`mounted()` 对 `visible=false` 的抽屉也会
   * 调一次 `close()` 来对齐状态，而原实现无条件挂一个定时器去 `dialog.close()`，
   * 宿主若在这 300ms 内命令式 `open()` 会被迟到的定时器立刻关掉。
   * 收尾时机按真实过渡时长算，取不到时用 300ms 兜底。
   */
  close() {
    const el = this.renderRoot as HTMLElement | undefined;
    if (!el) return;
    if (!this.#isOpen()) {
      this.transiting = -1;
      this.visible = false;
      return;
    }
    el.classList.remove("ce-drawer-visible");
    this.transiting = -1;
    if (this.#timer) {
      clearTimeout(this.#timer)
    }
    this.#timer = scheduleSettle(el, () => {
      this.visible = false;
      deactivateLayer(el);
      el.classList.remove("ce-drawer-open");
      popLayer(el);
      restoreFocus(el);
      // closed 必须在真正收尾（退出 top-layer、移除 open 类、display:none）之后发。
      // 早先它绑在 @transitionend.debounce 上，比这里早约 50~100ms：调用方若在
      // @closed 里切 placement（示例页「先关再切方向」正是如此），面板仍可见，
      // 换方向会从旧边缘瞬移到新边缘（transform 两端恰好相同、无过渡可依），
      // 表现为闪一下。收尾后再发让「关闭完成」名副其实，所有调用方都受益。
      this.emit("closed");
      this.#timer = null;
    }, 300);
  }
  onClose() {
    this.close();
  }
  onTransitionEnd(e: Event) {
    const rs = this.renderRoot!;
    if (this.transiting > 0) {
      this.emit("opened");
      if (!this.#isHorizontal() && rs.scrollHeight > rs.clientHeight) {
        rs.style.height = 'auto';
      }
    } else {
      // closed 改由 close() 的 scheduleSettle 收尾后发出（见 close 注释），
      // 此处 transitionend 可能早于真正隐藏，不再发事件，只同步厚度。
      this.#syncThickness();
    }
  }
  onAnimationEnd() {
    this.renderRoot?.classList.remove("ce-drawer-shake");
  }
  onSlotChange() {
    const rs = this.renderRoot!;
    if (!this.#isHorizontal() && rs.scrollHeight > rs.clientHeight) {
      rs.style.height = 'auto';
    } else {
      this.#syncThickness();
    }
  }
}
