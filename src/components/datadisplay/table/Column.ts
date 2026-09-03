import { csscope, Csscope, debounced, emits, h, ifElse, ifTrue, prop, show, state, styles, tag, Template, watch } from "compelem";
import { closest, findIndex, isDefined, isEmpty, isNumeric, isUndefined, kebabCase, some, walkTree } from "myfx";
import uii, { getBox } from 'uiik';
import { AlignType, DataType, SortType } from "../../../constants";
import { ArrowDownSolid, ArrowUpSolid, Close } from "../../../icons/icons";
import { Field } from "../../base/Field";
import { Table } from "./Table";
import columnStyle from "./column.scss?tmpl";
import { tableStyleSheet } from "./styleSheets";
import { ColumnProp, ColumnType, DataSelectionOption } from "./types";

/**
 * table column
 * 支持嵌套构建复杂表头
 * @attrs
 *  label {string} 列名
 *  prop {string} 列属性，支持多级属性，如 person.name.first
 *  width {number} 列宽，单位px。默认180
 *  minWidth {number} 最小列宽，单位px。默认40
 *  maxWidth {number} 最大列宽，单位px
 *  align {string} 对齐方向，可选值：left/center/right，当dataType为number时自动对齐到右侧，当dataType为time，date，datetime时自动对齐到中间。默认left
 *  type {string} 列类型，可选值：index/selection。默认空
 *  indexButton {boolean|string} 开启后鼠标悬浮时会显示可点击的详情按钮，仅当type为index/selection时生效。值为string时可设置图标样式类或svg名称
 *  hoverSelection {boolean} 当type为selection时，启用后默认显示序号。默认true
 *  header-align {string} 头部对其，为空时与align一致
 *  fixed {boolean|string} 是否固定列，可选 true/left/right。默认false
 *  hidden {boolean} 是否隐藏列，默认false
 *  dataType {string} 数据类型，可选值：text/number/time/date/datetime/tag/user/image，默认text
 *  multiple {boolean} 当dataType为user/image/tag时，是否支持显示多个头像/图片/标签，如果为true且单元格值是数组/逗号分隔字符串，则显示多个头像/图片/标签。默认false
 *  avatarField {string} 用户头像字段。当dataType为user时生效
 *  avatarColor {string} 用户头像背景色。当dataType为user时生效
 *  pattern {string} 数据格式化模式，当dataType为number，time，date，datetime时有效，各类型默认模式如下
 *    number: '###.00'
 *    time: 'HH:mm'
 *    date: 'yyyy-MM-dd'
 *    datetime: 'yyyy-MM-dd HH:mm'
 *  tagAppearance {string} 当列的数据类型为tag时，可配置tag的appearance，可选值: pale/flat/outlined。默认flat
 *  tagColors {object|string} 当列的数据类型为tag时，可配置内容对应的color，规则见tag组件。默认会根据种类数量随机配色
 *  trackIndex {boolean} 当type是index/selection时，过滤数据后可跟踪原行号
 *  dataSelection {array} 可选项，可以是字符串数组或对象数组，对象格式如下{label,value}
 *  dataSelectionOption {object} 可选项配置 {check:boolean 输入框内容必须符合选项中的某个值, multiple:boolean 多选}
 *  tree {boolean} 是否为树形列，默认false。table开启tree属性时生效，一个table内只有第一个启用该属性的列生效；type 为index/selection时无效；树形列强制左对齐
 *  stats {boolean|string} 是否开启列统计，开启后会根据dataType自动显示不同的统计指标。也可指定默认指标类型，仅限于dataType为number/date/datetime/time时有效。
 *        number 列可选 mean/max/min/median/sum/range
 *        date/datetime/time 列可选 min/max/range
 *  resizable {boolean} 是否可拖动列宽，默认true
 *  movable {boolean} 是否可拖动列顺序，默认false。影响config及TableBar
 *  hidable {boolean} 是否可隐藏，默认true。影响config及TableBar
 *  filterable {boolean} 是否可拖动列顺序，默认false。影响config及TableBar
 *  sortable {boolean} 是否可排序，默认false。影响config及TableBar
 *  groupable {boolean} 是否可分组数据，默认false。影响config及TableBar
 *  colorable {boolean} 是否可填色，默认false。影响config及TableBar
 *  config {boolean} 是否开启列配置面板，默认false。开启后会在表头可点击，点击后会弹出配置面板，可对列进行排序、冻结、隐藏、分组等操作。
 *  link {string} 内容显示为连接。当dataType为tag/user/image时无效
 *  linkOptions {object} 连接选项 {target: _self, defaultColor: -webkit-link, }
 *  header-icon {string} 列头图标，支持svg图标名称
 *  silent {boolean} 设置列静止，不响应列操作。可用于占位符
 *  sameSpan {boolean} 相同内容会自动合并为一个单元格
 * @slots
 *  - 仅支持嵌套列
 *  header 自定义表头显示
 *  cell({row,column,rowIndex,columnIndex}) 自定义单元格，当使用slot指令时支持以上参数，当使用插槽元素时可通过数据属性`data-slot-row="data"`进行标记，对应属性自动设置给插槽元素
 *  footer 自定义表尾显示，如果开启列统计则无效
 * @author holyhigh2
 */
