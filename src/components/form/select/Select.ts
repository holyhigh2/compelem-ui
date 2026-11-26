import { bind, classes, computed, createRef, csscope, Csscope, emits, h, html, ifElse, ifTrue, model, prop, query, QueryCache, show, slot, state, styles, tag, Template, watch } from "compelem";
import { each, find, isArray, isBlank, isEmpty, isNumeric, isObject, isString, kebabCase, size, slice, toString, concat, get, map, values } from "myfx";
import { ControlBox } from "../../../base/ControlBox";
import { ChevronDown } from "../../../icons/icons";
import { Overlay } from "../../overlays/overlay/Overlay";
import { ListPicker } from "../../picker/listpicker/ListPicker";
import { InputTag } from "../input/InputTag";
import { nodesToHTML } from "../../../utils/utils";
import formStyle from "../style.scss?tmpl";
import style from "./style.scss?tmpl";

/** 面板宽度 buffer：勾选图标 + gap + 行左右内距 + 面板内边距，单位 px */
const PANEL_WIDTH_BUFFER = 72;
/** css 长度换算用的基准字号（rem → px） */
const BASE_FONT_SIZE = 14;
/** 模块级共享的离屏 canvas，避免每次测量都新建 */
let _measureCtx: CanvasRenderingContext2D | null | undefined;
function measureCtx(): CanvasRenderingContext2D | null {
  if (_measureCtx === undefined) {
    _measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  return _measureCtx;
}
/** 把数值(px) / 带单位字符串(px|rem|em) 归一成 px；'100%' 等无法换算的返回 null */
function cssLengthToPx(v: number | string | undefined | null, base: number): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).trim().match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === 'rem' || m[2] === 'em') return n * base;
  return n;
}

/**
 * 下拉选择框，支持多选（仅逗号分隔）
 * @attrs
 *  data {array|object} 列表数组，格式[{value,label,selected}]。如果值类型为对象表示分组数据，格式 {groupLabel: [{value,label,selected}]}
 *  multiple {boolean} 是否可多选，默认false
 *  tags {boolean} 是否以标签形式显示，默认false
 *  limit {number} 多选时允许的最大项，小于1表示不限制。默认0
 *  clearable {boolean} 是否可清除，默认 false
 *  filterable {boolean} 是否可过滤，默认 false
 *  maxHeight {number} 弹出列表最大显示高度，超过会显示滚动条，默认30vh
 *  maxWidth {number} 弹出列表最大显示宽度，默认100%
 *  minWidth {number|string} 弹出列表最小宽度，保证最短选项也能显示全。默认100px；传数值按px，传字符串可带单位（如 '8rem'）
 *  panelWidth {number|string} 弹出列表宽度，与选择框宽度相互独立；不设置时按内容自适应（clamp(内容宽度, minWidth, maxWidth)）
 *  loading {boolean} 显示加载状态
 *  collapse-items {number} 折叠选项，在显示项超过数字后仅显示计数。小于1时无效，默认0
 *  
 *  value {string|string[]} model属性，受控
 * @events
 *  change({label,value})
 *  close() 选择框关闭时触发
 * @slots
 *  default 内部可使用option标签自定义内容样式
 *  option 列表选项插槽
 *  tag 当tags为true时，选中项插槽
 *
 * @author holyhigh2
 */
@emits('change', 'close', 'update:value')
@tag("ce-select")
export class Select extends ControlBox {

  changeDisplay(stateName: string, enabled: boolean): void {
    this.plaintext = enabled
  }
  @query('ce-input-tag', QueryCache.ONCE)
  input: InputTag

  @query('ce-overlay', QueryCache.ONCE)
  list: Overlay;

  @query('.ce-form-select slot')
  slotEl: HTMLSlotElement;

