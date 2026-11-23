import { prop } from "compelem";
import { FormControl } from "../components/form/FormControl";
import { IClearable } from "../interfaces/IClearable";

/**
 * 输入类组件盒，提供通用的盒状组件参数
 * 子组件包括：Input/InputXxx/Select/XxxPicker/ComboBox/Cascader 
 * @author holyhigh2
 */
export abstract class ControlBox extends FormControl implements IClearable {
    /**
     * 当值为true且label属性不为空时，显示星号
     */
    @prop required = false;
    /**
     * 输入标签
     */
    @prop label = '';
    /**
     * 占位符
     */
    @prop({ type: [String, Array] }) placeholder: string | Array<string> = ''
    /**
     * 可清除内容
     */
    @prop clearable = false;
    /**
     * 输入内容的水平对齐方式，可选 left / center / right
     *
     * 默认为空（跟随组件自身样式，通常左对齐）；设置后透传到内部输入框的 CSS text-align。
     * 数值型输入（ce-input / ce-input-number）常用 right 让数字靠右
     */
    @prop align = '';

    abstract clear(): void;
}