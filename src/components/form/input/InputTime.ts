import { bind, createRef, css, csscope, Csscope, emits, h, ifTrue, prop, query, state, tag, Template, watch } from "compelem";
import { isEmpty, merge, padZ, range, split } from "myfx";

import appearanceStyle from "../../../base/appearance.scss?tmpl";
import { Clock } from "../../../icons/icons";
import { Row } from "../../layout/grid/Row";
import { LoopList } from "../../layout/list/LoopList";
import { Overlay } from "../../overlays/overlay/Overlay";
import { formStyleSheet } from "../styleSheets";
import { BaseInput } from "./BaseInput";
import { Input } from "./Input";
import { inputStyleSheet } from "./styleSheets";
/**
 * 时间输入框
 * @attrs
 *  min {number} 最小值
 *  max {number} 最大值
 *  hide-seconds {boolean} 是否隐藏秒设置，默认false
 *  clearable {boolean} 支持清除，默认false
 * @slots
 *  prepend
 *  append
 * @events
 *  focus
 *  blur
 *  input
 *  clear
 *
 * @author holyhigh2
 */
@emits('clear', 'update:value', 'change')
@tag("ce-input-time")
export class InputTime extends BaseInput {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  @query('ce-input')
  input: Input;

  //////////////////////////////////// props
  @prop hideSeconds = false;
  @prop({ type: String, model: true }) value = ''

  @state __innerValue: string | number = '';
  @state selectedHour = '';
  @state selectedMin = '';
  @state selectedSec = '';

  minList = range(60).map(v => padZ(v, 2));
  hourList = range(24).map(v => padZ(v, 2));
  timePane = createRef<HTMLElement>()
  @query('.ce-input-time-panel') timePanel: Overlay

  hourListEl = createRef<LoopList>()
  minListEl = createRef<LoopList>()
  secListEl = createRef<LoopList>()

