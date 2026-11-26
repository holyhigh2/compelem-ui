import { classes, CompElem, css, csscope, Csscope, h, ifElse, ifTrue, prop, show, state, styles, tag, Template, watch } from "compelem";
import { formatDate, formatNumber, isEmpty, isNumeric, isString, kebabCase } from "myfx";
import { DataType } from "../../../constants";
import { StatsColumn } from "../../../icons/icons";
import columnStyle from "./column.scss?tmpl";
import style from "./style.scss?tmpl";
import { Table } from "./Table";
import { MetricType } from "./types";
const DEFAULT_VALUE = '-'
/**
 * table column foot
 * @attrs
 *  prop {string} data key
 *  width {number} 列宽，单位px
 *  stats {boolean|string} 显示统计信息，默认false
 *
 * @author holyhigh2
 */
@tag('ce-column-foot')
export class ColumnFoot extends CompElem {

  //////////////////////////////////// props
  @prop prop = '';
  // @prop({ type: Number }) width: number;
  @prop({ type: String }) align: string;
  @prop hoverSelection = true;
  @prop({ type: [String, Boolean] }) stats: string | boolean = false;
  @prop({ type: String }) dataType: string;
  @prop({ type: String }) pattern: string;

  @state currentStat = '';
  @state statValue: string | number = '';
  @state statLabel = ''
  @state selected = false

  @csscope(Csscope.INNER)
  static get css() {
    return [style, columnStyle, css`
      ce-list-item[appearance="pale"][hoverable]:not([disabled], [loading]):hover::part(__overlay),
      ce-list-item[appearance="pale"][hoverable]:not([disabled], [loading]):focus::part(__overlay) {
        background: var(--color, var(--ce-color-text));
        opacity: var(--ce-opacity-overlay);
      }
    `]
  }

  /**
   * **`cssVars` 里禁止出现「挂在响应式字段上的成员访问/方法调用」**（如 `this.prop.replaceAll(...)`）。
   *
   * 编译器 `deps-extract.ts` 的 `resolveChain()` 会把 `this.prop.replaceAll` 解析成**路径** `['prop','replaceAll']`，
   * 再由 `record()` 记成两条依赖：`'prop.replaceAll'` 与 `'prop'`；codegen 据此生成
   * `rc.__s.prop.replaceAll.value` —— 而 `__s` 上只有 `prop`，没有 `prop.replaceAll`
   * ⇒ 首次执行即 `TypeError: Cannot read properties of undefined (reading 'value')`。
   *
   * 修法：先把值**落到局部变量**（局部标识符不在依赖提取范围内），再在局部变量上做链式调用。
   * 这里 `this.prop` 单独出现 → 依赖恰为 `'prop'`，是正确且最小的依赖集。
   */
  get cssVars() {
    const prop = this.prop
    return {
      columnWidth: `var(--column-width-${kebabCase(String(prop).split('.').join('-'))})`
    }
  }

  /////////////////////////////////// watches
  @watch('stats', { immediate: true })
  watchStat(v: string | boolean) {
    if (isString(v)) {
      this.currentStat = v
    }
  }
  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
      <div
        class="ce-column-foot"
        ${classes({
      "ce-table-selected-stats": this.selected
    })}
        ${styles({
      height: '100%',
      'text-align': this.align || 'center'
    })}
      >
        ${ifTrue(!!this.stats, () => h`
          ${ifElse(this.currentStat !== MetricType.Index, () => h`
            <ce-button
              block
              color="text"
              size="xs"
              round="none"
              appearance="subtle"
              style="font-size:inherit;"
              data-action="stats"
            >
              <div
                ${show(!!this.currentStat)}
                title="${this.statValue}"
                style="text-align: right;width: 100%;overflow: hidden;text-overflow: ellipsis;"
              >
                <span class="ce-table-stats-label">${this.statLabel}</span>
                <span>${this.statValue}</span>
              </div>
              <span class="ce-table-stats-tip">
                统计
                <ce-icon .svg="${StatsColumn}"></ce-icon>
              </span>
            </ce-button>
          `, () => h`
            <span class="ce-table-stats-label">
              ${this.statValue}
              条
            </span>
          `)}
        `)}
        <slot name="footer"></slot>
      </div>
    `
  }
  mounted(): void {

  }
  //////////////////////////////////// methods
  //invoke by TableExtensionStats
  _onStats(obj: Record<string, any>, table: Table) {
    if (!this.stats) return
    if (!this.parentNode) return

    let { values, stats, labels, selectedValues } = obj
    let prop = this.prop

    let v = DEFAULT_VALUE
    if (selectedValues && !isEmpty(table.__selectedCells)) {
      if (!(prop in stats)) {
        this.selected = false
        if (!isString(this.stats)) return

        v = values[prop] ?? DEFAULT_VALUE
      } else {
        this.selected = true
        v = selectedValues[prop] ?? DEFAULT_VALUE
      }
    } else {
      v = values[prop] ?? DEFAULT_VALUE
      if (this.selected)
        this.selected = false
    }

    let fn = !!table._calcFn
    if (fn) {
      this.renderRoot!.innerHTML = v
    } else {
      let statType = this.stats
      if (isString(statType)) {
        this.currentStat = statType
        if (statType === MetricType.None) {
          this.currentStat = ''
        } else if (statType === MetricType.Index) {
          // this.currentStat = v;
        }
        this.statLabel = labels[prop] ?? ''

        let isFillStat = false
        switch (statType) {
          case MetricType.Filled:
          case MetricType.FilledPercent:
          case MetricType.NotFilled:
          case MetricType.NotFilledPercent:
            isFillStat = true
            break;
        }

        const col = table._fieldMap.get(prop)!
        if (col && col.pattern && v !== DEFAULT_VALUE && !isFillStat) {
          switch (col.dataType) {
            case DataType.Number:
              // 同 Table：非数字保留原文（列脚的统计文案不该被吞成空）
              v = isNumeric(v) ? formatNumber(v, col.pattern) : v
              break;
            case DataType.Time:
            case DataType.DateTime:
            case DataType.Date:
              v = isNumeric(v) ? v : formatDate(v, col.pattern)
              break;
          }
        }
        this.statValue = v
      }
    }
  }
}