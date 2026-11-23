import { defaults, each, get, isString, randi } from 'myfx';
import { Message, MessageType } from '../../feedback/message/Message';
import { Notification } from '../../feedback/notification/Notification';
import styleStr from './style.scss?tmpl';
import { settleTransition } from '../../../utils/transition';

export enum ToastPostion {
  TopLeft = 'top-left',
  TopCenter = 'top-center',
  TopRight = 'top-right',
  BottomLeft = 'bottom-left',
  BottomCenter = 'bottom-center',
  BottomRight = 'bottom-right',
}
export interface IPushOption {
  //默认 top-left
  position?: string;
  //默认 3000，小于1时不关闭
  duration?: number;
}
export interface IToast {
  /**
   * 显示消息或通知。需要自行构造消息实例
   * @param msg 
   * @param options IPushOption
   * @returns 消息id，返回0表示msg无效或document.body还未准备好
   */
  push(msg: Message, options?: IPushOption): number;
  /**
   * 显示消息
   * @param msgOption 
   * @param options 
   */
  pushMessage(msgOption: string | Record<string, any>, options?: IPushOption): number;
  pushNotice(noticeOption: string | Record<string, any>, options?: IPushOption): number;
  remove(toastId: number): void;
  clear(): void;
  info(msgOption: string | Record<string, any>, options?: IPushOption): number;
  warn(msgOption: string | Record<string, any>, options?: IPushOption): number;
  success(msgOption: string | Record<string, any>, options?: IPushOption): number;
  error(msgOption: string | Record<string, any>, options?: IPushOption): number;
}

const style = document.createElement('style')
// ?tmpl 导出的是 CssTemplate（供 @csscope static css 使用），全局注入需取其 CSS 文本
style.textContent = styleStr.getCssText()
const ToastContainer = document.createElement('div')
ToastContainer.className = "ce-toast-container";
// 每个方位一条 aria-live 通道：消息是程序化插进 DOM 的，没有 live region 读屏完全不会播报。
// 全部用 polite——错误级别由消息自身的 role=alert 负责升级为 assertive，
// 六个方位若都标 assertive，屏幕阅读器会被同时打断。
// 通知条的播报语义（role=status/alert）由各消息组件自己承担：
// 容器只做定位，不再叠加 aria-live —— 嵌在 live region 里的 live region
// 会被部分读屏（JAWS 一类）整段忽略，结果是「什么都不播报」。
ToastContainer.innerHTML = `
<div class="ce-toast-con ce-toast-top-left"></div>
<div class="ce-toast-con ce-toast-top-center"></div>
<div class="ce-toast-con ce-toast-top-right"></div>
<div class="ce-toast-con ce-toast-bottom-left"></div>
<div class="ce-toast-con ce-toast-bottom-center"></div>
<div class="ce-toast-con ce-toast-bottom-right"></div>
`;
const PostionMap: Record<ToastPostion, HTMLElement> = {
  [ToastPostion.TopLeft]: ToastContainer.querySelector<HTMLElement>('.ce-toast-top-left')!,
  [ToastPostion.TopCenter]: ToastContainer.querySelector<HTMLElement>('.ce-toast-top-center')!,
  [ToastPostion.TopRight]: ToastContainer.querySelector<HTMLElement>('.ce-toast-top-right')!,
  [ToastPostion.BottomLeft]: ToastContainer.querySelector<HTMLElement>('.ce-toast-bottom-left')!,
  [ToastPostion.BottomCenter]: ToastContainer.querySelector<HTMLElement>('.ce-toast-bottom-center')!,
  [ToastPostion.BottomRight]: ToastContainer.querySelector<HTMLElement>('.ce-toast-bottom-right')!,
}
// 必须与 style.scss 中的 .ce-toast-toasted 选择器一致（原 '--toasted' 与 CSS 不匹配，导致通知永远 opacity:0）
const ClassName = 'ce-toast-toasted'
const Dismissing = new WeakSet<HTMLElement>()
/** 移除消息节点；退出过渡结束后摘除，无过渡时立即摘除。 */
function dismiss(msgNode: HTMLElement) {
  if (!msgNode.isConnected || Dismissing.has(msgNode)) return
  Dismissing.add(msgNode)
  msgNode.classList.remove(ClassName)
  settleTransition(msgNode, () => {
    msgNode.parentNode?.removeChild(msgNode)
  }, 'opacity')
}
class Toast implements IToast {
  remove(toastId: number): void {
    let msgNode = ToastContainer.querySelector<HTMLElement>('[data-toast-id="' + toastId + '"]')
    if (!msgNode) return;

    dismiss(msgNode)
  }
  clear(): void {
    each(ToastContainer.querySelectorAll<HTMLElement>('ce-message, ce-notification'), msgNode => {
      if (!msgNode) return;
      dismiss(msgNode)
    })
  }

