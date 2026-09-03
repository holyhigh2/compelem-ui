import { Alert } from "./Alert";
import { Confirm } from "./Confirm";
import { Prompt } from "./Prompt";

export interface Options {
  cancelButtonText: string;
  confirmButtonText: string;
  esc: boolean;
}

let innerAlert: Alert;
let innerConfirm: Confirm;
let innerPromt: Prompt;

function alertModal(message: any, title?: string, options?: Options) {
  innerAlert.open((message ?? '') + '', title, options);

  return new Promise(
    (resolve: (value?: unknown) => void, reject: (reason?: any) => void) => {
      innerAlert.onConfirm(() => {
        resolve();
      });
      innerAlert.onCancel(() => {
        reject();
      });
    }
  );
}
function confirmModal(message: any, title?: string, options?: Options) {
  innerConfirm.open(message + '', title, options);
  return new Promise(
    (resolve: (value?: unknown) => void, reject: (reason?: any) => void) => {
      innerConfirm.onConfirm(() => {
        resolve();
      });
      innerConfirm.onCancel(() => {
        reject();
      });
    }
  );
}
function promptModal(message: any, title?: string, options?: Options) {
  innerPromt.open(message + '', title, options);
  return new Promise(
    (resolve: (value?: unknown) => void, reject: (reason?: any) => void) => {
      innerPromt.onConfirm(() => {
        resolve(innerPromt.input.value);
      });
      innerPromt.onCancel(() => {
        reject();
      });
    }
  );
}

export function useAlert() {
  if (document.body && !innerAlert) {
    innerAlert = new Alert()
    document.body.appendChild(innerAlert);
  }
  return alertModal;
}
export function useConfirm() {
  if (document.body && !innerConfirm) {
    innerConfirm = new Confirm()
    document.body.appendChild(innerConfirm);
  }
  return confirmModal;
}
export function usePrompt() {
  if (document.body && !innerPromt) {
    innerPromt = new Prompt()
    document.body.appendChild(innerPromt);
  }
  return promptModal;
}