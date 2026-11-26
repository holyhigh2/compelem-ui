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
      // 缓存里的实例可能已被销毁（目标节点被永久卸载后，组件侧的存活心跳
      // 会 `__dispose()` 掉它）。这时必须**落到下面的新建分支**，否则该目标节点
      // 永久失去提示框（更新分支直接 return，且 `TooltipMap.has(node)` 仍为真）。
      let cached = TooltipMap.get(node)
      if (cached && !cached.__dead) {
        if (!isEqual(option, oldOpt)) {
          cached.updateContent(option.content + '')
          if (option.disabled != oldOpt.disabled) {
            cached.updateProps({ disabled: option.disabled })
          }
          if (option.alwaysShow != oldOpt.alwaysShow) {
            cached.updateAlwasy(option.alwaysShow!)
          }
        }
        return
      }
      // 实例已销毁 ⇒ 落到下面的新建分支
    }
    // 判据不能只看 `TooltipMap.has(node)`：已销毁的实例也占位（见上面注释）
    const existing = TooltipMap.get(node)
    if (option.content && (!existing || existing.__dead)) {
      let tooltip = new Tooltip({ content: option?.content, placement: option?.placement, alwaysShow: option?.alwaysShow, disabled: option?.disabled, arrow: option?.arrow, dragFollow: option?.dragFollow })
      TooltipMap.set(node, tooltip)
      document.body.appendChild(tooltip)
      tooltip._bindTarget(node as HTMLElement)
    }
  };
}) as any, [EnterPointType.TAG])

/**
 * 让挂在 `node` 上的 tooltip 重新定位（目标被**程序化移动**后调用）。
 *
 * 为什么需要：指令把实例挂在模块级 WeakMap 上（不污染 DOM / 不暴露给宿主），
 * 宿主想主动同步就只能走这里。典型场景 = 滑杆把 thumb 用 `style.left` 挪走
 * （改值、挂载重钉）——移动过程没有任何事件可听，tooltip 不会自己跟。
 */
export function relocateTooltip(node: Node | null | undefined) {
  if (node) TooltipMap.get(node)?.relocate?.()
}