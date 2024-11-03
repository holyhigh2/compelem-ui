import { classes, CompElem, html, prop, query, queryAll, QueryCache, state, styles, tag, Template, watch } from "compelem";
import myfx, {
  bind,
  clone,
  cloneDeep,
  cloneDeepWith,
  closest,
  concat,
  debounce,
  each,
  every,
  filter,
  find,
  flatMap,
  get,
  groupBy,
  identity,
  isArray,
  isDefined,
  isEmpty,
  isEqual,
  isFunction,
  isObject,
  isUndefined,
  map,
  range,
  reduce,
  set,
  size,
  some,
  startsWith,
  test,
  throttle,
  toArray,
  trim,
  truncate,
  uuid,
  walkTree
} from "myfx";
import uii, { getBox } from "uiik";
import { Dropdown } from "../../nav/dropdown/Dropdown";
import style from "./style.scss";
import "./TableColumn";
import { TableColumn } from "./TableColumn";
import { colGroupRender, tbodyRender, theadRender } from "./templates";
import { ColumnMeta } from "./types";
const Command = {
  resizeCol: "resizeCol",
  sortCol: "sortCol",
};
/**
 * table webcomponent
 * @props
 *  height {number|string} 固定高度，默认500。设置auto时为自适应高度
 *  maxHeight {number} 最高高度，未超过前自适应高度，默认9999
 *  minHeight {number} 最底高度，默认100
 *  row-height {number} 默认 30px
 *  header-height {number} 默认auto
 *  data {array} data list
 *  overflowTip {boolean} 鼠标悬浮在溢出内容时显示悬浮内容，默认true
 *  highlightHover {boolean} 悬浮高亮行
 *  highlightHoverColumn {boolean} 悬浮高亮列
 *  fit {boolean} 是否自动撑满，默认true
 *  stripe {string} 是否开启条纹背景
 *  stripe-color 条纹背景色，默认
 *  cacheCount {number} 每页缓存记录数，默认4
 *  rowKey {string} 行数据主键，支持访问链如 a.b.c.0.x / a.b.c[0].x
 * @slots
 *  default - {row,column,rowIndex,colIndex,index}
 *  header - {row,column,rowIndex,colIndex,index}
 *  input - {row,column,rowIndex,colIndex,index}
 * 
 *  slot-scope-attrs row/column/rowIndex/colIndex
 *  slot-scope-inject({row,column,rowIndex,colIndex})
 * @events
 *  headerclick({column,header}) 点击列头触发
 *  cellclick({ column, row, cell, rowIndex, colIndex}) 点击单元格触发
 * @methods
 *  setFormatter(fn({row,column,rowIndex,colIndex})=>html string) 设置单元格格式化器，不适用于slot列
 *  setStyler(fn({row,column,rowIndex,colIndex})=>style string) 设置样式处理器
 *  setData(data)
 *  getData()
 *  reload()
 *  updateColumnCells(prop,values,syncData) 更新某一列视图（及数据），视图仅更新可视区域
 * @extends
 *  onResize
 *  onMouseEnter
 *  onMouseLeave
 *  onClickHead
 *  onMouseDown
 *  onClickBody
 *  onDblClickBody
 *  onGlobalMousedown
 *  onColumnResize
 *  onScroll
 *
 * @author holyhigh2
 */
@tag('l-table')
export class Table extends CompElem {
  #header: Array<Array<ColumnMeta>> = [];
  #headMaxLevel = 0;
  #el_body_rod: HTMLElement;
  el_body_scroller_y: HTMLElement;
  #el_column_group: HTMLElement;

  rowCount = 0;
  viewRowCount = 0;
  bodyHeight = 0;
  commandStack: Array<{ command: string; data: Record<string, any> }> = [];

  #lastScrollTop = 0;
  #lastScrollLeft = 0;
  #scrollHook: any;
  #scrollEndHook: any;
  #resizeHook: any;
  #globalMouseDownHook: any;

  #id: string;
  #highlightTds: any;

  #minThWidth = 50;
  #defaultColWidth = 120;

  #timer_rebuild: any;
  #timer_scrollend: any;
  //start position of column
  columnPositionMap: Record<number, number> = {};
  //单元格位置对应样式 ！！！列变动后位置不会更新！！！
  cellStyleMap: Record<string, string> = {}
  cellClassMap: Record<string, string> = {}
  cellNoteMap: Record<string, string> = {}

  tableHeight: number

  renderColumns: Array<ColumnMeta> = [];
  __formatter: (scope: Record<string, any>) => string
  #styler: (scope: Record<string, any>) => string

