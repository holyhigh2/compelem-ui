import { classes, CompElem, csscope, Csscope, forEach, h, ifElse, prop, tag, Template } from "compelem";
import style from "./style.scss?tmpl";

/**
 * 骨架加载器，用于card/table/panel/article等区域的内容占位加载
 * @attrs
 *  type {string} 预设骨架，逗号分隔可组合，可选 card/table/panel/article/list/heading/paragraph/title/text/avatar/image/button/divider，默认text
 *  loading {boolean} 是否显示骨架，默认true；为false时显示默认插槽中的真实内容
 *  animation {string} 动效 wave流光/pulse呼吸/none静态，默认wave
 *  rows {number} paragraph/table/list预设的重复行数，默认3
 *  columns {number} table预设的列数，默认4
 *  avatar {boolean} card/list预设是否带头像块，默认false
 *
 * @slots
 *  - loading为false时显示的真实内容
 *
 * @author holyhigh2
 */
interface SkeletonItem {
  /** 骨架块类型 title/text/avatar/image/button/divider/cell */
  v: string;
  /** 宽度比例 w-40/w-60/w-70 */
  w?: string;
  /** 是否flex撑满剩余空间 */
  grow?: boolean;
}

interface SkeletonRow {
  items: SkeletonItem[];
  /** 是否为表格网格行（CSS grid 均分列） */
  table?: boolean;
}

@tag('ce-skeleton-loader')
export class SkeletonLoader extends CompElem {

  //////////////////////////////////// props
  @prop({ type: String }) type = 'text';
  @prop({ type: Boolean }) loading = true;
  @prop({ type: String }) animation = 'wave'; //wave/pulse/none
  @prop({ type: Number }) rows = 3;
  @prop({ type: Number }) columns = 4;
  @prop({ type: Boolean }) avatar = false;

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  /////////////////////////////////// methods
  private item(v: string, w?: string, grow?: boolean): SkeletonItem {
    return { v, w, grow };
  }

  /**
   * 将type解析为"行数组"（每行是横向排列的骨架块组）
   * 行内块通过flex/grid布局，行间纵向堆叠
   */
  resolveRows(): SkeletonRow[] {
    const rows: SkeletonRow[] = [];
    const pushRow = (items: SkeletonItem[], table = false) => {
      if (items.length) rows.push({ items, table });
    };

    for (const t of this.type.split(',')) {
      const name = t.trim();
      switch (name) {
        case 'title':
          pushRow([this.item('title', 'w-60')]);
          break;
        case 'text':
          pushRow([this.item('text', undefined, true)]);
          break;
        case 'avatar':
          pushRow([this.item('avatar')]);
          break;
        case 'image':
          pushRow([this.item('image')]);
          break;
        case 'button':
          pushRow([this.item('button')]);
          break;
        case 'divider':
          pushRow([this.item('divider')]);
          break;
        case 'heading':
          pushRow([this.item('title', 'w-60')]);
          pushRow([this.item('text', undefined, true)]);
          pushRow([this.item('text', 'w-70')]);
          break;
        case 'paragraph':
          for (let i = 0; i < this.rows; i++) pushRow([this.item('text', undefined, true)]);
          break;
        case 'card': {
          const header: SkeletonItem[] = [];
          if (this.avatar) header.push(this.item('avatar'));
          header.push(this.item('title', undefined, true));
          pushRow(header);
          pushRow([this.item('text', undefined, true)]);
          pushRow([this.item('text', 'w-70')]);
          pushRow([this.item('button')]);
          break;
        }
        case 'table':
          pushRow([this.item('title', 'w-40')]);
          for (let r = 0; r < this.rows; r++) {
            const cells: SkeletonItem[] = [];
            for (let c = 0; c < this.columns; c++) cells.push(this.item('cell'));
            pushRow(cells, true);
          }
          break;
        case 'panel':
          pushRow([this.item('title', 'w-40')]);
          pushRow([this.item('divider')]);
          for (let i = 0; i < this.rows; i++) pushRow([this.item('text', undefined, true)]);
          break;
        case 'article':
          pushRow([this.item('title', 'w-70')]);
          pushRow([this.item('text', 'w-40')]);
          pushRow([this.item('image'), this.item('text', 'w-40')]);
          pushRow([this.item('text', 'w-70')]);
          break;
        case 'list':
          for (let r = 0; r < this.rows; r++) {
            const row: SkeletonItem[] = [];
            if (this.avatar) row.push(this.item('avatar'));
            row.push(this.item('text', undefined, true));
            row.push(this.item('text', 'w-60'));
            pushRow(row);
          }
          break;
        default:
          pushRow([this.item('text', undefined, true)]);
      }
    }
    if (!rows.length) rows.push([this.item('text', undefined, true)]);
    return rows;
  }

  //////////////////////////////////// lifecycles
  render(): Template {
    const rows = this.resolveRows();
    return h`
      <div class="ce-skeleton" ${classes({
        ['ce-skeleton-anim-' + this.animation]: true,
        "is-loading": this.loading
      })} style="--ce-skeleton-columns:${this.columns}">
        ${ifElse(this.loading,
          () => h`
            <div class="ce-skeleton-wrap">
              ${forEach(rows, (r, ri) => ri, (r, ri) => h`
                <div class="ce-skeleton-row" ${classes({ "ce-skeleton-table": !!r.table })}>
                  ${forEach(r.items, (b, i) => i, (b, i) => h`
                    <div class="ce-skeleton-item" ${classes({ ['ce-skeleton-' + b.v]: true, ['ce-skeleton-' + b.w]: !!b.w, "ce-skeleton-grow": !!b.grow })}></div>
                  `)}
                </div>
              `)}
            </div>
          `,
          () => h`
            <div class="ce-skeleton-slot"><slot></slot></div>
          `
        )}
      </div>
    `;
  }
}
