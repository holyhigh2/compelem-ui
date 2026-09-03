
/**
 * 输入内容对比接口
 * @author holyhigh2
 */
export interface IInputRange {

    /**
     * 设置更小值，在范围结束值变动时调用
     * @param v 
     */
    setSmallerValue(v: any): void
    /**
     * 设置更大值，在范围起始值变动时调用
     * @param v 
     */
    setBiggerValue(v: any): void

}