  /////////////////////////////////// queries
  @query('.c-table-table', QueryCache.ONCE)
  el_body_table: HTMLElement;
  @query('.c-table-table thead.head-columns')
  el_thead: HTMLElement;
  @query('.c-table-table thead.head-ext')
  el_thead_ext: HTMLElement;
  @queryAll('.c-table-header-wrapper l-dropdown[name="filtermenu"]')
  els_filterMenus: Dropdown[];
  @query('section.c-table', QueryCache.ONCE)
  el_table: HTMLElement;
  /////////////////////////////////// watches
  @watch(['height', 'minHeight', 'maxHeight'], { immediate: true })
  watchHeight(nv: any, ov: any, srcName: string) {
    set(this.style, srcName, isNaN(this[srcName]) ? this[srcName] : this[srcName] + 'px')
  }
  @watch('data', { immediate: true })
  watchData(nv: any, ov: any, srcName: string) {
    if (nv)
      this._innerData = concat(nv);
    this.renderRoot.classList.toggle('__empty', isEmpty(nv))

    if (this.isMounted)
      this.reload();
    else {
      this.nextTick(() => {
        this.reload();
      })
    }
  }
  //////////////////////////////////// props
  @prop({ type: [String, Number] }) height: string | number = 500;
  @prop minHeight = 100;
  @prop maxHeight = 9999;
  @prop rowHeight = 30;
  @prop({ type: Number }) headerHeight: number;
  @prop fit = true;
  @prop rowKey = '';
  @prop stripe = false;
  @prop stripeColor = "#f3f8ff";
  @prop overflowTip = true;
  @prop highlightHover = true;
  @prop highlightHoverColumn = false;
  @prop highlightColor = "#f3f8ff";
  @prop border = true;
  @prop transition = true;
  @prop cacheCount = 4;
  @prop({
    type: Array, required: false, sync: true, hasChanged(newValue: any, oldValue: any) {
      if (size(newValue) !== this.__lastDataSize) {
        this.__lastDataSize = size(newValue)
        return true;
      }
      //仅对比引用及数量
      return newValue !== oldValue
    }
  }) data: Array<Record<string, any>> = [];
  __lastDataSize: 0

  //////////////////////////////////// state
  @state
  _innerData: Array<Record<string, any>> = [];
  @state
  emptyData = true;
  @state
  hoverColumnIndex = -1;

  static get styles(): Array<string | CSSStyleSheet> {
    return [style];
  }
  get css() {
    return `.c-table-row-striped{
      ${this.stripe ? 'background:' + this.stripeColor : ''};
    }
    .c-table.highlight-over {
      .body-grid tr:hover{
        td{
          background:${this.highlightColor};
        }
      }
    }
    .c-table.highlight-over-column {
      .c-table-table:hover{
        td[data-column-index="${this.hoverColumnIndex}"]{
          background:${this.highlightColor};
        }
      }
    }
    `
  }
  //////////////////////////////////// lifecycles
  render(): Template {
    return html`
    <section tabindex="0" class="c-table ${classes({
      'highlight-over': this.highlightHover,
      'highlight-over-column': this.highlightHoverColumn,
      border: this.border,
      transition: this.transition
    })}" @click="${this.onClickBody}" @mousedown="${this.onMouseDown}" style="${styles({ minHeight: this.minHeight + 'px' })}">
      <div class="c-table-scroller-y"></div>
      <div class="c-table-container">
        <table class="c-table-table" @dblclick="${this.onDblClickBody}" tabindex="0">
          <colgroup class="column-group"></colgroup>
          <thead class="head-ext"></thead>
          <thead class="head-columns" @open="${this.onFilterOpen}" @click="${this.onClickHead}" >
          </thead>
          <tbody class="rod"></tbody>
          <tbody class="body-grid"></tbody>
          <tbody class="body-grid"></tbody>
          <tbody class="body-grid"></tbody>
        </table>
      </div>
      ${''}
    </section>
    `;
  }

