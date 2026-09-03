import { classes, createRef, csscope, Csscope, emits, forEach, h, prop, query, queryAll, state, tag, Template, watch } from "compelem";
import { addTime, compareDate, formatDate, identity, isBlank, isEmpty, isSameDay, padZ, range, sort } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { isVisible } from "../../../utils/utils";
import { Overlay } from "../../overlays/overlay/Overlay";
import style from "./style.scss?tmpl";
const NoTransitionClass = 'is-no-transition'
/**
 * 日期拾取
 * @props
 *  value {string} 选中的日期，格式为 'yyyy-MM-dd'，受控
 *  days {array} 一周的日期数组，默认 ['一', '二', '三', '四', '五', '六', '日']
 *  today {string|Date} 当日，用来高亮显示，可以是字符串或日期对象
 *  pattern {string} 值格式，默认'yyyy-MM-dd'
 *  monthUnit {string} 月单位，默认''
 *  min {string} 最小日期
 *  max {string} 最大日期
 * @models
 *  value 默认绑定属性，日期/时间变更时触发变更
 * @events
 *  change({value}) 日期变更时触发
 * @slots
 *  header 顶部右侧区域
 *
 * @author holyhigh2
 */
@emits('change', 'update:value')
@tag("ce-date-picker")
export class DatePicker extends AppearanceElem {

  //////////////////////////////////// props
  @prop({
    type: [String], model: true
  }) value: string
  @prop({ type: Array }) days = ['一', '二', '三', '四', '五', '六', '日']
  @prop({ type: [Date, String] }) today: Date | string = new Date()
  @prop pattern = 'yyyy-MM-dd'
  @prop monthUnit = ''
  @prop({ type: String }) min: string
  @prop({ type: String }) max: string

  @state({ shallow: true }) paneRows = [0, 1, 2, 3, 4, 5]
  @state({ shallow: true }) paneCols = [0, 1, 2, 3, 4, 5, 6]
  @state({ shallow: true }) datesQueue: any[] = [] // 存放三个月的日历渲染对象,前月、当月、下月的日期数组
  @state renderDateObj: { y: number, m: number, d: number } = { y: 0, m: 0, d: 0 }
  @state selectedDate = ''
  @state selectedyear = ''
  @state selectedMon = ''
  @state selectedHour = '0';
  @state selectedMin = '0';
  @state selectedSec = '0';

  minList = range(60).map(v => padZ(v, 2));
  hourList = range(24).map(v => padZ(v, 2));

  @queryAll('.ce-date-picker-month') calendarMonths: NodeListOf<HTMLElement>

  renderDate = new Date() // 用于渲染的日期对象
  mainHeight = 0
  ymPane = createRef<HTMLElement>()
  @query('.ce-date-picker-ym-panel') ymPanel: Overlay
  @query('.ce-date-picker-time-panel') timePanel: Overlay

