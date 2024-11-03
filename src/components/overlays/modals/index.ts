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
      innerAlert.on("confirm", () => {
        resolve();
      });
      innerAlert.on("cancel", () => {
        reject();
      });
    }
  );
}
function confirmModal(message: any, title?: string, options?: Options) {
  innerConfirm.open(message + '', title, options);
  return new Promise(
    (resolve: (value?: unknown) => void, reject: (reason?: any) => void) => {
      innerConfirm.on("confirm", () => {
        resolve();
      });
      innerConfirm.on("cancel", () => {
        reject();
      });
    }
  );
}
function promptModal(message: any, title?: string, options?: Options) {
  innerPromt.open(message + '', title, options);
  return new Promise(
    (resolve: (value?: unknown) => void, reject: (reason?: any) => void) => {
      innerPromt.on("confirm", (e: CustomEvent) => {
        resolve(e.detail.value);
      });
      innerPromt.on("cancel", () => {
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