  @csscope(Csscope.GLOBAL)
  static get globalCss(): string {
    return appearanceStyle;
  }
  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet, css`
      :host(ce-input-time){
        width: fit-content;
      }  
    `];
  }

  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  watchValue(nv: string) {
    this.__innerValue = nv
  }

  @watch(['selectedHour', 'selectedMin', 'selectedSec'])
  watchSelection() {
    this.__innerValue = this.selectedHour + ":" + this.selectedMin + (this.hideSeconds ? '' : ':' + this.selectedSec)
    // overlay portal 下 model 指令不落地，命令式把选中态同步回各 loop-list：
    // updateProps 会存值（scrollToSelected/watchSelect 才能读到），且不触发 update:select 事件，不会回环
    this.nextTick(() => {
      this.hourListEl.current?.updateProps({ select: this.selectedHour })
      this.minListEl.current?.updateProps({ select: this.selectedMin })
      this.secListEl.current?.updateProps({ select: this.selectedSec })
    })
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  render(): Template {
    return h`
      <ce-input-mask class="ce-input-time" part="input" border="${this.border}" mask="${this.hideSeconds ? '00:00' : '00:00:00'}" guide blocks="${this.hideSeconds ? '{0,23},{0,59}' : '{0,23},{0,59},{0,59}'}" placeholder-char="-" greedy
      .clearable="${this.clearable}" .required="${this.required}" .label="${this.label}" 
      @input="${this.onInput}"
      @focus="${this.onFocus}"
      ?readonly="${this.readonly}" ?disabled="${this.disabled}" .error="${this.error}" @blur="${this.onBlur}" .error-message="${this.errorMessage}" .hint="${this.hint}" .hide-hint="${this.hideHint}"
      .value="${this.__innerValue}" ${bind(merge({
      appearance: this.appearance,
      space: this.space,
      color: this.color,
      size: this.size,
      round: this.round,
      loading: this.loading,
      label: this.label
    }, this.attrs))} @clear="${this.onClear}" @change="${this.onChangeMask}">
        <div slot="append">
          <ce-icon .svg="${Clock}" style="color:var(--ce-color-placeholder);cursor:pointer;" @click="${this.openTimePanel}"></ce-icon>
          <slot name="append"></slot>
        </div>
      </ce-input-mask>
      <ce-overlay placement="bottom-end" auto-active close-on-click opacity="0.25" class="ce-input-time-panel">
        <ce-card class="ce-input-time-card" style="padding: var(--ce-spacing-xs);" ref="${this.timePane}">
          <ce-row gap="0" style="height: 14rem;overflow: hidden;" @mutate.child.debounce:100="${this.onColChange}">
            <ce-col>
              <ce-loop-list ref="${this.hourListEl}" style="width: 3.5rem;padding: 0 var(--ce-spacing-xs) 0 0" gap="5" row-height="32" emit-native></ce-loop-list>
            </ce-col>
            <ce-col>
              <ce-loop-list ref="${this.minListEl}" class="ce-input-min-list" style="width: 3.5rem;padding: 0" gap="5" row-height="32" emit-native></ce-loop-list>
            </ce-col>
            ${ifTrue(!this.hideSeconds, () => h`
              <ce-col>
                <ce-loop-list ref="${this.secListEl}" class="ce-input-sec-list" style="width: 3.5rem;padding: 0 0 0 var(--ce-spacing-xs)" gap="5" row-height="32" emit-native></ce-loop-list>
              </ce-col>
            `)}
          </ce-row>
          <ce-divider></ce-divider>
          <footer slot="actions" style="padding-top:.25rem;gap: 1rem;display: flex;justify-content: flex-end;align-items: center;">
            <ce-button appearance="subtle" @click="${this.selectNow}">此刻</ce-button>
            <ce-button appearance="outlined" color="info" @click="${this.closePanel}">确定</ce-button>
          </footer>
        </ce-card>
      </ce-overlay>
    `;
  }

  //////////////////////////////////// methods
  /**
   * 转发内部 ce-input-mask 的 change 事件（mask 完整合法/失效时触发），
   * 供外层范围组件（InputTimeRange）感知某一端的值已提交
   */
  onChangeMask(obj: Record<string, any>) {
    this.emit('change', obj)
  }
  /** 面板中某一列被点选：从 loop-list 的 select 事件取 value 写回对应 state。
   *  overlay portal 把 loop-list 物理移动到 body，compelem 内部事件通道（emitEvent 依赖 wrapperComponent）无法跨 portal 投递，
   *  故面板 loop-list 改用 emit-native 走原生 dispatchEvent，并在 openTimePanel 中直接 addEventListener 监听 select（原生监听随 DOM 移动保留，不依赖内部通道）。
   *  emit-native 的 CustomEvent 把 arg 放在 detail 上（e.item 在原生事件上不存在），故读 e.detail.item.value。*/
  private __onHour = (e: any) => this.onHourSelect(e)
  private __onMin = (e: any) => this.onMinSelect(e)
  private __onSec = (e: any) => this.onSecSelect(e)
  private __selBound = false
  private bindSelectListeners() {
    if (this.__selBound) return
    this.hourListEl.current?.addEventListener('select', this.__onHour)
    this.minListEl.current?.addEventListener('select', this.__onMin)
    this.secListEl.current?.addEventListener('select', this.__onSec)
    this.__selBound = true
  }
  onHourSelect(e: any) {
    let item = e?.item ?? e?.detail?.item
    if (item) this.selectedHour = item.value
  }
  onMinSelect(e: any) {
    let item = e?.item ?? e?.detail?.item
    if (item) this.selectedMin = item.value
  }
  onSecSelect(e: any) {
    let item = e?.item ?? e?.detail?.item
    if (item) this.selectedSec = item.value
  }
  onColChange({ target }: { target: Row }) {
    let rowEl = target

    setTimeout(() => {
      rowEl?.calcColWidth()
    }, 100);
  }
  openTimePanel() {
    // 先同步绑定面板 loop-list 的 select 原生监听（幂等）。
    // 必须在 nextTick 数据推送/滚动之前绑定：nextTick 内的 scrollToSelected 在首开时
    // 可能因 overlay 尚未布局完成而抛错，曾导致末尾的 bindSelectListeners 被跳过，
    // 进而首开点选无法回写 selected*（旧 active 残留 → 时分秒多列多选）。
    // 此处同步绑定不依赖 nextTick，用户点击时 ref 必然已就绪，且原生监听随 overlay portal
    // 把节点移到 body 仍保留，故只绑一次即可。
    this.bindSelectListeners()
    if (this.__innerValue) {
      let pair = split(this.__innerValue, ':')
      this.selectedHour = pair[0]
      this.selectedMin = pair[1]
      this.selectedSec = pair[2]
    }
    this.nextTick(() => {
      // overlay portal 下 .data 点绑定不落地，命令式推送数据源（hourList/minList 稳定，幂等）
      this.timePanel.openBy(this)
      this.hourListEl.current?.updateProps({ data: this.hourList })
      this.minListEl.current?.updateProps({ data: this.minList })
      this.secListEl.current?.updateProps({ data: this.minList })
      this.hourListEl.current?.updateProps({ select: this.selectedHour })
      this.minListEl.current?.updateProps({ select: this.selectedMin })
      this.secListEl.current?.updateProps({ select: this.selectedSec })
      this.hourListEl.current?.scrollToSelected()
      this.minListEl.current?.scrollToSelected()
      this.secListEl.current?.scrollToSelected()
    })
  }
  closePanel() {
    this.timePanel.close()

    // 未选择任何时间时不要拼出 ':' / '::' 垃圾值，回退为空串
    if (isEmpty(this.selectedHour) || isEmpty(this.selectedMin)) {
      this.value = ''
      return
    }
    this.value = this.selectedHour + ":" + this.selectedMin + (this.hideSeconds ? '' : ':' + this.selectedSec)
  }
  onFocus() {
    // this.openTimePanel()
  }
  selectNow() {
    let date = new Date()
    this.selectedHour = padZ(date.getHours() + '', 2)
    this.selectedMin = padZ(date.getMinutes() + '', 2)
    this.selectedSec = padZ(date.getSeconds() + '', 2)

    this.nextTick(() => {
      this.hourListEl.current?.scrollToSelected()
      this.minListEl.current?.scrollToSelected()
      this.secListEl.current?.scrollToSelected()
    })

  }
  onInput(obj: Record<string, any>) {
    let inputVal = obj.event.target.value
  }
  onClear() {
    this.selectedHour = this.selectedMin = '';
    this.__innerValue = '';
    this.value = ''
    this.emit('clear', { value: '' })
  }
  onBlur(obj: Record<string, any>) {
    let value = obj.value

    this.__innerValue = value

    // 时间面板从未选中过时 selected* 为空串，直接拼接会写出 ':' / '::'，
    // 并把用户键入的合法值覆盖掉 —— 此时保留 mask 的值
    if (isEmpty(this.selectedHour) || isEmpty(this.selectedMin)) return

    this.value = this.selectedHour + ":" + this.selectedMin + (this.hideSeconds ? '' : ':' + this.selectedSec)
  }
  clear() {
    this.value = '';
  }
}