  selectPanel = createRef<ListPicker>()
  //////////////////////////////////// props
  @prop({ type: Array }) data: Array<Record<string, any>> = [];
  @prop clearable = false;
  @prop tags = false;
  @prop multiple = false;
  @prop filterable = false;
  @prop loading = false;
  @prop maxHeight = '30vh';
  @prop maxWidth = '100%';
  /**
   * 下拉面板最小宽度。取一个能保证最短选项显示全的下限即可（默认 100px），
   * 不应跟随输入框宽度 —— 否则输入框被 flex 拉伸或被 tags 撑宽时，
   * 面板会被撑出大片透明命中死区、遮挡相邻控件（详见工作日志 2026-11-19）。
   */
  @prop({ type: [Number, String] }) minWidth: number | string = 100;
  /**
   * 弹出面板宽度。数值按 px，字符串可带单位（如 '20rem'）。
   * 不设置时按内容自适应：clamp(内容宽度, minWidth, maxWidth)。
   * 选择框自身的宽度请在 ce-select 上设置样式（如 style="width:320px"），
   * 面板宽度只由本属性 / minWidth / maxWidth 决定，不与选择框宽度对齐。
   */
  @prop({ type: [Number, String] }) panelWidth: number | string = '';
  @prop({ type: Number }) popHeight: number;
  @prop limit = 0;
  @prop({ type: [String, Array, Number], model: true }) value = '';
  @prop collapseItems = 0
  /**
   * 打开期间是否跟随触发元素滚动 / 窗口缩放实时重算位置，默认跟随。
   *
   * 设为 `false` 时面板停在打开时的那一点（`position: fixed`），页面滚动后与触发框
   * 分离 —— 需要"面板钉住不动"的场景（比如滚动做对比）才用，常规都保持默认。
   */
  @prop follow = true

