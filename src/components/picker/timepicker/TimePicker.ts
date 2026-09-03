import { createRef, csscope, Csscope, h, ifTrue, model, prop, state, tag, Template, watch } from "compelem";
import { formatDate, padZ, range } from "myfx";
import { AppearanceElem } from "../../../base/Appearance";
import { Row } from "../../layout/grid/Row";
import { LoopList } from "../../layout/list/LoopList";
import style from "./style.scss?tmpl";
/**
 * 时间拾取
 * @props
 *  value {string} 默认时间
 *  hideSeconds {boolean} 隐藏秒显示
 * @models
 *  value 默认绑定属性，时间变更时触发变更
 * @events
 *  change({value}) 时间变更时触发
 * @slots
 *  footer 底部右侧区域
 *
 * @author holyhigh2
 */
@tag("ce-timer-picker")
export class TimerPicker extends AppearanceElem {

  //////////////////////////////////// props
  @prop({ type: [String] }) value!: string
  @prop hideSeconds = false;

  @state selectedHour = '';
  @state selectedMin = '';
  @state selectedSec = '';

  minList = range(60).map(v => padZ(v, 2));
  hourList = range(24).map(v => padZ(v, 2));

  hourListEl = createRef<LoopList>()
  minListEl = createRef<LoopList>()
  secListEl = createRef<LoopList>()

  //////////////////////////////////// styles
  @csscope(Csscope.INNER)
  static get css() {
    return [style];
  }

  //////////////////////////////////// computed

  /////////////////////////////////// watches
  @watch('value')
  watchValue(nv: string) {
    let time = formatDate(nv, "HH:mm:ss")
    if (!time) return
    let parts = time.split(':')
    this.selectedHour = padZ(parts[0], 2)
    this.selectedMin = padZ(parts[1], 2)
    this.selectedSec = padZ(parts[2], 2)
  }
  //////////////////////////////////// lifecycles

  render(): Template {
    return h`
    <ce-card class="ce-time-picker">
      <ce-row gap="0" style="height: 14rem;overflow: hidden;" @mutate.child.debounce:100="${this.onColChange}">
        <ce-col>
          <ce-loop-list ref="${this.hourListEl}" .data="${this.hourList}" style="width: 3.5rem;padding: 0 var(--ce-spacing-xs) 0 0" gap="5" row-height="32" ${model(this.selectedHour, 'select')}></ce-loop-list>
        </ce-col>
        <ce-col>
          <ce-loop-list ref="${this.minListEl}" class="ce-time-picker-min-list" .data="${this.minList}" style="width: 3.5rem;padding: 0" gap="5" row-height="32" ${model(this.selectedMin, 'select')}></ce-loop-list>
        </ce-col>
        ${ifTrue(!this.hideSeconds, () => h`
          <ce-col>
            <ce-loop-list ref="${this.secListEl}" class="ce-time-picker-sec-list" .data="${this.minList}" style="width: 3.5rem;padding: 0 0 0 var(--ce-spacing-xs)" gap="5" row-height="32" ${model(this.selectedSec, 'select')}></ce-loop-list>
          </ce-col>
        `)}
      </ce-row>
      <ce-divider></ce-divider>
      <footer slot="actions" style="gap: 1rem;display: flex;justify-content: flex-end;align-items: center;">
        <ce-button appearance="subtle" @click="${this.selectNow}">此刻</ce-button>
        <slot name="footer"></slot>
      </footer>
    </ce-card>
    `;
  }

  //////////////////////////////////// hooks
  onColChange({ target }: { target: Row }) {
    let rowEl = target

    setTimeout(() => {
      rowEl?.calcColWidth()
    }, 100);
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
}