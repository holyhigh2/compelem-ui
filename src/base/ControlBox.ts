import { prop } from "compelem";
import { isArray } from "myfx";
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
    @prop({
        type: [String, Array], hasChanged(newValue, oldValue, changeChain, subNewValue, subOldValue) {
            if (isArray(newValue)) {
                return newValue[0] != oldValue[0] || newValue[1] != oldValue[1]
            }
            return newValue != oldValue
        },
    }) placeholder: string | Array<string> = ''
    /**
     * 可清除内容
     */
    @prop clearable = false;

    abstract clear(): void;
}