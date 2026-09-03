import { CompElem, directive, EnterPointType } from "compelem";
import { clone, isEqual } from "myfx";
import { Tooltip } from "../../components/overlays/tooltip/Tooltip";

interface TooltipOption {
  content: string | number,
  placement?: string,
  alwaysShow?: boolean,
  disabled?: boolean
  arrow?: boolean
  dragFollow?: boolean
}
const TooltipMap = new WeakMap()
const ToolOptionMap = new WeakMap()
/**
 * 提示信息指令
 * 与<tooltip>组件相比，指令不会将目标元素包裹到自定义标签中，不会影响目标元素样式结构等
 * @author holyhigh2
 */
export const tooltip = directive((function TooltipD(option?: TooltipOption) {
  return (pointNode: Node, [option]: any[], oldArgs: any[], { renderComponent }: { renderComponent: CompElem }) => {
    let node = pointNode
    let oldOpt = ToolOptionMap.get(node)
    ToolOptionMap.set(node, clone(option))

    if (oldArgs && oldArgs[0].content) {
      if (!isEqual(option, oldOpt)) {
        let tooltip = TooltipMap.get(node)
        tooltip.updateContent(option.content + '')
        if (option.disabled != oldOpt.disabled) {
          tooltip.updateProps({ disabled: option.disabled })
        }
        if (option.alwaysShow != oldOpt.alwaysShow) {
          tooltip.updateAlwasy(option.alwaysShow!)
        }
      }
      return
    }
    if (option.content && !TooltipMap.has(node)) {
      let tooltip = new Tooltip({ content: option?.content, placement: option?.placement, alwaysShow: option?.alwaysShow, disabled: option?.disabled, arrow: option?.arrow, dragFollow: option?.dragFollow })
      TooltipMap.set(node, tooltip)
      document.body.appendChild(tooltip)
      tooltip._bindTarget(node as HTMLElement)
    }
  };
}) as any, [EnterPointType.TAG])