import { Constructor } from "compelem";

/**
 * input组件扩展混入，提供input相关属性
 * @methods
 * 
 * @author holyhigh2
 */
export function InputAttrsMixin<T extends Constructor<any>>(spuerClass: T) {
  return class InputAttrsMixin extends spuerClass {


    constructor(...args: any[]) {
      super(...args)
    }

    ////////////////////////////////////////// methods

  }
}