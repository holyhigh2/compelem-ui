import { CompElem, csscope, Csscope, debounced, h, prop, query, tag, Template, watch } from "compelem";
import { cloneDeep, each, filter, findIndex, first, get, includes, isEmpty, isObject, isString, isUndefined, last, map, some } from "myfx";
import { STATS_METRICS, STATS_METRICS_BASE } from "../../../constants";
import { useToast } from "../../overlays/toast/toast";
import { Editable } from "../table/Editable";
import { SCROLLER_COL_PROP, Table } from "../table/Table";
import { CellPos, CellSpan } from "../table/types";
import { expand } from "./expander";
import type { ReportDataSource } from "./model";
import { BAND_COLORS, BAND_LABELS, BandType, createDefaultTemplate, DEFAULT_REPORT_DATA, ReportTemplate } from "./model";
import style from "./style.scss?tmpl";

const RID_PROP = '__rid';
const BAND_TYPE_PROP = '__bandType';
const FX_PREFIX = '=';
const EXPR_RE = /\{\{[^}]+\}\}|\{param\.|^\{(sum|avg|min|max|count|group\.|rownum|page)/;

/** 单元格样式 → CSS 文本：按行号 + 列 prop 定位（l-editable / l-table 共用） */
export interface CellStyleRef { rowIndex: number; prop: string; style: Record<string, string>; }
export function buildCellStyleCss(styles: CellStyleRef[]): string {
  const decls: string[] = [];
  each(styles, (s) => {
    const props: string[] = [];
    each(s.style, (v, k) => { if (v != null && v !== '') props.push(`${k}:${v}`); });
    if (!props.length) return;
    decls.push(`.ce-table-row[data-row-sn="${s.rowIndex + 1}"] .ce-table-cell[column="${s.prop}"]{${props.join(';')}}`);
  });
  return decls.join('\n');
}

/** 把样式表注入组件 renderRoot（key 防重复；空文本则移除） */
export function applyStyleSheet(host: Element, cssText: string, key = 're-style') {
  const root: ShadowRoot | null = (host as any).renderRoot || host.shadowRoot;
  if (!root) return;
  root.querySelector(`style[data-re-style="${key}"]`)?.remove();
  if (!cssText) return;
  const el = document.createElement('style');
  el.setAttribute('data-re-style', key);
  el.textContent = cssText;
  root.appendChild(el);
}

/** 区域类型下拉选项 */
const BAND_SELECT_OPTIONS = map(BAND_LABELS, (text, value) => ({ label: text, value }));
/** 统计类型下拉选项（转 l-select data 格式） */
const STATS_SELECT_OPTIONS = map(
  [
    { text: '取消统计', value: '' },
    { text: '求和', value: 'sum' },
    { text: '平均值', value: 'mean' },
    { text: '最大值', value: 'max' },
    { text: '最小值', value: 'min' },
    { text: '中位数', value: 'median' },
    { text: '极差', value: 'range' },
    { text: '已填写数', value: 'filled' },
    { text: '未填写数', value: 'notfilled' },
  ],
  (o) => ({ label: o.text, value: o.value })
);

/**
 * 单元格文本分类：= 前缀→fx；含报表 token→expr；其余→value
 */
function classifyCellText(text: any): { value?: string; expr?: string; fx?: string } {
  if (text == null) return {};
  const s = String(text);
  if (s.startsWith(FX_PREFIX)) return { fx: s };
  if (EXPR_RE.test(s)) return { expr: s };
  return { value: s };
}

/**
 * 报表编辑器组件
 * 在 l-editable（编辑界面）+ l-table（全屏预览）之上构造的报表设计器：
 *  - 设计态：左栏 l-editable 绘制模板（文本/表达式/公式），行按区域着色，
 *    支持原生单元格编辑、复制粘贴、填充、右键插行删行；右栏为设置面板（样式 / 数据源）
 *  - 预览态：全屏 l-table 渲染（区域循环展开、表达式求值、公式计算、合并、列统计）
 *  - 区域循环：选中行标记为 标题/表头/明细/分组尾/页脚/汇总，明细区按数据集重复展开
 *  - 表达式：{{field}} {param.x} {sum(f)} {group.sum(f)} {rownum}；公式 =SUM(A1:A5)，
 *    模板中以 {r} 表示当前行展开后的绝对行号
 *  - 合并：框选后工具栏/右键菜单合并、拆分（循环区内合并仅限区域内部行）
 *  - 统计：列尾统计（l-select 设置选中列的统计类型）+ 汇总区聚合表达式
 *  - 数据源：SQL / 表名两种配置，明细数据由宿主注入的执行器或事件提供（组件不直连数据库）
 *  - 单元格样式：背景色/文字色/字号/粗斜下划线/对齐，作用于选区并写入模板 cell.style，
 *    设计区与预览区一致回显
 *
 * 已知框架约束与规避：
 * 1. compelem 的 model prop setter 仅 emit('update:xxx') 而不存储值，
 *    因此 template / reportData / params 不用 @prop(model:true)，改用普通访问器手动存储并驱动刷新。
 * 2. render 仅执行一次构建静态骨架，后续所有状态变更（模式切换/面板显隐/Tab 切换）均直接操作 DOM，
 *    避免模板重渲染破坏内部 l-editable / l-table 的状态。
 * 3. 动态创建 l-column 在编辑器 mounted 之后的 nextTick 进行，确保容器先完成 upgrade，
 *    列的 tableRef 解析正常。
 * 4. 预览刷新复用 l-table 内部 mixin 方法（_pushFxQueue/_setStat/__spanCells），
 *    与库内其他组件复用内部 API 的风格一致。
 *
 * @props（attribute）
 *  height {string} 组件高度，默认 100%
 * @properties（命令式）
 *  template {ReportTemplate} 报表模板
 *  reportData {any[]} 预览数据集（明细区循环数据源）
 *  params {Record<string, any>} 报表参数（{param.x} 表达式取值）
 *  dataSourceLoader {(ds, params) => Promise<any[]>} 数据源执行器（宿主注入，负责真实 SQL/表查询）
 * @events
 *  templatechange({template}) 模板内容变更后触发（防抖）
 *  datasourcerequest({dataSource, params, respond}) 未注入 loader 时触发，宿主可用 respond(rows) 返回数据
 *  previewready() 预览渲染（含公式计算与统计）完成后触发
 * @methods
 *  getTemplate() 获取当前模板
 *  setTemplate(tpl) 设置模板并重绘画布
 *  exportTemplate() 导出模板 JSON 字符串
 *  importTemplate(json) 导入模板 JSON，成功返回 true
 *  getEditor() 获取内部 l-editable 实例
 *  getPreviewTable() 获取内部 l-table 实例
 *  loadDataSource(ds?) 按数据源配置加载明细数据（缺省用 template.dataSource）
 *
 * @author holyhigh2
 */
@tag("l-report-editor")
export class ReportEditor extends CompElem<null> {
  // —— 对外模型（普通访问器，手动驱动刷新）——
  private _tmpl: ReportTemplate | null = null;
  private _rdata: any[] | null = null;
  private _params: Record<string, any> | null = null;

  /** 设计态合并信息：{prop: [{rowIndex, rowSpan, colSpan}]}，行号为设计态全局行号 */
  private _designSpan: Record<string, CellSpan[]> = {};
  /** 预览态合并信息（expand 产出） */
  private _previewSpan: Record<string, CellSpan[]> = {};
  /** 预览列统计配置 */
  private _previewColStats: Record<string, string> = {};
  /** 预览态单元格样式（expand 产出，供 _applyPreviewStyles 注入） */
  private _previewCellStyles: CellStyleRef[] = [];
  /** 生成列 prop 用的自增序号 */
  private _colSeq = 0;

  mode: 'design' | 'preview' = 'design';
  /** 组件高度，默认 100%（文档声明但未实现，此处补全） */
  @prop({ type: String }) height: string = '100%'
  @watch('height')
  watchHeight(nv: string) {
    this.style.height = nv || '100%'
  }
  toast = useToast();

  /**
   * 数据源执行器（宿主注入）：按数据源配置返回明细数据集。
   * 组件不直连数据库——SQL / 表查询一律交由宿主执行（可连后端 / 直连受控数据库）。
   * 未注入时，_loadDataSource 会 emit 'datasourcerequest' 事件，宿主可用 detail.respond(rows) 响应。
   */
  dataSourceLoader?: (ds: ReportDataSource, params: Record<string, any>) => Promise<any[]>;

  @query('#re-editor')
  editor!: Editable;
  @query('#re-preview')
  previewTable!: Table;
  @query('.ce-reporteditor-split')
  splitPane!: HTMLElement;
  @query('.ce-reporteditor-preview-full')
  previewFull!: HTMLElement;
  @query('.ce-reporteditor-data-panel')
  dataPanel!: HTMLElement;
  @query('.ce-reporteditor-data-text')
  dataText!: HTMLTextAreaElement;
  @query('.ce-reporteditor-file-input')
  fileInput!: HTMLInputElement;

  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  /////////////////////////////////// 对外属性
  set template(v: ReportTemplate) {
    this._tmpl = v && Array.isArray(v.columns) && Array.isArray(v.bands) ? v : createDefaultTemplate();
    if (this.editor) this._renderDesign();
    if (this.previewTable) this._refreshPreview();
  }
  get template(): ReportTemplate {
    if (!this._tmpl) this._tmpl = createDefaultTemplate();
    return this._tmpl;
  }
  set reportData(v: any[]) {
    this._rdata = Array.isArray(v) ? v : [];
    if (this.previewTable) this._refreshPreview();
  }
  get reportData(): any[] {
    if (!this._rdata) this._rdata = cloneDeep(DEFAULT_REPORT_DATA);
    return this._rdata;
  }
  set params(v: Record<string, any>) {
    this._params = v && isObject(v) ? v : {};
    if (this.previewTable) this._refreshPreview();
  }
  get params(): Record<string, any> {
    if (!this._params) this._params = {};
    return this._params;
  }

  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
      <l-container class="ce-reporteditor-root">
        <l-header class="ce-reporteditor-header">
          <l-toolbar title="报表编辑器" class="ce-reporteditor-toolbar">
            <l-button-group togglable required @change="${this.onModeChange}">
              <l-button size="sm" value="design" color="info" active>设计</l-button>
              <l-button size="sm" value="preview" color="info">预览</l-button>
            </l-button-group>
            <l-button-group divided>
              <l-button size="sm" @click="${this.onMerge}">合并</l-button>
              <l-button size="sm" @click="${this.onUnmerge}">拆分</l-button>
              <l-button size="sm" @click="${this.onInsertColumn}">插列</l-button>
              <l-button size="sm" @click="${this.onRemoveColumn}">删列</l-button>
            </l-button-group>
            <span class="ce-reporteditor-tb-label">区域</span>
            <l-select class="ce-reporteditor-band-select" .data="${BAND_SELECT_OPTIONS}" @change="${this.onBandSelect}"></l-select>
            <span class="ce-reporteditor-tb-label">统计</span>
            <l-select class="ce-reporteditor-stats-select" .data="${STATS_SELECT_OPTIONS}" @change="${this.onStatsSelect}"></l-select>
            <l-button size="sm" @click="${this.onOpenDataSource}">数据源</l-button>
            <l-button size="sm" @click="${this.onToggleData}">数据</l-button>
            <l-button size="sm" @click="${this.onImportClick}">导入</l-button>
            <l-button size="sm" @click="${this.onExport}">导出</l-button>
            <input type="file" class="ce-reporteditor-file-input" accept=".json,application/json" @change="${this.onImportFile}" />
          </l-toolbar>
        </l-header>
        <l-main class="ce-reporteditor-body">
          <l-container class="ce-reporteditor-split">
            <l-main class="ce-reporteditor-pane ce-reporteditor-design">
              <div class="ce-reporteditor-pane-title">设计（模板）</div>
              <div class="ce-reporteditor-pane-content">
                <l-editable id="re-editor" row-key="${RID_PROP}" show-indicator="true" row-height="36"
                  @span="${this.onEditorSpan}" @change="${this.onEditorChange}"
                  @select="${this.onEditorSelect}" @contextmenuselect="${this.onEditorMenuSelect}"></l-editable>
              </div>
            </l-main>
            <l-aside class="ce-reporteditor-pane ce-reporteditor-settings" width="300px">
              <div class="ce-reporteditor-pane-title">设置</div>
              <div class="ce-reporteditor-settings-tabs">
                <button type="button" class="ce-reporteditor-tab is-active" data-tab="style">样式</button>
                <button type="button" class="ce-reporteditor-tab" data-tab="datasource">数据源</button>
              </div>
              <div class="ce-reporteditor-pane-content">
                <div class="ce-reporteditor-tab-panel ce-reporteditor-style">
                  <div class="ce-reporteditor-style-row">
                    <label>背景色</label>
                    <input type="color" class="ce-reporteditor-style-bg" value="#ffffff" />
                    <button type="button" class="ce-reporteditor-style-reset" data-target="bg">清除</button>
                  </div>
                  <div class="ce-reporteditor-style-row">
                    <label>文字色</label>
                    <input type="color" class="ce-reporteditor-style-fg" value="#000000" />
                    <button type="button" class="ce-reporteditor-style-reset" data-target="fg">清除</button>
                  </div>
                  <div class="ce-reporteditor-style-row">
                    <label>字号</label>
                    <input type="number" class="ce-reporteditor-style-size" min="8" max="48" step="1" placeholder="px" />
                  </div>
                  <div class="ce-reporteditor-style-row">
                    <label>字型</label>
                    <div class="ce-reporteditor-style-toggles">
                      <button type="button" class="ce-reporteditor-style-toggle ce-reporteditor-bold" title="加粗">B</button>
                      <button type="button" class="ce-reporteditor-style-toggle ce-reporteditor-italic" title="斜体">I</button>
                      <button type="button" class="ce-reporteditor-style-toggle ce-reporteditor-underline" title="下划线">U</button>
                    </div>
                  </div>
                  <div class="ce-reporteditor-style-row">
                    <label>对齐</label>
                    <div class="ce-reporteditor-style-aligns">
                      <button type="button" class="ce-reporteditor-style-align" data-align="left">左</button>
                      <button type="button" class="ce-reporteditor-style-align" data-align="center">中</button>
                      <button type="button" class="ce-reporteditor-style-align" data-align="right">右</button>
                    </div>
                  </div>
                  <div class="ce-reporteditor-style-row ce-reporteditor-actions">
                    <button type="button" class="ce-reporteditor-style-clear-all">清除选区样式</button>
                  </div>
                </div>
                <div class="ce-reporteditor-tab-panel ce-reporteditor-datasource" style="display:none">
                  <div class="ce-reporteditor-ds-type">
                    <button type="button" class="ce-reporteditor-ds-type-btn is-active" data-type="sql">SQL</button>
                    <button type="button" class="ce-reporteditor-ds-type-btn" data-type="table">表名</button>
                  </div>
                  <div class="ce-reporteditor-ds-field ce-reporteditor-sql">
                    <label>SQL 语句</label>
                    <textarea class="ce-reporteditor-ds-sql" rows="5" spellcheck="false" placeholder="SELECT code, qty, price FROM orders"></textarea>
                  </div>
                  <div class="ce-reporteditor-ds-field ce-reporteditor-table" style="display:none">
                    <label>表名</label>
                    <input type="text" class="ce-reporteditor-ds-table" placeholder="orders / products / users" />
                    <label>字段（逗号分隔，可选）</label>
                    <input type="text" class="ce-reporteditor-ds-fields" placeholder="code, qty, price, amount" />
                  </div>
                  <div class="ce-reporteditor-ds-actions">
                    <l-button size="sm" color="primary" @click="${this.onLoadDataSource}">加载数据</l-button>
                    <span class="ce-reporteditor-ds-status"></span>
                  </div>
                  <div class="ce-reporteditor-ds-note">
                    数据源执行由宿主注入的 <code>dataSourceLoader</code> 或监听
                    <code>datasourcerequest</code> 事件完成；本组件不直连数据库。demo 内置 mock 执行器（内存样例数据，安全）。
                  </div>
                </div>
                <div class="ce-reporteditor-data-panel" style="display:none">
                  <div class="ce-reporteditor-data-panel-title">静态数据（JSON 数组，无数据源时明细区循环数据）</div>
                  <textarea class="ce-reporteditor-data-text" spellcheck="false"></textarea>
                  <div class="ce-reporteditor-data-panel-actions">
                    <l-button size="sm" color="primary" @click="${this.onApplyData}">应用</l-button>
                    <l-button size="sm" @click="${this.onToggleData}">收起</l-button>
                  </div>
                </div>
              </div>
            </l-aside>
          </l-container>
          <div class="ce-reporteditor-preview-full" style="display:none">
            <l-table id="re-preview" enable-fx row-height="36"
              @span="${this.onPreviewSpan}"></l-table>
          </div>
        </l-main>
      </l-container>
    `;
  }

  mounted() {
    // 触发默认模板/数据初始化
    void this.template;
    void this.reportData;

    this.nextTick(() => {
      // 初始选中"设计"模式（ButtonGroup 的 selectedValues 不会读取按钮上的静态 active）
      const bg = (this.renderRoot as HTMLElement | null)?.querySelector('l-button-group') as any;
      if (bg) bg.selectedValues = ['design'];
      // 等子组件 upgrade 完成后再动态建列，规避 l-column 先于容器升级导致 tableRef 丢失的问题
      this._initEditor();
      this._initPreview();
      this._initSettingsPanel();
      // 模板自带数据源配置时自动加载
      if (this.template.dataSource) this._loadDataSource(this.template.dataSource);
    });
  }

  //////////////////////////////////// 公开方法
  getTemplate(): ReportTemplate {
    return cloneDeep(this.template);
  }
  setTemplate(tpl: ReportTemplate) {
    this.template = tpl;
  }
  exportTemplate(): string {
    return JSON.stringify(this.getTemplate(), null, 2);
  }
  importTemplate(json: string): boolean {
    let tpl: any;
    try {
      tpl = JSON.parse(json);
    } catch {
      this.toast.warn('模板 JSON 解析失败');
      return false;
    }
    if (!tpl || !Array.isArray(tpl.columns) || !Array.isArray(tpl.bands) || tpl.columns.length < 1) {
      this.toast.warn('模板结构不合法（需要 columns/bands 数组）');
      return false;
    }
    // 基本规范化
    each(tpl.columns, (c: any) => {
      if (!c.prop) c.prop = 'col' + (++this._colSeq);
    });
    each(tpl.bands, (b: any) => {
      if (!Array.isArray(b.rows)) b.rows = [];
      b.type = includes(BAND_LABELS, b.type) ? b.type : 'normal';
    });
    this.template = tpl;
    this.toast.pushMessage('模板已导入');
    return true;
  }
  getEditor(): Editable {
    return this.editor;
  }
  getPreviewTable(): Table {
    return this.previewTable;
  }

  //////////////////////////////////// 初始化
  private _initEditor() {
    const editor = this.editor as any;
    if (!editor) return;
    // 设计态默认显示行列标识（行号 + 列标）：仅依赖模板属性 show-indicator="true"，
    // 在 l-editable 首次渲染前即生效，避免后期置 true 触发重渲染清空已渲染的虚拟行。
    // 设计态不开启公式计算（enableFx 默认 false）：模板行号与展开后行号不一致，
    // 单元格直接显示表达式/公式原文，由预览态负责计算

    // 注入区域/合并菜单项（Editable.onMenuSelect 不识别的自定义项在此消费）
    (editor.menuItems as any[]).unshift(
      null,
      { text: '设为标题区', band: 'title', cellNeed: true },
      { text: '设为表头区', band: 'header', cellNeed: true },
      { text: '设为明细区（循环）', band: 'detail', cellNeed: true },
      { text: '设为分组尾区', band: 'groupfooter', cellNeed: true },
      { text: '设为汇总区', band: 'summary', cellNeed: true },
      { text: '设为普通行', band: 'normal', cellNeed: true },
      null,
      { text: '合并选中区域', mergeAction: 'merge', cellNeed: true },
      { text: '拆分合并单元格', mergeAction: 'unmerge', cellNeed: true },
    );

    this._renderDesign();
  }

  private _initPreview() {
    const table = this.previewTable as any;
    if (!table) return;
    // 预览态报表自带表头区，隐藏 l-table 原生表头（布尔 prop 经 updateProps 设置，避免 attribute 字符串歧义）
    table.updateProps?.({ showHeader: false });
    this._refreshPreview();
  }

  /**
   * 模板 → 设计态：重建 l-editable 的列、行数据、合并与区域着色
   */
  private _renderDesign() {
    const editor = this.editor;
    const tmpl = this.template;
    if (!editor || !tmpl.columns.length) return;

    // 1. 重建列（保留框架内部的滚动条列 __scroller，否则 _columnMetaMap 缺少该条目，
    //    导致 Table.__setDataColumns 的数量校验 4 != size(map)-1 永远成立、scrollColumns 永不赋值、设计表体 0 行）
    each(editor.querySelectorAll(':scope > l-column'), (col: Element) => {
      if (col.getAttribute('prop') === SCROLLER_COL_PROP) return;
      col.remove();
    });
    each(tmpl.columns, (c) => {
      const col = document.createElement('l-column');
      col.setAttribute('prop', c.prop);
      if (c.title) col.setAttribute('label', c.title);
      if (c.width) col.setAttribute('width', String(c.width));
      if (c.dataType) col.setAttribute('data-type', c.dataType);
      editor.appendChild(col);
    });

    // 2. 生成行数据与设计态合并信息（行序 = bands 展开序，不含数据循环）
    const rows: Record<string, any>[] = [];
    const designSpan: Record<string, CellSpan[]> = {};
    let ri = 0;
    each(tmpl.bands, (band) => {
      each(band.rows, (row) => {
        const r: Record<string, any> = { [RID_PROP]: 'r' + ri, [BAND_TYPE_PROP]: band.type };
        each(tmpl.columns, (c) => {
          const cell = row.cols[c.prop];
          r[c.prop] = cell ? (cell.fx ?? cell.expr ?? cell.value ?? '') : '';
          const rs = cell?.span?.rowSpan ?? 1;
          const cs = cell?.span?.colSpan ?? 1;
          if (rs > 1 || cs > 1) {
            if (!designSpan[c.prop]) designSpan[c.prop] = [];
            designSpan[c.prop].push({ rowIndex: ri, rowSpan: rs, colSpan: cs });
          }
        });
        rows.push(r);
        ri++;
      });
    });
    this._designSpan = designSpan;

    // 3. 写入数据并应用合并/着色/样式
    editor.setData(rows);
    this.nextTick(() => {
      this._applyDesignSpan();
      this._paintBands();
      this._applyDesignStyles();
    });
  }

  /** 把 _designSpan 应用到设计表格（__spanCells 是 TableExtensionSpan 内部方法） */
  private _applyDesignSpan() {
    const editor = this.editor as any;
    if (!editor) return;
    editor.__spanObj = this._designSpan;
    editor.__spanCells(this._designSpan);
  }

  /** 按区域类型给设计态行着色 */
  private _paintBands() {
    const editor = this.editor as any;
    if (!editor) return;
    const rows: any[] = editor.getData?.() ?? [];
    each(rows, (row, i) => {
      const type: BandType = row[BAND_TYPE_PROP] || 'normal';
      const color = BAND_COLORS[type] ?? 'transparent';
      editor.setRowStyle(color === 'transparent' ? '' : { 'background-color': color + '26' }, i);
    });
  }

  /**
   * 设计态 → 模板：从 l-editable 行数据（含 __bandType）重建 bands，
   * 相邻同类型行归并为一个多行区域；同类型区域继承原配置（loop/groupBy）
   */
  private _syncFromDesign() {
    const editor = this.editor as any;
    const tmpl = this.template;
    if (!editor) return;
    const rows: any[] = editor.getData?.() ?? [];

    const bands: typeof tmpl.bands = [];
    const rowIndexMap: Array<{ band: number; rowInBand: number }> = [];
    each(rows, (row, i) => {
      const type: BandType = row[BAND_TYPE_PROP] || 'normal';
      let band = last(bands);
      if (!band || band.type !== type) {
        // 继承旧模板中同类型区域的配置
        const prev = filter(tmpl.bands, (b) => b.type === type);
        band = { type, loop: first(prev)?.loop, groupBy: first(prev)?.groupBy, rows: [] };
        if (type === 'detail' && !band.loop) band.loop = 'default';
        bands.push(band);
      }
      const cols: Record<string, any> = {};
      each(tmpl.columns, (c) => {
        cols[c.prop] = classifyCellText(row[c.prop]);
      });
      band.rows.push({ cols });
      rowIndexMap.push({ band: bands.length - 1, rowInBand: band.rows.length - 1 });
    });

    // 合并信息回写：设计态全局行号 → band 行（cols 由 classifyCellText 全新构建，
    // span 完全以 _designSpan 为准回写，无旧值残留问题）
    each(this._designSpan, (spans, prop) => {
      each(spans, (sp) => {
        const pos = rowIndexMap[sp.rowIndex];
        if (!pos) return;
        const band = bands[pos.band];
        const bandLen = band.rows.length;
        const rowSpan = Math.min(sp.rowSpan, bandLen - pos.rowInBand);
        if (rowSpan < 1) return;
        const cell = band.rows[pos.rowInBand].cols[prop];
        if (cell) cell.span = { rowSpan, colSpan: sp.colSpan };
      });
    });

    tmpl.bands = bands;
    this._paintBands();
    this._refreshPreview();
    this._emitTemplateChange();
  }

  @debounced(200)
  private _emitTemplateChange() {
    this.emit('templatechange', { template: this.getTemplate() });
  }

  //////////////////////////////////// 预览
  /** 把 模板+数据 展开后喂给 l-table：列/数据/合并 → 公式 → 统计 */
  @debounced(150)
  _refreshPreview() {
    const table = this.previewTable as any;
    const tmpl = this.template;
    if (!table || !tmpl.columns.length) return;

    const hasStats = some(tmpl.columns, (c) => !!c.stats);

    // 1. 重建预览列（同样保留框架内部滚动条列 __scroller，与 _renderDesign 同因：
    //    否则 _columnMetaMap 缺条目，__setDataColumns 数量校验不通过、scrollColumns 永不赋值、预览表体 0 行）
    each(table.querySelectorAll(':scope > l-column'), (col: Element) => {
      if (col.getAttribute('prop') === SCROLLER_COL_PROP) return;
      col.remove();
    });
    each(tmpl.columns, (c) => {
      const col = document.createElement('l-column');
      col.setAttribute('prop', c.prop);
      if (c.title) col.setAttribute('label', c.title);
      if (c.width) col.setAttribute('width', String(c.width));
      if (c.dataType) col.setAttribute('data-type', c.dataType);
      if (c.stats) col.setAttribute('stats', c.stats);
      table.appendChild(col);
    });
    if (hasStats) table.setAttribute('show-footer', '');
    else table.removeAttribute('show-footer');

    // 2. 展开
    const { rows, spanObj, fxCells, colStats, cellStyles } = expand(tmpl, this.reportData, this.params);
    rows.forEach((r, i) => (r.id = i)); // rowKey 兜底
    this._previewSpan = spanObj;
    this._previewColStats = colStats;
    this._previewCellStyles = cellStyles;

    // 3. 数据 + 合并
    table.setData(rows);
    // setData 的 calcBounding 是 100ms 防抖，与虚拟列表初始化存在竞争，这里立即同步布局
    table.scroller?.calcBounding_$__?.();

    // 4. 等视图渲染后应用公式与统计
    this.nextTick(() => {
      this._applyPreviewStyles();
      this.nextTick(() => {
        table.__spanObj = this._previewSpan;
        table.__spanCells(this._previewSpan);

        const fxPromises: Promise<any>[] = [];
        each(fxCells, (fc) => {
          const formulaStr = get(table.innerData, [fc.rowIndex, fc.prop], '');
          if (isString(formulaStr) && formulaStr.startsWith('=')) {
            fxPromises.push(table._pushFxQueue(formulaStr, fc.rowIndex, fc.prop, true));
          }
        });
        Promise.all(fxPromises).then(() => {
          // 公式结果回写 innerData（列统计读 renderList）
          table.valueMap.forEach((v: any, key: string) => {
            const idx = key.lastIndexOf('@');
            if (idx < 0) return;
            const prop = key.slice(0, idx);
            const ri = parseInt(key.slice(idx + 1), 10);
            if (table.innerData[ri]) table.innerData[ri][prop] = v;
          });
          // 列统计（_setStat 为 TableExtensionStats 内部方法）
          if (hasStats && !this._previewColStatsEmpty()) {
            if (table._columnFootMap && table._columnFootMap.size < 1) {
              table._appendColumn_$__?.();
            }
            table._setStat?.(this._previewColStats, STATS_METRICS_BASE, STATS_METRICS);
          }
          this.emit('previewready');
        });
      });
    });
  }
  private _previewColStatsEmpty(): boolean {
    return isEmpty(this._previewColStats);
  }

  //////////////////////////////////// 事件：设计表格
  onEditorSpan(obj: Record<string, any>) {
    obj.setSpan(this._designSpan);
  }
  onPreviewSpan(obj: Record<string, any>) {
    obj.setSpan(this._previewSpan);
  }
  onEditorSelect(_obj: Record<string, any>) {
    // 选区变化时刷新样式面板（展示选中单元格当前样式）
    if (this._settingsTab === 'style') this._readSelectionStyle();
  }
  onEditorChange(obj: Record<string, any>) {
    const type = obj?.type;
    if (type === 'insert' || type === 'remove') {
      // 行数变化：新行无区域标记（普通行），重建 bands 并重着色
      this._syncFromDesign();
    } else {
      // 单元格文本变更：回写模板并刷新预览（不重绘设计区，保持编辑状态）
      this._syncFromDesignLight();
    }
  }
  /** 仅同步单元格文本到模板（不改行结构、不重着色） */
  @debounced(300)
  private _syncFromDesignLight() {
    const editor = this.editor as any;
    const tmpl = this.template;
    if (!editor) return;
    const rows: any[] = editor.getData?.() ?? [];
    let ri = 0;
    each(tmpl.bands, (band) => {
      each(band.rows, (row) => {
        const src = rows[ri++];
        if (!src) return;
        each(tmpl.columns, (c) => {
          row.cols[c.prop] = classifyCellText(src[c.prop]);
        });
      });
    });
    this._refreshPreview();
    this._emitTemplateChange();
  }
  onEditorMenuSelect(obj: Record<string, any>) {
    const item = obj?.item;
    if (!item) return;
    if (item.band) {
      this._applyBandToSelection(item.band);
    } else if (item.mergeAction === 'merge') {
      this.onMerge();
    } else if (item.mergeAction === 'unmerge') {
      this.onUnmerge();
    }
  }

  //////////////////////////////////// 工具栏动作
  onModeChange(obj: Record<string, any>) {
    const mode = obj?.value || 'design';
    this.mode = mode === 'preview' ? 'preview' : 'design';
    this._applyMode();
  }
  /** 两态布局：design = 设计画布 + 右侧设置栏；preview = 全屏预览 l-table */
  private _applyMode() {
    const isDesign = this.mode !== 'preview';
    if (this.splitPane) this.splitPane.style.display = isDesign ? '' : 'none';
    if (this.previewFull) this.previewFull.style.display = isDesign ? 'none' : '';
    this.nextTick(() => {
      if (!isDesign) this._refreshPreview();
      (this.previewTable as any)?.relayout?.();
      (this.editor as any)?.relayout?.();
    });
  }

  //////////////////////////////////// 设置面板（样式 / 数据源）
  private _settingsTab = 'style';
  private _initSettingsPanel() {
    const root: any = this.renderRoot;
    if (!root) return;
    // Tab 切换
    each(Array.from(root.querySelectorAll('.ce-reporteditor-tab')), (btn: HTMLElement) => {
      btn.addEventListener('click', () => this._switchSettingsTab((btn as HTMLElement).dataset.tab || 'style'));
    });
    // 样式控件
    const bg = root.querySelector('.ce-reporteditor-style-bg') as HTMLInputElement | null;
    const fg = root.querySelector('.ce-reporteditor-style-fg') as HTMLInputElement | null;
    const size = root.querySelector('.ce-reporteditor-style-size') as HTMLInputElement | null;
    bg?.addEventListener('input', () => this._applyStyleToSelection({ 'background-color': bg.value }));
    fg?.addEventListener('input', () => this._applyStyleToSelection({ color: fg.value }));
    size?.addEventListener('change', () => {
      const v = parseFloat(size.value);
      if (v > 0) this._applyStyleToSelection({ 'font-size': v + 'px' });
    });
    each(Array.from(root.querySelectorAll('.ce-reporteditor-style-toggle')), (btn: HTMLElement) => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).classList.contains('--bold') ? 'font-weight'
          : (btn as HTMLElement).classList.contains('--italic') ? 'font-style'
            : 'text-decoration';
        const isOn = (btn as HTMLElement).classList.contains('--active');
        const next = key === 'font-weight' ? (isOn ? '' : 'bold')
          : key === 'font-style' ? (isOn ? '' : 'italic')
            : (isOn ? '' : 'underline');
        this._applyStyleToSelection({ [key]: next });
      });
    });
    each(Array.from(root.querySelectorAll('.ce-reporteditor-style-align')), (btn: HTMLElement) => {
      btn.addEventListener('click', () => this._applyStyleToSelection({ 'text-align': (btn as HTMLElement).dataset.align || 'left' }));
    });
    each(Array.from(root.querySelectorAll('.ce-reporteditor-style-reset')), (btn: HTMLElement) => {
      btn.addEventListener('click', () => {
        const target = (btn as HTMLElement).dataset.target;
        this._applyStyleToSelection({ [target === 'bg' ? 'background-color' : 'color']: '' });
      });
    });
    root.querySelector('.ce-reporteditor-style-clear-all')?.addEventListener('click', () => this._clearSelectionStyle());
    // 数据源控件
    each(Array.from(root.querySelectorAll('.ce-reporteditor-ds-type-btn')), (btn: HTMLElement) => {
      btn.addEventListener('click', () => {
        const type = (btn as HTMLElement).dataset.type || 'sql';
        each(Array.from(root.querySelectorAll('.ce-reporteditor-ds-type-btn')), (b: HTMLElement) => b.classList.toggle('--active', b === btn));
        const sqlField = root.querySelector('.ce-reporteditor-ds-field.ce-reporteditor-sql') as HTMLElement | null;
        const tableField = root.querySelector('.ce-reporteditor-ds-field.ce-reporteditor-table') as HTMLElement | null;
        if (sqlField) sqlField.style.display = type === 'sql' ? '' : 'none';
        if (tableField) tableField.style.display = type === 'table' ? '' : 'none';
      });
    });
    // 回填当前模板数据源配置
    this._syncDataSourcePanel();
  }

  private _switchSettingsTab(tab: string) {
    this._settingsTab = tab;
    const root: any = this.renderRoot;
    if (!root) return;
    each(Array.from(root.querySelectorAll('.ce-reporteditor-tab')), (btn: HTMLElement) => {
      btn.classList.toggle('--active', (btn as HTMLElement).dataset.tab === tab);
    });
    const stylePanel: HTMLElement | null = root.querySelector('.ce-reporteditor-tab-panel.ce-reporteditor-style');
    const dsPanel: HTMLElement | null = root.querySelector('.ce-reporteditor-tab-panel.ce-reporteditor-datasource');
    if (stylePanel) stylePanel.style.display = tab === 'style' ? '' : 'none';
    if (dsPanel) dsPanel.style.display = tab === 'datasource' ? '' : 'none';
    if (tab === 'style') this._readSelectionStyle();
    else this._syncDataSourcePanel();
  }

  /** 工具栏「数据源」入口：切到数据源 Tab 并回填配置 */
  onOpenDataSource() {
    this._switchSettingsTab('datasource');
  }

  /** 把模板 dataSource 回填到面板控件 */
  private _syncDataSourcePanel() {
    const root: any = this.renderRoot;
    if (!root) return;
    const ds = this.template.dataSource;
    const type = ds?.type || 'sql';
    each(Array.from(root.querySelectorAll('.ce-reporteditor-ds-type-btn')), (b: HTMLElement) => {
      b.classList.toggle('--active', (b as HTMLElement).dataset.type === type);
    });
    const sqlField = root.querySelector('.ce-reporteditor-ds-field.ce-reporteditor-sql') as HTMLElement | null;
    const tableField = root.querySelector('.ce-reporteditor-ds-field.ce-reporteditor-table') as HTMLElement | null;
    if (sqlField) sqlField.style.display = type === 'sql' ? '' : 'none';
    if (tableField) tableField.style.display = type === 'table' ? '' : 'none';
    const sql = root.querySelector('.ce-reporteditor-ds-sql') as HTMLTextAreaElement | null;
    if (sql) sql.value = ds?.sql || '';
    const table = root.querySelector('.ce-reporteditor-ds-table') as HTMLInputElement | null;
    if (table) table.value = ds?.table || '';
    const fields = root.querySelector('.ce-reporteditor-ds-fields') as HTMLInputElement | null;
    if (fields) fields.value = (ds?.fields || []).join(', ');
  }

  /** 从面板读取数据源配置（合并回模板） */
  private _collectDataSource(): ReportDataSource {
    const root: any = this.renderRoot;
    const cur = this.template.dataSource || { type: 'sql' as const };
    const typeBtn: HTMLElement | null = root?.querySelector('.ce-reporteditor-ds-type-btn.is-active');
    const type: 'sql' | 'table' = typeBtn?.dataset.type === 'table' ? 'table' : 'sql';
    const sql: string = root?.querySelector('.ce-reporteditor-ds-sql')?.value?.trim() || '';
    const table: string = root?.querySelector('.ce-reporteditor-ds-table')?.value?.trim() || '';
    const fields: string[] = (root?.querySelector('.ce-reporteditor-ds-fields')?.value || '')
      ?.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) || [];
    return { type, sql, table, fields: fields.length ? fields : cur.fields };
  }

  /** 工具栏「数据源」：加载当前面板配置的数据 */
  onLoadDataSource() {
    const ds = this._collectDataSource();
    if (ds.type === 'sql' && !ds.sql) { this.toast.warn('请填写 SQL 语句'); return; }
    if (ds.type === 'table' && !ds.table) { this.toast.warn('请填写表名'); return; }
    this.template.dataSource = ds;
    this._loadDataSource(ds);
  }

  /** 公开方法：按数据源配置加载明细数据（缺省用 template.dataSource） */
  async loadDataSource(ds?: ReportDataSource) {
    const source = ds ?? this.template.dataSource;
    if (!source) { this.toast.warn('请先配置数据源'); return; }
    this.template.dataSource = source;
    await this._loadDataSource(source);
  }

  /**
   * 数据源加载：loader 优先，否则 emit 'datasourcerequest'（宿主 respond 回调，3s 超时回退）。
   * 安全边界：组件不直连数据库，真实执行完全由宿主控制（建议只读账号 + 超时 + 行数上限）。
   */
  private async _loadDataSource(ds: ReportDataSource) {
    const status: HTMLElement | null = this.renderRoot ? (this.renderRoot as any).querySelector('.ce-reporteditor-ds-status') : null;
    if (status) status.textContent = '加载中...';
    let rows: any[] | null = null;
    try {
      if (typeof this.dataSourceLoader === 'function') {
        rows = await this.dataSourceLoader(ds, this.params);
      } else {
        rows = await this._requestDataSource(ds);
      }
    } catch (e: any) {
      this.toast.warn('数据源加载失败：' + (e?.message || String(e)));
      if (status) status.textContent = '加载失败';
      return;
    }
    if (Array.isArray(rows)) {
      this._rdata = rows;
      if (!ds.fields || !ds.fields.length) {
        ds.fields = rows.length ? Object.keys(rows[0]) : [];
        this._syncDataSourcePanel();
      }
      if (this.previewTable) this._refreshPreview();
      if (status) status.textContent = `已加载 ${rows.length} 行`;
      this.toast.pushMessage(`数据源已加载：${rows.length} 行`);
      this._emitTemplateChange();
    } else {
      // 超时/宿主未响应：回退现有静态数据
      if (status) status.textContent = '未获取数据（已回退静态数据）';
      this.toast.warn('数据源未返回数据（已回退静态数据）');
    }
  }

  private _requestDataSource(ds: ReportDataSource): Promise<any[] | null> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 3000);
      this.emit('datasourcerequest', {
        dataSource: ds,
        params: this.params,
        respond: (rows: any[]) => {
          if (!settled) { settled = true; clearTimeout(timer); resolve(rows); }
        },
      });
    });
  }

  //////////////////////////////////// 单元格样式（作用于选区，写入 cell.style）
  /** 设计态全局行号 → {band, rowInBand} 映射（与 _renderDesign 行序一致） */
  private _getDesignRowMap(): Array<{ band: number; rowInBand: number }> {
    const map: Array<{ band: number; rowInBand: number }> = [];
    each(this.template.bands, (band, bi) => {
      each(band.rows, (_row, ri) => { map.push({ band: bi, rowInBand: ri }); });
    });
    return map;
  }

  /** 读取选中区域左上角单元格样式并回填面板控件 */
  private _readSelectionStyle() {
    const box = this._getSelection();
    const root: any = this.renderRoot;
    if (!box || !root) return;
    const pos = this._getDesignRowMap()[box.r0];
    if (!pos) return;
    const prop = this.editor.getColumnPropByIndex(box.c0);
    const cell = this.template.bands[pos.band].rows[pos.rowInBand].cols[prop];
    const st: Record<string, string> = cell?.style || {};
    const bg = root.querySelector('.ce-reporteditor-style-bg') as HTMLInputElement | null;
    const fg = root.querySelector('.ce-reporteditor-style-fg') as HTMLInputElement | null;
    const size = root.querySelector('.ce-reporteditor-style-size') as HTMLInputElement | null;
    if (bg) bg.value = st['background-color'] || '#ffffff';
    if (fg) fg.value = st['color'] || '#000000';
    if (size) size.value = st['font-size'] ? String(parseFloat(st['font-size'])) : '';
    const bold = root.querySelector('.ce-reporteditor-style-toggle.ce-reporteditor-bold') as HTMLElement | null;
    const italic = root.querySelector('.ce-reporteditor-style-toggle.ce-reporteditor-italic') as HTMLElement | null;
    const underline = root.querySelector('.ce-reporteditor-style-toggle.ce-reporteditor-underline') as HTMLElement | null;
    bold?.classList.toggle('--active', st['font-weight'] === 'bold');
    italic?.classList.toggle('--active', st['font-style'] === 'italic');
    underline?.classList.toggle('--active', (st['text-decoration'] || '').includes('underline'));
    each(Array.from(root.querySelectorAll('.ce-reporteditor-style-align')), (btn: HTMLElement) => {
      btn.classList.toggle('--active', (btn as HTMLElement).dataset.align === (st['text-align'] || ''));
    });
  }

  /** 把样式写入当前选区所有单元格（覆盖式合并到 cell.style），空值表示清除该项 */
  private _applyStyleToSelection(partial: Record<string, string>) {
    const box = this._getSelection();
    if (!box) { this.toast.warn('请先在左侧设计区选中单元格'); return; }
    const rowMap = this._getDesignRowMap();
    for (let r = box.r0; r <= box.r1; r++) {
      const pos = rowMap[r];
      if (!pos) continue;
      const band = this.template.bands[pos.band];
      const row = band.rows[pos.rowInBand];
      for (let c = box.c0; c <= box.c1; c++) {
        const prop = this.editor.getColumnPropByIndex(c);
        // 默认模板单元格可能尚未创建（cols 为空对象），此处按需创建
        let cell = row.cols[prop];
        if (!cell) cell = row.cols[prop] = {};
        if (!cell.style) cell.style = {};
        each(partial, (v, k) => {
          if (v === '' || v == null) delete cell.style![k];
          else cell.style![k] = v;
        });
        if (isEmpty(cell.style)) delete cell.style;
      }
    }
    this._renderDesign();
    this._refreshPreview();
    this._readSelectionStyle();
    this._emitTemplateChange();
  }

  /** 清除选中区域全部样式 */
  private _clearSelectionStyle() {
    const box = this._getSelection();
    if (!box) { this.toast.warn('请先选中单元格'); return; }
    const rowMap = this._getDesignRowMap();
    for (let r = box.r0; r <= box.r1; r++) {
      const pos = rowMap[r];
      if (!pos) continue;
      const band = this.template.bands[pos.band];
      for (let c = box.c0; c <= box.c1; c++) {
        const prop = this.editor.getColumnPropByIndex(c);
        const cell = band.rows[pos.rowInBand].cols[prop];
        if (cell?.style) delete cell.style;
      }
    }
    this._renderDesign();
    this._refreshPreview();
    this._readSelectionStyle();
    this._emitTemplateChange();
    this.toast.pushMessage('已清除选中单元格样式');
  }

  /** 设计区样式回显：从模板 cell.style 生成 CSS 注入 l-editable renderRoot */
  private _applyDesignStyles() {
    const editor = this.editor as any;
    if (!editor) return;
    const styles: CellStyleRef[] = [];
    let ri = 0;
    each(this.template.bands, (band) => {
      each(band.rows, (row) => {
        each(this.template.columns, (c) => {
          const cell = row.cols[c.prop];
          if (cell?.style && !isEmpty(cell.style)) styles.push({ rowIndex: ri, prop: c.prop, style: cell.style });
        });
        ri++;
      });
    });
    applyStyleSheet(editor, buildCellStyleCss(styles), 're-style');
  }

  /** 预览区样式透传：从 expand 的 cellStyles 生成 CSS 注入 l-table renderRoot */
  private _applyPreviewStyles() {
    const table = this.previewTable as any;
    if (!table) return;
    applyStyleSheet(table, buildCellStyleCss(this._previewCellStyles), 're-style');
  }

  /** 获取设计表格当前选区 {r0,r1,c0,c1}，无选区返回 null */
  private _getSelection(): { r0: number; r1: number; c0: number; c1: number } | null {
    const sel: CellPos[] = (this.editor as any).__selectedCells;
    if (!sel || sel.length < 1) return null;
    const rIdx = map(sel, (c) => c.rowIndex);
    const cIdx = map(sel, (c) => c.colIndex);
    return {
      r0: Math.min(...rIdx), r1: Math.max(...rIdx),
      c0: Math.min(...cIdx), c1: Math.max(...cIdx),
    };
  }

  onMerge() {
    const box = this._getSelection();
    if (!box || (box.r0 === box.r1 && box.c0 === box.c1)) {
      this.toast.warn('请先框选要合并的区域');
      return;
    }
    const editor = this.editor;
    const topProp = editor.getColumnPropByIndex(box.c0);
    // 重叠检查：已有 span 落在新矩形内则拒绝
    const overlap = some(this._designSpan[topProp] ?? [], (sp) =>
      sp.rowIndex <= box.r1 && sp.rowIndex + sp.rowSpan - 1 >= box.r0
    );
    if (overlap) {
      this.toast.warn('选中区域与已有合并重叠，请先拆分');
      return;
    }
    if (!this._designSpan[topProp]) this._designSpan[topProp] = [];
    this._designSpan[topProp].push({
      rowIndex: box.r0,
      rowSpan: box.r1 - box.r0 + 1,
      colSpan: box.c1 - box.c0 + 1,
    });
    // span 回写模板后重绘设计区：__spanCells 仅更新样式映射，
    // 已渲染单元格需经 setData 重新填充才会应用合并 class
    this._syncFromDesign();
    this._renderDesign();
    this.toast.pushMessage('已合并选中区域');
  }

  onUnmerge() {
    const box = this._getSelection();
    if (!box) {
      this.toast.warn('请先选中要拆分的单元格');
      return;
    }
    let removed = false;
    const spanObj = this._designSpan;
    for (const prop in spanObj) {
      const list = spanObj[prop];
      const keeps = filter(list, (sp) => {
        const inside = sp.rowIndex >= box.r0 && sp.rowIndex <= box.r1;
        if (inside) removed = true;
        return !inside;
      });
      if (keeps.length < 1) delete spanObj[prop];
      else spanObj[prop] = keeps;
    }
    if (!removed) {
      this.toast.warn('选中行内没有合并单元格');
      return;
    }
    this._syncFromDesign();
    this._renderDesign();
    this.toast.pushMessage('已拆分');
  }

  /** 把选中行标记为指定区域类型（工具栏下拉/右键菜单共用） */
  private _applyBandToSelection(bandType: BandType) {
    const box = this._getSelection();
    const editor = this.editor as any;
    if (!box) {
      this.toast.warn('请先选中行');
      return;
    }
    const rows: any[] = editor.getData?.() ?? [];
    for (let i = box.r0; i <= box.r1 && i < rows.length; i++) {
      rows[i][BAND_TYPE_PROP] = bandType;
    }
    this._syncFromDesign();
    this.toast.pushMessage(`已将选中行设为「${BAND_LABELS[bandType]}」区`);
  }

  onBandSelect(obj: Record<string, any>) {
    const value = obj?.value;
    if (!value) return;
    this._applyBandToSelection(value as BandType);
  }

  /** 设置选中列的统计类型（作用于第一个选中列） */
  onStatsSelect(obj: Record<string, any>) {
    const value = obj?.value;
    if (isUndefined(value)) return;
    const box = this._getSelection();
    const tmpl = this.template;
    if (!box) {
      this.toast.warn('请先选中列');
      return;
    }
    const prop = this.editor.getColumnPropByIndex(box.c0);
    const col = findIndex(tmpl.columns, (c) => c.prop === prop);
    if (col < 0) return;
    if (value) {
      tmpl.columns[col].stats = value;
      if (!tmpl.columns[col].dataType) tmpl.columns[col].dataType = 'number';
    } else {
      delete tmpl.columns[col].stats;
    }
    this._refreshPreview();
    this._emitTemplateChange();
    this.toast.pushMessage(value ? `列「${prop}」已开启统计` : `列「${prop}」已取消统计`);
  }

  /** 生成不重复的列 prop */
  private _genColumnProp(): string {
    const tmpl = this.template;
    let prop = '';
    do {
      prop = 'col' + (++this._colSeq);
    } while (findIndex(tmpl.columns, (c) => c.prop === prop) >= 0);
    return prop;
  }

  onInsertColumn() {
    const box = this._getSelection();
    const tmpl = this.template;
    const at = box ? box.c1 + 1 : tmpl.columns.length;
    const prop = this._genColumnProp();
    tmpl.columns.splice(at, 0, { prop, title: prop, width: 100 });
    this._renderDesign();
    this._refreshPreview();
    this._emitTemplateChange();
  }

  onRemoveColumn() {
    const box = this._getSelection();
    const tmpl = this.template;
    if (!box) {
      this.toast.warn('请先选中要删除的列');
      return;
    }
    if (tmpl.columns.length <= 1) {
      this.toast.warn('至少保留一列');
      return;
    }
    const prop = this.editor.getColumnPropByIndex(box.c0);
    const at = findIndex(tmpl.columns, (c) => c.prop === prop);
    if (at < 0) return;
    tmpl.columns.splice(at, 1);
    // 同步清理合并信息与区域单元格
    delete this._designSpan[prop];
    each(tmpl.bands, (band) => each(band.rows, (row) => delete row.cols[prop]));
    this._renderDesign();
    this._refreshPreview();
    this._emitTemplateChange();
  }

  //////////////////////////////////// 数据面板 / 导入导出
  onToggleData() {
    if (!this.dataPanel) return;
    const visible = this.dataPanel.style.display === 'none';
    this.dataPanel.style.display = visible ? 'flex' : 'none';
    if (visible && this.dataText) {
      this.dataText.value = JSON.stringify(this.reportData, null, 2);
    }
  }
  onApplyData() {
    if (!this.dataText) return;
    try {
      const arr = JSON.parse(this.dataText.value);
      if (!Array.isArray(arr)) throw new Error('not array');
      this.reportData = arr;
      this.toast.pushMessage('预览数据已更新');
    } catch {
      this.toast.warn('数据格式错误：需要 JSON 数组');
    }
  }
  onExport() {
    const json = this.exportTemplate();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report-template.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  onImportClick() {
    this.fileInput?.click();
  }
  onImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    const file = files && files.length > 0 ? files[0] : null;
    if (!file) return;
    file.text().then((text: string) => {
      this.importTemplate(text);
    });
    input.value = '';
  }
}
