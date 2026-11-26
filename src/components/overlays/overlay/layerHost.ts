/** 浮层统一层栈 / top-layer 注册入口。 */

export interface LayerOptions {
  /** 本层处于栈顶时按 ESC 的回调；组件自行决定 close 还是 shake */
  onEsc?: (e: KeyboardEvent) => void;
  /** 本层处于栈顶时点击「层外」的回调。 */
  onOutsideClick?: (e: MouseEvent) => void;
}

interface LayerEntry extends LayerOptions {
  el: HTMLElement;
}

const STACK: LayerEntry[] = [];
let escBound = false;

/** 模块加载时探测，避免每个组件各写一份 typeof 判断 */
export const supportsPopover: boolean =
  typeof HTMLElement !== 'undefined' &&
  typeof (HTMLElement.prototype as any).showPopover === 'function';

/**
 * 把元素放进 top-layer（幂等）。只负责「进入」，不负责「顺序」。
 * 长期驻留的共享容器需显式置顶 —— 见 bringLayerToFront()。
 */
export function activateLayer(el: HTMLElement): boolean {
  if (!supportsPopover) return false;
  if (el.getAttribute('popover') !== 'manual') el.setAttribute('popover', 'manual');
  try {
    if (!el.matches(':popover-open')) (el as any).showPopover();
  } catch {
    return false;
  }
  return true;
}

/**
 * 把已在 top-layer 的元素排到最末（= 视觉最上）。
 *
 * 只给**共享容器**用：Overlay 家族共用一个 body 级容器，容器一旦进入 top-layer
 * 就长期驻留，之后打开的 Drawer / 其它 popover 会排在它后面把它压住。每次有新
 * overlay 打开时同步 hide+show 一次即可把容器抬到最上，同一任务内完成不会闪。
 *
 * 不要给每个浮层实例都调：单个实例 showPopover() 时本来就在末尾。
 */
export function bringLayerToFront(el: HTMLElement): void {
  if (!supportsPopover || !isLayerActive(el)) return;
  try {
    (el as any).hidePopover();
    (el as any).showPopover();
  } catch {
    /* noop */
  }
}

export function deactivateLayer(el: HTMLElement): void {
  if (!supportsPopover) return;
  try {
    if (el.matches(':popover-open')) (el as any).hidePopover();
  } catch {
    /* 已隐藏 / 未连接：noop */
  }
  // 刻意**保留** `popover="manual"` 属性，不要 removeAttribute。
  // UA 的 `[popover]:not(:popover-open){display:none}` 依赖这个属性；一旦删掉，
  // 关闭态元素会从 display:none 变回 display:block。共享 overlay 容器还带着
  // `position:fixed;inset:0`，于是变成铺满视口的空 div 永久吞掉页面点击
  // （2026-11-10 真机复现：最后一个浮层关闭后 elementFromPoint 全命中
  // .ce-overlay-container，编辑区完全点不动）。
  // 属性残留无害：isLayerActive() 按 :popover-open 判定，activateLayer() 幂等。
}

/** 元素此刻是否真的在 top-layer（也是组件判「是否打开」的唯一依据） */
export function isLayerActive(el: HTMLElement): boolean {
  try {
    return el.matches(':popover-open');
  } catch {
    return false;
  }
}

/** 登记层（去重后压栈）；重复 open 也会刷新栈序 */
export function pushLayer(el: HTMLElement, options: LayerOptions = {}): void {
  popLayer(el);
  STACK.push({ el, ...options });
}

export function popLayer(el: HTMLElement): void {
  const at = STACK.findIndex((v) => v.el === el);
  if (at >= 0) STACK.splice(at, 1);
}

export function topLayerEl(): HTMLElement | undefined {
  return STACK[STACK.length - 1]?.el;
}

/**
 * 焦点归还：打开前记住来源，关闭后还回去。
 * 用 WeakMap 而不是全局变量，多层嵌套时各自配对、互不覆盖。
 */
const FOCUS_RETURN = new WeakMap<HTMLElement, HTMLElement>();
export function captureFocus(el: HTMLElement): void {
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== document.body && active !== el && !el.contains(active)) {
    FOCUS_RETURN.set(el, active);
  }
}
export function restoreFocus(el: HTMLElement): void {
  const prev = FOCUS_RETURN.get(el);
  FOCUS_RETURN.delete(el);
  if (!prev || !prev.isConnected) return;
  try {
    prev.focus({ preventScroll: true });
  } catch {
    /* noop */
  }
}

