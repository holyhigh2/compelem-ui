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

  get cssVars() {
    return {
      columnWidth: `var(--column-width-${kebabCase(this.prop.replaceAll('.', '-'))})`
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
              v = isNumeric(v) ? formatNumber(v, col.pattern) : ''
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