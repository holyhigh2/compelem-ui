
import { CompElem, csscope, Csscope, emits, h, prop, query, state, tag, Template, watch } from "compelem";
import { isEmpty } from "myfx";
import { fixedContainingBlock, Menu } from "../menu/Menu";
/**
 * 右键菜单
 * @attrs
 *  target {string} 目标容器选择器。作用域**先取本组件的根节点**（宿主常把菜单与目标容器放在同一个
 *   shadow root 里，document.querySelector 会找不到），兜底 document。为空时取 parentComponent，
 *  再退到 parentElement
 *  items {array} 字符串数组/{text:,value:,disabled,iconClass}数组，如果数组内容为非对象/字符串则显示为分割条。
 *   **非必填**：典型用法是 `beforeopen` 里 `setItems()` 现算（内容往往依赖打开这一刻的状态），
 *   声明成 required 会让这些用法在初始化时收到 "Prop 'items' is required" 并被跳过赋值
 *  theme {string} light/dark
 * @events
 *  select({item,index,el}) 菜单项选中时触发
 *  hover({item,index,el}) 菜单项悬浮时触发
 *  beforeopen({event}) 打开前触发
 *  close() 关闭后触发
 *
 * @author holyhigh2
 */
@emits('select', 'hover', 'beforeopen', 'close')
@tag('ce-context-menu')
export class ContextMenu extends CompElem {
  #init = false;
  #opened = false;
  /** 绑在 targetEl 上的 contextmenu 监听（mounted 建、beforeDestroyed 摘） */
  #targetAc?: AbortController;
  /** 打开期间才存在的 document 监听（点外面 / Esc / 滚轮）：open 重建、close 摘 */
  #docAc?: AbortController;
  @query('ce-menu')
  menu: Menu
  //////////////////////////////////// props
  @prop theme = "light"
  @prop({ type: String }) target = ''
  @prop({ type: Array }) items: Array<any> = []

  @state itemList: Array<any> = this.items;

  targetEl: HTMLElement | undefined

  @csscope(Csscope.INNER)
  static get css() {
    return []
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <nav class="ce-context-menu">
      <ce-menu @select="${this.onSelect}" @hover="${this.onHover}" .items="${this.items}" theme="${this.theme}" round="true" style="position: fixed;"></ce-menu>
    </nav>
    `;
  }

  /**
   * 原实现是 `updated(changed) { if (changed.itemList) … }`。
   * compelem 0.31 起 `updated()` 只在 `forceUpdate()`（恒传 `{}`）里被调用，
   * 响应式重渲染走 per-point effect、**不再经过它** ⇒ `changed` 永远是空对象
   * ⇒ 外部换 items 后菜单内容不更新（`#init` 已是 true，`open()` 也不会再推一次）。
   *
   * 改为直接 `@watch('itemList')`：`itemList` 是 `@state`，编译器把它编成
   * `rc.__s.itemList.value` 的 signal effect，写入即回调，语义与原意完全一致。
   */
  @watch('itemList')
  onItemListChange(nv: Array<any>) {
    // 未渲染时 menu 还不存在，交给 open() 里的惰性 setItems
    const menu = this.#menuEl();
    if (menu) menu.setItems(nv)
  }

  /** 取内层 `ce-menu`：@query 已拿到的优先，未渲染时返回 null 让调用方早退。 */
  #menuEl(): Menu | null {
    return ((this.menu as Menu | undefined) ||
      (this.renderRoot?.querySelector?.('ce-menu') as Menu | null) ||
      null) as Menu | null;
  }

