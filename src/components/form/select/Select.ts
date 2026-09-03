import { bind, classes, computed, createRef, csscope, Csscope, emits, h, ifElse, ifTrue, model, prop, query, QueryCache, show, slot, state, styles, tag, Template, watch } from "compelem";
import { each, find, isArray, isBlank, isEmpty, isObject, size, slice, toString } from "myfx";
import { ControlBox } from "../../../base/ControlBox";
import { ChevronDown } from "../../../icons/icons";
import { Overlay } from "../../overlays/overlay/Overlay";
import { ListPicker } from "../../picker/listpicker/ListPicker";
import { InputTag } from "../input/InputTag";
import formStyle from "../style.scss?tmpl";
import style from "./style.scss?tmpl";
/**
 * 下拉选择框，支持多选（仅逗号分隔）
 * @props
 *  data {array|object} 列表数组，格式[{value,label,selected}]。如果值类型为对象表示分组数据，格式 {groupLabel: [{value,label,selected}]}
 *  multiple {boolean} 是否可多选，默认false
 *  tags {boolean} 是否以标签形式显示，默认false
 *  limit {number} 多选时允许的最大项，小于1表示不限制。默认0
 *  clearable {boolean} 是否可清除，默认 false
 *  filterable {boolean} 是否可过滤，默认 false
 *  maxHeight {number} 弹出列表最大显示高度，超过会显示滚动条，默认30vh
 *  maxWidth {number} 弹出列表最大显示宽度，默认100%
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
  @prop({ type: Array, shallow: true }) data: Array<Record<string, any>> = [];
  @prop clearable = false;
  @prop tags = false;
  @prop multiple = false;
  @prop filterable = false;
  @prop loading = false;
  @prop maxHeight = '30vh';
  @prop maxWidth = '100%';
  @prop({ type: Number }) popHeight: number;
  @prop limit = 0;
  @prop({
    type: [String, Array, Number], model: true, hasChanged(nv, ov) {
      return toString(nv) !== toString(ov)
    }
  }) value = '';
  @prop collapseItems = 0

  @state selectLabel: string | string[];
  @state opened = false
  @state minW = 0
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
    if (!this.selectPanel.current) return

    if (this.multiple) {
      this.selectLabel = [...this.selectPanel.current.selectLabelAry]
      this.__r = Math.random()
    } else {
      this.selectLabel = this.selectPanel.current.getLabel(nv)!
    }
  }
  /////////////////////////////////// computed
  @computed
  get collapseValue() {
    this.__r;
    if (this.collapseItems > 0) {
      this.__plusCount = size(this.selectPanel.current?.selectLabelAry ?? []) - this.collapseItems
      return slice(this.selectPanel.current?.selectLabelAry ?? [], 0, this.collapseItems)
    }
    return this.selectPanel.current?.selectLabelAry ?? []
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  mounted(): void {
    this.minW = this.offsetWidth
    //init
    setTimeout(() => {
      if (!isEmpty(this.value) && isEmpty(this.selectLabel)) {
        // this.watchValue(this.value, undefined)
        this.calcInitValue()
      }
    }, 0);
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
    // if (this.firstPopup) return
    //计算初值
    if (this.value) {
      if (!isEmpty(this.data)) {
        each(this.data, item => {
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
  }
  @state firstPopup = false
  render(): Template {
    return this.plaintext ? h`${this.value}` : h`
      <div
        class="ce-form-select"
        @resize.debounce="${this.onResize}"
        ${classes({
      "is-disabled": this.disabled
    })}
      >
        <ce-input-tag
          inside
          readonly
          active="${this.opened}"
          style="user-select: none;"
          ?clearable="${this.clearable}"
          ?disabled="${this.disabled || this.loading}"
          .max-collapse-tags="${this.collapseItems}"
          .value="${isBlank(this.selectLabel) ? [] : isArray(this.selectLabel) ? this.selectLabel : [this.selectLabel]}"
          .required="${this.required}"
          .error="${this.error}"
          .error-message="${this.errorMessage}"
          .hint="${this.hint}"
          .hide-hint="${this.hideHint}"
          @mousedown="${this.onMouseDown}"
          @clear="${this.onClear}"
          ${bind(({
      appearance: this.appearance,
      color: this.color,
      size: this.size,
      round: this.round,
      loading: this.loading,
      label: this.label
    }))}
        >
          ${slot((v, i, onClose) => this.tags ? (this.slotHooks.tag ? this.slotHooks.tag(find(this.data, d => d.label == v) ?? {}) : h`<ce-tag appearance="flat" closable @close="${onClose}">${v}</ce-tag>`) : h`${v}`)}
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
          style="width:100%"
          close-on-click
          backdrop="false"
          placement="bottom-start"
          open-delay="100"
          .min-width="${this.minW}"
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
                .data="${this.data}"
                .filterable="${this.filterable}"
                .value="${this.multiple ? (isArray(this.value) ? this.value : []) : this.value}"
                @clickoption="${this.onClickOption}"
                @change="${this.onSelectChange}"
                @ready="${this.onReady}"
                ${styles({ maxWidth: this.maxWidth, width: '100%', maxHeight: '30vh' })}
              >
                ${slot((data) => this.slotHooks.option ? this.slotHooks.option(data) : h`${data.label}`, 'option')}
              </ce-list-picker>
            `)}
          </div>
        </ce-overlay>
        <slot style="display:none"></slot>
      </div>
    `;
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
    if (this.loading) return;
    this.list && this.list.openBy(this.input)
  }
  __hideList() {
    this.opened = false
  }
  onMouseDown(e: Event) {
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
  onClickIcon() {
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
  onResize() {
    if (this.opened)
      this.minW = this.offsetWidth
  }
  clear(): void {
    this.onClear()
  }
  setData(data: Array<Record<string, any>>) {
    this.updateProps({ data })
  }
}