import { classes, CompElem, computed, forEach, html, ifElse, ifTrue, prop, query, show, state, tag, Template, watch } from "compelem";
import CRUD from "cruda";
import { append, cloneDeep, compact, concat, each, filter, find, first, flatMap, get, isArray, isBlank, isEmpty, isEqual, isObject, isUndefined, map, pull, some, test, values } from "myfx";
import { CrudData } from "../../../cruda/types";
import { ripples } from "../../../directives/ripples/Ripples";
import { Check, Question } from "../../../icons/icons";
import { showError } from "../../../utils";
import { Input } from "../../form/input/Input";
import style from "./style.scss";

/**
 * 选择框面板
 * 支持slot/data方式定义数据
 * optgroup标签分组开启后，非分组标签会忽略
 * 如果data/groupData属性
 * @props
 *  data {array|object} 列表数组，格式[{value,label,selected}]。如果值类型为对象表示分组数据，格式 {groupLabel: [{value,label,selected}]}
 *  multiple {boolean} 是否可多选，默认false
 *  limit {number} 多选时允许的最大项，小于1表示不限制。默认0
 *  clearable {boolean} 是否可清除，默认 true
 *  filterable {boolean} 是否可过滤，默认 true
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
 *  value model属性，受控。单选时字符串，多选时数组
 * @events
 *  change({label,value}) 选中变更时触发
 *  clickoption({label,value}) 点击某个选项时触发
 *  load(rs) 通过crudData加载数据成功时触发
 * @slots
 *  default 内部可使用option/optgroup标签自定义内容样式
 *
 * @author holyhigh2
 */
@tag("l-select-panel")
export class SelectPanel extends CompElem {
  __formatter: Function;
  //////////////////////////////////// props
  @prop clearable = true;
  @prop multiple = false;
  @prop filterable = true;
  @prop readonly = false;
  @prop limit = 0;
  @prop({
    type: [String, Array], sync: true, isValid(value: any, props: Record<string, any>) {
      if (isUndefined(props.multiple)) return true;
      return props.multiple ? isArray(value) : true;
    }
  }) value: string | Array<string>;
  //单项列表/分组列表数据
  @prop({ type: [Array, Object] }) data: Record<string, any>[] | Record<string, Record<string, any>[]> = [];

  //crud
  @prop({ type: String }) crud: string;
  @prop({ type: Object }) crudData: CrudData;
  //crud实例，通过lookup查询上级组件
  $crud: CRUD

  //已选中标签
  @state selectLabelAry: Array<string> = [];
  @state private __filterValue = '';
  @state private groupData: Record<string, any[]> = {}

  static get styles(): string[] {
    return [style];
  }

  @query('slot')
  slotEl: HTMLSlotElement;

  //////////////////////////////////// computed
  //实际渲染列表
  @computed
  get filteredData() {
    let fv = this.__filterValue;
    if (!isEmpty(this.groupData)) {
      let rs: typeof this.groupData = {}
      each(this.groupData, (gd, k: string) => {
        let filtered = filter(gd, item => test(item.label, fv, 'i'))
        if (!isEmpty(filtered)) {
          rs[k] = filtered;
        }
      })
      return rs;
    }
    return filter(this.data, item => test(item.label, fv, 'i'))
  }
  /////////////////////////////////// watches