  //////////////////////////////////// 目标绑定
  /** 解析右键监听的目标容器。 */
  #resolveTarget(): HTMLElement | undefined {
    const sel = (this.target || '').trim();
    if (sel) {
      // 作用域先取本组件所在根节点：宿主把菜单与目标容器放进同一个 shadow root 时，
      // document.querySelector 找不到目标容器（它不在 light DOM 里）
      const root = this.getRootNode?.() as Document | ShadowRoot | undefined;
      const scoped =
        root && typeof (root as any).querySelector === 'function'
          ? ((root as any).querySelector(sel) as HTMLElement | null)
          : null;
      return scoped || (document.querySelector(sel) as HTMLElement | null) || undefined;
    }
    return ((this.parentComponent as unknown as HTMLElement) || this.parentElement) ?? undefined;
  }

  mounted(): void {
    this.targetEl = this.#resolveTarget();
    if (!this.targetEl) {
      console.warn(
        `[ce-context-menu] target 未解析到元素（target="${this.target}"），右键菜单不会响应`
      );
      return;
    }
    this.#targetAc = new AbortController();
    this.targetEl.addEventListener('contextmenu', this.#onTargetContextMenu, {
      signal: this.#targetAc.signal,
    });
  }

  beforeDestroyed(): void {
    this.#targetAc?.abort();
    this.#targetAc = undefined;
    this.#unbindDoc();
  }

  #onTargetContextMenu = (e: MouseEvent): void => this.onContextMenu(e);

  //////////////////////////////////// methods
  onSelect(obj: Record<string, any>) {
    this.close()
    this.emit('select', obj)
  }
  onHover(obj: Record<string, any>) {
    this.emit('hover', obj)
  }

  /**
   * 点外面关闭。
   *
   * 不能靠 `e.target.tagName` 判断"点在菜单内/外"：本组件（及宿主应用）都活在
   * shadow DOM 里，事件冒泡到监听所在的 document 时 target 已被**重定向**为
   * 最外层宿主（实测 = `RB-WORKBENCH`），永远不等于 `CE-CONTEXT-MENU` ⇒ 点在菜单
   * 项上的 mousedown 也会 close()，元素被移到 -9999px，随后的 click 落空 ⇒
   * 菜单项「点了没反应」。用 composedPath 穿透 shadow 边界做归属判断。
   */
  #onDocMouseDown = (e: MouseEvent): void => {
    const path: EventTarget[] = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const inside = path.includes(this) || (!!this.renderRoot && path.includes(this.renderRoot));
    if (inside) return;
    this.close()
  }

  #onDocKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close()
  }

  /** 滚轮一动菜单就停在原地错位：直接关掉比追着改坐标简单 */
  #onDocWheel = (): void => this.close()

  /**
   * 菜单打开期间才挂 document 监听，关掉即摘（AbortController 一次性全摘）。
   *
   * 原实现把 `document.body` 的 mousedown 监听存在 `_bodyClick` 里、每次 `open()` 都
   * `bind` 一个新函数覆写它 —— 旧引用就此丢失，连续打开 N 次会累积 N 个监听（只有
   * 最后一个能被移除）。Esc 与滚轮则完全没有处理。
   */
  #bindDoc(): void {
    this.#unbindDoc();
    const ac = new AbortController();
    this.#docAc = ac;
    const opt = { signal: ac.signal, capture: true };
    document.addEventListener('mousedown', this.#onDocMouseDown as EventListener, opt);
    document.addEventListener('keydown', this.#onDocKeyDown as EventListener, opt);
    document.addEventListener('wheel', this.#onDocWheel as EventListener, { signal: ac.signal, capture: true, passive: true });
  }

  #unbindDoc(): void {
    this.#docAc?.abort();
    this.#docAc = undefined;
  }

  onContextMenu(e: MouseEvent) {
    if (!(e instanceof MouseEvent)) return;
    let t = e.target as Node;
    let target = this.targetEl
    // contains 不含自身：直接右键目标容器空白处时 t === target，旧写法会漏掉
    if (!target || (t !== target && !target.contains(t))) {
      return;
    }

    let toOpen = true;
    this.emit("beforeopen", {
      cancel: () => {
        toOpen = false;
      }
    }, e);
    if (toOpen)
      this.open(e)
  }

  setItems(items: any[]) {
    this.itemList = items;
    this.#init = false;
  }
  isOpen(): boolean {
    return this.#opened;
  }
  open(e: MouseEvent) {
    e.preventDefault();
    if (isEmpty(this.itemList)) return
    const list = this.#menuEl()
    // 未渲染（还没 renderRoot / 还没 upgrade）时不做任何事。
    if (!list) return
    //渲染菜单
    if (!this.#init) {
      list.setItems(this.itemList as any);
      this.#init = true;
    }

    //显示菜单
    const { clientX, clientY } = e;

    let ml = 0, mt = 0;

    // 坐标换算：若祖先里有复合层（transform/filter/…），它就是 `fixed` 菜单的包含块，
    // 此时 left/top 需相对它解析（菜单在 `Menu.open()` 里也按同一包含块做靠边钳制）。
    // 复用 `fixedContainingBlock`（读 computed style + 穿越 shadow 边界）与
    // `Menu.open()` 保持同口径；旧的 `isCompoundLayer` 只读内联样式、且
    // `parentNode` 上溯会被 slot 边界截断，会漏判（详见 Menu.ts 该函数注释）。
    const con = fixedContainingBlock(this as unknown as HTMLElement);
    if (con) {
      const rect = con.getBoundingClientRect();
      ml = rect.left;
      mt = rect.top;
    }

    list.open(clientX - ml, clientY - mt)
    this.#opened = true;

    this.#bindDoc()
  }
  close() {
    this.#unbindDoc()
    // 未渲染过就 close（宿主在挂载前主动关一次）时内层菜单还不存在
    this.#menuEl()?.close?.()
    if (!this.#opened) return
    this.#opened = false;
    this.emit("close", {});
  }
}