  push(msg: Message | Notification, options?: IPushOption): number {
    if (!document.body) return 0;
    if (!ToastContainer.parentNode) {
      document.head.appendChild(style)
      document.body.appendChild(ToastContainer)
    }

    let msgNode: HTMLElement = msg as HTMLElement
    if (msgNode) {
      let pos = get<ToastPostion>(options, 'position', 'top-center')
      let duration = get<number>(options, 'duration', 3000)
      let con: HTMLElement = PostionMap[pos]

      con.appendChild(msgNode)
      setTimeout(() => {
        msgNode.classList.add(ClassName)
      }, 0);
      msgNode.addEventListener('close', () => {
        dismiss(msgNode)
      })

      let tid = randi(10, 500)
      if (duration > 0) {
        tid = setTimeout(() => {
          dismiss(msgNode)
        }, duration) as any;
        msgNode.addEventListener('mouseenter', (e: Event) => {
          clearTimeout(tid)
        })
        msgNode.addEventListener('mouseleave', (e: Event) => {
          tid = setTimeout(() => {
            dismiss(msgNode)
          }, duration) as any;
          let id = parseFloat(tid + '.' + randi(10000, 100000));
          msgNode.dataset.toastId = id + ''
        })
      }

      let id = parseFloat(tid + '.' + randi(10000, 100000));
      msgNode.dataset.toastId = id + ''
      return id as any
    }

    return 0
  }

  pushMessage(msgOption: string | Record<string, any>, options?: IPushOption): number {
    let newOpt = isString(msgOption) ? { type: 'info', descr: msgOption } : msgOption
    let msg = new Message(newOpt)
    return this.push(msg, options)
  }

  pushNotice(noticeOption: string | Record<string, any>, options?: IPushOption): number {
    let newOpt = isString(noticeOption) ? { type: 'info', descr: noticeOption } : noticeOption
    let msg = new Notification(newOpt)

    options = defaults(options || {}, { position: 'bottom-right' })
    return this.push(msg, options)
  }

  info(msgOption: string | Partial<Message>, options?: IPushOption): number {
    let newOpt = isString(msgOption) ? { descr: msgOption } : msgOption
    newOpt.type = MessageType.Info
    return this.pushMessage(newOpt, options)
  }
  warn(msgOption: string | Partial<Message>, options?: IPushOption): number {
    let newOpt = isString(msgOption) ? { descr: msgOption } : msgOption
    newOpt.type = MessageType.Warning
    return this.pushMessage(newOpt, options)
  }
  success(msgOption: string | Partial<Message>, options?: IPushOption): number {
    let newOpt = isString(msgOption) ? { descr: msgOption } : msgOption
    newOpt.type = MessageType.Success
    return this.pushMessage(newOpt, options)
  }
  error(msgOption: string | Partial<Message>, options?: IPushOption): number {
    let newOpt = isString(msgOption) ? { descr: msgOption } : msgOption
    newOpt.type = MessageType.Error
    return this.pushMessage(newOpt, options)
  }
}

let toastInstance = new Toast;
/**
 * 
 * @returns 
 */
export function useToast(): IToast {
  return toastInstance;
}
