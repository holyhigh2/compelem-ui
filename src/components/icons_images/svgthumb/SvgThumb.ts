import { CompElem, csscope, Csscope, createRef, h, prop, tag, Template, watch } from "compelem";
import style from "./style.scss?tmpl";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * SVG 缩略图。把一段 SVG 内部标记（不含 <svg> 根）渲染为带 viewBox 的缩略图，
 * 并提供缩略场景常用的缺省样式与回退内容。
 *
 * 常用于元件库/图层列表/拖拽副本等处，替代各业务里重复的
 * 「建 <svg> → <g>.innerHTML = content → 补 fill/stroke → 空内容给占位」样板。
 *
 * @attrs
 *  content {string} SVG 内部标记（不含 <svg> 根）
 *  view-box {string} 视图框，如 "0 0 100 100"
 *  color {string} 前景色（写入 <g> 的 color，供 currentColor 使用）；空串表示不写
 *  fill {string} 缺省填充；空串表示不写（沿用 SVG 默认，避免覆盖 content 自带 fill）
 *  stroke {string} 缺省描边；空串表示不写
 *  stroke-width {number} 覆盖所有 [stroke-width]，用于缩略尺寸下保持一致线宽；0 表示不覆盖
 *  size {number|string} 宽高（px 或任意 CSS 长度），缺省由消费方 CSS 决定
 *  title {string} 无障碍标题，渲染为 <title>
 *  fallback {string} content 为空时的占位字符（居中显示）
 *
 * @author holyhigh2
 */
@tag("ce-svg-thumb")
export class SvgThumb extends CompElem<null> {
  //////////////////////////////////// props
  @prop({ type: String }) content = "";
  @prop({ type: String }) viewBox = "0 0 100 100";
  @prop({ type: String }) color = "";
  @prop({ type: String }) fill = "";
  @prop({ type: String }) stroke = "";
  @prop strokeWidth = 0;
  @prop({ type: [Number, String] }) size: number | string = "";
  @prop({ type: String }) title = "";
  @prop({ type: String }) fallback = "";

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  //////////////////////////////////// refs
  rootRef = createRef<HTMLDivElement>();

  //////////////////////////////////// lifecycles
  render(): Template {
    return h`<div class="ce-svg-thumb" ref="${this.rootRef}"></div>`;
  }

  mounted(): void {
    this.rebuild();
  }

  //////////////////////////////////// watchers
  @watch(["content", "viewBox", "color", "fill", "stroke", "strokeWidth", "size", "title", "fallback"])
  onPropChange(): void {
    this.rebuild();
  }

  //////////////////////////////////// methods
  /** 依据当前 props 重建内部 svg。content 为受信任的 SVG 标记 */
  rebuild(): void {
    const root = this.rootRef.current;
    if (!root) return;
    const sizeAttr = this.size === "" || this.size == null ? "" : ` width="${this.size}" height="${this.size}"`;
    const gStyle = [
      this.color ? `color:${this.color}` : "",
      this.fill ? `fill:${this.fill}` : "",
      this.stroke ? `stroke:${this.stroke}` : "",
    ]
      .filter(Boolean)
      .join(";");
    const gAttr = gStyle ? ` style="${gStyle}"` : "";
    root.innerHTML = `<svg viewBox="${this.viewBox}"${sizeAttr}><g${gAttr}>${this.content || ""}</g></svg>`;
    const svg = root.firstElementChild as SVGSVGElement | null;
    if (!svg) return;
    const g = svg.querySelector("g") as SVGGElement | null;

    if (g && this.strokeWidth) {
      for (const el of Array.from(g.querySelectorAll("[stroke-width]"))) {
        el.setAttribute("stroke-width", String(this.strokeWidth));
      }
    }
    if (this.title) {
      const t = document.createElementNS(SVG_NS, "title");
      t.textContent = this.title;
      svg.insertBefore(t, svg.firstChild);
    }
    if (!String(this.content || "").trim() && this.fallback) {
      const t = document.createElementNS(SVG_NS, "text");
      t.setAttribute("x", "50%");
      t.setAttribute("y", "50%");
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "central");
      t.setAttribute("font-size", String(Math.round(this.viewBoxHeight() * 0.6)));
      t.setAttribute("fill", this.color || "#666");
      t.textContent = this.fallback;
      svg.append(t);
    }
  }

  /** viewBox 的第四个数字（高度），解析失败时回退 100 */
  private viewBoxHeight(): number {
    const parts = String(this.viewBox).trim().split(/\s+/);
    const h = parseFloat(parts[3]);
    return isNaN(h) ? 100 : h;
  }
}