  constructor() {
    super();

    //listen
    this.#resizeHook = debounce(this.onResize, 100).bind(this);
    window.addEventListener("resize", this.#resizeHook);

    this.#globalMouseDownHook = this.onGlobalMousedown.bind(this);
    document.addEventListener("mousedown", this.#globalMouseDownHook);

    this.#id = uuid();
    (window as any)["cell_enter_" + this.#id] = this.onMouseEnter.bind(this);
  }
  connectedCallback() {
    super.connectedCallback();

    //init

    this.#el_body_rod = this.el_table.querySelector(".c-table-container .rod")!;
    this.#el_column_group = this.el_table.querySelector("colgroup.column-group")!;
    this.el_body_scroller_y = this.el_table.querySelector(
      ".c-table-scroller-y"
    )!;

    // this.buildColumns();
    // this.changeHeader();

    //init attributes

    this.#scrollHook = throttle(this.scrollHandle, 10).bind(this);
    this.el_table.addEventListener("scroll", this.#scrollHook);

    this.#scrollEndHook = this.onScrollEnd.bind(this);
    this.el_table.addEventListener("scrollend", this.#scrollEndHook);

    this.reload();

    this.nextTick(() => {
      this.style.height = this.height + 'px';
    })
  }
  disconnectedCallback() {
    this.el_table.removeEventListener("scroll", this.#scrollHook);
    window.removeEventListener("resize", this.#resizeHook);
  }
  mounted(): void {

  }
  //////////////////////////////////// methods
  doCommand(command: string, data: Record<string, any>) {
    this.onCommand(command, data);
    this.commandStack.push({ command, data });
  }
  isEqualCell(n1: HTMLElement, n2: HTMLElement) {
    if (!n1 || !n2) return false;
    return (
      n1.dataset.columnIndex == n2.dataset.columnIndex &&
      n1.dataset.rowIndex == n2.dataset.rowIndex
    );
  }
  isFixedCell(cell: HTMLElement, dir?: "left" | "right") {
    return cell.className.indexOf("fixed-cell" + (dir ? "-" + dir : "")) > -1;
  }
  getColIndex(cell: HTMLElement) {
    if (!cell) return -1;
    return parseInt(cell.dataset.columnIndex!);
  }
  getRowIndex(cell: HTMLElement) {
    if (!cell) return -1;
    return parseInt(cell.dataset.rowIndex!);
  }
  getColumnMeta(cell: HTMLElement): ColumnMeta {
    return this.renderColumns[this.getColIndex(cell)];
  }
  getHeaderHeight() {
    return this.el_thead.offsetHeight + this.el_thead_ext.offsetHeight
  }
  /********* layout **********/
  changeWidth() {
    let totalColWidth = 0;
    let specifiedColWidth = 0;
    let unsetCols: ColumnMeta[] = flatMap(this.renderColumns, (c) => {
      let isUnD = isUndefined(c.primaryWidth);
      totalColWidth += c.primaryWidth || 0;
      if (!isUnD) {
        specifiedColWidth += c.primaryWidth || 0;
      }
      return isUnD ? c : [];
    });
    let isAllColSet = every(this.renderColumns, (c) =>
      isDefined(c.primaryWidth)
    );

    let tableWidth = isAllColSet ? totalColWidth : this.el_table.offsetWidth;

    [].reduce

    if (!isAllColSet) {
      if (this.fit) {
        let avaliableWidth = tableWidth - specifiedColWidth;
        // 减去指定宽度
        let avg = Math.floor(avaliableWidth / unsetCols.length);
        if (avg < 0) {
          avg = this.#defaultColWidth;
        }
        let mod = avaliableWidth % unsetCols.length;
        each(unsetCols, (c) => {
          c.width = avg;
        });
        let one = unsetCols[0];
        one.width = one.width! + mod;
      } else {
        each(unsetCols, (c) => {
          c.width = this.#defaultColWidth;
        });
        totalColWidth = reduce<ColumnMeta, number>(
          this.renderColumns,
          (acc, v) => (acc += v.width || 0),
          0
        );
        tableWidth = totalColWidth;
      }
    }

    totalColWidth = reduce(
      map(this.renderColumns, (c) => c.width),
      (acc, v) => (acc += v || 0),
      0
    );

    this.el_body_table.style.width = tableWidth + "px";

    const cols = toArray<HTMLElement>(
      this.#el_column_group.querySelectorAll("col")
    );
    cols.length &&
      each(this.renderColumns, (c, i: number) => {
        cols[i].style.width = c.width + "px";
      });

    let startPos = 0;
    this.columnPositionMap = {}
    each(this.renderColumns, (c, i: number) => {
      this.columnPositionMap[startPos] = i;
      startPos += c.width!;
    });

    this.setFixedColumn();
  }
  buildColumns() {
    let header: Array<Array<ColumnMeta>> = [];
    let columns: Array<ColumnMeta> = [];
    let columnMap = new WeakMap();
    walkTree(
      this.children,
      (node: HTMLElement, parentNode, chain, level, index) => {
        const attrs = node.attributes;
        if (!(node instanceof TableColumn)) {
          return -1;
        }

        let ltc = node as any;
        //invalid check
        let hasNoChild = node.childElementCount < 1;

        each(chain, (p) => {
          let pCol = columnMap.get(p);
          pCol.colspan += 1;
          pCol.rowspan = level;
        });

        let row = header[level];
        if (!row) {
          row = header[level] = [];
        }

        let colSlot: Record<string, Element[]> = {};
        let hasSubCol = false;
        if (!hasNoChild) {
          hasSubCol = ltc.hasSubCol();
          colSlot = ltc.getSlots();
        }

        let width = parseFloat(ltc.width + '') || undefined;
        let align = ltc.align;
        let headerAlign = ltc.headerAlign || align;
        let resizable = ltc.resizable;
        let fixed = ltc.fixed;
        let sort = ltc.sort;
        let filters =
          ltc.filters;
        let dataType = ltc.dataType;
        let dataOption = ltc.dataOption;
        let dataSelection = ltc.dataSelection;
        let dataSelectionOption = ltc.dataSelectionOption;
        let cellClass = ltc.cellClass;
        let headerClass = ltc.headerClass;
        let type = ltc.type;
        if (type === "index") {
          headerAlign = align = "center";
        }

        let column: ColumnMeta = {
          label: get(attrs.getNamedItem("label"), "value", ""),
          prop: get(attrs.getNamedItem("prop"), "value", ""),
          colspan: 0,
          rowspan: level,
          width: width,
          primaryWidth: width,
          type: type,
          align,
          headerAlign,
          slots: colSlot,
          hasSub: hasSubCol,
          resizable: isUndefined(resizable) ? true : resizable,
          fixed,
          sort,
          filters,
          dataType,
          dataOption,
          dataSelection,
          dataSelectionOption,
          cellClass,
          headerClass,
        };
        row.push(column);
        if (hasNoChild || !hasSubCol) columns.push(column);
        if (level > this.#headMaxLevel) {
          this.#headMaxLevel = level;
        }

        columnMap.set(node, column);
      }
    );

    let lastLeftFixedColIndex = -1;
    let lastLeftFixedCol: any = null;
    let lastRightFixedColIndex = 99999;
    let lastRightFixedCol: any = null;
    each(columns, (c, i: number) => {
      if (c.fixed) {
        if (c.fixed == "right") {
          if (i < lastRightFixedColIndex) {
            lastRightFixedCol = c;
            lastRightFixedColIndex = i;
          }
        } else {
          if (i > lastLeftFixedColIndex) {
            lastLeftFixedCol = c;
            lastLeftFixedColIndex = i;
          }
        }
      }
    });
    if (lastLeftFixedCol) {
      lastLeftFixedCol.isFixedEnd = true;
    }
    if (lastRightFixedCol) {
      lastRightFixedCol.isFixedEnd = true;
    }

    this.renderColumns = columns;
    this.#header = header;

    this.nextTick(() => {
      this.el_thead.style.top = this.el_thead_ext.offsetHeight - 0.5 + 'px'
    })

    this.onBuildColumns(columns, header);
  }
  changeHeader() {
    let colgroupHTML = colGroupRender({ columns: this.renderColumns });
    this.#el_column_group.innerHTML = colgroupHTML;

    let theadHTML = theadRender({
      headerHeight: this.headerHeight,
      columns: this.renderColumns,
      header: this.#header,
      maxLevel: this.#headMaxLevel + 1,
      render: TableColumn.renderSlotHeaderCell,
    });
    this.el_thead.innerHTML = theadHTML

    if (this.#headMaxLevel > 0) {
      this.el_thead.classList.add("complex");
    }

    let head = this.el_thead;
    let deviationX = 0;
    const that = this;
    //bind splitter
    uii.newDraggable(
      toArray(this.el_thead.querySelectorAll("tr th .resizable-handle")),
      {
        direction: "h",
        ghost: true,
        ghostTo: this.el_table,
        onStart(data, event) {
          let box = getBox(data.draggable.parentElement!, head);
          deviationX = box.x;
        },
        onDrag(data) {
          data.transform.moveToX(data.x + deviationX);
          return false;
        },
        onEnd(data) {
          let colIndex = parseInt(data.draggable.dataset.columnIndex + "");
          let w = parseInt(data.x + "");
          if (w < that.#minThWidth) {
            w = that.#minThWidth;
          }

          that.doCommand(Command.resizeCol, {
            toWidth: w,
            colIndex,
            th: data.draggable.parentElement as HTMLElement,
          });

          return false;
        },
      }
    );
  }
  //列调用
  rebuild() {
    if (!this.isConnected) return;

    if (this.#timer_rebuild) clearTimeout(this.#timer_rebuild);
    this.#timer_rebuild = setTimeout(() => {
      let oldCols = this.renderColumns;
      this.buildColumns();
      this.changeHeader();

      let colChanged = !isEqual(oldCols, this.renderColumns);
      if (colChanged) {
        let grids: any = this.el_body_table.querySelectorAll(".body-grid");
        grids = filter(grids, (g: HTMLElement) => {
          if (g.childElementCount < 1) return false;

          let top = g.offsetTop - this.el_table.scrollTop;
          let bottom = g.offsetTop + g.offsetHeight;
          let end = this.el_table.scrollTop + this.el_table.offsetHeight;

          return (
            (top >= this.el_table.scrollTop && top < end) ||
            (bottom <= end && bottom > this.el_table.scrollTop) ||
            (top < this.el_table.scrollTop && bottom > end)
          );
        });
        each<HTMLElement>(grids, (g) => {
          let startIndex = parseInt(
            (g.querySelector(".top-loader") as HTMLElement).dataset.index + ""
          );
          g.innerHTML = this.#getTbodyHTML(
            this._innerData.slice(startIndex, startIndex + this.viewRowCount),
            startIndex
          );
        });

        this.onRebuild();
      }
      this.scrollHandle({ target: this.el_table }, true);

      this.changeWidth();
    }, 100);
  }
  setFixedColumn() {
    let columns = this.renderColumns;
    //header
    let ths = concat(this.el_thead.querySelectorAll("th.fixed-cell-left"), this.el_thead_ext.querySelectorAll("th.fixed-cell-left"));
    each<HTMLElement>(ths, (th) => {
      let cIndex = this.getColIndex(th);
      let prevWidth = reduce(
        range(cIndex),
        (acc, v) => acc + (columns[v].width || 0),
        0
      );
      th.style.left = prevWidth + "px";
    });
    //main
    let tds = this.el_body_table.querySelectorAll<HTMLElement>("tbody td.fixed-cell-left");
    each<HTMLElement>(tds, (td) => {
      let cIndex = this.getColIndex(td);
      let prevWidth = reduce(
        range(cIndex),
        (acc, v) => acc + (columns[v].width || 0),
        0
      );
      td.style.left = prevWidth + "px";
    });
  }
  onCommand(command: string, data: Record<string, any>) {
    if (command === Command.resizeCol) {
      let columns = this.renderColumns;
      let colIndex = data.colIndex;
      let toWidth = data.toWidth;
      columns[colIndex].width = toWidth;
      columns[colIndex].primaryWidth = columns[colIndex].width;
      this.changeWidth();
      this.onColumnResize(data.th, columns[colIndex], toWidth);
    } else if (command === Command.sortCol) {
    }
  }
  onResize() {
    if (!this.el_table) return;

    this.tableHeight = this.el_table.offsetHeight;
    this.bodyHeight = this.tableHeight - this.getHeaderHeight();
    let viewRowCount = Math.ceil(this.bodyHeight / this.rowHeight);
    viewRowCount += parseInt(this.cacheCount * 2 + ""); //缓冲
    this.viewRowCount = viewRowCount;

    this.changeWidth();
    //刷新检测
    this.scrollHandle({ target: this.el_table }, true);
  }
  onRebuild() { }
  onScroll(scrollV: boolean) { }
  onMouseEnter(t: HTMLElement) {
    if (this.overflowTip) {
      let wrapper = t.querySelector(".c-table-cell-wrapper .view") as HTMLElement;
      if (wrapper && wrapper.clientWidth != wrapper.scrollWidth) {
        wrapper.title = wrapper.innerText;
      }
    }
    this.hoverColumnIndex = parseInt(t.dataset.columnIndex || '')
    // if (this.highlightHoverColumn) {
    //   let tds = this.el_body_table.querySelectorAll(
    //     'td[data-column-index="' + t.dataset.columnIndex + '"]'
    //   );
    //   this.#highlightTds = tds;
    //   each(tds, (td) => td.classList.toggle("highlight-column", true));
    // }
  }
  onMouseLeave(t: HTMLElement) {
    // if (this.highlightHoverColumn && this.#highlightTds) {
    //   each(this.#highlightTds, (td: HTMLElement) =>
    //     td.classList.remove("highlight-column")
    //   );
    // }
  }
  onClickHead(e: Event) {
    let t = e.target as HTMLElement;

    let th = t.closest('th')!
    let col = this.getColumnMeta(th);
    this.emit('headerclick', { column: col, header: th }, { event: e })
    if (
      t instanceof HTMLElement &&
      t.classList.contains("c-table-header-sort")
    ) {
    } else if (
      t instanceof SVGElement &&
      t.classList.contains("c-table-header-filters")
    ) {
    }
  }
  #lastFilterItems: Record<string, string[]> = {}
  #filterColsMap: Record<string, Array<Record<string, any>>> = {}
  #filteringColProp: string;
  onFilterOpen(e: Event) {
    let t = e.target as HTMLElement;
    if (t.tagName === "L-DROPDOWN") {
      let menu = t as Dropdown;
      //groupby 该列内容
      let col = this.getColumnMeta(t.closest('th')!);
      let filterItems = filter<string>(map(this._innerData, d => d[col.prop!]), v => trim(v).length > 0)
      let groups = groupBy<Record<string, any>>(filterItems, identity)
      if (size(groups) < 1) {
        this.nextTick(() => {
          menu.close()
        })
        return;
      }
      if (isEqual(this.#lastFilterItems[col.prop!], filterItems)) {
        return;
      }
      this.#filteringColProp = col.prop!
      this.#lastFilterItems[col.prop!] = filterItems

      let filters = map<any, any, any>(groups!, (v, k: string) => {
        k = truncate(k, 10)
        let rs: Record<string, any> = {
          text: () => k + `<span style="margin-left:1rem;color:var(--l-color-placeholder)">(${v.length})</span>`,
          value: k
        }
        rs.checkMode = 'checkbox';
        rs.checkGroup = 'filter_' + col.prop
        return rs
      });
      filters.push(null);
      filters.push({
        custom: bind(() => `
        <div style="text-align: center;">
        <l-link type="info" onclick="this.parent.parent.parent.onFilterCol(this.parent.parent)">筛选</l-link> 
        <l-divider .vertical="true"></l-divider> 
        <l-link type="info" onclick="this.parent.parent.parent.onResetCol(this.parent.parent)"">重置</l-link>
        </div>
        `, this)
      })
      menu.setItems(filters);
    }
  }
  onFilterCol(menu: Dropdown) {
    //1. 筛选条件记录到列中
    let items = menu.getCheckedItems()
    if (isEmpty(items)) return;

    let prop = this.#filteringColProp
    let colMapList: any[] = this.#filterColsMap[prop] = []
    items.forEach(o => {
      colMapList.push({ type: '=', value: o.value })
    })

    //2. 筛选记录
    let filterData = concat(this.data)
    each(this.#filterColsMap, (colMapList: [], prop: string) => {
      filterData = filter(filterData, d => {
        let v = d[prop]
        return some(colMapList, ({ type, value }: { type: string, value: string }) => {
          if (type === '=') return value == v;
          return test(v, value)
        });
      })
    })
    this._innerData = filterData
    this.reload();

    //3. 关闭
    menu.close();

    let icon = menu.querySelector('.c-table-header-filters') as HTMLElement
    icon.style.stroke = 'var(--l-color-primary)';
  }
  onResetCol(menu: Dropdown) {
    this._innerData = this.data;
    this.reload();

    menu.menuPane.getCheckedItems().forEach(item => {
      item.checked = false
    })
    menu.menuPane.reload();
    menu.close();
    let icon = menu.querySelector('.c-table-header-filters') as HTMLElement
    icon.style.stroke = '';
  }
  onMouseDown(e: MouseEvent) {
    let t = e.target as Element;
    let el_body = this.el_table;
  }
  onClickBody(e: Event) {
    let t = e.target as Element;

    let td = closest<HTMLElement>(
      t,
      (node) =>
        node.tagName == "TD" && node.classList.contains("c-table-cell"),
      "parentNode"
    );
    if (td) {
      let rowIndex = this.getRowIndex(td);
      let colIndex = this.getColIndex(td);
      let column = cloneDeepWith<ColumnMeta>(this.renderColumns[colIndex], clone, (v, k: string) => k === 'slots');
      if (!column.prop || startsWith(column.prop, '__')) return;

      let row = cloneDeep(this._innerData[rowIndex])
      let cellPos = { colIndex: colIndex, rowIndex: rowIndex, prop: column.prop };
      this.emit('cellclick', { column, row, cell: cellPos, rowIndex, colIndex }, { event: e })
    }

  }
  onDblClickBody(e: Event) {
    let t = e.target as Element;
  }
  onGlobalMousedown(e: MouseEvent) {
    let t = e.target as Element;
  }
  onBuildColumns(columns: ColumnMeta[], header: ColumnMeta[][]) {

  }
  onColumnResize(th: HTMLElement, col: ColumnMeta, w: number) { }
  /********* data **********/
  #getTbodyHTML(data: Array<Record<string, any>>, startIndex: any) {

    let rs = tbodyRender({
      rowHeight: this.rowHeight,
      columns: this.renderColumns,
      data,
      startIndex,
      renderBody: TableColumn.renderSlotBodyCell,
      renderInput: TableColumn.renderInput,
      renderInputSlot: TableColumn.renderSlotInputCell,
      stripe: this.stripe,
      stripeColor: this.stripeColor,
      tableId: this.#id,
      styler: this.#styler,
      formatter: this.__formatter,
      cellStyleMap: this.cellStyleMap,
      cellClassMap: this.cellClassMap,
      cellNoteMap: this.cellNoteMap
    });

    return rs;
  }
  /**
   * 重置视口数据，用于 动态列变更/数据重置 等等
   */
  reload() {
    //reset
    this.cellStyleMap = {}
    this.cellClassMap = {}
    this.cellNoteMap = {}
    let dataSize = size(this._innerData) || 0;

    //head渲染后，计算body高度及滚动高度
    let headHeight = this.getHeaderHeight();

    this.tableHeight = this.el_table.offsetHeight;
    let bodyHeight = (this.bodyHeight = this.tableHeight - headHeight);
    let scrollHeight = this.rowHeight * dataSize + headHeight;
    this.el_body_scroller_y.style.height = scrollHeight + "px";

    //计算视口最大显示行数
    let viewRowCount = Math.ceil(bodyHeight / this.rowHeight);
    viewRowCount += parseInt(this.cacheCount * 2 + ""); //缓冲
    this.viewRowCount = viewRowCount;

    //计算渲染首行
    let firstviewRowIndex = 0;

    //生成用于视口显示的行数 = 视口高度行数 * 2
    //在1.5倍处标记append，用于append数据
    let tbodyHTML = this.#getTbodyHTML(
      this._innerData.slice(firstviewRowIndex, viewRowCount),
      firstviewRowIndex
    );

    let grids = this.el_table.querySelectorAll(".body-grid:not(.rod)");
    grids[1].innerHTML = tbodyHTML;

    this.changeWidth();

    this.__setSlot()

    this.onReload();
  }
  onReload() { }
  /**
   * 更新视口数据，用于 插入/删除/筛选等，不刷新列，仅用于数据行变动
   */
  updateData(dataIndex?: number) {
    let dataSize = size(this._innerData) || 0;

    //head渲染后，计算body高度及滚动高度
    let headHeight = this.getHeaderHeight();

    this.tableHeight = this.el_table.offsetHeight;
    let bodyHeight = (this.bodyHeight = this.tableHeight - headHeight);
    let scrollHeight = this.rowHeight * dataSize + headHeight;
    this.el_body_scroller_y.style.height = scrollHeight + "px";

    //计算视口最大显示行数
    let viewRowCount = Math.ceil(bodyHeight / this.rowHeight);
    viewRowCount += parseInt(this.cacheCount * 2 + ""); //缓冲
    this.viewRowCount = viewRowCount;

    let st = this.el_table.scrollTop;
    if (!dataIndex) {
      dataIndex = (st / this.rowHeight) >> 0;
    }

    let updatePageIndex = 1;
    if (dataSize - dataIndex < viewRowCount) {
      updatePageIndex = 2
    } else if (dataIndex < viewRowCount) {
      updatePageIndex = 0
    }

    let rodHeight = dataIndex * this.rowHeight;

    this.#el_body_rod.style.height = rodHeight + 'px';

    //生成用于视口显示的行数 = 视口高度行数 * 2
    //在1.5倍处标记append，用于append数据
    let tbodyHTML = this.#getTbodyHTML(
      this._innerData.slice(dataIndex, dataIndex + this.viewRowCount),
      dataIndex
    );

    let grids = this.el_table.querySelectorAll(".body-grid");
    grids[0].innerHTML = grids[2].innerHTML = '';
    grids[1].innerHTML = tbodyHTML;

    this.renderRoot.classList.toggle('__empty', isEmpty(this._innerData))

    this.__setSlot()
  }
  onScrollEnd(e: Event) {
    let t = e.target as HTMLElement;
    // console.log(
    //   "滚动结束",
    //   (window as any).zzz,
    //   (window as any).zzz1,
    //   this.el_table.scrollTop
    // );
  }
  scrollHandle(
    e: { target: HTMLElement; currentTarget?: HTMLElement },
    fromThis: boolean = false
  ) {
    let t = this.el_table;

    //fixed shadow
    this.el_thead_ext.classList.toggle("fixed", t.scrollTop > 0);
    this.el_thead.classList.toggle("fixed", t.scrollTop > 0);
    this.el_table.classList.toggle("fixed-left", t.scrollLeft > 0);

    let deviationV = t.scrollTop - this.#lastScrollTop;
    let deviationH = t.scrollLeft - this.#lastScrollLeft;

    this.#lastScrollTop = t.scrollTop;
    this.#lastScrollLeft = t.scrollLeft;
    if (Math.abs(deviationV) > 0) {
      this.doScrollV(deviationV, t.scrollTop);
    } else {
      this.doScrollH(deviationH, t.scrollLeft);
    }
    this.onScroll(Math.abs(deviationV) > 0);
  }
  doScrollV(deviation: number, scrollTop: number, fromThis: boolean = false) {
    if (Math.abs(deviation) < 10 && !fromThis) return;
    let dir = "";
    let tbodyHTML = "";

    let dataIndex = (scrollTop / this.rowHeight) >> 0;
    if (deviation >= 0) {
      dir = "down";
    } else {
      dir = "up";
    }

    let bodyRect = this.el_thead.getBoundingClientRect();
    let bodyY = bodyRect.y + this.getHeaderHeight();
    if (dir === "down") {
      //检测apppend高度<bodyHeight
      let bottomRow = this.el_table.querySelector(
        "tr.bottom-loader:not(.invalid)"
      ) as HTMLElement;
      //bottom
      if (!bottomRow) {
        let lastBottomLoader = myfx
          .chain(
            this.el_table.querySelectorAll(".body-grid:not(.rod) tr.bottom-loader")
          )
          .last();
        let br = lastBottomLoader.value();
        let index = lastBottomLoader.get("dataset.index").value();

        //正常情况下，当没有有效底部loader时，最后一个bottomRow的index必须是 rowcount，如果不是，则需要定位
        if (index != this.rowCount - 1) {
          bottomRow = br;
        } else {
          return;
        }
      }

      let bottomRect = bottomRow.getBoundingClientRect();

      if (bottomRect.y - bodyY < this.bodyHeight) {
        console.log("down loader data-index:", bottomRow.dataset.index);

        let startIndex = parseInt(bottomRow.dataset.index!) + 1;
        let rodHeight = 0;

        if (bottomRect.y < 0) {
          //处理拖动滚动条后距离过大的问题
          if (dataIndex > this.rowCount) {
          } else {
            startIndex = dataIndex;
          }

          rodHeight = dataIndex * this.rowHeight;
        }
        //已有数据不更新
        let nextIndex = -1;
        if (bottomRow.parentElement?.nextElementSibling) {
          let nextTopLoader =
            bottomRow.parentElement.nextElementSibling.querySelector(
              ".top-loader"
            ) as HTMLElement;
          nextIndex = nextTopLoader
            ? parseInt(nextTopLoader.dataset.index!)
            : -1;
        }

        if (parseInt(bottomRow.dataset.index!) + 1 != nextIndex) {
          tbodyHTML = this.#getTbodyHTML(
            this._innerData.slice(startIndex, startIndex + this.viewRowCount),
            startIndex
          );
          if (tbodyHTML.trim()) {
            rodHeight
              ? this.#jumpToFirst(
                tbodyHTML,
                startIndex,
                this.viewRowCount,
                "down"
              )
              : this.#bottomLoad(
                bottomRow.parentElement!,
                tbodyHTML,
                this.viewRowCount
              );
          } else {
            //剩余sibling全部清空
            let ne1: any = myfx.get(
              bottomRow.parentNode,
              "nextElementSibling",
              {}
            );
            if (ne1) ne1.innerHTML = "";
            let ne2: any = myfx.get(
              bottomRow.parentNode,
              "nextElementSibling.nextElementSibling",
              {}
            );
            if (ne2) ne2.innerHTML = "";
          }
        }

        bottomRow.classList.toggle("invalid", true);
      }
    } else {
      //检测apppend高度<bodyHeight
      let topRow = this.el_table.querySelector(
        "tr.top-loader:not(.invalid)"
      ) as HTMLElement;
      //bottom
      if (!topRow || topRow.dataset.index === "0") {
        return;
      }

      let topRect = topRow.getBoundingClientRect();
      if (topRect.y - bodyY > 0) {
        console.log(
          "up load ready, data-index:",
          topRow.dataset.index,
          dataIndex
        );
        let startIndex = parseInt(topRow.dataset.index!) - this.viewRowCount;
        if (startIndex < 0) {
          startIndex = 0;
        }
        let rodHeight = null;

        if (topRect.y - bodyY > this.bodyHeight) {
          //处理拖动滚动条后距离过大的问题
          startIndex = dataIndex;
          rodHeight = dataIndex * this.rowHeight;
          console.log("up load rodHeight", rodHeight, startIndex);
        }

        tbodyHTML = this.#getTbodyHTML(
          this._innerData.slice(startIndex, startIndex + this.viewRowCount),
          startIndex
        );
        if (tbodyHTML.trim()) {
          rodHeight != null
            ? this.#jumpToFirst(tbodyHTML, startIndex, this.viewRowCount, "up")
            : this.#topLoad(
              topRow.parentElement!,
              tbodyHTML,
              this.viewRowCount
            );
        } else {
          this.#el_body_rod.style.height = "0";
        }

