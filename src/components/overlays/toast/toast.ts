import { defaults, each, get, isString, randi } from 'myfx';
import { Message, MessageType } from '../../feedback/message/Message';
import { Notification } from '../../feedback/notification/Notification';
import styleStr from './style.scss?tmpl';

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
style.textContent = styleStr
const ToastContainer = document.createElement('div')
ToastContainer.className="ce-toast-container";
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
const ClassName = '--toasted'
class Toast implements IToast {
  remove(toastId: number): void {
    let msgNode = ToastContainer.querySelector<HTMLElement>('[data-toast-id="' + toastId + '"]')
    if (!msgNode) return;

    msgNode.classList.remove(ClassName)
    msgNode.addEventListener('transitionend', (e: Event) => {
      let t = e.target as HTMLElement;
      t.parentNode?.removeChild(t)
    })
  }
  clear(): void {
    each(ToastContainer.querySelectorAll<HTMLElement>('ce-message'), msgNode => {
      if (!msgNode) return;
      msgNode.classList.remove(ClassName)
      msgNode.addEventListener('transitionend', (e: Event) => {
        let t = e.target as HTMLElement;
        t.parentNode?.removeChild(t)
      })
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
        msgNode.classList.remove(ClassName)
      })
      msgNode.addEventListener('transitionend', (e: Event) => {
        let t = e.target as HTMLElement;
        if (t.classList.contains(ClassName)) return;

        t.parentNode?.removeChild(t)
      })


      let tid = randi(10, 500)
      if (duration > 0) {
        tid = setTimeout(() => {
          msgNode.classList.remove(ClassName)
        }, duration) as any;
        msgNode.addEventListener('mouseenter', (e: Event) => {
          clearTimeout(tid)
        })
        msgNode.addEventListener('mouseleave', (e: Event) => {
          tid = setTimeout(() => {
            msgNode.classList.remove(ClassName)
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
