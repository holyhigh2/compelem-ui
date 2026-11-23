import { bind, classes, CompElem, csscope, Csscope, emits, forEach, h, html, prop, state, styles, tag, Template, watch } from "compelem";
import { capitalize, concat, each, filter, get, isArray, isFunction, isNil, isObject, join, map, split, trim } from "myfx";
import { getBox } from "uiik";
import { measureRowColumn, RowColumnFlags, rowColumnVars } from "../../../base/RowColumns";
import { Check } from "../../../icons/icons";
import style from "./style.scss?tmpl";

const enum CheckMode {
  RADIO = "radio",
  CHECKBOX = "checkbox",
}
const EDGE = 20;

/** 把 item.extra 归一化为可渲染内容：string=HTML 片段，Element=渲染后命令式挂载 */
function resolveExtra(v: any, item: any): { html: string; el: HTMLElement | null } {
  let raw = v.extra;
  if (isFunction(raw)) raw = raw(item);
  if (isNil(raw)) return { html: "", el: null };
  if (typeof raw === "string") return { html: raw, el: null };
  if (raw && raw.nodeType === 1) return { html: "", el: raw as HTMLElement };
  return { html: raw + "", el: null };
}

/** 快捷键文本：数组按 "Ctrl + Shift + N" 拼接，字符串原样使用 */
function hotKeyText(it: any): string {
  if (isArray(it.hotKey)) {
    return join(map(it.hotKey, (k: string) => capitalize(k)), " + ");
  }
  return isNil(it.hotKey) ? "" : it.hotKey + "";
}

/**
 * 判断某祖先是否是 `fixed` 后代的**包含块**（复合层）。
 *
 * 依据 CSS 规范：`transform` / `perspective` / `filter` / `backdrop-filter` 非 `none`，
 * 或 `will-change` 命中上述属性、`contain` 含 paint/layout/strict/content 时，
 * 该元素的 **padding box** 即成为其后代（含 `position: fixed`）的包含块。
 *
 * ⚠️ 必须读 `getComputedStyle` 而不是 `node.style`（内联）：对话框/浮层的
 * transform 来自 class 规则（如 `.ce-overlay-visible .ce-overlay-content
 * { transform: scale(1) !important }`），只查内联会漏判。
 */
function createsFixedCb(node: HTMLElement): boolean {
  const cs = window.getComputedStyle(node);
  if (cs.transform && cs.transform !== "none") return true;
  if (cs.perspective && cs.perspective !== "none") return true;
  if (cs.filter && cs.filter !== "none") return true;
  if (cs.backdropFilter && cs.backdropFilter !== "none") return true;
  if (cs.willChange && /transform|perspective|filter/.test(cs.willChange)) return true;
  if (/paint|layout|strict|content/.test(cs.getPropertyValue("contain") || "")) return true;
  return false;
}

/**
 * 找 `fixed` 定位元素的包含块（最近的复合层祖先），**穿越 shadow 边界**
 * （`parentNode` 命中 ShadowRoot 时取 `host` 继续上溯）。
 *
 * @returns 该祖先元素；`null` ⇒ 包含块就是初始包含块（视口）。
 *
 * 用途：`Menu.open()` 的靠边钳制与 `ContextMenu.open()` 的坐标换算都基于它，
 * 两者口径必须一致，否则菜单既可能偏出、又可能被包含块的可用宽度压窄。
 */
export function fixedContainingBlock(el: HTMLElement): HTMLElement | null {
  let node: Node | null = el.parentNode;
  while (node) {
    if (node instanceof ShadowRoot) {
      node = node.host;
      continue;
    }
    if (node instanceof HTMLElement && createsFixedCb(node)) return node;
    node = node.parentNode;
  }
  return null;
}

/**
 * 子菜单落位：右侧优先，右侧放不下且左侧放得下才翻到左侧；两侧都放不下时取空间
 * 大的一侧（宁可溢出视口，也不能压在父菜单上 —— 盖住父行等于把入口吃掉）。
 *
 * 边界是**视口**，不是 fixed 包含块：子层绝对定位、相对 `:host` 解析，既不受包含块
 * 约束，也不会被（除 `overflow:hidden` 以外的）祖先裁掉。inline 菜单的包含块恰好
 * 等于它自身宽度（`.ce-overlay-content` 带 transform 且被收缩到菜单宽），拿它判越界
 * 会恒判「右侧放不下」，子菜单于是必然反折、盖住父菜单。
 *
 * @param hostLeft    宿主左缘（视口坐标）
 * @param hostTop     宿主上缘（视口坐标）
 * @param anchorRight 子菜单贴右时自身的左缘（宿主坐标）
 * @param preferredTop 子菜单相对宿主的纵向偏移（贴父行）
 * @param subSize     子菜单自然尺寸
 * @param viewport    视口尺寸
 */
export function resolveSubPos(
  hostLeft: number,
  hostTop: number,
  anchorRight: number,
  preferredTop: number,
  subSize: { width: number; height: number },
  viewport: { width: number; height: number }
): { left: number; top: number } {
  const edgeRight = hostLeft + anchorRight;
  const spaceRight = viewport.width - edgeRight - EDGE;
  const spaceLeft = hostLeft - EDGE;
  let left: number;
  if (subSize.width <= spaceRight) left = anchorRight;
  else if (subSize.width <= spaceLeft) left = -subSize.width;
  else left = spaceRight >= spaceLeft ? anchorRight : -subSize.width;
  let top = preferredTop;
  const maxTop = viewport.height - hostTop - subSize.height - EDGE;
  if (top > maxTop) top = maxTop;
  if (hostTop + top < EDGE) top = EDGE - hostTop;
  return { left, top };
}

/** 层元信息：列存在性由层决定（定义与列宽换算见 base/RowColumns） */
type LevelMeta = RowColumnFlags;
/**
 * 扁平化层级条目：一个菜单层（root 或某个已展开的 sub）。
 * 子菜单不再是 li 的后代，而是 `.ce-menu` 的直属子层 —— 行模板因此只需一份。
 */
