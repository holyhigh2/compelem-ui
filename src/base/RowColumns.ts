/**
 * 行内列位的共享计算。
 *
 * 行的**结构**仍由各组件自己的模板决定（ce-menu 是 `ul/li` + 7 列网格，
 * ce-list-item 是宿主 grid + 槽位）；这里只收敛两者共用的那部分：
 * 列宽常量、层元信息 → 层变量的换算，以及列宽的实测。
 *
 * 变量命名沿用 `--<prefix>-col-*`，默认 `prefix = "menu"`，与 ce-menu
 * 既有的样式契约逐字一致；其他行渲染器复用同一套算法时传自己的前缀即可。
 */

/**
 * 层元信息：决定**整层**哪些列存在。
 *
 * 列的存在性只由层级决定、单元格内容只由单项决定 —— 这是跨行对齐的唯一
 * 正确姿势。单项各自决定列宽会让「有图标/无图标」「有快捷键/无快捷键」的行
 * 文本左缘互相错开。
 */
export interface RowColumnFlags {
  hasCheck: boolean;
  hasIcon: boolean;
  hasShortcut: boolean;
  hasSub: boolean;
  hasExtra: boolean;
  maxHotKey: number;
}

/** 勾选列在哪一端、以及 CSS 变量前缀 */
export interface RowColumnOptions {
  /** start/end，默认 start */
  checkPosition?: string;
  /** 变量前缀，默认 menu */
  prefix?: string;
}

/** 勾选列默认宽（行首/行尾共用一个覆盖入口 `--<prefix>-check-col`） */
export const ROW_COL_CHECK = "1.15rem";
/** 图标列默认宽 */
export const ROW_COL_ICON = "1.35rem";
/** 子菜单箭头列默认宽 */
export const ROW_COL_CARET = "0.95rem";
/** extra 列兜底宽，精确值由 measureRowColumn 写回 `--<prefix>-col-extra-fixed` */
export const ROW_COL_EXTRA_FALLBACK = "7rem";

/** 层容器上要写入的列宽变量值 */
export interface RowColumnVars {
  check: string;
  checkEnd: string;
  icon: string;
  shortcut: string;
  caret: string;
  extra: string;
}

/** 把层元信息换算成该层的列宽变量值 */
export function rowColumnVars(m: RowColumnFlags, opts: RowColumnOptions = {}): RowColumnVars {
  const p = opts.prefix ?? "menu";
  const atEnd = opts.checkPosition === "end";
  const check = "var(--" + p + "-check-col, " + ROW_COL_CHECK + ")";
  return {
    check: m.hasCheck && !atEnd ? check : "0px",
    checkEnd: m.hasCheck && atEnd ? check : "0px",
    icon: m.hasIcon ? "var(--" + p + "-icon-col, " + ROW_COL_ICON + ")" : "0px",
    shortcut: m.hasShortcut
      ? "var(--" + p + "-col-shortcut-fixed, calc(" + m.maxHotKey + " * 0.62ch + 0.5rem))"
      : "0px",
    caret: m.hasSub ? ROW_COL_CARET : "0px",
    extra: m.hasExtra ? "var(--" + p + "-col-extra-fixed, " + ROW_COL_EXTRA_FALLBACK + ")" : "0px",
  };
}

/**
 * 实测某列的自然宽，写回 `--<prefix>-col-<name>-fixed`。
 *
 * **绝不能去写 `--<prefix>-col-<name>` 本身**：那个变量是 `styles()` 指令
 * 写在层容器上的（值为 `var(--<prefix>-col-<name>-fixed, 兜底)`），用
 * `style.setProperty(name, "")` 把它清掉等于**删掉**该自定义属性，而指令的
 * diff 认为值没变、不会补回，于是行模板里的 `var(...)` 全部回落到 0px ——
 * 轨道直接塌掉。走 `-fixed` 变量不动指令管理的那个，才是安全通道。
 *
 * @param scope        层容器（变量写在这里，被该层所有行继承）
 * @param name         列名（shortcut / extra …）
 * @param cellSelector 该列单元格的选择器，相对 `scope`
 */
export function measureRowColumn(
  scope: HTMLElement,
  name: string,
  cellSelector: string,
  prefix = "menu"
): void {
  if (!scope) return;
  const cells = scope.querySelectorAll<HTMLElement>(cellSelector);
  if (cells.length < 1) return;
  const probe = `--${prefix}-col-${name}-fixed`;
  scope.style.setProperty(probe, "max-content");
  let max = 0;
  cells.forEach((c) => {
    if (c.offsetWidth > max) max = c.offsetWidth;
  });
  scope.style.setProperty(probe, max > 0 ? max + "px" : "0px");
}
