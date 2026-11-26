import { CompElem, directive, EnterPointType } from "compelem";
import { defaults, isBlank } from "myfx";
import uii from 'uiik';
import { adoptStyleSheets } from "../../utils/utils";
import style from './style.scss?inline';

const NodeMap = new WeakMap
const sheet = new CSSStyleSheet();
sheet.replaceSync(style);

interface SplitOption {
  //拖动把尺寸
  handleSize?: number,
  /**
   * 只更新拖拽把的哪一侧。
   * 不传 = 两侧都更新（uiik 默认，三栏 flex 布局必须用这个）；
   * 'start' = 只改前一个兄弟;'end' = 只改后一个兄弟。
   */
  oneSideMode?: 'start' | 'end',//start/end
  //粘性吸附，如果是数组可以按顺序定义分割区域。设置minSize后生效
  sticky?: boolean | boolean[],
  /**
   * 最小区域，如果是数组可以按顺序定义分割区域，默认0
   */
  minSize?: number | number[],
  color?: string,
  /**
   * 粘性吸附跃迁回调（2026-10-19 compelem-report-builder 需求透传）：
   * 拖拽把某子区域拖过 minSize/2 阈值时触发，position =
   * 'start'（前一个被压扁）/ 'end'（后一个被压扁）/ 'none'（拖离吸附区复位）。
   * ghost 模式下不触发（uiik 语义：ghost 只移幽灵把手，不写真实尺寸）。
   */
  onSticky?: (arg: { size1: number; size2: number; position: 'start' | 'end' | 'none' }, ev: Event) => void,
  /** 拖拽结束回调（每根把手 pointerup 都触发，参数为最终 size1 / size2） */
  onEnd?: (arg: { size1: number; size2: number }, ev: Event) => void,
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

    adoptStyleSheets(renderComponent.shadowRoot, sheet)

    setTimeout(() => {
      uii.newSplittable(
        node,
        {
          minSize: option.minSize,
          sticky: option.sticky,
          handleSize: option.handleSize,
          // 不要在这里兜底成 'start'。uiik 的语义是：
          //   oneSideMode = 'start' → 只写 dom1；'end' → 只写 dom2；
          //   **不传（undefined）→ updateStart 与 updateEnd 都为真，两侧都写**。
          // 强制单侧时，「三栏 + 中栏 flex:1」这类布局的右侧把手会失效：
          // 该把手的 dom1 是中栏，而 flex-basis:0% 会让写入的 width 被完全忽略，
          // 真正该变的 dom2 没被写过一个字节。
          oneSideMode: option.oneSideMode,
          onSticky: option.onSticky,
          onEnd: option.onEnd,
          ghost: false,
          ghostTo: node.parentNode as HTMLElement,
        }
      );
    }, 1000);

    NodeMap.set(node, option)
  };
}) as any, [EnterPointType.TAG])