/**
 * 全库唯一一份 ESC 监听：只让栈顶那层响应。
 *
 * 原实现 Overlay 与 Drawer 各挂一个 document keydown，栈序各算各的，
 * 嵌套时会出现「ESC 关掉下面那层」或两层同时抖动。这里统一后，
 * 每层把自己的 onEsc 注册进来，行为由组件自己决定（close / shake）。
 */
function onKeyDown(e: KeyboardEvent): void {
  if (STACK.length < 1) return;
  const top = STACK[STACK.length - 1];
  if (e.key === 'Escape') {
    if (!top.onEsc) return;
    e.preventDefault();
    top.onEsc(e);
  }
}

/**
 * 统一的 outside-click 分发：只让**栈顶且登记了 onOutsideClick** 的层响应。
 *
 * 旧 `<dialog>` 靠点击 `::backdrop` 派发到 dialog 自身来关抽屉；popover 的
 * ::backdrop 不派发 click 到元素自身（真机实测），所以模态语义必须由库补。
 *
 * 只认栈顶很重要：下拉展开时栈顶是那个 Overlay（未登记 outside 语义），
 * 此时点外部应当只关下拉（由 Overlay 自己的 close-on-click 处理），
 * 不能越层把抽屉一起关掉。
 */
/** 判定一次鼠标事件是否落在「已登记层之外的页面区域」（层外）。 */
function isOutsideClick(e: MouseEvent): boolean {
  const path = (e.composedPath?.() ?? []) as any[];
  // 命中任一已登记层（含 shadow 内子树与 slot 投影内容）都算层内
  if (STACK.some((l) => path.includes(l.el))) return false;
  // 兜底：命中共享容器里**已打开的浮层内容**才算层内。
  // 不能判「命中容器就算层内」：容器是铺满视口的 popover，点页面任意
  // 位置（包括遮罩/背景）都会命中它，那样 outside-click 永远不会触发
  // （真机验证：backdrop=initial 点外部不关）。
  const container = document.querySelector('.ce-overlay-container');
  if (container) {
    const target = e.target as Element | null;
    if (target && container.contains(target)) {
      const ov = target.closest?.('.ce-overlay');
      if (ov?.classList.contains('ce-overlay-visible')) return false;
    }
  }
  return true;
}

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0 || STACK.length < 1) return;
  const top = STACK[STACK.length - 1];
  // 只有登记了 onOutsideClick 的层（当前仅 Drawer 的模态抽屉）需要「点外部关闭」。
  // 下拉 / 嵌套 Overlay 未登记，其外部点击行为由组件自己处理，这里不拦、不关。
  if (!top.onOutsideClick) return;
  if (!isOutsideClick(e)) return;
  // 模态浮层用非模态 popover + ::backdrop(pointer-events:none) 实现，浏览器不会
  // 产生 inert：若不拦，遮罩上的点击会穿透到背后的按钮（实测：点遮罩上的「左侧」
  // 按钮会一边关抽屉、一边把按钮也点了）。这里在捕获阶段掐断 mousedown，并记下
  // 标志，让随后的 click / mouseup 一并被拦（见 onClickCapture）。
  e.preventDefault();
  e.stopPropagation();
  blockClickUntil = performance.now() + 800;
  top.onOutsideClick(e);
}

// mousedown 的 stopPropagation 挡不住独立的 click 事件落到同一按钮上，
// 因此在捕获阶段再拦一次紧随其后的 click。用一次性时间窗而非在 click 时重新
// 判定 isOutsideClick：抽屉已在 mousedown 里关闭，栈随时可能变，重判不可靠。
// 800ms 兜底是为了「按下后拖出窗口松开」这类不产生 click 的情况——否则标志
// 会残留并误吞下一次正常点击。
let blockClickUntil = 0;
function onClickCapture(e: MouseEvent): void {
  if (performance.now() > blockClickUntil) return;
  blockClickUntil = 0;
  e.preventDefault();
  e.stopPropagation();
}

if (typeof document !== 'undefined' && !escBound) {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('click', onClickCapture, true);
  escBound = true;
}
