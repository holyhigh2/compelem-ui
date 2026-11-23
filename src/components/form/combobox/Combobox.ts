import { bind, classes, computed, csscope, Csscope, emits, forEach, h, ifElse, model, prop, query, QueryCache, show, state, styles, tag, Template, watch } from "compelem";
import { find, isBlank, isEmpty, isNumber, toString, trim } from "myfx";
import { ControlBox } from "../../../base/ControlBox";
import { ChevronDown } from "../../../icons/icons";
import { Overlay } from "../../overlays/overlay/Overlay";
import { Input } from "../input/Input";
import formStyle from "../style.scss?tmpl";
import style from "./style.scss?tmpl";

/**
 * 可输入、可过滤的组合框（combobox）
 *
 * 与 ce-select 的区别：**输入框本身可编辑**，输入即过滤候选；选中后回填 label。
 * 适用于「测点」这类候选多、名称是中文的场景。默认不允许自由文本（freeSolo=false），
 * 失焦时把未提交的输入还原为已选项的 label。
 *
 * @attrs
 *  data {array} 候选列表，格式 [{value,label,disabled}]，label 为显示/过滤文本
 *  filterable {boolean} 输入是否参与过滤，默认 true
 *  freeSolo {boolean} 是否允许提交不在候选里的自由文本，默认 false
 *  displayField {string} 选中后输入框显示哪个字段：label（名称，默认）/ value（代码）
 *  clearable {boolean} 是否可清除，默认 false
 *  loading {boolean} 加载中（显示占位、禁用输入）
 *  openOnFocus {boolean} 聚焦即展开候选，默认 true
 *  autoselect {boolean} 聚焦时全选文本（键入直接覆盖已选项），默认 true
 *  maxHeight {number|string} 候选面板最大高度，超出内部滚动，默认 30vh
 *  panelWidth {number|string} 候选面板宽度，不设置时与输入框等宽
 *  emptyText {string} 无匹配项时的提示，默认「无可选项」
 *  optionHeight {number} 候选行高，默认 32
 *  follow {boolean} 打开期间跟随触发元素滚动/窗口缩放重新定位，默认 true
 *  value model 属性，当前选中的值
 * @events
 *  change({value,label}) 选中/清除/自由文本提交时触发
 *  input({value}) 输入框文本变化时触发（可用于远程搜索）
 *  open() 候选面板展开
 *  close() 候选面板关闭
 *  clear() 清除已选项
 *
 * @author holyhigh2
 */
@emits('change', 'input', 'open', 'close', 'clear', 'update:value')
@tag("ce-combobox")
export class Combobox extends ControlBox {
  @query('ce-input', QueryCache.ONCE)
  input: Input;

  @query('ce-overlay', QueryCache.ONCE)
  overlay: Overlay;

  //////////////////////////////////// props
  @prop({ type: Array }) data: Array<Record<string, any>> = [];
  @prop({ type: [String, Array, Number], model: true }) value: any = '';
  @prop filterable = true;
  @prop freeSolo = false;
  @prop displayField = 'label';
  @prop loading = false;
  @prop openOnFocus = true;
  @prop autoselect = true;
  @prop maxHeight = '30vh';
  @prop({ type: [Number, String] }) panelWidth: number | string = '';
  @prop emptyText = '无可选项';
  @prop follow = true;
  @prop({ type: Number }) optionHeight = 32;

