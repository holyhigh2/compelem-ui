import { css } from "compelem";

/**
 * 组件内部结构切换的共用过渡样式。
 *
 * 只做 opacity —— 结构指令的入/离场由 `ce-{name}-enter/leave-*` 三组类驱动，
 * 位移与尺寸留给各组件自己的样式，避免框架级样式覆盖组件布局。
 *
 * 所有组件共享同一个 `css` 模板 ⇒ 同一张 CSSStyleSheet ⇒ 多个 shadow root 复用，
 * 不随组件数量增长。
 */
export const FADE_CSS = css`
  .ce-fade-enter-active,
  .ce-fade-leave-active {
    transition: opacity 160ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .ce-fade-enter-from,
  .ce-fade-leave-to {
    opacity: 0;
  }
`;