interface LevelEntry {
  /** 路径键：root 为 ""，sub 为 "0-1-2"（与 li 的 data-path 同构） */
  key: string;
  /** 路径索引数组 */
  path: Array<number>;
  list: Array<any>;
  level: number;
  isRoot: boolean;
}
/**
 * 取某一层（`path` 指定）的 items。
 *
 * ⚠️ 供 `renderItem` 就地重算该层列表用 —— 不能依赖外层 forEach 的 `e.list`：
 * `renderItem` 的方法体会被编译器**内联进 forEach 子模板**，实测内联后子点工厂里
 * 捕获到的 `e` 是空壳（`e.list` 为 undefined），导致分割条判据 `isNil(list[i-1])`
 * 恒真、每行都被画上 is-divider。走模块函数 + 组件态 `this.itemList` 才稳定。
 */
function levelList(root: any, path: Array<number>): Array<any> {
  let list: Array<any> = root ?? [];
  for (let i = 0; i < path.length; i++) {
    const it = list[path[i]];
    if (!isObject(it) || !isArray((it as any).children)) return [];
    list = (it as any).children;
  }
  return list;
}

function measureLevel(list: any[]): LevelMeta {
  const m: LevelMeta = {
    hasCheck: false,
    hasIcon: false,
    hasShortcut: false,
    hasSub: false,
    hasExtra: false,
    maxHotKey: 0,
  };
  each(list, (raw: any) => {
    if (!isObject(raw)) return;
    const it: any = raw;
    if (it.checkMode === CheckMode.RADIO || it.checkMode === CheckMode.CHECKBOX) {
      m.hasCheck = true;
    }
    if (it.icon || it.iconClass || it.iconSvg) m.hasIcon = true;
    if (it.extra) m.hasExtra = true;
    if (isArray(it.children)) m.hasSub = true;
    const hk = hotKeyText(it);
    if (hk) {
      m.hasShortcut = true;
      if (hk.length > m.maxHotKey) m.maxHotKey = hk.length;
    }
  });
  return m;
}

/**
 * 菜单项。数组里的 `null` 表示分割条。
 *
 * 下列字段之外的成员按下标透传（如表格右键菜单的 `cellNeed` / `insert` / `id`），
 * 由宿主自行解释。
 */
export interface MenuItem {
  /** 标签：字符串按 HTML 片段渲染；函数返回同样内容 */
  text?: string | Function
  /** 双行项的第二行，纯文本 */
  description?: string | Function
  disabled?: boolean
  icon?: string
  iconClass?: string
  iconSvg?: string | (() => Template)
  hotKey?: string[]
  children?: MenuEntry[]
  /** 与 children 共存时整行可点击，子菜单只由右侧箭头悬浮展开 */
  separate?: boolean
  /** 自定义项：不响应点击 */
  custom?: boolean
  /** 分组标题行，不可交互 */
  section?: string
  checkMode?: 'radio' | 'checkbox'
  checked?: boolean
  checkGroup?: string
  /** 行尾定制区：字符串按 HTML 片段渲染，Element 在渲染后被挂进 `.ce-menu__extra` */
  extra?: string | Function | Element
  [key: string]: any
}

/** 菜单项或分割条 */
export type MenuEntry = MenuItem | null

/**
 * 菜单面板。可用于 nav 下拉、dropdown 下拉与右键菜单。
 *
 * 与 ce-menu-pane 的差异（本组件存在的理由）：
 * 1. **整层统一网格**：列的存废由层级元信息决定（`measureLevel`），单元格内容
 *    的显隐用 `visibility` 而非 `show()` —— `show()` 是 display 快捷指令，
 *    grid 中 display:none 的子项不占位，后续单元格会前移串列。
 * 2. **箭头只画给有子菜单的项**：判据是项级 `hasSub`，不是列表级"该层是否有子项"。
 * 3. **类名不两用**：修饰符 `--x` 只作用于宿主元素，元素类 `__x` 只作用于子元素，
 *    绝不出现"同一个字符串既是 li 修饰符又是 span 类名"（ce-menu-pane 因此
 *    把 grid/center/灰色文字整套规则命中到 li 上，导致菜单项缩窄居中且发灰）。
 * 4. 键盘导航（↑↓ / Home / End / Enter / Esc / ←→）+ ARIA。
 *
 * @attrs
 *  items {array} 菜单项数组，null/undefined 项为分割条。custom 项不响应点击
 * {
 *  text:string|()=>html, description:string|()=>string, disabled, icon, iconClass,
 *  iconSvg, hotKey, children, separate, custom, checkMode:'radio'|'checkbox',
 *  checked, checkGroup, extra:string|()=>string|Element|()=>Element, section, ...
 * }
 *  - `section`：分组标题行（不可交互、role=presentation），几何由 `--menu-section-*`
 *    变量控制。默认项不受影响。
 *  - `description`：双行项的第二行（**纯文本**，省略即单行）。选择显隐用
 *    display —— 未提供时该行不占第二行高度，视觉与旧版一致。
 *  - `extra`：右侧定制操作区（如输入框）。字符串按 HTML 片段渲染（走 html()
 *    通道）；传 Element（或返回 Element 的函数）时，组件在渲染后把它挂进该行的
 *    `.ce-menu__extra`，宿主自持引用即可直接操作真组件。点击该区域不会触发
 *    `select`，且不再向上冒泡（宿主的 outside-click 不会误关菜单）。
 *  - `separate`：与 `children` 同时存在时，该项**整行可点击**（触发 select），
 *    子菜单改为**只在鼠标悬浮到最右侧箭头时**展开（仅 hover 模式）。
 *  theme {string} light/dark，默认 light
 *  round {boolean} 圆角，默认 false
 *  submenuTrigger {string} hover/click，默认 hover
 *  submenuDelay {number} 子菜单展开延迟(ms)，默认 200
 *  minWidth {string} 最小宽度，默认 8rem
 *  maxHeight {string} 最大高度，超出滚动
 *  keyboard {boolean} 是否启用键盘导航，默认 true
 *  radioStyle {string} dot/check，radio 选中标记用圆点还是勾选图标，默认 dot
 *  checkPosition {string} start/end，选中标记列在行首还是行尾，默认 start
 *  checkIcon {string|function} 勾选图标：已注册的图标名（如 "c-svg-check"）或图标模板函数，默认内置 Check
 *  inline {boolean} 内联模式：宿主不再浮层定位（position:relative），由容器排版，默认 false
 * @slots
 *  header 根层顶部的自定义内容（搜索框等）。插槽为空时不占位，默认视觉不变
 * @events
 *  select({item,index,el,path})
 *  hover({item,index,el,path})
 *  submenu-open({item,el,path})
 *  submenu-close({path})
 *  escape()
 *  ⭐ 事件**双通道**派发：模板内用 `@select`，命令式创建时用
 *  `menu.addEventListener('select', ...)`，两者都直接可用（详见 #fire）。
 * @methods
 *  setItems(items) / getItems() / reload() / getCheckedItems() / setIcon(index,iconClass)
 *  open(left,top) / close() / focusFirst() / focusLast()
 *
 * @author holyhigh2
 */