  //////////////////////////////////// state
  @state opened = false;
  /** 输入框当前显示文本（选中项 label / 用户键入文本） */
  @state displayText = '';
  /** 当前过滤词：仅在输入态生效，选中/关闭后清空 */
  @state filterText = '';
  /** 键盘高亮项下标，-1 表示无 */
  @state activeIndex = -1;
  /** 打开时的触发框宽度（面板与输入框等宽） */
  @state __triggerWidth = 0;

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyle, style];
  }

  //////////////////////////////////// computed
  @computed
  get filteredData(): Array<Record<string, any>> {
    const list = this.data || [];
    const kw = trim(this.filterText);
    if (!this.filterable || !kw) return list;
    const lower = kw.toLowerCase();
    return list.filter((d: any) =>
      toString(d?.label ?? '').toLowerCase().includes(lower) ||
      toString(d?.value ?? '').toLowerCase().includes(lower)
    );
  }

  @computed
  get panelWidthCss(): string {
    if (!isBlank(this.panelWidth)) {
      return isNumber(this.panelWidth) ? `${this.panelWidth}px` : toString(this.panelWidth);
    }
    return this.__triggerWidth > 0 ? `${this.__triggerWidth}px` : '';
  }

  /**
   * 候选面板样式。overlay 的内容会被搬到 overlay 自己的 shadow 内，
   * 宿主 shadow 的 CSS 不再命中，故这里全部走内联样式。
   */
  @computed
  get panelStyle(): Record<string, string> {
    return {
      width: this.panelWidthCss,
      'max-height': toString(this.maxHeight),
      'overflow-y': 'auto',
      'overflow-x': 'hidden',
      'box-sizing': 'border-box',
      padding: '4px',
    };
  }

  @computed
  get stateStyle(): Record<string, string> {
    return {
      padding: '18px 0',
      'text-align': 'center',
      color: 'var(--ce-color-text-secondary, var(--ce-color-text-desc))',
      'font-size': 'var(--ce-font-sm, 12px)',
    };
  }

  get labelStyle(): Record<string, string> {
    return {
      'min-width': '0',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
    };
  }

  /////////////////////////////////// watches
  @watch('value')
  watchValue(nv: any) {
    this.displayText = this.displayOf(nv);
    this.filterText = '';
    this.activeIndex = -1;
  }

  @watch('data', { deep: true })
  watchData() {
    // 候选异步到达（先绑定、后加载）时回填；输入中不打断用户
    if (!this.opened) this.displayText = this.displayOf(this.value);
  }

  //////////////////////////////////// lifecycles
  mounted(): void {
    this.displayText = this.displayOf(this.value);
  }

  render(): Template {
    return h`
      <div class="ce-combobox" ${classes({ 'is-disabled': this.disabled, 'is-open': this.opened })}>
        <ce-input
          inside
          ?clearable="${this.clearable}"
          ?autoselect="${this.autoselect}"
          ?disabled="${this.disabled || this.loading}"
          ?readonly="${this.readonly}"
          .value="${this.displayText}"
          placeholder="${toString(this.placeholder)}"
          ${bind({
            appearance: this.appearance,
            color: this.color,
            size: this.size,
            round: this.round,
            label: this.label,
            required: this.required,
            error: this.error,
            errorMessage: this.errorMessage,
            hint: this.hint,
            hideHint: this.hideHint,
          })}
          @input="${this.onInput}"
          @mousedown="${this.onMousedown}"
          @focus="${this.onFocus}"
          @blur="${this.onBlur}"
          @clear="${this.onClear}"
          @keydown="${this.onKeydown}"
        >
          <ce-icon
            slot="append"
            class="ce-combobox-caret"
            .svg="${ChevronDown}"
            ${show(!this.loading && (!this.clearable || isBlank(this.value)))}
            @mousedown.stop="${this.togglePanel}"
          ></ce-icon>
        </ce-input>
        <ce-overlay
          surface
          close-on-click
          backdrop="false"
          placement="bottom-start"
          .follow="${this.follow}"
          @closed="${this.onClosed}"
          ${model(this.opened, 'visible')}
        >
          <div class="ce-combobox-panel" ${styles(this.panelStyle)}>
            ${ifElse(this.loading, () => h`
              <div class="ce-combobox-state" ${styles(this.stateStyle)}>加载中…</div>
            `, () => h`
              ${ifElse(isEmpty(this.filteredData), () => h`
                <div class="ce-combobox-state" ${styles(this.stateStyle)}>${this.emptyText}</div>
              `, () => h`
                ${forEach(this.filteredData, (d: any) => toString(d?.value), (d: any, i: number) => h`
                  <div
                    class="ce-combobox-option"
                    ${classes({ 'is-active': i === this.activeIndex })}
                    ${styles(this.optionStyle(i, d))}
                    @mousedown.prevent
                    @mouseenter="${() => this.activeIndex = i}"
                    @click="${() => this.selectOption(d)}"
                  >
                    <span class="ce-combobox-label" ${styles(this.labelStyle)}>${toString(d?.label ?? d?.value ?? '')}</span>
                  </div>
                `)}
              `)}
            `)}
          </div>
        </ce-overlay>
      </div>
    `;
  }

  //////////////////////////////////// methods
  private optionStyle(i: number, d: any): Record<string, string> {
    const active = i === this.activeIndex;
    return {
      display: 'flex',
      'align-items': 'center',
      'box-sizing': 'border-box',
      height: `${this.optionHeight}px`,
      padding: '0 8px',
      'border-radius': '4px',
      cursor: d?.disabled ? 'not-allowed' : 'pointer',
      opacity: d?.disabled ? '0.45' : '1',
      'font-size': 'var(--ce-font-md, 13px)',
      background: active ? 'rgb(var(--ce-color-primary-rgb, 47 124 255) / 0.10)' : '',
      color: active ? 'rgb(var(--ce-color-primary-rgb, 47 124 255))' : 'var(--ce-color-text)',
    };
  }

  /** 值 → 显示文本：候选里有就用 label，否则回退原文 */
  labelOf(v: any): string {
    if (isBlank(v)) return '';
    const hit = find(this.data || [], (d: any) => d?.value == v);
    return hit ? toString(hit.label ?? hit.value) : toString(v);
  }

  /** 值 → 输入框文本：displayField='value' 时显示代码，否则显示名称 */
  displayOf(v: any): string {
    if (isBlank(v)) return '';
    if (this.displayField === 'value') return toString(v);
    return this.labelOf(v);
  }

  /** 当前值在过滤后列表中的位置 */
  private indexOfValue(): number {
    const i = this.filteredData.findIndex((d: any) => d?.value == this.value);
    return i;
  }

  showPanel(): void {
    if (this.opened || this.disabled || this.readonly) return;
    this.__triggerWidth = this.getBoundingClientRect().width;
    this.filterText = '';
    this.activeIndex = -1;
    this.opened = true;
    this.overlay?.openBy(this.input);
    this.emit('open');
  }

  hidePanel(): void {
    if (!this.opened) return;
    this.opened = false;
    this.overlay?.close();
  }

  /** 放弃未提交的输入，恢复为已选项 */
  private revertText(): void {
    this.filterText = '';
    this.activeIndex = -1;
    this.displayText = this.displayOf(this.value);
  }

  private selectOption(d: any): void {
    if (!d || d.disabled) return;
    const ov = this.value;
    const label = toString(d.label ?? d.value ?? '');
    this.filterText = '';
    this.activeIndex = -1;
    this.displayText = this.displayOf(d.value);
    this.value = d.value;
    this.hidePanel();
    if (ov != d.value) this.emit('change', { value: d.value, label });
  }

  /** 失焦提交自由文本（freeSolo）或回填已选项 */
  private commitText(force?: boolean): void {
    const text = toString(this.displayText ?? '');
    const shown = this.displayOf(this.value);
    if (!this.freeSolo) {
      this.displayText = shown;
      return;
    }
    if (!force && text === shown) return;
    const hit = find(this.data || [], (d: any) => toString(d?.label) === text || toString(d?.value) === text);
    const v = hit ? hit.value : text;
    const ov = this.value;
    this.displayText = hit ? this.displayOf(hit.value) : text;
    this.filterText = '';
    this.value = v;
    const label = hit ? toString(hit.label ?? hit.value) : text;
    if (ov != v) this.emit('change', { value: v, label });
  }

  private moveActive(step: number): void {
    const items = this.filteredData;
    if (isEmpty(items)) {
      this.activeIndex = -1;
      return;
    }
    let i = this.activeIndex;
    for (let n = 0; n < items.length; n++) {
      i = i < 0 ? (step > 0 ? 0 : items.length - 1) : i + step;
      if (i < 0) i = items.length - 1;
      if (i >= items.length) i = 0;
      if (!items[i]?.disabled) break;
    }
    this.activeIndex = i;
    this.scrollActiveIntoView();
  }

  private scrollActiveIntoView(): void {
    this.nextTick(() => {
      const box = this.overlay?.contentEl?.current;
      const el = box?.querySelector('.ce-combobox-option.is-active') as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  //////////////////////////////////// events
  private onInput(obj: Record<string, any>): void {
    const v = toString(obj?.value ?? '');
    this.displayText = v;
    if (!this.opened) this.showPanel();
    if (this.filterable) this.filterText = v;
    this.activeIndex = this.filteredData.length ? 0 : -1;
    this.emit('input', { value: v });
    this.scrollActiveIntoView();
  }

  private onFocus(): void {
    if (!this.openOnFocus) return;
    this.showPanel();
  }

  /**
   * 点击触发框（已聚焦时不会再触发 focus）也要能再次展开：
   * 面板被「点击外部」关掉后，焦点仍在输入框里，只靠 focus 无法重开。
   */
  private onMousedown(e: MouseEvent): void {
    if (e?.button !== 0) return;
    if (this.disabled || this.readonly || this.loading) return;
    if (!this.opened) this.showPanel();
  }

  private onBlur(): void {
    this.commitText();
    this.filterText = '';
    this.activeIndex = -1;
  }

  private onClear(): void {
    const ov = this.value;
    this.value = '';
    this.displayText = '';
    this.filterText = '';
    this.activeIndex = -1;
    this.emit('clear');
    if (!isBlank(ov)) this.emit('change', { value: '', label: '' });
    this.input?.focus();
  }

  private onKeydown(obj: Record<string, any>): void {
    const ev: KeyboardEvent = obj?.event;
    if (!ev) return;
    // 输入法组合期间方向键/回车属于候选词操作，不能驱动面板
    if (ev.isComposing || (ev as any).keyCode === 229) return;

    const items = this.filteredData;
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        if (!this.opened) {
          this.showPanel();
          this.activeIndex = items.length ? 0 : -1;
        } else {
          this.moveActive(1);
        }
        break;
      case 'ArrowUp':
        ev.preventDefault();
        if (!this.opened) {
          this.showPanel();
          this.activeIndex = items.length ? items.length - 1 : -1;
        } else {
          this.moveActive(-1);
        }
        break;
      case 'Enter':
        if (this.opened && this.activeIndex >= 0 && this.activeIndex < items.length) {
          ev.preventDefault();
          this.selectOption(items[this.activeIndex]);
        } else if (this.freeSolo) {
          ev.preventDefault();
          this.commitText(true);
          this.hidePanel();
        } else if (!this.opened) {
          this.revertText();
        }
        break;
      case 'Escape':
        if (this.opened) {
          this.revertText();
          this.hidePanel();
        } else {
          this.revertText();
        }
        break;
      case 'Tab':
        this.revertText();
        this.hidePanel();
        break;
    }
  }

  togglePanel(): void {
    if (this.disabled || this.readonly || this.loading) return;
    if (this.opened) {
      if (this.freeSolo) this.commitText(true);
      else this.revertText();
      this.hidePanel();
    } else {
      this.input?.focus();
      this.showPanel();
    }
  }

  private onClosed(): void {
    this.opened = false;
    this.filterText = '';
    this.activeIndex = -1;
    this.emit('close');
  }

  clear(): void {
    this.onClear();
  }

  /** 当前值对应项 */
  get selectedItem(): Record<string, any> | undefined {
    return find(this.data || [], (d: any) => d?.value == this.value);
  }

  /** 当前高亮项（键盘用；无高亮时返回 undefined） */
  get activeItem(): Record<string, any> | undefined {
    if (this.activeIndex < 0) return undefined;
    return this.filteredData[this.activeIndex];
  }

  /** 供外部（远程搜索）同步输入框文本 */
  setInputText(v: string): void {
    this.displayText = toString(v ?? '');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ce-combobox': Combobox;
  }
}
