/**
 * 可加载状态接口
 * @author holyhigh2
 */
export interface IColorable {
    /**
     * 在不同组件中可能会表示字体/背景/边框等颜色，支持内置命名色如 'primary/success/...'，或其他合法CSS颜色格式
     * 会在组件host中产生 --color 变量
     */
    color: string
}