        topRow.classList.toggle("invalid", true);

        return false;
      }
    }
  }
  doScrollH(deviation: number, scrollLeft: number) {
    // this.el_thead.style.marginLeft = -scrollLeft + "px";
  }

  //顶点插入
  #jumpToFirst(
    listHTML: string,
    startIndex: number,
    viewRowCount: number,
    dir: string
  ) {
    console.log("jumpToFirst", dir, startIndex);
    let firstGrid = this.el_table.querySelector(
      ".body-grid:not(.rod)"
    ) as HTMLElement;
    firstGrid.innerHTML = listHTML;
    //底部修正
    if (startIndex + viewRowCount > this._innerData.length) {
      myfx.set(myfx.get(firstGrid, "nextElementSibling"), "innerHTML", "");
      myfx.set(
        myfx.get(firstGrid, "nextElementSibling.nextElementSibling"),
        "innerHTML",
        ""
      );

      firstGrid!
        .querySelector(".bottom-loader")!
        .classList.toggle("invalid", true);
    }

    this.#el_body_rod.style.height = this.el_table.scrollTop + "px";

    this.__setSlot()
  }
  //追加列表
  #bottomLoad(tbody: HTMLElement, listHTML: string, viewRowCount: number) {
    let target = tbody.nextElementSibling;
    if (target) {
      target.innerHTML = listHTML;
    } else {
      //rotate
      let firstGrid = this.el_table.querySelector(
        ".body-grid:not(.rod)"
      ) as HTMLElement;
      firstGrid.parentElement!.removeChild(firstGrid);
      tbody.insertAdjacentHTML(
        "afterend",
        `<tbody class="body-grid">${listHTML}</tbody>`
      );
    }

    //rod 高度
    let firstRow = this.el_table.querySelector(
      ".c-table .body-grid:not(.rod)>.top-loader"
    ) as HTMLElement;
    let rowIndex = parseInt(firstRow.dataset.index + "") || 0;
    this.#el_body_rod.style.height = rowIndex * this.rowHeight + "px";
    //4. reloadable
    tbody.querySelector(".top-loader")!.classList.remove("invalid");

    this.__setSlot()
  }
  //插入列表
  #topLoad(tbody: HTMLElement, listHTML: string, viewRowCount: number) {
    let target = tbody.previousElementSibling;
    let tot = tbody.offsetTop;
    console.time('start topLoad')

    if (target && !target.classList.contains("rod")) {
      target.innerHTML = listHTML;
      console.log("topLoad target");
    } else {
      console.time('start insertAdjacentHTML')
      //rotate
      let lastGrid = this.el_table.querySelector(
        ".body-grid:not(.rod):last-child"
      ) as HTMLElement;

      lastGrid.parentElement!.removeChild(lastGrid);

      tbody.insertAdjacentHTML(
        "beforebegin",
        `<tbody class="body-grid">${listHTML}</tbody>`
      );

      tot -= this.rowHeight * viewRowCount;
      console.timeEnd('start insertAdjacentHTML')
    }

    console.time('xxx topLoad')
    let firstRow = this.el_table.querySelector(
      ".c-table .body-grid:not(.rod)>.top-loader"
    ) as HTMLElement;
    let rowIndex = parseInt(firstRow.dataset.index + "") || 0;
    this.#el_body_rod.style.height = rowIndex * this.rowHeight + "px";

    //4. reappendable
    let lastGrid = tbody.nextElementSibling || tbody;
    let bottomLoader = lastGrid.querySelector(".bottom-loader");
    bottomLoader && bottomLoader.classList.remove("invalid");

    console.timeEnd('xxx topLoad')

    this.__setSlot()

    console.timeEnd('start topLoad')
  }

  setData(data: Array<Record<string, any>>) {
    this._innerData = cloneDeep(data);
    this.renderRoot.classList.toggle('__empty', isEmpty(data))

    if (this.isMounted)
      this.reload();
    else {
      this.nextTick(() => {
        this.reload();
      })
    }
  }
  getData() {
    return cloneDeep(this._innerData)
  }
  __setSlot() {
    //slot-scope-attrs & slot-scope-inject
    each(this.el_body_table.querySelectorAll('[slot-scope-attrs]'), el => {
      let td = el.closest('td')
      if (!td) return;

      let rowIndex = this.getRowIndex(td);
      let colIndex = this.getColIndex(td);
      let column = cloneDeepWith(this.renderColumns[colIndex], clone, (v, k: string) => k === 'slots');
      let row = cloneDeep(this._innerData[rowIndex])

      el.setAttribute('rowIndex', rowIndex + '');
      el.setAttribute('colIndex', colIndex + '');
      el.setAttribute('column', JSON.stringify(column) + '');
      el.setAttribute('row', JSON.stringify(row) + '');

      el.removeAttribute('slot-scope-attrs')
    });
    each(this.el_body_table.querySelectorAll('[slot-scope-inject]'), el => {
      let td = el.closest('td')
      if (!td) return;

      let rowIndex = this.getRowIndex(td);
      let colIndex = this.getColIndex(td);
      let column = cloneDeepWith(this.renderColumns[colIndex], clone, (v, k: string) => k === 'slots');
      let row = cloneDeep(this._innerData[rowIndex])

      el.removeAttribute('slot-scope-inject')

      let slotScopeInject = get(el, 'slotScopeInject')
      if (isFunction(slotScopeInject)) {
        slotScopeInject({ rowIndex, colIndex, column, row })
      }
    });
  }
  setFormatter(formatter: (scope: Record<string, any>) => string) {
    this.__formatter = formatter
  }
  setStyler(styler: (scope: Record<string, any>) => string) {
    this.#styler = styler
  }
  _getCellDom(rowIndex: string | number, colIndex: string | number) {
    return this.el_body_table.querySelector(
      `td[data-row-index="${rowIndex}"][data-column-index="${colIndex}"]`
    ) as HTMLElement;
  }
  //更新某列视图值
  updateColumnCells(prop: string, values: any[] | Record<string, any>, syncData: boolean = false) {
    //1. 设置dom
    let colIndex = this.renderColumns.findIndex(col => col.prop === prop)
    let colMeta = this.renderColumns[colIndex];
    if (!colMeta) return;

    let viewRowCount = Math.ceil(this.bodyHeight / this.rowHeight);
    let startRowIndex = Math.ceil(this.el_table.scrollTop / this.rowHeight);
    let endRowIndex = startRowIndex + viewRowCount
    let rowKey = this.rowKey

    //查找对应rowIndex
    let valueIndexMap: Record<string, any> = {}
    if (isObject(values)) {
      each(this._innerData, (r, i: number) => {
        let v = get(values, r[rowKey])
        let hasValue = isDefined(v)
        if (hasValue && i >= startRowIndex && i <= endRowIndex) {
          valueIndexMap[i] = v
        }
      })
    }

    //仅更新可视区
    each(range(startRowIndex, endRowIndex), ri => {
      let td = this._getCellDom(ri, colIndex)
      if (!td) return;
      let v = undefined
      if (isArray(values)) {
        v = values[ri]
      } else {
        v = valueIndexMap[ri]
      }
      let cell = td.querySelector('div.view')
      if (cell && isDefined(v)) {
        cell.innerHTML = v ?? '';
      }
    })
    //2. 更新data
    if (syncData && !isEmpty(this._innerData)) {
      if (isArray(values)) {
        each(values, (v, i: number) => {
          let row = this._innerData[i];
          if (row)
            row[colMeta.prop!] = v;
        })
      } else {
        each(values, (v, k) => {
          let row = find(this._innerData, r => r[rowKey] == k);
          if (row)
            row[colMeta.prop!] = v;
        })
      }

    }

  }
}
