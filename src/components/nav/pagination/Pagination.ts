import { classes, csscope, Csscope, emits, forEach, h, ifTrue, prop, query, state, tag, Template, watch } from "compelem";
import { clamp, range } from "myfx";
import { ChevronLeft, ChevronRight } from "../../../icons/icons";
import { AppearanceElem } from "../../../base/Appearance";
import { t } from "../../../locale";
import style from "./pagination.scss?tmpl";
/**
 * 分页组件
 * 基于 ce-button 组合实现：上一页/下一页/页码均使用按钮组件渲染，复用外观、涟漪、禁用等能力
 * @attrs
 *  value {number} 当前页，受控model属性，默认1
 *  total {number} 总条数，默认0
 *  pageSize {number} 每页条数，默认10
 *  pagerCount {number} 页码按钮数量（含省略号占位），默认7，最小按5处理
 *  simple {boolean} 简洁模式，仅显示 上一页 / 当前页 / 下一页，默认false
 *  showTotal {boolean|string} 显示总条数文案；传字符串视为模板，支持{total}/{pageSize}占位，默认false
 *  showQuickJumper {boolean} 显示快速跳转输入框，默认false
 *  showSizeChanger {boolean} 显示每页条数切换下拉，默认false
 *  pageSizeOptions {array} 每页条数选项，默认[10,20,50,100]，Array类型须通过JS赋值
 *  align {string} 对齐方式 start/center/end，默认start
 *  size {string} 尺寸 xs/sm/md/lg/xl，默认md
 *  disabled {boolean} 是否禁用，默认false
 *  color {string} 高亮颜色，默认primary
 *
 * @events
 *  change({value,pageSize}) 页码或每页条数变更时触发
 *
 * @parts
 *  root 分页导航根节点（nav）
 *  prev 上一页
 *  next 下一页
 *  pager 页码
 *  total 总条数文案
 *  jumper 快速跳转输入框
 *  sizes 每页条数下拉
 *
 * @a11y
 *  根节点是 nav 且带 aria-label；上一页/下一页/页码的可访问名称经 ce-button
 *  透传到 shadow 内的原生 button；当前页 aria-current=page，其余显式 false
 *  （省略会让读屏把整组页码都当成「当前」）；省略号占位 aria-hidden。
 *
 * @author holyhigh2
 */
@emits('change')
@tag("ce-pagination")
export class Pagination extends AppearanceElem {

  //////////////////////////////////// props
  @prop({ type: Number, model: true }) value = 1;
  @prop({ type: Number }) total = 0;
  @prop({ type: Number }) pageSize = 10;
  @prop({ type: Number }) pagerCount = 7;
  @prop simple = false;
  @prop({ type: [Boolean, String] }) showTotal: boolean | string = false;
  @prop showQuickJumper = false;
  @prop showSizeChanger = false;
  @prop({ type: Array }) pageSizeOptions: number[] = [10, 20, 50, 100];
  @prop align = 'start';

  // 内部当前页（渲染用）。value 是 model 属性，setter 仅发出 update:value 通知不存储，
  // 显示态统一由 current 承担：内部翻页更新 current，外部通过 attribute 变化经 watch 同步。
  @state current = 1;

  // sizeChanger 下拉（data 为 Array prop 无法在模板绑定，需命令式 updateProps）
  @query('ce-select')
  sizesSelect: any;
  __sizesKey = '';