  @watch('crudData', { immediate: true })
  watchCrudData(nv: Record<string, any>) {
    if (!nv) return;

    this.requestUrl();
  }
  @watch('data')
  watchData(nv: Record<string, any>[] | Record<string, Record<string, any>[]>) {
    if (isObject(nv) && !isArray(nv)) {
      this.groupData = cloneDeep(nv);
    }
  }
  @watch('value')
  watchValue(nv: any, ov: any) {
    if (nv === ov) return;

    let data = isArray(this.data) ? this.data : concat(...values(this.groupData));
    if (isArray(nv)) {
      this.selectLabelAry = compact(flatMap(data, d => nv.includes(d.value) ? d.label : []));
    } else {
      let s = find(data, d => d.value === nv)
      if (get<string>(s, 'label', '') != get<string>(this.selectLabelAry, 0, ''))
        this.selectLabelAry = s ? compact([s.label]) : [];
    }
  }
  @watch('selectLabelAry')
  watchChange(nv: any, ov: any) {
    if (isEmpty(nv) && isEmpty(ov)) return;

    let label = this.multiple ? this.selectLabelAry : this.selectLabelAry[0];
    let data = isArray(this.data) ? this.data : concat(...values(this.groupData));
    let value = this.multiple ? map(this.selectLabelAry, l => find(data, { label: l }).value) : get(find(data, { label: this.selectLabelAry[0] }), 'value', '');
    if (!isEqual(nv, ov))
      this.emit('change', { label, value })
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return html`
    <div class="c-select-panel">
      <l-input ${show(this.filterable)} ?readonly="${this.readonly}" inside clearable unhoverable @mousedown="${this.onFilterClick}" @mouseenter="${this.onFilterEnter}" @input="${this.onFilterInput}" @clear="${this.onFilterClear}">
        <l-icon class="--caret" slot="trailing" .svg="${Question}" ></l-icon>
      </l-input>
      ${ifTrue(isEmpty(this.filteredData), () => html`<div class="--select-item --empty" unhoverable style="display:block;cursor:auto" @mousedown.stop>无可选项</div>`)}
      ${ifElse(isEmpty(this.groupData), () => this._renderList(), () => this._renderGroup())}
    </div>
    <slot style="display:none" @slotchange.stop.debounce="${this.onSlotChange}"></slot>
    `;
  }
  _renderList() {
    if (!isArray(this.filteredData)) return html``
    return html`
      <l-list size="sm" hover divider="false" >
      ${forEach((this.filteredData), (li: any) => html`
        <div ${ripples({ disabled: li.disabled })} class="--select-item ${classes({ active: this.selectLabelAry.includes(li.label), __disabled: li.disabled })}" ?unhoverable="${li.disabled}" index="${li.label}" key="${li.label}" data-value="${li.value}" data-label="${li.label}" @mousedown.left="${this.selectData}">
          <span class="--check-icon">
            ${ifElse(this.multiple,
      () => html`<l-checkbox .checked="${this.selectLabelAry.includes(li.label)}"></l-checkbox>`,
      () => html`<l-icon .svg="${Check}" ${show(this.selectLabelAry.includes(li.label))}></l-icon>`
    )}
          </span>
          <span class="--label">${li.label}</span>
        </div>
      `)}
      </l-list>
    `
  }
  _renderGroup() {
    return html`
      ${forEach((this.filteredData), (gd, k: string) => html`
        <l-panel .header="${k}" shadow="never" key="${k}" style="--padding:0.5rem">
          <l-list size="sm" hover divider="false" >
          ${forEach(gd, (li: any) => html`
            <div ${ripples({ disabled: li.disabled })} class="--select-item ${classes({ active: this.selectLabelAry.includes(li.label), __disabled: li.disabled })}" ?unhoverable="${li.disabled}" index="${li.label}" key="${li.label}" data-value="${li.value}" data-label="${li.label}" @mousedown.left="${this.selectData}">
            <span class="--check-icon">
                ${ifElse(this.multiple,
      () => html`<l-checkbox .checked="${this.selectLabelAry.includes(li.label)}"></l-checkbox>`,
      () => html`<l-icon .svg="${Check}" ${show(this.selectLabelAry.includes(li.label))}></l-icon>`
    )}
              </span>
              <span class="--label">${this.__formatter ? this.__formatter(li) : li.label}</span>
            </div>
          `)}
          </l-list>
        </l-panel>
      `)}
    `
  }

