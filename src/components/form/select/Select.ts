import { bind, classes, html, ifElse, prop, query, QueryCache, state, tag, Template, watch } from "compelem";
import { cloneDeep, isArray, isEmpty, isEqual, merge } from "myfx";
import { ChevronDown, Close } from "../../../icons/icons";
import { SelectPanel } from "../../dataentry/selectpanel/SelectPanel";
import { Popup } from "../../overlays/popup/Popup";
import { FormControl } from "../FormControl";
import { Input } from "../input/Input";
import formStyle from "../style.scss";
import style from "./style.scss";
/**
 * 下拉选择框
 * @props
 *  data {array|object} 列表数组，格式[{value,label,selected}]。如果值类型为对象表示分组数据，格式 {groupLabel: [{value,label,selected}]}
 *  multiple {boolean} 是否可多选，默认false
 *  limit {number} 多选时允许的最大项，小于1表示不限制。默认0
 *  clearable {boolean} 是否可清除，默认 true
 *  filterable {boolean} 是否可过滤，默认 true
 *  maxHeight {number} 弹出列表的最大高度，默认320
 *  loading {boolean} 显示加载状态
 *  crud {string} 多实例时crud标识
 *  crudData {object} 可定义api地址自动查询，格式如下
 *  {
 *    url:'', //API服务地址，GET请求。支持url变量如：/a/b/{form.xx}
 *    listField:'', //用于指定返回结果的列表字段名，支持链式如'data.list'。如果为空，则直接使用返回结果作为列表。
 *    labelField:'label', //label字段名，默认label
 *    valueField:'value', //value字段名，默认value
 *    watchVar:false //监控url变量，默认false。如果开启，当url变量发生变更时，自动重新发起get请求
 *    filter: (list,rs,callback) {Function|string} 对检索结果进行过滤，可以是函数或函数字符串，必须调用callback函数传递过滤后的list
 *  }
 *  
 *  value {string} model属性，受控
 * @events
 *  change({label,value})
 * @slots
 *  default 内部可使用option标签自定义内容样式，启用slot会
 *
 * @author holyhigh2
 */
@tag("l-select")
export class Select extends FormControl {

  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  @query('l-input', QueryCache.ONCE)
  input: Input
  @query('l-popup', QueryCache.ONCE)
  list: Popup;

  @query('.c-form-select slot')
  slotEl: HTMLSlotElement;
  @query('l-select-panel')
  selectPanel: SelectPanel
  //////////////////////////////////// props
  @prop({ type: [Array, Object, String] }) data = [];
  @prop clearable = true;
  @prop multiple = false;
  @prop filterable = true;
  @prop loading = false;
  @prop maxHeight = 320;
  @prop limit = 0;
  @prop({ type: String, sync: true }) value = '';

  //crud
  @prop({ type: String }) crud: string;
  @prop({ type: Object }) crudData: Object;

  @state selectLabel: string;

  static get styles(): string[] {
    return [formStyle, style];
  }

  /////////////////////////////////// watches
  @watch('data')
  watchData(nv: any, ov: any) {
    if (nv !== ov)
      this.selectLabel = this.selectPanel.getLabel(nv)
  }
  @watch('value', {})
  watchValue(nv: any, ov: any) {
    if (nv !== ov)
      this.selectLabel = this.selectPanel.getLabel(nv)
  }
  _crudData: object
  @watch('crudData', { immediate: true })
  watchCrudData(nv: any, ov: any) {
    if (isEmpty(nv)) return;
    if (isEqual(this._crudData, nv)) return;
    if (!this._crudData) this._crudData = cloneDeep(nv)
    if (nv.url) this.loading = true;
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
    const that = this;
    document.addEventListener('mousedown', (e) => {
      if (that.list.style.display !== 'block' || that.dontClose) return;

      if (that.closeTimer) {
        clearTimeout(that.closeTimer)
      }
      that.closeTimer = setTimeout(() => {
        that.__hideList();
        that.closeTimer = null;
      }, 10);
    })

  }

  mounted(): void {
  }

  render(): Template {

    return this.plaintext ? html`${this.value}` : html`<div class="c-form-select ${classes({
      __disabled: this.disabled
    })}">
      <l-input inside readonly ?disabled="${this.disabled || this.loading}" .value="${this.selectLabel}" ${bind(merge({
      appearance: this.appearance,
      color: this.color,
      size: this.size,
      round: this.round,
      loading: this.loading,
      label: this.label
    }, this.attrs))} @mousedown="${this.onMouseDown}" @focus="${this.onFocus}" @blur="${this.onBlur}" @update:value.stop  style="cursor:pointer;user-select: none;">
        ${ifElse(this.loading, () => html`
          <l-progress-circular slot="trailing" class="--caret" r="9" width="3" indeterminate="true"></l-progress-circular>  
        `, () => html`
          <l-icon @mousedown.stop="${this.onClickIcon}" class="--caret ${classes({ 'c-btn-close': !!this.selectLabel && this.clearable })}" slot="trailing" .svg="${(!!this.selectLabel && this.clearable) ? Close : ChevronDown}"></l-icon>
        `)}
      </l-input>
      <l-popup @mousedown.stop>
        <l-select-panel .crud="${this.crud}" .crud-data="${this.crudData}" @load="${this.onLoad}" .filterable="${this.filterable}" .value="${(this.value)}" @clickoption="${this.onClickOption}" @change="${this.onSelectChange}" ?multiple="${this.multiple}" ?readonly="${this.readonly}">
          <slot></slot>
        </l-select-panel>
      </l-popup>
      </div>
    `;
  }
  //////////////////////////////////// methods
  onClear() {
    let v = this.value;
    this.selectLabel = this.value = '';
    if (v !== this.value)
      this.emit('change', { label: '', value: '' })

    // this.input.blur()
  }
  __showList() {
    if (this.loading) return;
    this.list && this.list.open(this.input)
    // this.__opened = true;
  }
  __hideList() {
    if (this.list) this.list.style.display = 'none'
    // this.__opened = false;
  }
  onMouseDown(e: Event) {
    this.dontClose = true;
    setTimeout(() => {
      this.dontClose = false;
    }, 10);
  }
  onFocus(e: Event) {
    this.__showList();
  }
  onBlur(e: Event) {
    let t = e.target;
  }
  onSelectChange(e: CustomEvent) {
    let { label, value } = e.detail

    if (!isArray(value)) {
      setTimeout(() => {
        this.__hideList();
      }, 200);
    }

    let ov = this.value;
    if (this.value != value) this.value = value!


    this.selectLabel = label || ''

    if (value !== ov)
      this.emit('change', { label, value })
  }
  onClickOption(e: CustomEvent) {
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
  onLoad() {
    if (this.value && !this.selectLabel) {
      this.selectLabel = this.selectPanel.getLabel(this.value)
    }
    this.loading = false;
  }
}