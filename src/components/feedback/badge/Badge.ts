import { classes, CompElem, csscope, Csscope, h, prop, show, state, tag, Template, watch } from "compelem";
import { isEmpty, isNumeric } from "myfx";
import { IBordered } from "../../../interfaces/IBordered";
import { IColorable } from "../../../interfaces/IColorable";
import { IPlacement } from "../../../interfaces/IPlacement";
import { ColorHelper } from "../../../utils/color";
import style from "./style.scss?tmpl";
/**
 * 徽章组件
 * @attrs
 *  color {string} 徽章颜色，任意颜色及类型颜色包括：info/success/warning/error/text，默认info
 *  dot {boolean} 是否只显示点，默认false
 *  content {string|number} 徽章内显示内容
 *  max {number} 当content值为数字时显示的最大值，默认99
 *  placement {string} 相对trigger节点放置内容的位置，默认right-start。可选值 right/right-start/right-end/ left/left-start/left-end top/top-start/top-end bottom/bottom-start/bottom-end
 *  offsetX {string|number} x轴偏移 
 *  offsetY {string|number} y轴偏移 
 *  visible {boolean} 显示/隐藏徽章
 *  bordered {boolean} 是否显示边框，默认false
 *
 * @slots
 *  default() 链接内容
 *
 * @author holyhigh2
 */
@tag('ce-badge')
export class Badge extends CompElem implements IColorable, IBordered, IPlacement {

    //////////////////////////////////// props
    @prop dot = false;
    @prop({ type: String }) color: string;
    @prop({ type: [String, Number] }) content: number | string
    @prop max = 99
    @prop({ type: [String, Number] }) offsetX = 0
    @prop({ type: [String, Number] }) offsetY = 0
    @prop visible = true
    @prop bordered: string | boolean = false
    @prop placement = "right-start"

    @state _content = ''
    @csscope(Csscope.INNER)
    static get css() {
        return [style];
    }
    get cssVars() {
        return {
            offX: `${this.offsetX ?? 0}px`,
            offY: `${this.offsetY ?? 0}px`
        }
    }
    /////////////////////////////////// watches
    @watch("color", { immediate: true })
    watchColor(nv: any, ov: any,) {
        ColorHelper.setColor(nv, this.style)
    }
    @watch("content", { immediate: true })
    watchContent(nv: any, ov: any) {
        let d = nv
        if (isNumeric(nv)) {
            d = parseFloat(nv + '')
            if (d > this.max) {
                d = this.max + '+'
            }
        }
        this._content = d ?? ''
    }

    //////////////////////////////////// lifecycles
    constructor() {
        super();
    }

    render(): Template {
        return h`
            <div class="ce-badge" ${classes({ ['is-' + this.placement]: true, "ce-badge-dot": this.dot, "ce-badge-bordered": this.bordered, "ce-badge-no-content": isEmpty(this.slots.default) })}>
            <slot></slot>
            <div ${show(this.visible)}>${this.dot ? '' : this._content}</div>
            </div>
        `;
    }

    //////////////////////////////////// methods
}