@emits('update:*')
@tag('ce-column')
export class Column extends Field {
  //////////////////////////////////// props
  @prop({ type: String }) type: string;
  @prop({ type: [Boolean, String] }) indexButton = false
  @prop({ type: Number, model: true }) width: number;
  @prop minWidth: number = 40;
  @prop maxWidth: number = 999999;
  @prop({ type: String, model: true }) align: string;
  @prop({ type: String, model: true }) headerAlign: string;
  @prop resizable = true;

  @prop({ type: [Boolean, String] }) fixed: boolean | string = false;
  @prop hidden = false;
  @prop trackIndex = false;
  @prop hoverSelection = true;
  @prop tree = false;
  @prop silent = false;
  @prop({ type: [String, Boolean], model: true }) stats: string | boolean = false;
  @prop({ type: [Boolean] }) config: boolean = false;
  @prop({ type: String }) avatarField: string
  @prop({ type: String }) avatarColor: string
  @prop tagAppearance: string = 'flat'
  @prop headerIcon = ''
  @prop multiple = false

  /**
   * 可选项
   */
  @prop({ type: Array }) dataSelection: Array<any>;
  /**
   * constraint:false 输入框内容必须符合选项中的某个值
   * multiple:false 多选
   */
  @prop({ type: Object }) dataSelectionOption: DataSelectionOption = { constraint: false, multiple: false };
  @prop({ type: String }) link: string;
  @prop({ type: Object }) linkOptions: Record<string, any> = { target: '_self', defaultColor: '-webkit-link' }

  @state({ prop: 'width' }) renderWidth: number = 0;
  @state headerHeight = '100%';
  @state hasChild = false;
  @state rootWidth = 0;
  @state filterCondition = ''
  @state sorted = ''
  @state sortedOrder: number

  @state hideHandle = false
  draggedWidth: number

  __fixed: boolean | string | undefined

  @csscope(Csscope.INNER)
  static get css() {
    return [tableStyleSheet, columnStyle]
  }

  get cssVars() {
    return {
      columnWidth: (isUndefined(this.renderWidth) || this.hasChild ? (this.rootWidth ? this.rootWidth + 'px' : 'auto') : (this.renderWidth ? this.renderWidth + 'px' : 'auto')),
      columnMinWidth: `${this.minWidth}px`,
      columnTableCellConentHeight: isNumeric(this.headerHeight) ? this.headerHeight + 'px' : this.headerHeight,
      columnTableCellConentLineHeight: isNumeric(this.headerHeight) ? this.headerHeight + 'px' : '',
      columnTableCellConentJustify: this.type !== ColumnType.Selection ? 'unset' : ''
    }
  }

