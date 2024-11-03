import { buildHTML, CompElem, html, prop, tag, Template, watch } from "compelem";
import CRUD from "cruda";
import { clone, cloneDeep, cloneDeepWith, closest, fval, get, isBlank, map, some } from "myfx";
import { CrudData } from "../../../cruda/types";
import { showError } from "../../../utils";
import { Table } from "./Table";
import { ColumnMeta } from "./types";

/**
 * table column
 * 支持嵌套构建复杂表头
 * @attrs
 *  label {string} column name
 *  prop {string} data key
 *  width {string|number} column width 仅支持整数格式，单位px
 *  align {string} 对齐
 *  header-align {string} 头部对其
 *  resizable {boolean}
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
 * @slots
 *  -
 *  header
 *
 * @author holyhigh2
 */
@tag('l-table-column')
export class TableColumn extends CompElem {

  //////////////////////////////////// props
  @prop({ type: String, required: true }) label: string;
  @prop prop = '';
  @prop type = '';
  @prop cellClass = '';
  @prop headerClass = '';
  @prop width: string | number = '';
  @prop align = 'left';
  @prop headerAlign = 'left';
  @prop resizable = true;
  @prop sort: boolean = false;
  @prop fixed: boolean = false;
  @prop filters = false;
  /**
   * text 文本
   * currency 金额 
   * number 数字
   * time 时间
   * date 日期
   * datetime 日期时间
   */
  @prop({ type: String }) dataType: string;
  /**
   * 可选项
   */
  @prop({ type: Array }) dataSelection: Array<any>;
  /**
   * check:true 输入框内容必须符合选项中的某个值
   * multiple:false 多选
   */
  @prop({ type: Object }) dataSelectionOption = { constraint: false, multiply: false };
  @prop({ type: Object }) dataOption: Record<string, any>;

  //crud
  @prop({ type: String }) crud: string;
  @prop({ type: Object }) crudData: CrudData;
  //crud实例，通过lookup查询上级组件
  $crud: CRUD

  static get styles(): string[] {
    return []
  }
  render(): Template {
    return html`<slot name="header" @slotchange="${this.onSlotChange}"></slot><slot @slotchange="${this.onSlotChange}"></slot>`
  }
  tableRef: Table
  #hasSubCol = false
  slots2: Record<string, Element[]> = {}

  /////////////////////////////////// watches
  @watch('dataSelection', { immediate: true })
  watchDataSelection(nv: string) {
    if (!nv) return;

    if (this.tableRef) this.tableRef.rebuild()
  }
  @watch('crudData', { immediate: true })
  watchCrudData(nv: Record<string, any>) {
    if (!nv) return;

    this.requestUrl();
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }
  connectedCallback() {
    super.connectedCallback();

    let tableRef = closest<Table>(this.parentElement!, (n, times) => {
      return !!n.rebuild
    }, 'parentElement')
    if (!tableRef) {
      return;
    }
    this.tableRef = tableRef
    tableRef.rebuild()
  }
  disconnectedCallback() {
    if (this.tableRef) this.tableRef.rebuild()
  }
  //////////////////////////////////// methods
  onSlotChange(e: Event) {
    let t = e.target as HTMLSlotElement;
    let slotRoots = t.assignedElements();
    if (slotRoots.length < 1) return;
    if (some(slotRoots, slot => slot instanceof TableColumn)) {
      this.#hasSubCol = true
      return;
    }

    this.slots2[t.name || 'default'] = slotRoots
  }

  hasSubCol() {
    return this.#hasSubCol
  }
  /**
   * 返回默认及header的slots
   * @returns [defaultSlot, headerSlot]
   */
  getSlots() {
    return this.slots2
  }
  static renderSlotHeaderCell(col: ColumnMeta, rowIndex: number, colIndex: number, index: number) {
    return col.slots.header ? buildHTML(map<Template>(col.slots.header, (e: Element) => new Template([e.outerHTML], []))) : col.label
  }
  static renderSlotBodyCell(col: ColumnMeta, rowData: Record<string, any>, rowIndex: number, colIndex: number, formatter?: Function) {
    let prop = {
      row: rowData,
      column: col,
      rowIndex,
      colIndex
    }
    if (col.slots.default) {
      return buildHTML(map<Template>(col.slots.default, (e: Element) => new Template([replaceExp(e.outerHTML, e.getAttribute('slot-scope')!, prop)], [])))
    } else {
      let f = formatter ? formatter({ row: cloneDeep(rowData), column: cloneDeepWith(col, clone, (v, k) => k === 'slots'), rowIndex, colIndex }) : rowData[col.prop!]
      return f
    }
  }
  static renderSlotInputCell(col: ColumnMeta, rowData: Record<string, any>, rowIndex: number, colIndex: number) {
    return col.slots.input ? buildHTML(map<Template>(col.slots.input, (e: Element) => new Template([e.outerHTML], []))) : rowData[col.prop!]
  }

  static renderInput(
    dataType: string,
    dataSelection: Array<any>,
    dataSelectionOption: Record<string, any>,
    dataOption: Record<string, any>, text: string) {
    let rs = `<textarea class="c-table-cell-input__text">${text || ''}</textarea>`
    return rs;
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

        that.dataSelection = formattedList
        that.emit("load", rs);
      })
      .catch((e: Error) => {
        showError(this.tagName, "Fetch options error with api " + this.crudData.url, e);
      });
  }
}

//todo slot支持需要抽取到基类中。。。
function replaceExp(tmpl: string, slotScope: string, props: Record<string, any>) {
  return tmpl.replace(/\$\{([^}]+)\}/img, (a: string, b: string) => {
    if (!slotScope) showError('', `can not find slot-scope but got expression \${${b}}`)
    return fval<string>(b, { [slotScope]: props })
  })
}