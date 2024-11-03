import { directive, Directive, DirectiveUpdateTag, EnterPoint, EnterPointType } from "compelem";
import { isEqual } from "myfx";
import { Tooltip } from "../../components/overlays/tooltip/Tooltip";

interface TooltipOption {
  content: string | number,
  placement?: string,
  alwaysShow?: boolean,
  disabled?: boolean
}
/**
 * 提示信息指令
 * 与<tooltip>组件相比，指令不会将目标元素包裹到自定义标签中，不会影响目标元素样式结构等
 * @author holyhigh2
 */
class TooltipD extends Directive {
  update(nodes: Node[], newArgs: TooltipOption[], oldArgs: TooltipOption[]): DirectiveUpdateTag {
    if (!isEqual(newArgs[0], oldArgs[0])) {
      this.tooltip.updateContent(newArgs[0].content + '')
      if (newArgs[0].disabled != oldArgs[0].disabled) {
        this.tooltip._setParentProps({ disabled: newArgs[0].disabled })
      }
      if (newArgs[0].alwaysShow != oldArgs[0].alwaysShow) {
        this.tooltip.updateAlwasy(newArgs[0].alwaysShow!)
      }
    }
    return DirectiveUpdateTag.NONE
  }
  tooltip: Tooltip
  static get scopes(): EnterPointType[] {
    return [EnterPointType.TAG]
  }
  constructor(point: EnterPoint) {
    super();
    this.point = point
  }
  render(option?: TooltipOption) {
    if (!this.tooltip) {
      let tooltip = this.tooltip = new Tooltip({ content: option?.content, placement: option?.placement, alwaysShow: option?.alwaysShow, disabled: option?.disabled })
      document.body.appendChild(tooltip)
      tooltip._bindTarget(this.point.startNode)
    }

  }

}
export const tooltip = directive<Parameters<typeof TooltipD.prototype.render>>(TooltipD);