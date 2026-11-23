/**
 * 全量图标注册入口（逃生口）
 *
 * 引入本模块会把内置的全部图标注册进注册表，使 <ce-icon svg="c-svg-xxx">
 * 之类的字符串引用开箱可用。代价是全部图标都会进入产物。
 *
 * 该入口刻意不并入主入口（src/index.ts），以免拖垮其 tree-shaking。
 * 仅在确实需要全量图标时显式引入：
 *
 *   import 'compelem-ui/icons/full'
 *
 * @author holyhigh2
 */
import { IconMap } from "./icons";
import { registerIcons } from "./registry";

registerIcons(IconMap);
