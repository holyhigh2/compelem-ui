import { CompElem, prop, tag, watch, csscope, Csscope } from "compelem";
import { isNumeric } from "myfx";
import { styleSheet } from "./styleSheets";
/**
 * 手风琴
 * @attrs
 *  gap {string | number} 开合项间隔
 *
 * @author holyhigh2
 */
@tag('ce-accordion')
export class Accordion extends CompElem<null> {
  //////////////////////////////////// props
  @prop({ type: [String, Number] }) gap: string | number = '0'

  //////////////////////////////////// state

  @csscope(Csscope.HOST)
  static get hostCss() {
    return styleSheet;
  }

  /////////////////////////////////// watches
  @watch('gap', { immediate: true })
  watchGap(nv: string | number) {
    this.style.gap = isNumeric(this.gap) ? this.gap + 'px' : this.gap
  }
  //////////////////////////////////// lifecycles
  constructor() {
    super();
  }

  //////////////////////////////////// methods

}
