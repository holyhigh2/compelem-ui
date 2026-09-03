/**
 * 可激活状态接口
 * @author holyhigh2
 */
export interface IActivatable {
    //设置组件的active状态，通常用来控制显示样式
    active: boolean
    //激活颜色，当值有效时会创建 --active-color变量，否则使用 --color 变量
    activeColor: string
}