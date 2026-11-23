/**
 * 行 DOM 换主标记。
 *
 * 虚拟行复用会在滚动中把一行的 DOM 改写成另一行的数据。单元格里的组件在这一轮
 * 里只是"换主"，播放过渡就成了闪烁。填充方在换主的行上打这个属性，组件在自己的
 * 值写入路径里用 `inReusedRow()` 判断本次写入是否属于换主。
 *
 * 属性由填充方每轮重设，因此读到的值总是"最近一次填充是否换主"；
 * 同 key 的数据更新、宿主回写、用户交互都不会带这个标记，过渡照常播放。
 */
export const REUSE_ROW_ATTR = 'data-row-reuse';

/**
 * 从元素向上查找换主标记，跨 shadow 边界。
 * @param el 起始元素（组件自身）
 * @returns 位于换主行内时返回 true
 */
export function inReusedRow(el: Element | null) {
    let cur: Element | null = el;
    while (cur) {
        if (cur.hasAttribute(REUSE_ROW_ATTR)) return true;
        const root = cur.getRootNode() as ShadowRoot & { host?: Element };
        cur = cur.parentElement ?? root.host ?? null;
    }
    return false;
}