  monthList = range(1, 13).map(m => padZ(m, 2))
  yearList = range(1970, 2100)
  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  //////////////////////////////////// computed

  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  watchValue(nv: string) {
    if (isBlank(nv) && this.selectedDate) {
      // this._gotoMonth(new Date())
      this.selectedDate = ''
      return
    }
    let isValid = new Date(nv)
    if (isValid.toString().includes('Invalid')) return
    if (compareDate(this.renderDate, isValid, 'M') !== 0) {
      if (this.isMounted)
        this.nextTick(() => {
          this._gotoMonth(isValid)
        })
    }

    let date = formatDate(nv, 'yyyy-MM-dd HH:mm:ss');

    this.selectedDate = date.split(' ')[0]
  }
  @watch(['min', 'max'])
  watchMinMax() {
    // this._rerender();
    this.nextTick(() => {
      this._gotoMonth(this.renderDate, true)
    })
  }
  /** 选中日期高亮规则文本（仅供本实例的动态样式表使用） */
  __selectedCss() {
    return `.ce-date-picker-month[date="${this.renderDateObj.y + '-' + (this.renderDateObj.m)}"] .ce-date-picker-cell[date="${this.selectedDate}"] .ce-date-picker-item{
        background: var(--ce-color-text-active);
        color: #fff;
      }
      `
  }
  @watch(['selectedDate', 'renderDateObj'], { deep: true })
  updateCss() {
    this.__updatableStyle?.replaceSync(this.__selectedCss())
  }
  //////////////////////////////////// lifecycles
  propsReady(props: Record<string, any>): void {
    let value = props.value
    this.renderDate = value ? new Date(value) : new Date();
    this.renderDate.setDate(1);
    this.renderDateObj = { y: this.renderDate.getFullYear(), m: this.renderDate.getMonth() + 1, d: this.renderDate.getDate() };

    this._rerender();
  }
  __updatableStyle: CSSStyleSheet | null
  mounted(): void {// 查找三个日历
    let calendars = sort<HTMLElement>(this.calendarMonths, (a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')));
    calendars[1].setAttribute('date', this.renderDateObj.y + "-" + this.renderDateObj.m)

    // 关键：这里**不能**用 css`` 模板。compelem 的 css() 按模板字符串数组缓存 CssTemplate
    // （CssTemplateCacheMap），insertStyleSheet 再按 CssTemplate 缓存同一个 CSSStyleSheet
    // （CssTemplateSheetMap）。同一模板点的多个 ce-date-picker 实例会拿到**同一张样式表**，
    // replaceSync 时互相覆盖 → 范围面板两个日历的选中高亮联动（改一个，另一个也跟着变，
    // 而 startValue/endValue 其实各自独立）。
    // 传 new CSSStyleSheet() 可绕开缓存，保证每个实例独占一张样式表。
    this.__updatableStyle = this.insertStyleSheet(new CSSStyleSheet())
    this.__updatableStyle?.replaceSync(this.__selectedCss())
  }
  render(): Template {
    return h`
    <section class="ce-date-picker">
      <header class="ce-date-picker-control">
        <div style="display: flex;">
          <ce-button appearance="subtle" @click="${this.onOpenYMPane}">${formatDate(this.renderDateObj.y + "/" + this.renderDateObj.m + "/" + this.renderDateObj.d, 'yyyy年MM' + this.monthUnit)}</ce-button>
          <ce-button appearance="subtle" icon="c-svg-caret-up" color="var(--ce-color-text-desc-rgb)" @click="${this.prevMonth}"></ce-button>
          <ce-button appearance="subtle" icon="c-svg-caret-down" color="var(--ce-color-text-desc-rgb)" @click="${this.nextMonth}"></ce-button>
        </div>
        <slot name="header"></slot>
      </header>
      <main
        class="ce-date-picker-body"
        @wheel.prevent.throttle:150="${this.onWheel}"
      >
        <div class="ce-date-picker-days">
          ${forEach(this.days, identity, (day) => h`
            <div class="ce-date-picker-cell"><div class="ce-date-picker-item ">${day}</div></div>
          `)}
        </div>
        <div @mousedown="${this.onDateClick}">
        ${forEach(this.datesQueue, (date, i) => i, (date, i) => h`
          <div class="ce-date-picker-month">
              ${forEach(this.paneRows, identity, row => h`
                <div class="ce-date-picker-row" week="${this.days[row]}">
                  ${forEach(this.paneCols, identity, col => h`
                    <div class="ce-date-picker-cell ce-date-picker-date"
                    ${classes({ "is-in-the-month": date.dates[col + 7 * row].curr, "ce-date-picker-is-today": this.isToday(date.dates[col + 7 * row]) })}
                     ?disabled="${date.dates[col + 7 * row].disabled}"
                    date="${date.dates[col + 7 * row].y + '-' + padZ(date.dates[col + 7 * row].m + 1, 2) + '-' + padZ(date.dates[col + 7 * row].d, 2)}">
                        <div class="ce-date-picker-item " week="${this.days[col]}">
                          ${date.dates[col + 7 * row].d}
                        </div>
                    </div>
                  `)}
                </div>
              `)}
          </div>
        `)}
        </div>
      </main>
      <ce-overlay placement="bottom-start" auto-active close-on-click opacity="0.25" class="ce-date-picker-ym-panel" >
        <ce-card class="ce-date-picker-ym-card" style="padding: var(--ce-spacing-sm);" ref="${this.ymPane}">
          <ce-year-month-panel month-unit="${this.monthUnit}" .year="${this.selectedyear}" .month="${this.selectedMon}" show-month @change="${this.changeYearMonth}" @dblclick="${this.closePanel}"></ce-year-month-panel>
        </ce-card>
      </ce-overlay>
    </section>
    `;
  }

  //////////////////////////////////// hooks
  onConfirmTime() {
    this.value = this.__formatValue(this.selectedDate)
    this.timePanel.close()
  }
  onOpenTimePane(obj: Record<string, any>) {
    const t = obj.target as HTMLElement
    this.timePanel.openBy(t)
  }
  onOpenYMPane(obj: Record<string, any>) {
    if (isBlank(this.selectedyear)) {
      this.selectedyear = this.renderDate.getFullYear() + ''
      this.selectedMon = this.renderDate.getMonth() + 1 + ''
    }
    const t = obj.target as HTMLElement
    this.ymPanel.openBy(t)
  }
  onDateClick(event: MouseEvent) {
    const t = event.target as HTMLElement;
    const cell = t.closest('.ce-date-picker-cell');
    if (!cell || cell?.hasAttribute('disabled')) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const date = cell?.getAttribute('date');
    const sameDate = compareDate(date!, this.value) === 0
    if (date && !sameDate) {
      this.value = this.__formatValue(date)
      this.selectedDate = date

      this.nextTick(() => {
        this.emit('change', { value: this.value })
      })
    }
  }
  //////////////////////////////////// methods
  setValue(value: string | number) {
    this.value = formatDate(value, this.pattern)
  }
  _gotoMonth(gotoDate: Date, forceUpdate = false) {
    const todayStr = formatDate(gotoDate, this.pattern)
    const diff = compareDate(this.renderDate, gotoDate, 'M')
    if (diff === 0) {
      this.value = this.__formatValue(todayStr)
      this.selectedDate = todayStr
      if (forceUpdate) {
        let calendars = sort<HTMLElement>(this.calendarMonths, (a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')));
        this._rerender2(calendars)
      }
    } else {
      if (diff > 0) {
        this.renderDate = addTime(gotoDate, 1, 'M');
      } else {
        this.renderDate = addTime(gotoDate, -1, 'M');
      }
      this.renderDate.setDate(1);
      this.onWheel({ deltaY: diff > 0 ? -1 : 1 } as any)
    }
  }
  changeYearMonth(obj: Record<string, any>) {
    let { value, type } = obj
    let pair = value.split('-')
    this.selectedyear = pair[0]
    this.selectedMon = pair[1]

    if (isBlank(this.selectedMon)) return

    const toDay = new Date(parseInt(this.selectedyear), parseInt(this.selectedMon) - 1, 1)

    this._gotoMonth(toDay)

    if (type === 'm') {
      this.ymPanel.close()
    }
  }
  closePanel() {
    this.ymPanel.close()
  }
  selectToday() {
    const toDay = new Date()
    this._gotoMonth(toDay)
  }
  isToday(date: { y: number; m: number; d: number }) {
    return isSameDay(new Date(), new Date(date.y, date.m, date.d));
  }
  nextMonth() {
    this.onWheel(new WheelEvent('wheel', { deltaY: 100 }));
  }
  prevMonth() {
    this.onWheel(new WheelEvent('wheel', { deltaY: -100 }));
  }
  moving = false // 是否正在滚动中
  onWheel(event: WheelEvent) {
    if (this.moving) return

    const delta = Math.sign(event.deltaY);
    // 查找三个日历
    let calendars = sort<HTMLElement>(this.calendarMonths, (a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1')));
    // 获取原始记录
    const s = parseInt(window.getComputedStyle(calendars[0]).height);

    //更新内容高度
    this.mainHeight = s

    let ss = [-s, 0, s];

    if (delta > 0) {
      ss = [-1, -1, 0];
      this.renderDate.setMonth(this.renderDate.getMonth() + 1);
    } else {
      ss = [0, 1, 1];
      this.renderDate.setMonth(this.renderDate.getMonth() - 1);
    }
    this.renderDateObj = { y: this.renderDate.getFullYear(), m: this.renderDate.getMonth() + 1, d: this.renderDate.getDate() };

    this.moving = true
    calendars.forEach((calendar, index) => {
      let pos = ss[index] * s
      calendar.style.transform = `translateY(${pos}px)`;
    });

    if (!isVisible(this)) {
      if (delta > 0) {
        calendars[0].style.transform = `translateY(${this.mainHeight}px)`;
      } else {
        calendars[2].style.transform = `translateY(-${this.mainHeight}px)`;
      }

      this.moving = false
      this._rerender2(sort<HTMLElement>(calendars, (a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1'))))
      return
    }

    calendars[1].ontransitionend = () => {
      calendars[1].ontransitionend = null
      if (delta > 0) {
        calendars[0].classList.add(NoTransitionClass)
        setTimeout(() => {
          calendars[0].style.transform = `translateY(${this.mainHeight}px)`;
          setTimeout(() => {
            calendars[0].classList.remove(NoTransitionClass)
            this.moving = false
            this._rerender2(sort<HTMLElement>(calendars, (a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1'))))
          }, 50);
        }, 50);
      } else {
        calendars[2].classList.add(NoTransitionClass)
        setTimeout(() => {
          calendars[2].style.transform = `translateY(-${this.mainHeight}px)`;
          setTimeout(() => {
            calendars[2].classList.remove(NoTransitionClass)
            this.moving = false
            this._rerender2(sort<HTMLElement>(calendars, (a, b) => parseFloat(a.style.transform.replace(/translateY\((.*?)\)/, '$1')) - parseFloat(b.style.transform.replace(/translateY\((.*?)\)/, '$1'))))
          }, 50);
        }, 50);
      }
    };

  }
  _getCalendarPaneRenderObject(year: number, month: number, dates: Array<any>) {
    return {
      year: year,
      month: month,
      dates: dates,
      // key: year + '-' + month, // 用于DOM重用
    };
  }
  _renderDates(i: number) {
    let rs = ''
    this.paneRows.forEach(row => {
      rs += `<div class="ce-date-picker-row" key="${row}" week="${this.days[row]}">`
      this.paneCols.forEach(col => {
        rs += `<div class="ce-date-picker-cell ce-date-picker-date ${this.datesQueue[i].dates[col + 7 * row].curr ? 'is-in-the-month' : ''} ${this.isToday(this.datesQueue[i].dates[col + 7 * row]) ? 'is-today' : ''}" ${this.datesQueue[i].dates[col + 7 * row].disabled ? 'disabled' : ''} key="${col}"
          date="${this.datesQueue[i].dates[col + 7 * row].y + '-' + padZ(this.datesQueue[i].dates[col + 7 * row].m + 1, 2) + '-' + padZ(this.datesQueue[i].dates[col + 7 * row].d, 2)}"
          >
              <div class="ce-date-picker-item " week="${this.days[col]}">
                ${this.datesQueue[i].dates[col + 7 * row].d}
              </div>
          </div>`
      })
      rs += `</div>`
    })
    return rs
  }
  /**
     * 返回指定年月的日期列表，用于渲染日历面板
     * @param {number} year
     * @param {number} month
     * @return {Array}
     */
  _getDates(year: number, month: number) {
    const dates = [];
    const currMonth = new Date(year, month + 1, 0);

    // month
    const monthDays = currMonth.getDate();
    currMonth.setDate(1);
    let dayInWeek = currMonth.getDay();
    if (dayInWeek == 0) dayInWeek = 7;

    for (let i = 1; i <= monthDays; i++) {
      let disabled = this.min ? compareDate(`${year}/${month + 1}/${i}`, this.min) < 0 : false
      disabled = disabled || (this.max ? compareDate(`${year}/${month + 1}/${i}`, this.max) > 0 : false)
      const dateObj = {
        y: year,
        m: month,
        d: i,
        curr: true,
        disabled
      };
      dates[dayInWeek + i - 2] = dateObj;
    }

    // prev month
    if (dayInWeek > 0) {
      const prevMonth = new Date(
        currMonth.getFullYear(),
        currMonth.getMonth(),
        0,
      );
      year = prevMonth.getFullYear();
      month = prevMonth.getMonth();

      let prevMonthDays = prevMonth.getDate();
      for (let i = dayInWeek - 1; i--;) {
        let date = prevMonthDays--
        let disabled = this.min ? compareDate(`${year}/${month + 1}/${date}`, this.min) < 0 : false
        disabled = disabled || (this.max ? compareDate(`${year}/${month + 1}/${date}`, this.max) > 0 : false)
        dates[i] = { y: year, m: month, d: date, disabled };
      }
    }

    // next month
    if (dates.length < 42) {
      const nextMonth = new Date(
        currMonth.getFullYear(),
        currMonth.getMonth() + 2,
        0,
      );
      year = nextMonth.getFullYear();
      month = nextMonth.getMonth();
      let s = 1;
      for (let i = dates.length; i < 42; i++) {
        let date = s++
        let disabled = this.min ? compareDate(`${year}/${month + 1}/${date}`, this.min) < 0 : false
        disabled = disabled || (this.max ? compareDate(`${year}/${month + 1}/${date}`, this.max) > 0 : false)
        dates[i] = { y: year, m: month, d: date, disabled };
      }
    }

    return dates;
  }
  _isToday(date: { y: number; m: number; d: number }) {
    return isSameDay(this.today, new Date(date.y, date.m, date.d));
  }
  _rerender() {
    const d = new Date(this.renderDate)
    d.setDate(1)
    const datesQueue: any[] = []; // 保存从左到右三个月日历

    // 当前月
    datesQueue[1] = this._getCalendarPaneRenderObject(
      d.getFullYear(),
      d.getMonth(),
      this._getDates(d.getFullYear(), d.getMonth())
    );

    // 上月
    d.setMonth(d.getMonth() - 1);
    datesQueue[0] = this._getCalendarPaneRenderObject(
      d.getFullYear(),
      d.getMonth(),
      this._getDates(d.getFullYear(), d.getMonth())
    );

    // 下月
    d.setMonth(d.getMonth() + 2);
    datesQueue[2] = this._getCalendarPaneRenderObject(
      d.getFullYear(),
      d.getMonth(),
      this._getDates(d.getFullYear(), d.getMonth())
    )

    this.datesQueue = datesQueue
  }
  _rerender2(calendars: HTMLElement[]) {
    this._rerender()

    // reset calendars
    calendars.forEach((calendar, index) => {
      // let k = parseInt(calendar.getAttribute('key')!)
      let d = calendar.getAttribute('date')
      let qDate = this.datesQueue[index].year + '-' + (this.datesQueue[index].month)
      if (d === qDate) return // 如果日期没变则不更新
      calendar.innerHTML = this._renderDates(index)
    })
    calendars[1].setAttribute('date', this.renderDateObj.y + "-" + this.renderDateObj.m)
  }
  __formatValue(date: string) {
    if (isEmpty(date)) {
      date = formatDate(Date.now(), this.pattern)
    }

    return formatDate(date, this.pattern);
  }
}