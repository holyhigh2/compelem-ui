//For sheets import
import appearanceStyle from "../base/appearance.scss?inline";
export const appearanceStyleSheet = new CSSStyleSheet();
appearanceStyleSheet.replaceSync(appearanceStyle)

import resetStyle from "./reset.scss?inline";
export const resetStyleSheet = new CSSStyleSheet();
resetStyleSheet.replaceSync(resetStyle)