  rootCol: Column | null = null;
  tableRef: Table
  /////////////////////////////////// watches
  @watch(['width', 'minWidth', 'align', 'renderWidth'], { immediate: false })
  watchStyle(nv: string, ov: string, srcName: string) {
    if (this.silent) return;
    // 列尚未接入表格时 tableRef 为空，跳过样式回写（挂载时序问题，接入后由 Report/Table 重算）
    if (!this.tableRef) return;
    setTimeout(() => {
      this.tableRef._updateColumnStyleD(this)
    }, 0);
    this.__setColumnWidth()
    //如果是rootCol并且有子列，则计算子列宽度
    if (this.rootCol) {
      this.rootCol.calcRootWidth()
    }
  }
  // @watch('fixed', { immediate: true })
  // watchFixed(nv: string) {
  //   this.__fixed = nv
  // }
  @watch('align', { immediate: false })
  watchAlign(nv: string) {
    this.__setColumnAlign()
  }
  @watch('type', { immediate: true })
  watchType(nv: string) {
    if (nv === ColumnType.Index) {
      this.align = AlignType.Center
      this.headerAlign = AlignType.Center
      this.renderWidth = this.width = 60
      this.prop = ColumnProp.Index
      this.stats = 'index'
    } else if (nv === ColumnType.Selection) {
      this.align = AlignType.Center
      this.headerAlign = AlignType.Center
      this.renderWidth = this.width = 60

      this.prop = ColumnProp.Selection
      this.stats = 'index'
    }
  }
  @watch('dataType', { immediate: true })
  watchDataType(nv: string) {
    if (!this.pattern) {
      switch (nv) {
        case DataType.Number:
          this.pattern = '###.00'
          if (!this.align)
            this.align = AlignType.Right
          break;
        case DataType.Time:
          this.pattern = 'HH:mm'
          if (!this.align)
            this.align = AlignType.Center
          break;
        case DataType.Date:
          this.pattern = 'yyyy-MM-dd'
          if (!this.align)
            this.align = AlignType.Center
          break;
        case DataType.DateTime:
          this.pattern = 'yyyy-MM-dd HH:mm'
          if (!this.align)
            this.align = AlignType.Center
          break;
        case DataType.Tag:
        case DataType.User:
          if (!this.align)
            this.align = AlignType.Left
          break;
        default:
          break;
      }
    }
    if (!this.align) {
      switch (nv) {
        case DataType.Number:
          this.align = AlignType.Right
          break;
        case DataType.Time:
          this.align = AlignType.Center
          break;
        case DataType.Date:
          this.align = AlignType.Center
          break;
        case DataType.DateTime:
          this.align = AlignType.Center
          break;
        default:
          break;
      }
    }
  }