@emits("select", "hover", "submenu-open", "submenu-close", "escape")
@tag("ce-menu")
export class Menu extends CompElem {
  #expanded: Record<string, HTMLElement> = {};
  /** path → 元素型 extra（渲染后被挂进 .ce-menu__extra，宿主自持引用） */
  /**
   * path → 元素型 extra（渲染后被挂进 .ce-menu__extra，宿主自持引用）。
   * ⚠️ **不能用 #private 字段**：renderItem 的方法体会被编译器内联进 forEach
   * 回调，prelude 里的 `this.#x` 在类外是语法错误，会让 collectPreludeDeclNames
   * 解析失败 ⇒ fx 工厂不注入 prelude ⇒ 运行期 ReferenceError（2026-10-17 实锤）。
   */
  extraEls: Record<string, HTMLElement> = {};
  #timer_expand: any;
  #timer_hide: any;
  /** 待展开的项（配合 `separate` 的"仅箭头触发"，避免依赖 mouseenter 派发顺序） */
  #pendingLi: HTMLElement | null = null;
  //////////////////////////////////// props
  @prop({ type: Array }) items: Array<Record<string, any>>;
  @prop round = false;
  @prop theme = "light";
  @prop submenuTrigger = "hover";
  @prop submenuDelay = 200;
  @prop({ type: String }) minWidth = "8rem";
  @prop({ type: String }) maxHeight = "";
  @prop keyboard = true;
  /** radio 选中标记：dot=圆点（默认），check=勾选图标 */
  @prop({ type: String }) radioStyle = "dot";
  /** 选中标记列位置：start=行首（默认），end=行尾 */
  @prop({ type: String }) checkPosition = "start";
  /** 勾选图标：已注册的图标名（如 "c-svg-check"）或图标模板函数；空则用内置 Check */
  @prop({ type: [String, Function] }) checkIcon: string | (() => Template) = "";
  /** 内联模式：不参与浮层定位，由宿主容器排版（子菜单仍相对宿主定位） */
  @prop({ type: Boolean }) inline = false;

  @state itemList: Array<any>;
  /** 已展开的子菜单路径集合（响应式驱动 aria-expanded 与子层显示） */
  @state expandedMap: Record<string, boolean> = {};
  /** 子菜单定位（响应式），key = 路径 */
  @state subPos: Record<string, { left: string; top: string }> = {};

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  /////////////////////////////////// watches
  @watch("items", { deep: true, immediate: true })
  watchItems(nv: any) {
    this.itemList = isNil(nv) ? [] : concat(nv);
    this.nextTick(() => {
      this._syncExtras();
      this._measureAll();
    });
  }
  //////////////////////////////////// lifecycles
  /**
   * 扁平化渲染：root 层与各展开层各是一个 ul，全部由 `levelEntries` 驱动。
   *
   * ⭐ 为什么不再用「renderLevel 递归」：编译管线要求结构指令回调**直接返回**
   * h`` 模板。`${this.renderLevel(...)}` 是普通插值，被当纯文本写入
   * （Template 对象 → [object Object]）；renderItem 的自递归回调也过不了
   * 方法内联 pass 的 visited 护栏（cycle 直接放弃）。把子菜单从「li 的后代」
   * 摊平为「.ce-menu 的直属子层」后：行模板只剩一份、深度无上限，
   * `expandedMap` 即「层的集合」。定位包含块仍是 :host（li/div 都不定位），
   * 坐标基准与旧版嵌套结构一致。
   */
  render(): Template {
    return h`
    <div class="ce-menu" ${classes({ "is-rounded": this.round, [`ce-menu-${this.theme}`]: true })}
      @click="${this.onClick}" @keydown="${this.onKeyDown}" @mouseleave="${this.onMouseLeave}"
      @contextmenu.stop.prevent>
      ${forEach(this.levelEntries,
      (e: LevelEntry) => e.key,
      (e: LevelEntry) => {
        const m = measureLevel(e.list);
        const cols = rowColumnVars(m, { checkPosition: this.checkPosition });
        return h`
        <ul class="ce-menu__list" role="menu" data-level="${e.level}" data-path="${e.isRoot ? "" : e.key}"
          ${classes({ "ce-menu__list--root": e.isRoot, "ce-menu__list--sub": !e.isRoot })}
          ${styles({
          "--menu-col-check": cols.check,
          "--menu-col-check-end": cols.checkEnd,
          "--menu-col-icon": cols.icon,
          "--menu-col-shortcut": cols.shortcut,
          "--menu-col-caret": cols.caret,
          "--menu-col-extra": cols.extra,
          "min-width": e.isRoot ? this.minWidth : "",
          "max-height": e.isRoot && this.maxHeight ? this.maxHeight : "",
          "overflow-y": e.isRoot && this.maxHeight ? "auto" : "",
          "display": e.isRoot ? "" : "block",
          "left": e.isRoot ? "" : (this.subPos[e.key]?.left || "0px"),
          "top": e.isRoot ? "" : (this.subPos[e.key]?.top || "0px"),
        })}>
          <li class="ce-menu__header" role="none"
            ${styles({ display: e.isRoot && this.slots.header?.length ? "" : "none" })}>
            <slot name="header"></slot>
          </li>
          ${forEach(e.list ?? [],
          (item: any, k: any, i: number) => i,
          (item: any, i: number) => this.renderItem(item, i, e.level, e.path, m))}
        </ul>
        `;
      })}
    </div>
    `;
  }