  //////////////////////////////////// computed
  get totalPages() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }
  /**
   * 页码折叠：总页数超出 pagerCount 时保留首页/末页，中间以省略号占位
   */
  get pages(): (number | string)[] {
    const tp = this.totalPages;
    const pc = Math.max(5, this.pagerCount);
    const v = this.current;
    if (tp <= pc) return range(1, tp + 1);
    const half = Math.floor((pc - 2) / 2);
    let start = Math.max(2, v - half);
    let end = Math.min(tp - 1, start + pc - 3);
    start = Math.max(2, end - (pc - 3));
    const list: (number | string)[] = [1];
    if (start > 2) list.push('...');
    for (let i = start; i <= end; i++) list.push(i);
    if (end < tp - 1) list.push('...');
    list.push(tp);
    return list;
  }
  get sizeOptions() {
    return this.pageSizeOptions.map(v => ({ value: String(v), label: `${v} 条/页` }));
  }
  get totalText() {
    if (typeof this.showTotal === 'string') {
      return this.showTotal.replace(/\{total\}/g, String(this.total)).replace(/\{pageSize\}/g, String(this.pageSize));
    }
    return `共 ${this.total} 条`;
  }
  get simpleText() {
    return `${this.current} / ${this.totalPages}`;
  }

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  /////////////////////////////////// watches
  // 外部受控：value attribute 变化时同步到内部 current（越界钳制）
  @watch('value', { immediate: true })
  __syncValue(nv: number) {
    this.current = this.clamp(Number(nv) || 1);
  }
  // total/pageSize 变化时钳制当前页
  @watch(['total', 'pageSize'])
  __clamp() {
    const v = this.clamp(this.current);
    if (v !== this.current) {
      this.current = v;
      this.value = v;
      this.emit('change', { value: v, pageSize: this.pageSize });
    }
  }

  //////////////////////////////////// lifecycles
  render(): Template {
    // 原 `const tp = this.totalPages` 局部变量已移除：tp 被 ifTrue / forEach 回调引用，
    // 而回调的插值在按类烘焙的 effect 工厂里求值，看不到 render() 的局部作用域
    // （报「引用了无法解析的自由标识符 'tp'」）。直接读 `this.totalPages`（getter, 开销可忽略），
    // 顺带让 props 依赖被正确的信号追踪覆盖。
    return h`
    <nav class="ce-pagination" part="root" aria-label="${t('pagination.label')}" ${classes({ [`__${this.align}`]: true })}>
      <ce-button part="prev" class="ce-pagination-prev" .icon="${ChevronLeft}" circle appearance="outlined"
        size="${this.size}" ?disabled="${this.disabled || this.current <= 1}"
        aria-label="${t('pagination.prev')}"
        @click="${this.onPrev}"></ce-button>
      ${ifTrue(!this.simple && this.totalPages > 1, () => h`
        ${forEach(this.pages, (p: any, i) => i, (p: any) => h`
          <ce-button part="pager" data-page="${p}" class="ce-pagination-pager ${p === '...' ? 'ce-pagination-ellipsis' : ''}" appearance="outlined" size="${this.size}"
            ?disabled="${this.disabled || p === '...'}" ?active="${p === this.current}"
            aria-current="${p === this.current ? 'page' : 'false'}"
            aria-label="${p === '...' ? null : t('pagination.page', { page: p })}"
            aria-hidden="${p === '...' ? 'true' : null}"
            @click="${this.onPagerClick}">${p === '...' ? '…' : p}</ce-button>
        `)}
      `)}
      ${ifTrue(this.simple, () => h`
        <span class="ce-pagination-simple-info">${this.simpleText}</span>
      `)}
      <ce-button part="next" class="ce-pagination-next" .icon="${ChevronRight}" circle appearance="outlined"
        size="${this.size}" ?disabled="${this.disabled || this.current >= this.totalPages}"
        aria-label="${t('pagination.next')}"
        @click="${this.onNext}"></ce-button>
      ${ifTrue(!!this.showTotal, () => h`
        <span part="total" class="ce-pagination-total">${this.totalText}</span>
      `)}
      ${ifTrue(this.showQuickJumper, () => h`
        <span class="ce-pagination-jumper">
          <span class="ce-pagination-jumper-label">跳至</span>
          <ce-input-number part="jumper" class="ce-pagination-jumper-input" min="1" .max="${this.totalPages}" .value="${this.current}" @change="${this.onJump}"></ce-input-number>
          <span class="ce-pagination-jumper-label">页</span>
        </span>
      `)}
      ${ifTrue(this.showSizeChanger, () => h`
        <ce-select part="sizes" class="ce-pagination-sizes" size="sm" .value="${String(this.pageSize)}" @change="${this.onSizeChange}"></ce-select>
      `)}
    </nav>
    `;
  }

  //////////////////////////////////// lifecycles
  mounted(): void {
    this.__syncSizes();
  }
  /**
   * ⚠️ 原实现是 `updated() { this.__syncSizes() }`。compelem 0.31 起 `updated()` 只在
   * `forceUpdate()` 里被调用（恒传 `{}`），响应式重渲染走 per-point effect、不再经过它
   * ⇒ 运行期改 `pageSizeOptions` / 切换 `showSizeChanger` 时下拉 data **不再同步**。
   *
   * 改为显式 `@watch`：两个源都是本类 `@prop`，编译器会编成 `rc.__s.<key>.value`
   * 的 signal effect，写入即回调。
   *
   * ⚠️ 不能写 `@watch('sizeOptions')`：`sizeOptions` 是**普通 getter**（非 @state/@prop
   * /@computed），编译器会生成 `rc.__s.sizeOptions.value` —— `__s` 上没有这个键，
   * 首次执行即 TypeError。这里改为监听它的**来源** `pageSizeOptions`。
   */
  @watch(['pageSizeOptions', 'showSizeChanger'])
  onSizesChange(): void {
    this.__syncSizes();
  }

  //////////////////////////////////// methods
  clamp(page: number) {
    const tp = this.totalPages;
    return clamp(Math.floor(page), 1, tp);
  }
  /**
   * sizeChanger 下拉的 data（Array prop）无法通过模板 .data 绑定（会触发 prop 保护报错），
   * 只能在渲染后命令式 updateProps，且仅在选项变化时更新
   */
  __syncSizes() {
    const sel = this.sizesSelect;
    if (!sel || !this.showSizeChanger) return;
    const key = JSON.stringify(this.sizeOptions);
    if (key === this.__sizesKey) return;
    this.__sizesKey = key;
    (sel as any).updateProps({ data: this.sizeOptions });
  }
  /**
   * 统一翻页入口：钳制到 [1, totalPages]，更新内部当前页并发出 change 与 model 通知
   */
  go(page: number) {
    if (this.disabled) return;
    const n = this.clamp(page);
    if (n === this.current) return;
    this.current = n;
    this.value = n;
    this.emit('change', { value: n, pageSize: this.pageSize });
  }
  onPrev() {
    this.go(this.current - 1);
  }
  onNext() {
    this.go(this.current + 1);
  }
  onPagerClick(e: MouseEvent) {
    const btn = (e.target as Element).closest('ce-button[data-page]');
    if (!btn) return;
    const n = Number(btn.getAttribute('data-page'));
    if (!n || n < 1) return;
    this.go(n);
  }
  onJump(e: CustomEvent) {
    const v = Number(e.detail?.value);
    if (v) this.go(v);
  }
  onSizeChange(e: CustomEvent) {
    const v = Number(e.detail?.value);
    if (!v || v === this.pageSize) return;
    this.updateProps({ pageSize: v });
    this.current = 1;
    this.value = 1;
    this.emit('change', { value: 1, pageSize: v });
  }
}