  //////////////////////////////////// methods
  setFormatter(formatter: Function) {
    this.__formatter = formatter
  }
  selectData(e: MouseEvent) {
    if (this.readonly) return;

    let t = e.target as HTMLElement;
    if (t.classList.contains('__disabled')) return;

    let value = t.dataset.value;
    let label = t.dataset.label;

    this.emit('clickoption', { label, value })

    if (this.multiple) {
      if (this.selectLabelAry.includes(label!)) {
        pull(this.selectLabelAry, label!);
        pull(this.value as Array<string>, value!);
      } else {
        this.selectLabelAry.push(label!);
        append(this.value as Array<string>, value)
      }

    } else {
      if (this.selectLabelAry.includes(label!)) return;
      this.selectLabelAry = [label!]
      this.value = value!
    }

  }
  onFilterClick(e: Event) {
    // e.stopPropagation();
  }
  onFilterEnter(e: Event) {
    let t = e.target as Input
    t.focus()
  }
  onFilterInput(e: CustomEvent) {
    let value = e.detail.value;
    this.__filterValue = value;
  }
  onFilterClear(e: CustomEvent) {
    let value = e.detail.value;
    this.__filterValue = value;
  }
  onBlur(e: Event) {
    let t = e.target;
  }
  onSlotChange(e: Event) {
    if (this.crudData) return;

    this.__updateDataList(this.slotEl)
  }
  __getFilteredData(data: any[], filterValue: string) {
    return filter(data, item => test(item.label, filterValue, 'i'))
  }
  __updateDataList(slotEl: HTMLSlotElement) {
    if (!isEmpty(this.data)) return;

    let data: any[] = []
    let dataGroup: typeof this.groupData = {}
    let els = slotEl.assignedElements({ flatten: true })

    let selectLabelAry: typeof this.selectLabelAry = []
    if (some(els, el => el.tagName == 'OPTGROUP')) {
      each(filter(els, el => el.tagName == 'OPTGROUP'), (opg: HTMLOptGroupElement) => {
        let opts = filter<HTMLElement>(opg.children, el => el.tagName == 'OPTION')
        dataGroup[opg.label] = map(opts, op => {
          let d = { label: op.label, value: op.value, selected: !!op.selected, disabled: !!op.disabled }
          if (d.selected && d.label) {
            selectLabelAry.push(d.label)
          }
          return d
        })
      })

      this.data = dataGroup
    } else {
      each(filter(els, el => el.tagName == 'OPTION'), (op: HTMLOptionElement) => {
        let d = { label: op.label, value: op.value, selected: !!op.selected, disabled: !!op.disabled }
        data.push(d)
        if (d.selected && d.label) {
          selectLabelAry.push(d.label)
        }
      })
      this.data = data;
    }

    if (!isEmpty(this.value)) {
      if (isEmpty(this.selectLabelAry)) {
        if (isArray(this.value)) {
          selectLabelAry = compact(flatMap<any, string>(this.data, d => this.value.includes(d.value) ? d.label : []));
        } else {
          let s = find(this.data, d => d.value === this.value)
          selectLabelAry = s ? compact([s.label]) : [];
        }
      } else {
        return;
      }

    }
    //仅初始化时设置
    if (this.multiple) {
      this.selectLabelAry = selectLabelAry
    } else {
      this.selectLabelAry = isEmpty(selectLabelAry) ? [] : [first(selectLabelAry)]
    }
  }
  getLabel(value: string) {
    let data = this.data || concat(...values(this.groupData));
    return get<string>(find(data, { value: value }), 'label', '');
  }

  /////////////////////////////////////////////////////// crud
  requestUrl() {
    if (!this.crudData.url) {
      showError(this.tagName, `无效${this.crudData}参数`, this)
      return;
    }
    const that = this;
    let invalidUrlVar = false;
    let invalidUrlVarName = '';
    const watchVar = this.crudData.watchVar || false;
    const listField = this.crudData.listField;
    const labelField = this.crudData.labelField || "label";
    const valueField = this.crudData.valueField || "value";

    //1. 拼接url
    const url = this.crudData.url.replace(/\{([^}]+)\}/gm, (a, varName) => {
      if (!watchVar) return;
      let parentComp = this.$crud.getContext()
      let v = parentComp[varName]
      //检测变量值
      if (isBlank(v)) {
        invalidUrlVar = true
        invalidUrlVarName = varName
      }

      return v;
    });
    if (invalidUrlVar) {
      showError(this.tagName, "无效url变量值 '" + invalidUrlVarName + "'")
      return;
    }
    //2. 请求地址
    CRUD.request({
      url: url,
      method: "get",
    })
      .then((rs: Record<string, any>) => {
        let list = listField ? get(rs, listField) : rs;

        const formattedList = map(list as any, (v) => {
          v.label = v[labelField];
          v.value = v[valueField];
          return v;
        });
        that.data = formattedList
        that.emit("load", rs);
      })
      .catch((e: Error) => {
        showError(this.tagName, "Fetch options error with api " + this.crudData.url, e);
      });
  }
}