  /**
   * 扁平化的层级条目：root 恒在；sub 层按 `expandedMap` 动态建出/移除。
   * 只整对象读 `itemList` / `expandedMap` ⇒ 两者的写（均为整对象替换）
   * 经渲染侧前缀命中驱动重渲染。
   */
  get levelEntries(): Array<LevelEntry> {
    const entries: Array<LevelEntry> = [
      { key: "", path: [], list: this.itemList ?? [], level: 0, isRoot: true },
    ];
    const em = this.expandedMap || {};
    each(Object.keys(em), (key: string) => {
      if (!em[key]) return;
      const path = split(key, "-").map((s: string) => parseInt(s, 10));
      const list = this.#childrenOf(path);
      if (!list) return;
      entries.push({ key, path, list, level: path.length, isRoot: false });
    });
    return entries;
  }
  /** 按路径取该层 items：path=[0,1] ⇒ itemList[0].children[1].children */
  #childrenOf(path: Array<number>): Array<any> | undefined {
    let list: Array<any> = this.itemList ?? [];
    for (let i = 0; i < path.length; i++) {
      const it: any = list[path[i]];
      if (!isObject(it) || !isArray((it as any).children)) return undefined;
      list = (it as any).children;
    }
    return list;
  }

  /**
   * 渲染单个菜单项（行模板，全层级共用一份）。
   *
   * ⚠️ 引擎契约：forEach 子模板结构恒定（首项播种 meta），TplFn 内不可用
   * ifTrue / 条件插值切换结构；条件一律走 styles(visibility/display) 与 html()。
   * ⭐ 子菜单**不在本模板内**：摊平后由 render() 的 levelEntries 另建一层 ul
   * （见 `_expandChildren`），本模板只负责行本身。
   */
  renderItem(item: any, i: number, level: number, path: Array<number>, m: LevelMeta): Template {
    const v: any = isNil(item) ? {} : (isObject(item) ? item : { text: item, value: item });
    const list: Array<any> = levelList(this.itemList, path);
    const visible = !isNil(item);
    /**
     * ⭐⭐ `i` 的实参其实是 forEach 的 **key**，不是下标。
     *
     * compelem 给子模板的 `itemArgs = [v, k, index]`，而本组件的 key 工厂写成
     * `(item, k, i) => i` ⇒ 传进来的是**被 String 化后的 key**。一位数 key 无碍，
     * 两位起就出事：`concat(path, "10")` 会**逐字符展开**成 `["1","0"]`
     * （实测 `concat([], "10") === ["1","0"]`）⇒ `data-path="1-0"` ⇒
     * `#resolveItem` 解析成 `itemList[1].children[0]` = undefined ⇒
     * ① hover 展不开子菜单（`onItemEnter` 里 `!isArray(item?.children)` 提前 return）；
     * ② 点击时 `switch(item.id)` 抛 `Cannot read properties of undefined (reading 'id')`。
     * 这正是"菜单第 11 项起出现的追加项全部失灵"的根因（2026-10-27 定位）。
     * 显式转回数字：`concat` 拿到 number 就只追加一个元素。
     */
    const idx = Number(i) || 0;
    const isDivider = idx > 0 && isNil(list[idx - 1]);
    const hasSub = isArray(v.children);
    const selectableParent = !!v.separate && hasSub;
    const section = !!v.section;
    const mode =
      v.checkMode === CheckMode.RADIO || v.checkMode === CheckMode.CHECKBOX
        ? v.checkMode
        : "";
    const itemPath = concat(path, idx);
    const pathKey = join(itemPath, "-");

    //radio 组内选中项（取同组最后一个 checked=true，与 ce-menu-pane 一致）
    let radioChecked = false;
    if (mode === CheckMode.RADIO) {
      const groupName = trim(v.checkGroup);
      let last: any;
      each(list, (raw: any) => {
        if (!isObject(raw)) return;
        const it: any = raw;
        if (
          it.checkMode === CheckMode.RADIO &&
          trim(it.checkGroup) === groupName &&
          it.checked
        ) {
          last = it;
        }
      });
      radioChecked = last === v;
    }
    const checked =
      mode === CheckMode.RADIO ? radioChecked : mode === CheckMode.CHECKBOX ? !!v.checked : false;

    //文本：纯字符串走文本节点插值（响应式、无 XSS）；函数/custom 返回 HTML 走 html()
    let text = v.text;
    if (isFunction(text)) text = text();
    const useHtml = isFunction(v.custom) || isFunction(v.text);
    const labelText = useHtml ? "" : isNil(text) ? "" : text + "";
    const labelHtml = useHtml
      ? isFunction(v.custom)
        ? v.custom() + ""
        : isNil(text)
          ? ""
          : text + ""
      : "";
    //第二行描述：纯文本插值（无 XSS），空则整行不占位
    let desc = v.description;
    if (isFunction(desc)) desc = desc();
    const descText = isNil(desc) ? "" : desc + "";
    //radio 选中标记：默认圆点；radioStyle="check" 时复用勾选图标（ARIA 不变）
    const radioCheck = this.radioStyle === "check";
    const showCheck =
      checked &&
      (mode === CheckMode.CHECKBOX || (mode === CheckMode.RADIO && radioCheck));
    const showDot = checked && mode === CheckMode.RADIO && !radioCheck;
    // 行首/行尾标记共用一份 checked 状态，但只渲染 checkPosition 指定的那一侧；
    // 另一侧的列宽是 0 且 overflow:visible，不隐藏会溢出成一个多余的标记。
    const checkAtEnd = this.checkPosition === "end";
    const showCheckStart = showCheck && !checkAtEnd;
    const showCheckEnd = showCheck && checkAtEnd;
    const showDotStart = showDot && !checkAtEnd;
    const showDotEnd = showDot && checkAtEnd;
    //勾选图标：图标名或模板函数交给 ce-icon 解析（不再接收 HTML 片段）
    const checkIcon = this.checkIcon || Check;

    const iconClass = v.iconClass || "";
    const iconSvg = v.iconSvg || "";
    const iconRaw = v.icon || "";
    const hotKey = hotKeyText(v);
    //右侧定制区：string 走 html() 通道；Element 由 _syncExtras() 渲染后命令式挂载
    const extra = resolveExtra(v, v);
    const extraHtml = extra.html;
    if (extra.el) this.extraEls[pathKey] = extra.el;
    else delete this.extraEls[pathKey];

    //ARIA：role 与 aria-* 会随数据变化，用 bind 指令（属性值内插值不会被补丁更新）
    //⚠️ 类型只能是 any：本方法体会被编译器内联进 forEach 回调，prelude 里
    //任何类型标识符（Record / 索引签名的 k…）都会撞 D3 自由标识符检查
    const aria: any = {
      role: visible
        ? section
          ? "presentation"
          : mode === CheckMode.RADIO
            ? "menuitemradio"
            : mode === CheckMode.CHECKBOX
              ? "menuitemcheckbox"
              : "menuitem"
        : "separator",
    };
    if (visible && v.disabled) aria["aria-disabled"] = "true";
    if (visible && mode) aria["aria-checked"] = checked ? "true" : "false";
    if (visible && hasSub) {
      aria["aria-haspopup"] = "menu";
      aria["aria-expanded"] = this.expandedMap[pathKey] ? "true" : "false";
    }

    return h`
    <li class="ce-menu__item" tabindex="-1" data-path="${pathKey}" data-level="${level}" data-index="${idx}"
      data-check-mode="${mode}" data-check-group="${v.checkGroup}"
      ${bind(aria)}
      ${classes({
      "is-disabled": !!v.disabled,
      "is-expanded": !!this.expandedMap[pathKey],
      "has-children": hasSub,
      "is-selectable-parent": selectableParent,
      "is-divider": isDivider,
      "is-custom": !!v.custom,
      "is-section": section,
    })}
      ${styles({ display: visible ? "" : "none" })}
      @mouseenter="${this.onItemEnter}">
      <span class="ce-menu__row">
        <span class="ce-menu__cell ce-menu__cell--check">
          <span class="ce-menu__check" ${styles({ visibility: showCheckStart ? "visible" : "hidden" })}><ce-icon .svg="${checkIcon}" size="sm"></ce-icon></span>
          <span class="ce-menu__dot" ${styles({ display: showDotStart ? "" : "none" })}></span>
        </span>
        <span class="ce-menu__cell ce-menu__cell--icon" ${styles({ visibility: m.hasIcon && !v.custom ? "visible" : "hidden" })}>
          <i ${classes({ [iconClass || "ce-menu__i-none"]: true })} ${styles({ visibility: iconClass ? "visible" : "hidden" })}></i>
          <ce-icon .svg="${iconSvg}" size="sm" ${styles({ visibility: iconSvg ? "visible" : "hidden" })}></ce-icon>
          <span class="ce-menu__icon-raw" ${styles({ visibility: iconRaw ? "visible" : "hidden" })} ${html(iconRaw)}></span>
        </span>
        <span class="ce-menu__cell ce-menu__cell--label">
          <span class="ce-menu__label-wrap">
            <span class="ce-menu__label" ${styles({ display: useHtml ? "none" : "" })}>${labelText}</span>
            <span class="ce-menu__label-html" ${styles({ display: useHtml ? "" : "none" })} ${html(labelHtml)}></span>
            <span class="ce-menu__desc" ${styles({ display: descText ? "" : "none" })}>${descText}</span>
          </span>
        </span>
        <span class="ce-menu__cell ce-menu__cell--shortcut" ${styles({ visibility: m.hasShortcut && !v.custom ? "visible" : "hidden" })}>${hotKey}</span>
        <span class="ce-menu__cell ce-menu__cell--extra" ${styles({ visibility: m.hasExtra && !v.custom ? "visible" : "hidden" })}>
          <span class="ce-menu__extra" ${html(extraHtml)}></span>
        </span>
        <span class="ce-menu__cell ce-menu__cell--caret" ${styles({ visibility: m.hasSub ? "visible" : "hidden" })} @mouseenter="${this.onCaretEnter}">
          <span class="ce-menu__caret" ${styles({ visibility: hasSub && !v.custom ? "visible" : "hidden" })}>
            <ce-icon svg="c-svg-caret-right" size="sm"></ce-icon>
          </span>
        </span>
        <span class="ce-menu__cell ce-menu__cell--check-end">
          <span class="ce-menu__check" ${styles({ visibility: showCheckEnd ? "visible" : "hidden" })}><ce-icon .svg="${checkIcon}" size="sm"></ce-icon></span>
          <span class="ce-menu__dot" ${styles({ display: showDotEnd ? "" : "none" })}></span>
        </span>
      </span>
    </li>`;
  }
  //////////////////////////////////// methods
  /**
   * 只补**原生 DOM 通道**。框架通道（`emit`）由调用点自己发 ——
   * 因为编译期 E-EMIT-ARG 要求 `this.emit()` 的第一个实参是字面量常量，
   * 才能拿它去比对 `@emits` 声明集；转发形参的办法会绕过该校验，丢掉拼写错误的保护。
   * 所以调用点的写法是固定的三行：
   *   const arg = { ... }; this.emit("hover", arg); this.#dispatch("hover", arg);
   *
   * ⚠️ 两条通道必须都走：`CompElem.emit()` 在没有 `wrapperComponent` 时会**直接 return
   * 不派发任何事件**（CompElem.ts:1265-1269），而 `emit-native` 属性又会屏蔽框架通道。
   * 本组件的典型用法是命令式创建的浮层，只走框架通道等于事件全丢。
   */
  #dispatch(name: string, arg: Record<string, any>) {
    this.dispatchEvent(
      new CustomEvent(name, { detail: arg, bubbles: false, composed: false, cancelable: true })
    );
  }
  #resolveItem(li: HTMLElement | null | undefined) {
    if (!li) return undefined;
    let dataPath = split(li.dataset.path, "-");
    let item = get(this.itemList, dataPath.shift()!) as any;
    each(dataPath, (p) => {
      item = get(item.children, p);
    });
    return item;
  }
  /** 取同层可见且可交互的项（键盘导航用） */
  #siblings(li: HTMLElement): HTMLElement[] {
    const ul = li.parentElement!;
    return filter(
      Array.from(ul.querySelectorAll<HTMLElement>(":scope > li.ce-menu__item")),
      (el: HTMLElement) => {
        if (el.style.display === "none") return false;
        if (el.classList.contains("is-disabled")) return false;
        if (el.classList.contains("is-section")) return false;
        return true;
      }
    ) as HTMLElement[];
  }
  //---------- hover
  /**
   * 只清"待展开"定时器。`except` 表示"若待展开的正是这一项则保留"——
   * 这样 `separate` 项不依赖 mouseenter 在内层/外层之间的派发顺序。
   */
  #clearExpandTimer(except?: HTMLElement) {
    if (this.#timer_expand && this.#pendingLi !== except) {
      clearTimeout(this.#timer_expand);
      this.#timer_expand = null;
      this.#pendingLi = null;
    }
  }
  #scheduleExpand(li: HTMLElement) {
    if (this.#timer_expand) {
      clearTimeout(this.#timer_expand);
      this.#timer_expand = null;
    }
    this.#pendingLi = li;
    this.#timer_expand = setTimeout(() => {
      this.#timer_expand = null;
      this.#pendingLi = null;
      this._expandChildren(li);
    }, this.submenuDelay);
  }
  onItemEnter(e: MouseEvent) {
    const li = e.currentTarget as HTMLElement;
    this.#clearExpandTimer(li);
    if (this.#timer_hide) {
      clearTimeout(this.#timer_hide);
      this.#timer_hide = null;
    }

    const item = this.#resolveItem(li);
    if (item?.disabled || item?.section) return;
    const arg = {
      target: li,
      item,
      index: li.dataset.index,
      el: li,
      path: li.dataset.path,
    };
    this.emit("hover", arg);
    this.#dispatch("hover", arg);

    //收起同层已展开的其他子菜单
    const level = li.dataset.level!;
    const expandedLi = this.#expanded[level];
    if (expandedLi && expandedLi !== li) {
      this.#collapse(expandedLi);
    }

    if (this.submenuTrigger !== "hover") return;
    if (!isArray(item?.children)) return;
    //⭐ separate 项：整行可点击，子菜单只由最右侧箭头触发（见 onCaretEnter）
    if (item.separate) return;
    this.#scheduleExpand(li);
  }
  /** `separate` 项：鼠标悬浮到最右侧箭头单元格时才展开子菜单 */
  onCaretEnter(e: MouseEvent) {
    if (this.submenuTrigger !== "hover") return;
    const cell = e.currentTarget as HTMLElement;
    const li = cell.closest("li.ce-menu__item") as HTMLElement | null;
    if (!li) return;
    const item = this.#resolveItem(li);
    if (!item || item.disabled || !isArray(item.children)) return;
    this.#scheduleExpand(li);
  }
  onMouseLeave() {
    this.#clearExpandTimer();
  }
  /**
   * 展开子菜单（响应式建层 + 命令式测量定位）。
   * 扁平化后该层 ul 不在 DOM 里，须先写 `expandedMap` 让 render 建出该层，
   * 再于 nextTick 测量定位；`subPos` 写回后由 styles 指令更新 left/top。
   */
  _expandChildren(li: HTMLElement) {
    if (li.classList.contains("is-disabled")) return;
    const pathKey = li.dataset.path!;
    const level = li.dataset.level!;
    this.#expanded[level] = li;
    this.expandedMap = { ...this.expandedMap, [pathKey]: true };
    this.nextTick(() => {
      const sub = this.renderRoot!.querySelector<HTMLElement>(
        `ul.ce-menu__list--sub[data-path="${pathKey}"]`
      );
      if (!sub) return;
      // 先实测列宽：`_measureShortcut/_measureExtra` 会写 `--menu-col-*-fixed`，
      // 撑开的是子层的**最终宽度**。若不先跑，量到的 subRect.width 是未撑开的旧值
      // （实测 118 vs 139），横向翻边会偏小、贴不齐。
      this._measureShortcut(sub);
      this._measureExtra(sub);
      this._syncExtras();
      const wrapper = li.querySelector<HTMLElement>(":scope > .ce-menu__row")!;
      const host = this as unknown as HTMLElement;
      const hostRect = host.getBoundingClientRect();
      // ⚠️ 子层 ul 的绝对定位包含块是 **:host**（摊平后 li/div 都不定位，见 render 注释），
      //   所以 top 必须是「行相对宿主」的偏移。旧代码硬编码 top:-4（那是嵌套结构下
      //   相对 li 的值），摊平后等于把二级菜单顶到整个一级菜单的顶部 —— 即
      //   「默认比一级菜单还高」的根因。getBox 相对 parent padding box，正是该坐标系。
      const box = getBox(wrapper, host);
      const subRect = sub.getBoundingClientRect();
      const pos = resolveSubPos(
        hostRect.left,
        hostRect.top,
        box.x + box.w,
        box.y - 4,
        { width: subRect.width, height: subRect.height },
        { width: window.innerWidth, height: window.innerHeight }
      );
      this.subPos = { ...this.subPos, [pathKey]: { left: pos.left + "px", top: pos.top + "px" } };
    });
    const arg = { item: this.#resolveItem(li), el: li, path: pathKey };
    this.emit("submenu-open", arg);
    this.#dispatch("submenu-open", arg);
  }
  #collapse(li: HTMLElement) {
    const pathKey = li.dataset.path;
    if (!pathKey) return;
    li.classList.remove("is-expanded");
    const map = { ...this.expandedMap };
    delete map[pathKey];
    this.expandedMap = map;
    //连带收起更深层：扁平化后深层 ul 是 .ce-menu 的直属子级，不再被父层
    //display:none 遮罩，必须显式移除其展开态（路径前缀匹配）
    const prefix = pathKey + "-";
    each(Object.keys(map), (k: string) => {
      if (k.indexOf(prefix) === 0) delete map[k];
    });
    this.expandedMap = map;
    const arg = { path: pathKey };
    this.emit("submenu-close", arg);
    this.#dispatch("submenu-close", arg);
  }
  //---------- 列宽实测
  /**
   * 量某一层的某一列，并把结果写回 `--menu-col-<name>-fixed`。
   * 探针/回写规则见 `base/RowColumns.measureRowColumn`（含「不能直接写
   * `--menu-col-<name>`」的原因），这里只提供菜单的行选择器。
   */
  _measureCol(ul: HTMLElement, name: string) {
    measureRowColumn(
      ul,
      name,
      `:scope > li.ce-menu__item > .ce-menu__row > .ce-menu__cell--${name}`
    );
  }
  _measureShortcut(ul: HTMLElement) {
    this._measureCol(ul, "shortcut");
  }
  _measureExtra(ul: HTMLElement) {
    this._measureCol(ul, "extra");
  }
  /** 元素型 extra：渲染后挂进对应行的 `.ce-menu__extra`（string 型走 html() 通道，无需处理） */
  _syncExtras() {
    const root = this.renderRoot;
    if (!root) return;
    each(root.querySelectorAll<HTMLElement>("li.ce-menu__item[data-path]"), (li) => {
      const el = this.extraEls[li.dataset.path!];
      if (!el) return;
      const box = li.querySelector<HTMLElement>(
        ":scope > .ce-menu__row > .ce-menu__cell--extra > .ce-menu__extra"
      );
      if (box && box.firstElementChild !== el) box.replaceChildren(el);
    });
  }
  _measureAll() {
    const root = this.renderRoot;
    if (!root) return;
    each(root.querySelectorAll<HTMLElement>("ul.ce-menu__list"), (ul) => {
      this._measureShortcut(ul);
      this._measureExtra(ul);
    });
  }
  //---------- 点击
  onClick(e: MouseEvent) {
    let t = e.target as Element;
    //右侧定制区（输入框等）自己处理交互：不选中、也不冒泡给宿主的 outside-click
    if (t.closest?.(".ce-menu__cell--extra")) {
      e.stopPropagation();
      return;
    }
    let li = t.closest("li.ce-menu__item") as HTMLElement | null;
    if (!li || !this.renderRoot!.contains(li)) return;

    const item = this.#resolveItem(li);
    const disabled = li.classList.contains("is-disabled");
    const hasSub = li.classList.contains("has-children");
    const custom = li.classList.contains("is-custom");
    const section = li.classList.contains("is-section");
    const selectableParent = li.classList.contains("is-selectable-parent");
    const checkMode = li.dataset.checkMode;

    //click 触发模式下由点击展开子菜单
    if (hasSub && this.submenuTrigger === "click" && !selectableParent) {
      e.preventDefault();
      if (this.expandedMap[li.dataset.path!]) this.#collapse(li);
      else this._expandChildren(li);
      return;
    }
    if (disabled || section || (hasSub && !selectableParent) || custom) {
      e.preventDefault();
      return;
    }
    if (selectableParent && t.closest(".ce-menu__cell--caret")) {
      e.preventDefault();
      this._expandChildren(li);
      return;
    }

    if (checkMode === CheckMode.RADIO) {
      const groupName = li.dataset.checkGroup;
      const radios = li.parentElement?.querySelectorAll<HTMLElement>(
        'li[data-check-mode="radio"][data-check-group="' + groupName + '"]'
      );
      each<HTMLElement>(radios!, (r) => {
        const rItem = this.#resolveItem(r);
        if (rItem) rItem.checked = r === li;
      });
    } else if (checkMode === CheckMode.CHECKBOX) {
      item.checked = !item.checked;
    }

    const selArg = {
      target: li,
      item,
      index: li.dataset.index,
      el: li,
      path: li.dataset.path,
    };
    this.emit("select", selArg);
    this.#dispatch("select", selArg);
  }
  //---------- 键盘
  #activeLi: HTMLElement | null = null;
  onKeyDown(e: KeyboardEvent) {
    if (!this.keyboard) return;
    const li = (e.target as Element)?.closest?.("li.ce-menu__item") as HTMLElement | null;
    if (!li) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.#move(li, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.#move(li, -1);
        break;
      case "Home":
        e.preventDefault();
        this.#moveTo(li, 0);
        break;
      case "End":
        e.preventDefault();
        this.#moveTo(li, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (li.classList.contains("has-children")) {
          this._expandChildren(li);
          //扁平化后子层 ul 由 nextTick 建出，聚焦首项也要等该帧
          this.nextTick(() => {
            const first = this.renderRoot!.querySelector<HTMLElement>(
              `ul.ce-menu__list--sub[data-path="${li.dataset.path}"] > li.ce-menu__item`
            );
            if (first) this.#focus(first);
          });
        }
        break;
      case "ArrowLeft": {
        e.preventDefault();
        const parentLi = this.#parentLi(li);
        if (parentLi) {
          this.#collapse(parentLi);
          this.#focus(parentLi);
        }
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        li.click();
        break;
      case "Escape":
        e.preventDefault();
        {
          const parentLi = this.#parentLi(li);
          if (parentLi) {
            this.#collapse(parentLi);
            this.#focus(parentLi);
          } else {
            this.emit("escape", {});
            this.#dispatch("escape", {});
          }
        }
        break;
      default:
        break;
    }
  }
  /** 父级 li：按 data-path 反查（扁平化后父子关系不再由 DOM 嵌套表达） */
  #parentLi(li: HTMLElement): HTMLElement | null {
    const path = li.dataset.path;
    if (!path) return null;
    const parentPath = path.split("-").slice(0, -1).join("-");
    if (!parentPath) return null;
    return this.renderRoot!.querySelector<HTMLElement>(`li.ce-menu__item[data-path="${parentPath}"]`);
  }
  #move(li: HTMLElement, step: number) {
    const list = this.#siblings(li);
    const idx = list.indexOf(li);
    let next = list[idx + step];
    if (!next && step > 0) next = list[0];
    if (!next && step < 0) next = list[list.length - 1];
    if (next) this.#focus(next);
  }
  #moveTo(li: HTMLElement, index: number) {
    const list = this.#siblings(li);
    const next = index < 0 ? list[list.length - 1] : list[index];
    if (next) this.#focus(next);
  }
  #focus(li: HTMLElement) {
    if (this.#activeLi && this.#activeLi !== li) {
      this.#activeLi.classList.remove("is-active");
    }
    this.#activeLi = li;
    li.classList.add("is-active");
    li.focus();
    if (isArray(this.#resolveItem(li)?.children) && this.submenuTrigger === "hover") {
      this._expandChildren(li);
    }
  }
  //////////////////////////////////// public api
  setItems(items: Array<any>) {
    this.itemList = isNil(items) ? [] : concat(items);
    this.expandedMap = {};
    this.subPos = {};
    this.#expanded = {};
    this.extraEls = {};
    this.#pendingLi = null;
    this.#clearExpandTimer();
  }
  getItems() {
    return this.itemList;
  }
  setIcon(index: string | number, iconClass: string) {
    const li = this.renderRoot!.querySelector<HTMLElement>(`li[data-index="${index}"]`);
    const i = li?.querySelector<HTMLElement>(".ce-menu__cell--icon > i");
    if (i) {
      i.className = iconClass;
      i.style.visibility = "visible";
    }
  }
  reload() {
    this.setItems(this.items);
  }
  getCheckedItems() {
    return filter(
      this.itemList,
      (item: any) => item && item.checkMode === CheckMode.CHECKBOX && item.checked
    );
  }
  focusFirst() {
    const first = this.renderRoot!.querySelector<HTMLElement>(
      "ul.ce-menu__list--root > li.ce-menu__item"
    );
    if (first) this.#focus(first);
  }
  focusLast() {
    const list = this.renderRoot!.querySelectorAll<HTMLElement>(
      "ul.ce-menu__list--root > li.ce-menu__item"
    );
    const last = list[list.length - 1];
    if (last) this.#focus(last);
  }
  /**
   * 定位并显示菜单。定位是可选的 —— 宿主完全可以自己摆位置，只用面板。
   * 修掉了 ce-menu-pane 用 menuW 计算 Y 越界的笔误（此处应为 menuH）。
   */
  open(left: number, top: number) {
    this.nextTick(() => {
      this._syncExtras();
      this._measureAll();
      const root = this.renderRoot!.querySelector<HTMLElement>("ul.ce-menu__list--root")!;
      // 先复位再量宽：菜单若停留在上次的靠右位置，收缩宽度已被包含块可用宽度压窄，
      // 直接量到的是「被挤压后的宽」而非自然宽（report-builder 系统配置弹层实测：
      // 靠右时 112px ↔ 自然 ~250px）。left:0 处可用空间最大 ⇒ 量得自然宽，
      // 后续按自然宽翻边，宽度才不会被包含块再压窄。
      this.style.left = "0px";
      this.style.top = "0px";
      const menuW = root.offsetWidth;
      const menuH = root.offsetHeight;
      let x = left;
      let y = top;
      const pos = window.getComputedStyle(this).position;
      if (pos === "fixed") {
        // ⚠️ `fixed` 的包含块未必是视口：任何带 transform / perspective / filter /
        //    backdrop-filter / will-change / contain 的祖先都会成为包含块，此时
        //    left/top 相对它解析、收缩宽度也受它的可用宽度约束。用 window.innerWidth
        //    比会永久判「没超」⇒ 靠右既不左移、又被压窄（系统配置弹层实测复现）。
        //    钳制边界改用包含块的 padding box（clientWidth/Height）。
        const cb = fixedContainingBlock(this);
        const cbW = cb ? cb.clientWidth : window.innerWidth;
        const cbH = cb ? cb.clientHeight : window.innerHeight;
        if (x + menuW >= cbW) {
          x = cbW - menuW - EDGE;
        } else if (x < 0) {
          x = 0;
        }
        if (x < 0) x = 0;
        if (y + menuH >= cbH) {
          y = cbH - menuH - EDGE;
        } else if (y < 0) {
          y = 0;
        }
        if (y < 0) y = 0;
      } else {
        const op = this.offsetParent as HTMLElement | null;
        const cH = menuH;
        const maxH = (op?.clientHeight || 0) - EDGE * 2;
        const viewTop = y - (op?.scrollTop || 0);
        if (maxH > 0 && viewTop + cH > maxH) {
          y = maxH - cH;
          if (y < 0) {
            y = EDGE;
            root.style.maxHeight = `${maxH}px`;
            root.style.overflowY = "auto";
          }
          y += op?.scrollTop || 0;
        }
        const rect = op ? op.getBoundingClientRect() : { x: 0, y: 0 };
        if (rect.x + x < EDGE) x = EDGE - rect.x;
        if (rect.y + y < EDGE) y = EDGE - rect.y;
        // ⚠️ 原实现绝对定位分支**只**钳左缘与纵向下缘，右/下溢出不会翻边。
        //    x/y 与 offsetParent 的 padding box 同坐标系，故右/下钳制直接用它的
        //    clientWidth/Height 即可；下限仍以视口 EDGE 兜底，避免把左边顶出。
        if (op) {
          const opW = op.clientWidth;
          const opH = op.clientHeight;
          if (x + menuW > opW - EDGE) x = Math.max(opW - menuW - EDGE, EDGE - rect.x);
          if (y + menuH > opH - EDGE) y = Math.max(opH - menuH - EDGE, EDGE - rect.y);
        }
      }
      this.style.top = `${y}px`;
      this.style.left = `${x}px`;
      this.nextTick(() => {
        this._syncExtras();
        this._measureAll();
      });
    });
  }
  close() {
    this.style.left = "-9999px";
    this.#clearExpandTimer();
    each(this.#expanded, (li) => this.#collapse(li));
    this.#expanded = {};
    if (this.#activeLi) {
      this.#activeLi.classList.remove("is-active");
      this.#activeLi = null;
    }
  }
}
