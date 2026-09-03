/**
 * 可设置边框接口
 * @author holyhigh2
 */
export interface IBordered {
    /**
     * boolean 开启/关闭边框显示，默认always
     * string 显示方式，hover 鼠标浮动后显示 / focus 获得焦点时显示 / both hover及focus / always 始终显示(相当于true)
     */
    bordered: boolean | string
}