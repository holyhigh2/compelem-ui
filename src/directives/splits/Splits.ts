import { CompElem, directive, EnterPointType } from "compelem";
import { defaults, isBlank } from "myfx";
import uii from 'uiik';
import style from './style.scss?inline';

const NodeMap = new WeakMap
const sheet = new CSSStyleSheet();
sheet.replaceSync(style);

interface SplitOption {
  //拖动把尺寸
  handleSize?: number,
  oneSideMode?: 'start' | 'end',//start/end
  //粘性吸附，如果是数组可以按顺序定义分割区域。设置minSize后生效
  sticky?: boolean | boolean[],
  /**
   * 最小区域，如果是数组可以按顺序定义分割区域，默认0
   */
  minSize?: number | number[],
  color?: string
}

/**
 * 为元素赋予拖动能力
 * @author holyhigh2
 */
export const splits = directive((function Splits(option?: SplitOption) {
  return (pointNode: Node, [option]: any[], oldArgs: any[] | undefined, { renderComponent }: { renderComponent: CompElem }) => {
    if (oldArgs) {
      return
    }
    let node = pointNode as HTMLElement

    //注入样式
    if (NodeMap.has(node)) {
      return;
    }

    //检测父元素样式
    let pos = window.getComputedStyle(node).position
    if (pos === 'static' || isBlank(pos)) {
      node.style.position = 'relative'
    }
    option = defaults(option!, { handleSize: 3 })

    if (option.color) {
      renderComponent.style.setProperty(`--ce-ui-splittable-handle-color`, option.color);
    }

    renderComponent.shadowRoot!.adoptedStyleSheets.includes(sheet) || renderComponent.shadowRoot!.adoptedStyleSheets.push(sheet)

    setTimeout(() => {
      uii.newSplittable(
        node,
        {
          minSize: option.minSize,
          sticky: option.sticky,
          handleSize: option.handleSize,
          oneSideMode: option.oneSideMode || "start",
          ghost: false,
          ghostTo: node.parentNode as HTMLElement,
        }
      );
    }, 1000);

    NodeMap.set(node, option)
  };
}) as any, [EnterPointType.TAG])