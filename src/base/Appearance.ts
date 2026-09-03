import { CompElem, h, prop, Template, watch } from "compelem";
import { isNumeric, kebabCase } from "myfx";
import { IBordered } from "../interfaces/IBordered";
import { IColorable } from "../interfaces/IColorable";
import { ILoadable } from "../interfaces/ILoadable";
import { ColorHelper } from "../utils/color";

/**
 * 外观基类提供组件外观基础属性
 * space —— 通过三种空间尺寸定义组件垂直方向的高度
 * size —— 定义不同尺寸的字体、边距
 */

/**
 * 默认外观类型
 * 可通过 [_appearance="xxx"]样式扩展其他外观
 */
export enum AppearanceType {
    //默认仅显示文字（鼠标悬浮后显示高透明度背景，同字体色）(激活时显示高透明度背景，优先使用--active-color，fallback使用--color)
    Subtle = 'subtle',
    //与Subtle相反
    SubtleInvert = 'subtle-invert',
    //无背景色，显示字体色边框（鼠标悬浮后显示高透明度背景，同字体色）(激活时显示高透明度背景，优先使用--active-color，fallback使用--color)
    Outlined = 'outlined',
    //深色背景，字体色为白色（鼠标悬浮后显示高透明度前景，白色）(激活时颜色变更，优先使用--active-color，fallback使用--color)
    Flat = 'flat',
    //高透明度背景，同字体色（鼠标悬浮后叠加显示高透明度前景，同字体色）(激活时颜色变更，优先使用--active-color，fallback使用--color)
    Pale = 'pale',
    //无背景色，整体不透明度60%（鼠标悬浮后不透明度为100%）(激活时显示高透明度背景，优先使用--active-color，fallback使用--color)
    Text = 'text',
    //无背景
    Default = 'default'
}

export enum AppearanceSize {
    XS = 'xs',
    SM = 'sm',
    MD = 'md',
    LG = 'lg',
    XL = 'xl'
}
export enum AppearanceSpace {
    //紧凑
    Compact = 'compact',
    //舒适
    Default = 'default',
    //宽松
    Loose = 'loose'
}

/**
 * 外观基类
 * 为多数可见组件提供外观参数及统一样式
 * 使用focus方式时，请确保元素可聚焦 
 * @author holyhigh2
 */
export class AppearanceElem extends CompElem implements ILoadable, IColorable, IBordered {
    @prop({ type: String })
    activeColor!: string;
    @prop space: string = AppearanceSpace.Default
    /**
     * 只读状态
     */
    @prop readonly: boolean = false;
    /**
     * 禁用状态
     */
    @prop disabled: boolean = false;
    /**
     * 加载中，用于显示加载状态
     */
    @prop loading: boolean = false;
    /**
     * 在不同组件中可能会表示字体/背景/边框等颜色，支持内置命名色如 'primary/success/...'，或其他合法CSS颜色格式
     * 会在组件host中产生 --color 变量
     */
    @prop({ type: String })
    color!: string;
    //尺寸，用于控制显示样式
    @prop({ type: [String] }) size: string = AppearanceSize.MD;
    /**
     * number 阴影程度px
     * string 命名程度 xs/sm/md/lg/xl
     */
    @prop({ type: [String] }) shadow: string = AppearanceSize.SM;
    //当该属性有效时，shadow会作为源样式，shadow2则作为hover、focus的目标样式
    @prop({ type: [String] })
    shadow2!: string;
    /**
     * number 边框宽度px
     * string 命名程度 xs/sm/md/lg/xl
     */
    @prop({ type: [String] }) border: string = AppearanceSize.SM;
    //同上
    @prop({ type: [String] })
    border2!: string;
    /**
     * number 圆角程度px
     * string 命名程度 xs/sm/md/lg/xl/pill/circle
     */
    @prop({ type: [String] }) round: string = AppearanceSize.MD;
    //同上
    @prop({ type: [String] })
    round2!: string;
    /**
     * boolean 开启/关闭阴影效果，默认always
     * string 显示方式，hover 鼠标浮动后显示 / focus 获得焦点时显示 / both hover及focus / always 始终显示(相当于true)
     */
    @prop({ type: [Boolean, String] }) shadowed: boolean | string = false;
    /**
     * boolean 开启/关闭边框显示，默认always
     * string 显示方式，hover 鼠标浮动后显示 / focus 获得焦点时显示 / both hover及focus / always 始终显示(相当于true)
     */
    @prop({ type: [Boolean, String] }) bordered: boolean | string = false;
    /**
     * boolean 开启/关闭边框圆角，默认always
     * string 显示方式，hover 鼠标浮动后显示 / focus 获得焦点时显示 / both hover及focus / always 始终显示(相当于true)
     */
    @prop({ type: [Boolean, String] }) rounded: boolean | string = false;
    //size
    @prop({ type: [Number, String] })
    width!: string | number;
    @prop({ type: [Number, String] })
    maxWidth!: string | number;
    @prop({ type: [Number, String] })
    minWidth!: string | number;
    @prop({ type: [Number, String] })
    height!: string | number;
    @prop({ type: [Number, String] })
    maxHeight!: string | number;
    @prop({ type: [Number, String] })
    minHeight!: string | number;
    //外观风格 
    @prop({ type: String }) appearance: string = AppearanceType.Default;

    //外观是否启用hover交互
    @prop({ type: Boolean }) hoverable = false;

    /////////////////////////////////// watches
    @watch(["width", 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'], { immediate: true })
    __watchWidth(nv: any, ov: any, sourceName: string) {
        let v = isNumeric(nv) ? nv + 'px' : nv;
        this.style.setProperty(kebabCase(sourceName), v);
    }

    static RoundSize: string[] = ['pill', 'circle']
    @watch(["shadow", 'round', 'border'], { immediate: true })
    __watchSRB(nv: any, ov: any, sourceName: string) {
        let v = nv
        if (Object.values(AppearanceSize).includes(nv) || AppearanceElem.RoundSize.includes(nv)) {
            v = `var(--ce-${sourceName}-${nv})`
        }
        this.style.setProperty(`--${sourceName}-size`, v);
    }
    @watch(["shadow2", 'round2', 'border2'], { immediate: true })
    __watchSRB2(nv: any, ov: any, sourceName: string) {
        let v = nv
        let name = sourceName.replace(/2$/, '')
        if (!!v) {
            if (Object.values(AppearanceSize).includes(nv) || AppearanceElem.RoundSize.includes(nv)) {
                v = `var(--ce-${name}-${nv})`
            }
            this.style.setProperty(`--${name}-size2`, v);
        }
    }
    @watch("color", { immediate: true })
    __watchColor(nv: any, ov: any) {
        if (nv === ov && nv === undefined) return
        ColorHelper.setColor(nv, this.style, `--color`)
    }
    @watch("activeColor", { immediate: true })
    __watchActiveColor(nv: any, ov: any, sourceName: string) {
        ColorHelper.setColor(nv, this.style, '--active-color')
    }
    //////////////////////////////////// lifecycles
    constructor(...args: any[]) {
        super(...args)
    }
    render(): Template {
        return h`<div class="ce-appearance-underlay" part="__underlay"></div><div class="ce-appearance-overlay" part="__overlay"></div>`
    }
    //子类可覆盖后实现指定元素应用外观
    get renderEl() {
        return this.renderRoot
    }
}