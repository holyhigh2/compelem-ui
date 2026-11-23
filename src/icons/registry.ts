/**
 * 图标注册表
 *
 * compelem-ui 的内置图标以具名导出形式提供（见 ./icons），组件通过静态 import 直接引用，
 * 由打包器按需 tree-shake，未使用的图标不会进入产物。
 *
 * 只有当需要以「字符串名称」动态引用图标时（如 <ce-icon svg="c-svg-search">），
 * 才需要先调用 registerIcons 注册对应图标。请只注册实际用到的图标；
 * 若确实需要全量图标，可引入 ./full（会显著增大产物）。
 *
 * @author holyhigh2
 */
import type { Template } from "compelem";

/** 图标工厂：返回 svg 模板 */
export type IconFactory = () => Template;

const registry = new Map<string, IconFactory>();

/**
 * 注册图标，供 Icon 组件以字符串名称查找
 * @param icons 形如 { Search, Close } 的图标映射，建议只传入实际用到的图标
 */
export function registerIcons(icons: Record<string, IconFactory>): void {
  Object.keys(icons).forEach((key) => {
    const factory = icons[key];
    if (typeof factory === "function") {
      registry.set(key, factory);
    }
  });
}

/** 按名称获取已注册的图标工厂 */
export function getIcon(name: string): IconFactory | undefined {
  return registry.get(name);
}

/** 判断图标是否已注册 */
export function hasIcon(name: string): boolean {
  return registry.has(name);
}

/** 已注册的图标数量（调试用） */
export function iconCount(): number {
  return registry.size;
}
