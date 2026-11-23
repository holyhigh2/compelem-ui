import { CompElem, directive, EnterPointType } from "compelem";

interface ActivatableOption {
  /** 读屏名称：控件本身只有一个图标时必须给，否则朗读出来只有「按钮」 */
  label?: string;
  disabled?: boolean;
  /**
   * 键盘激活时执行的动作，默认对宿主元素派发 click。
   * 需要走 mousedown、或要阻止激活事件冒泡到父级交互容器时显式传入。
   */
  activate?: (el: HTMLElement) => void;
}

const BoundMap = new WeakMap<HTMLElement, (e: KeyboardEvent) => void>()
// 每次求值都写回最新参数：keydown 回调只创建一次，闭包里抓住旧值会导致
// 「disabled 变了但键盘仍能激活」
const OptionMap = new WeakMap<HTMLElement, Required<ActivatableOption>>()

/**
 * 把「只有一个图标的元素」补成真正的按钮：role/tabindex/aria-label + Enter、Space 激活。
 *
 * 消息条、通知条这类关闭控件直接是 ce-icon 上挂一个 mousedown/click：鼠标可用，
 * 但既进不了 Tab 焦点序列，也没有可访问名称，键盘与读屏用户完全碰不到它。
 * 指令作用在**宿主元素**上（不是 shadow 内部），tabindex 才会进入页面焦点序列。
 */
export const activatable = directive((function Activatable(option?: ActivatableOption) {
  return (pointNode: Node, [option]: any[], oldArgs: any[] | undefined, { renderComponent }: { renderComponent: CompElem }) => {
    let el = pointNode as HTMLElement
    let { label = '', disabled = false, activate }: Required<ActivatableOption> = Object.assign({ activate: (n: HTMLElement) => n.click() }, option)

    el.setAttribute('role', 'button')
    el.setAttribute('aria-disabled', String(disabled))
    if (disabled) {
      el.removeAttribute('tabindex')
    } else {
      el.setAttribute('tabindex', '0')
    }
    if (label) el.setAttribute('aria-label', label)
    OptionMap.set(el, { label, disabled, activate })

    if (!BoundMap.has(el)) {
      let onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        // 空格默认滚动页面；Enter 在自定义元素上默认无动作，两者都要吃掉默认行为
        e.preventDefault()
        let opt = OptionMap.get(el)
        if (!opt || opt.disabled) return
        opt.activate(el)
      }
      BoundMap.set(el, onKeyDown)
      el.addEventListener('keydown', onKeyDown)
    }
  }
}) as any, [EnterPointType.TAG])