  //////////////////////////////////// lifecycles
  constructor(...args: any[]) {
    super(...args)
  }
  render(): Template {
    return h`<div part="columnheader" role="columnheader" class="ce-table-cell" ?config="${this.config && !this.hasChild && !!this.prop && !this.type}" data-action="config">
      <div class="ce-table-cover" part="cover"></div>
      <div class="ce-table-cell-content" part="content" ${styles({
      'text-align': (this.headerAlign ?? this.align) || AlignType.Left,
      display: this.type === ColumnType.Selection ? 'grid' : 'block',
      'justify-content': 'center',
      'align-items': 'center'
    })}>
        <div style="flex:1;overflow: hidden;text-overflow: ellipsis;">
          ${ifTrue(!!this.headerIcon, () => h`<ce-icon class="ce-table-header-icon" size="md" .svg="${this.headerIcon}" style="margin-right: var(--ce-spacing-xs); vertical-align: middle;"></ce-icon>`)}
          ${ifElse(this.type === ColumnType.Selection, () => h`<ce-checkbox @change="${this.checkAll}" style="margin-block: .5rem;"></ce-checkbox>`, () => h`<span style="pointer-events:none" ${show(isEmpty(this.slots.header))}>${this.label}</span>`)}
          <slot name="header" style="pointer-events:all"></slot>
        </div>
        ${ifTrue(this.sortable, () => h`
          <ce-tag class="ce-table-sort-tag" ${show(!!this.sorted)} appearance="flat" size="md" color="rgb(156 163 175)" pill data-action="clear">
            ${ifElse(this.sorted === SortType.Asc, () => h`<ce-icon class="ce-table-order" .svg="${ArrowUpSolid}" ></ce-icon>`, () => h`<ce-icon class="ce-table-order" .svg="${ArrowDownSolid}" size="sm" ></ce-icon>`)}
            <span class="ce-table-order" style="margin-right: .25rem;">${this.sortedOrder}</span>
            <ce-icon class="ce-table-close" .svg="${Close}"></ce-icon>
          </ce-tag>
        `)}
        ${ifTrue(this.filterable && !this.hasChild && !!this.prop && this.type !== ColumnType.Index && this.type !== ColumnType.Selection, () => h`
            <ce-button data-action="filter" class="ce-table-filter ce-table-trigger" color="text" ?filtering="${!!this.filterCondition}" style="padding: 0;" size="md" appearance="subtle" icon="c-svg-filter-list-light"></ce-button>
        `)}
      </div>
      <div class="ce-table-subcolumn" ${show(!isEmpty(this.slots.default))}>
        <slot></slot>
      </div>
      ${ifTrue(!this.hideHandle, () => h`<div part="handle" class="uiik-resizable-handle" ${show(this.resizable)}></div>`)}
    </div>
    <slot name="cell" style="display:none"></slot>
    <slot name="footer" style="display:none"></slot>
    `
  }
  propsReady(props: Record<string, any>): void {
    if (props.type === ColumnType.Index) {
      props.align = 'center'
      props.width = 60
      props.prop = ColumnProp.Index
    } else if (props.type === ColumnType.Selection) {
      props.align = 'center'
      props.prop = ColumnProp.Selection
    }
  }
  initConfig(): void {
    let level = 0
    let table = this.tableRef = closest<Table>(this.parentComponent!, (node) => {
      level++
      return node instanceof Table
    }, 'parentComponent')!
    if (some(this.children, c => c instanceof Column) || this.parentComponent instanceof Column) {
      this.headerHeight = table.headerHeight + ''
    }

    if (this.parentComponent instanceof Column) {
      this.rootCol = closest(this, node => !(node.parentComponent instanceof Column), 'parentComponent') as Column;
    }

  }
  mounted() {
    const that = this;
    if (this.silent) return;
    this.initConfig()

    this.__setColumnWidth()
    this.__setColumnAlign()

    if (isUndefined(this.renderWidth) && this.minWidth) {
      this.renderWidth = this.minWidth
    }

    setTimeout(() => {
      // this.tableRef._updateScrollWidth()
    }, 100)

    // renderRoot / tableRef 在列挂载阶段可能尚未就绪（挂载时序问题），未就绪时跳过分隔条绑定，待列接入表格后由 Report/Table 重新补设样式
    if (!this.renderRoot || !this.tableRef) return;
    let handleEl = this.renderRoot.querySelector(".uiik-resizable-handle") as HTMLElement
    if (!handleEl) return;
    //bind splitter
    let deviationX = 0;
    uii.newDraggable(
      handleEl,
      {
        direction: "h",
        ghost: true,
        zIndex: 2,
        ghostTo: this.tableRef!.renderRoot,
        onStart(data, event) {
          let box = getBox(data.draggable.parentElement!, that.tableRef);
          deviationX = box.x;
        },
        onDrag(data) {
          let w = data.x + deviationX
          if (w < that.minWidth + deviationX) {
            w = that.minWidth + deviationX;
          } else if (w > that.maxWidth + deviationX) {
            w = that.maxWidth + deviationX;
          }

          data.transform.moveToX(w);
          return false;
        },
        onEnd(data) {
          let w = parseInt(data.x + "");
          if (w < that.minWidth) {
            w = that.minWidth;
          } else if (w > that.maxWidth) {
            w = that.maxWidth;
          }

          that.renderWidth = that.draggedWidth = w
          that.tableRef._updateColumnResize(that)

          return false;
        },
      }
    )
  }
  slotChange(slot: HTMLSlotElement, name: string): void {
    if (this.silent) return;
    if (!name) {
      let cols = slot.assignedElements()
      if (isEmpty(cols)) return;

      this.hasChild = true;
      this.toggleAttribute('parent', true)
      this.hideHandle = true
    }
    if (!isEmpty(this.slots.default)) {
      if (this.rootCol) {
        this.rootCol.calcRootWidth()
      } else {
        this.calcRootWidth()
      }
    }
  }
  //////////////////////////////////// table cbk
  __setColumnAlign() {
    //设置列样式
    if (!this.tableRef) return;
    if (this.prop) {
      this.tableRef.style.setProperty('--column-align-' + kebabCase(this.prop.replaceAll('.', '-')), this.align ?? 'initial')
      let justify = 'initial'
      switch (this.align) {
        case 'left':
          justify = 'flex-start'
          break
        case 'right':
          justify = 'flex-end'
          break
        default:
          justify = 'center'
      }
      this.tableRef.style.setProperty('--column-align-justify-' + kebabCase(this.prop.replaceAll('.', '-')), justify)
    }
  }
  __setColumnWidth() {
    //设置列样式
    if (!this.tableRef) return;
    if (this.prop) {
      this.tableRef.style.setProperty('--column-width-' + kebabCase(this.prop.replaceAll('.', '-')), (isUndefined(this.renderWidth) || this.hasChild ? (this.rootWidth ? this.rootWidth + 'px' : 'auto') : (this.renderWidth ? this.renderWidth + 'px' : 'auto')))
      // this.tableRef.style.setProperty('--column-min-width-' + kebabCase(this.prop.replaceAll('.', '-')), (this.minWidth ?? 'initial') + '')
    }
  }
  _onSortChange(orders: { prop: string, sort: string }[]) {
    if (orders.length < 1) {
      this.sorted = ''
      this.sortedOrder = 0
    } else {
      this.sortedOrder = findIndex<{ prop: string, sort: string }>(orders, o => {
        if (o.prop === this.prop) {
          this.sorted = o.sort
          return true;
        }
        return false;
      }) + 1
      if (this.sortedOrder < 1) {
        this.sorted = ''
      }
    }
  }
  _onFilterChange(filters?: Record<string, any>) {
    this.filterCondition = filters ? filters[this.prop] ?? '' : ''
  }
  _onFixedChange(left: string) {
    if (left !== this.prop) {
      this.tableRef._removeFix(this.prop)
    }
  }
  //////////////////////////////////// methods
  @debounced(50)
  calcRootWidth() {
    if (this.parentComponent instanceof Column) return
    if (this.children.length < 1) return
    if (isEmpty(this.slots.default)) return

    let w = 0
    walkTree(this.children, (node) => {
      if (node instanceof Column && !some(node.children, c => c instanceof Column)) {
        w += node.renderWidth
      }
    })
    this.rootWidth = w

    // this.tableRef._updateScrollWidth()
  }
  checkAll({ checked }: { checked: boolean }) {
    this.tableRef.toggleRowSelectionAll(checked)
  }

  setFixed(value: boolean | string) {
    this.__fixed = value
  }
  getFixed() {
    return isDefined(this.__fixed) ? this.__fixed : this.fixed
  }
}