  @state selectLabel: string | string[];
  @state opened = false
  @state __plusCount: number = 0;
  @state __r = 0

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyle, style];
  }

  /////////////////////////////////// watches
  @watch('data', { deep: true })
  watchData(nv: any, ov: any) {
    this.calcInitValue()
  }
  @watch('value')
  watchValue(nv: any, ov: any) {
    if (!isObject(nv) && nv === ov) return;
    if (!this.selectPanel.current) {
      // 弹出面板尚未创建（firstPopup=false，从未展开过下拉）时没有 ListPicker
      // 可取 label。
      // 回退到 calcInitValue()：它直接查 this.data，不依赖面板。
      this.calcInitValue()
      return
    }

    if (this.multiple) {
      this.selectLabel = [...this.selectPanel.current.selectLabelAry]
      this.__r = Math.random()
    } else {
      this.selectLabel = this.selectPanel.current.getLabel(nv)!
    }
  }
  /**
   * 内容自然宽度：用 canvas 量出最长选项文本宽度，再加勾选图标 + 左右内距的 buffer。
   */
  @computed
  get contentWidth(): number {
    let textW = 0
    const labels = (this.data || []).map((o: any) => toString(o?.label ?? ''))
    if (labels.length) {
      const ctx = measureCtx()
      if (ctx) {
        // 用组件的真实字体测量，避免字号/字体差异导致宽度偏差
        ctx.font = getComputedStyle(this).font || '14px sans-serif'
        for (const label of labels) {
          const w = ctx.measureText(label).width
          if (w > textW) textW = w
        }
      }
    }
    // 勾选图标(约1rem) + gap + 行左右内距(2×spacing-md) + 面板内边距(buffer)
    return Math.ceil(textW) + PANEL_WIDTH_BUFFER
  }

  /**
   * 面板最终宽度 = clamp(内容宽度, minWidth, maxWidth)，取整为 px。
   * maxWidth 默认 '100%'——此时不封顶（跟随内容）；传数值或带单位字符串才封顶。
   */
  @computed
  get panelWidthCss(): string {
    // 显式指定面板宽度时直接采用，不再由内容/选择框宽度推导
    if (!isBlank(this.panelWidth)) {
      return typeof this.panelWidth === 'number' ? `${this.panelWidth}px` : this.panelWidth
    }
    let w = this.contentWidth
    const min = cssLengthToPx(this.minWidth, BASE_FONT_SIZE)
    if (min != null && w < min) w = min
    // '100%' / 空值视为不封顶；数值与带单位字符串才裁上限
    if (!isBlank(this.maxWidth) && this.maxWidth !== '100%') {
      const max = cssLengthToPx(this.maxWidth, BASE_FONT_SIZE)
      if (max != null && w > max) w = max
    }
    return `${w}px`
  }
  @computed
  get collapseValue() {
    this.__r;
    if (this.collapseItems > 0) {
      this.__plusCount = size(this.selectPanel.current?.selectLabelAry ?? []) - this.collapseItems
      return slice(this.selectPanel.current?.selectLabelAry ?? [], 0, this.collapseItems)
    }
    return this.selectPanel.current?.selectLabelAry ?? []
  }

  /**
   * 覆盖 AppearanceElem 的尺寸同步：minWidth / maxWidth / maxHeight 在本组件里是
   * **面板尺寸**，只能作用于弹出列表，不能写到宿主样式上——否则会把选择框本身撑宽/限高，
   * 面板看起来就像“和选择框对齐”了。选择框尺寸请直接在 ce-select 上设置样式。
   */
  __watchWidth(nv: any, _ov: any, sourceName: string) {
    if (sourceName === 'minWidth' || sourceName === 'maxWidth' || sourceName === 'maxHeight') return
    this.style.setProperty(kebabCase(sourceName), isNumeric(nv) ? `${nv}px` : nv)
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  mounted(): void {
    //init
    setTimeout(() => {
      if (!isEmpty(this.value) && isEmpty(this.selectLabel)) {
        // this.watchValue(this.value, undefined)
        this.calcInitValue()
      }
    }, 0);
    // 兜底设置 default 渲染钩子：compelem `slot()` 指令在多实例场景下,
    // 只有第一个 ce-input-tag 能拿到钩子（详见 .workbuddy/memory）。
    // 此处直接挂到 input.slotHooks.default 并 forceUpdate,
    // 保证每个 Select 实例的显示渲染可靠（单选=纯文本, 多选=ce-tag）
    if (this.input && !this.input.slotHooks['default']) {
      this.input.slotHooks['default'] = (v: string, _i: number, onClose: () => void) => {
        if (this.multiple) {
          // 多选：以 <ce-tag> 芯片形式呈现选中项（保留 tag 样式）。
          // 此前非 tags 多选直接返回纯文本导致“选中 tag 样式丢失/塌缩”。
          return h`<ce-tag ?closable="${this.tags}" @close="${onClose}">${v}</ce-tag>`
        }
        return h`${v}`
      }
      this.input.forceUpdate()
    }
  }
  slotChange(slot: HTMLSlotElement, name: string): void {
    let els = slot.assignedElements({ flatten: true });

    if (els.length > 0 && this.selectPanel.current) {
      this.selectPanel.current!.innerHTML = ''
      this.selectPanel.current?.append(...els)
    }

    this.calcInitValue()
  }
  calcInitValue() {
    //计算初值
    if (isEmpty(this.value)) return;

    if (this.multiple) {
      // value 是数组（多选）,按 data 或 slots.default 收集对应的 label 列表
      const values = (Array.isArray(this.value) ? this.value : [this.value]) as string[];
      const labels: string[] = [];
      if (!isEmpty(this.data)) {
        each(this.data, (item: any) => {
          if (values.includes(item.value)) labels.push(item.label ?? String(item.value))
        })
      } else if (!isEmpty(this.slots.default)) {
        each(this.slots.default, (el: Element) => {
          const v = el.getAttribute('value');
          if (v != null && values.includes(v)) labels.push(el.textContent ?? '')
        })
      }
      this.selectLabel = labels
      return
    }

    // 单选:保留原逻辑
    if (!isEmpty(this.data)) {
      each(this.data, (item: any) => {
        if (item.value == this.value) {
          this.selectLabel = item.label ?? ''
          return false
        }
      })
    } else if (!isEmpty(this.slots.default)) {
      each(this.slots.default, (el: Element) => {
        if (el.getAttribute('value') == this.value) {
          this.selectLabel = el.textContent ?? ''
          return false
        }
      })
    }
  }
  // 自定义 tag 钩子是使用者经 slot() 传入的**编译子模板**（DOM 结构挂在「写回调那个类」的
  // __ce_static__.subViews 上），只能在 JS 里用 getSubViewNodes 取、不能在模板里直接调用；
  // 取回的节点需要序列化成字符串才能经 html() 指令插进模板，故走 customTagHTML()。
  /**
   * combobox 语义要落到**最内层原生 input**（ce-select → ce-input-tag → ce-input → input）：
   * 自定义元素宿主上的 aria-* 读屏不会当成输入框属性。这里只负责产出，
   * 由 bind 逐层透传，各层的 prop 声明统一在 base/AriaElem.ts。
   *
   * 类型只能是 any：本 getter 会被编译器内联进模板插值，prelude 里任何
   * 类型标识符都会撞 D3 自由标识符检查（同 Menu.ts 的 aria 对象）。
   */
  get __comboboxAria(): any {
    return {
      role: 'combobox',
      'aria-haspopup': 'listbox',
      'aria-expanded': String(this.opened),
      'aria-label': this.label || null,
      'aria-disabled': String(!!this.disabled),
      'aria-required': String(!!this.required),
      'aria-invalid': String(!!this.error),
      'aria-autocomplete': this.filterable ? 'list' : null,
    }
  }
  @state firstPopup = false
  render(): Template {
    // 0.30 要求 render() 只有一个主视图 h`` 模板，根级三元会触发 "2 个主视图模板" 阻断
    return h`${ifElse(
      this.plaintext,
      () => h`${this.value}`,
      () => h`
      <div
        class="ce-form-select"
        ${classes({
      "is-disabled": this.disabled
    })}
      >
        <ce-input-tag
          inside
          readonly
          align="${this.align}"
          ?active="${this.opened}"
          style="user-select: none;"
          ?hide-input="${!this.multiple}"
          ?clearable="${this.clearable}"
          ?disabled="${this.disabled || this.loading}"
          .max-collapse-tags="${this.collapseItems}"
          .value="${isBlank(this.selectLabel) ? [] : isArray(this.selectLabel) ? this.selectLabel : [this.selectLabel]}"
          .required="${this.required}"
          .error="${this.error}"
          .error-message="${this.errorMessage}"
          .hint="${this.hint}"
          .hide-hint="${this.hideHint}"
          ${bind(this.__comboboxAria)}
          @mousedown="${this.onMouseDown}"
          @clear="${this.onClear}"
          @close="${this.onTagClose}"
          ${bind(({
      appearance: this.appearance,
      color: this.color,
      size: this.size,
      round: this.round,
      loading: this.loading,
      label: this.label
    }))}
        >
          ${slot((v, i, onClose) => h`${ifElse(
            !!this.slotHooks.tag && this.tags,
            () => h`${html(this.customTagHTML(v))}`,
            () => h`${ifElse(
              !!this.tags,
              () => h`<ce-tag closable @close="${onClose}">${v}</ce-tag>`,
              () => h`${v}`
            )}`
          )}`)}
          ${ifElse(this.loading, () => h`
            <ce-progress-circular
              slot="append"
              class="ce-form-select-caret"
              r="9"
              width="3"
              indeterminate="true"
              @mousedown.stop
            >
            </ce-progress-circular>
          `, () => h`
            <ce-icon
              size="${this.size}"
              class="ce-form-select-caret"
              slot="append"
              .svg="${ChevronDown}"
              @mousedown.stop="${this.onClickIcon}"
              ${show(!this.clearable || (!this.value))}
            >
            </ce-icon>
          `)}
        </ce-input-tag>
        <ce-overlay
          close-on-click
          backdrop="false"
          placement="bottom-start"
          open-delay="100"
          .follow="${this.follow}"
          @closed="${this.onClosed}"
          @beforeopen="${this.onBeforeopen}"
          @beforeclose="${this.onBeforeClose}"
          ${model(this.opened, 'visible')}
        >
          <div>
            ${ifTrue(this.firstPopup, () => h`
              <ce-list-picker
                shadowed
                ref="${this.selectPanel}"
                ?multiple="${this.multiple}"
                ?readonly="${this.readonly}"
                .height="${this.popHeight}"
                .rowHeight="${this.optionRowHeight}"
                .data="${this.data}"
                .filterable="${this.filterable}"
                .value="${this.multiple ? (isArray(this.value) ? this.value : []) : this.value}"
                @clickoption="${this.onClickOption}"
                @change="${this.onSelectChange}"
                @ready="${this.onReady}"
                ${styles({ width: this.panelWidthCss, maxWidth: this.maxWidth, maxHeight: this.maxHeight, '--ce-list-picker-min-width': this.panelWidthCss })}
              >
                ${slot((data) => h`${ifElse(
                  !!this.slotHooks.option,
                  () => h`${html(this.customOptionHTML(data))}`,
                  () => h`${data.label}`
                )}`, 'option')}
              </ce-list-picker>
            `)}
          </div>
        </ce-overlay>
        <slot style="display:none"></slot>
      </div>
    `)}`;
  }
  /**
   * 渲染使用者传入的自定义 tag 钩子。
   * 回调的 DOM 已由编译器前移到**写回调那个组件类**的 subViews，所以只能经
   * `getSubViewNodes`（一次性快照，不注册 effect）在 JS 里取节点；取回后需要变成
   * 字符串才能经 `html()` 指令插进模板，故用 `nodesToHTML` 序列化。
   * 代价：序列化会丢掉钩子内部的事件绑定（仅显示型插槽适用）。
   */
  /**
   * 承载自定义下拉项的行高。自定义项常是两行内容（标题 + 副标题，约 32px），
   * 默认 32px 行高会让文字顶到行盒上下边界（实测文字略微溢出、无留白）。
   * 有 option 钩子时提到 44px：内容在 ce-list-item 的 grid 里垂直居中，
   * 上下自然各留约 6px；无钩子时保持 32px，不影响常规单行选项的紧凑观感。
   * 行高仍为固定值，不破坏 list-picker 虚拟化按 rowHeight 定位的前提。
   */
  get optionRowHeight(): number {
    return this.slotHooks?.option ? 44 : 32
  }
  /** 同理：使用者传入的自定义下拉项钩子 */
  customOptionHTML(data: any): string {
    const fn = this.slotHooks.option
    if (!fn) return ""
    return nodesToHTML(this.getSubViewNodes(fn, data))
  }

  customTagHTML(v: any): string {
    const fn = this.slotHooks.tag
    if (!fn) return ""
    return nodesToHTML(this.getSubViewNodes(fn, find(this.data, d => d.label == v) ?? {}))
  }

  //////////////////////////////////// methods
  onBeforeopen() {
    this.selectPanel.current?.resetVirtualized()
  }
  onBeforeClose(obj: Record<string, any>) {
    let { event, cancel } = obj
    if (!event) return
    let targetElAry = event.composedPath()
    if (find(targetElAry, (el: Element) => el instanceof Node && this.input.contains(el))) cancel()
  }
  onClosed() {
    this.emit('close')
  }
  onClear() {
    this.selectPanel.current?.clear()
    let v = this.value;
    this.selectLabel = this.value = '';
    if (v !== this.value)
      this.emit('change', { label: '', value: '' })
    this.opened = false

    this.nextTick(() => {
      this.selectPanel.current?.refreshView()
    })
  }
  __showList() {
    if (this.loading || this.disabled) return;
    this.list && this.list.openBy(this.input)
  }
  __hideList() {
    this.opened = false
    // 下拉经 this.list.openBy() 命令式打开，opened 从未被置真，
    // 故 this.opened=false 是 no-op、model 不会把 overlay 的 visible 写成 false。
    // 必须命令式关闭 overlay，否则单选选中/清除后弹层关不掉。
    this.list?.close()
  }
  onMouseDown(e: Event) {
    // 禁用/加载中态:屏蔽点击展开下拉
    if (this.disabled || this.loading) return;
    // 只响应左键：右键（button=2）紧接着会弹浏览器上下文菜单，此时还把下拉打开
    // 会出现"右键菜单和下拉面板同时出现"的错乱；中键同理。触摸/笔事件 button 为 0。
    if ((e as MouseEvent).button !== 0) return;
    // 置为已打开：模板把它映射成 input-tag 的 active 属性，外观层（下划线 / 边框
    // 变主色）靠这个状态，不能只靠 focus —— hide-input 模式下内部 input 是
    // display:none，点开下拉不会产生 focus。
    // 不会和 openBy 打架：overlay 的 visible watcher 在 openTimer 存在时直接返回。
    this.opened = true;
    // this.opened = true
    if (!this.firstPopup) {
      this.firstPopup = true
      this.nextTick(() => {
        this.selectPanel.current!.innerHTML = ''
        if (!isEmpty(this.data)) {
        } else if (!isEmpty(this.slots.default))
          this.selectPanel.current?.append(...this.slots.default)

        // this.selectPanel.current?.resetVirtualized()
        this.list.openBy(this.input)
      })
      return
    }
    this.list.openBy(this.input)
  }
  onFocus(e: Event) {
    if (this.disabled || this.loading) return;
    this.__showList();
  }
  onBlur(e: Event) {
    let t = e.target;
  }
  onSelectChange(obj: Record<string, any>) {
    let { label, value } = obj

    let ov = this.value;
    if (this.value != value) this.value = value!

    //multiple 时 label 为数组，保留数组结构供 input-tag 逐项渲染
    if (this.multiple) {
      this.selectLabel = isBlank(label) ? [] : (isArray(label) ? label as string[] : [toString(label)])
    } else {
      this.selectLabel = toString(label) || ''
    }

    if (value !== ov) {
      if (!isArray(value)) {
        setTimeout(() => {
          this.__hideList();
        }, 200);
      }
      this.emit('change', { label, value })
    }

  }
  onClickOption() {
    if (this.multiple) {
      return;
    }
    setTimeout(() => {
      this.__hideList();
    }, 200);
  }
  /**
   * 多选+tags 时，点击输入框内 tag 的 × 关闭标签。
   * InputTag.onClose 只改自己内部的 __innerValue 并 emit('close')，
   * 若不在侧同步，selectLabel/value/ListPicker/ce-list.selection 全部保持旧值，
   * 下拉勾选态失真（被移除项仍打勾）。此处移除对应 label/value 并经
   * updateProps 下发 ListPicker → model(selectedValue,'select') →
   * ce-list._resetSelectItem 数组分支重建 selection，勾选态随之同步。
   */
  onTagClose(obj: Record<string, any> | string) {
    if (this.disabled || this.loading) return;
    const closedLabel = isString(obj) ? obj : get(obj, 'value') as string;
    if (isBlank(closedLabel)) return;
    const cur: string[] = (isBlank(this.selectLabel) ? [] : isArray(this.selectLabel) ? this.selectLabel : [this.selectLabel]) as string[];
    const labels = cur.filter(l => l !== closedLabel);
    // label -> value 映射：data 优先，回落 ListPicker.renderData（覆盖 slot 用法）
    const lp = this.selectPanel.current;
    const data: any[] = !isEmpty(this.data) ? this.data
      : (lp ? (isArray(lp.renderData) ? lp.renderData : concat(...values(lp.groupData))) : []);
    const newValue = map(labels, (l: string) => {
      const hit = find(data, (d: any) => d.label == l);
      return hit ? hit.value : l;
    }) as any[];
    this.selectLabel = labels as any;
    if (toString(newValue) !== toString(this.value)) {
      this.value = newValue as any;
      this.emit('change', { label: labels, value: newValue })
    }
    if (lp) {
      lp.updateProps({ value: newValue as any })
      this.nextTick(() => {
        lp.refreshView()
      })
    }
  }
  onClickIcon() {
    if (this.disabled || this.loading) return;
    if (!!this.selectLabel && this.clearable) {
      this.onClear()
    } else {
      this.input.focus()
    }
  }
  onReady() {
    this.list.openBy(this.input)
    // this.opened = true
  }
  clear(): void {
    this.onClear()
  }
  setData(data: Array<Record<string, any>>) {
    this.updateProps({ data })
  }
}