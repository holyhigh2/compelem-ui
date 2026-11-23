# Changelog

本文件记录对外可见的变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.0] - 2026-11-24

### Added

- 测试基建 `test/helpers.ts`（`flush` / `nextFrame` 帧等待），6 个慢速测试文件不再依赖固定 `setTimeout`；新增 toast、表格统计函数用例（36 文件 / 264 用例）。
- `npm run gen` / `npm run check` 统一脚本；`prepublishOnly` 串联 typecheck、测试、生成物与契约检查、构建及产物校验。
- `compelem-ui/index.css` 正式对外导出：消费方可通过 `import 'compelem-ui/index.css'` 引入设计令牌、reset 与基础样式。
- `compelem-ui/icons` 图标入口（`dist/icons.es.js`），替代原先直接指向 `.ts` 源码的路径。
- `scripts/gen.mjs exports`：`exports` 由 `src/entries` 生成，并提供 `--check` 校验模式（`node scripts/gen.mjs exports --check`）。
- `scripts/verify-package.mjs`：发布前校验导出目标存在、无 `.ts` 源码泄漏、`.d.ts` 无重复 `export *`（`npm run verify:pkg`）。
- `package.json` 新增 `sideEffects` 声明：根入口 `import { Button } from 'compelem-ui'` 在 Vite / Rollup / esbuild 下实测可裁到约 48 KB raw / 12 KB gzip，子路径入口的自注册行为保持不变。
- **`ce-menu` 可选的 DSH 风格能力**（全部默认关闭，旧用法像素不变）：
  - `header` 插槽（根层置顶，配合 `maxHeight` 滚动时不随列表滚走）；
  - item `description` 双行项（纯文本第二行）；
  - item `section` 分组标题行（不可交互、`role=presentation`，几何走 `--menu-section-font-size` / `--menu-section-line-height` / `--menu-section-color` / `--menu-section-py` / `--menu-section-px` / `--menu-section-min-height`）；
  - `radioStyle="check"`、`checkPosition="end"`、`checkIcon`（radio 用勾选图标、选中标记列可放行尾、可换图标）；
  - `inline` 内联排版（宿主 `position:relative`，无需浮层定位）；
  - 主题/几何变量：`--menu-backdrop-filter`、`--menu-row-line-height`、`--menu-row-min-height`、`--menu-label-gap`、`--menu-desc-font-size`、`--menu-desc-line-height`、`--menu-desc-white-space`（默认 `nowrap`，设为 `normal` 时 description 按 label 列宽换行）、`--menu-check-col`（设为 0 时行尾勾选标记覆盖显示、不占列宽）、`--menu-icon-col`、`--menu-icon-cell-padding`、`--menu-icon-cell-justify`、`--menu-label-cell-px`、`--menu-divider-margin`、`--menu-divider-width`、`--menu-divider-inset`、`--menu-divider-line-offset`、`--menu-scrollbar-width`、`--menu-overscroll`。

- **`ce-dropdown` 菜单面板能力**（对齐 DSH composer 弹层）：
  - `searchable` / `searchPlaceholder` / `emptyText`：面板顶部搜索头（走 `ce-menu` 的 `header`，随列表滚动时固定），按 `text`/`label` 不区分大小写过滤，无命中时显示禁用的 `emptyText` 占位项；打开时自动聚焦、清空上次的关键词，`select`/`hover` 的回查改用过滤后的原始下标。
  - `offset`：面板与触发元素之间的间距（px），按 `placement` 自动加在靠近触发元素的一侧（`top-*` 加下、其余加上）。
  - `menuVars`：以对象透传 `--menu-*` CSS 变量到内部 `ce-menu`。Overlay 会把菜单搬进自己的 shadow 树，宿主侧作用域样式命不中，表面/几何参数只能内联到菜单元素上。
  - `esc`：面板打开后 `Esc` 直接收起，并交还焦点给触发元素。
  - 触发器点击可收起：原实现点第二次会被 overlay 的 `open` 桥接重新打开。

- **`ce-container` 的 `direction`**（`auto`/`row`/`column`，默认 `auto`）：`auto` 仍按「直接子元素里有没有 `ce-aside`」推断方向，所以侧栏被自定义元素包一层（`<dsh-sidebar>` 内部才是 `ce-aside`）时原先必然判成纵向；显式传 `direction="row"` 即可，不传时行为与旧版一致。
- **`ce-header` / `ce-footer` 的 `height`**（默认 `56`，数字按 px、字符串原样写入）：两者此前硬编码 `height:56px`，任何非 56px 的页头/页脚只能在外部用类名提权重覆盖；现在改为组件参数（内联样式），消费方的类规则可以只留排版属性。
- **`ce-list-item` 折叠态自动提示**（对齐 AntD Menu `inlineCollapsed` / shadcn `SidebarMenuButton tooltip`）：`collapsed` 时若未显式设置 `tooltip`，气泡内容回落为 `heading`；展开态仍只用显式 `tooltip`，旧行为不变。新增 `tooltipPlacement`（默认 `right`）供右侧栏改 `left`。此前组件文档写了「折叠后悬浮显示 title」，但 `tooltip` 指令只读 `tooltip` 属性，折叠态实际没有任何回落，调用方必须把功能名重抄一遍。
- **`ce-list-item` 的 `prepend` part**：左侧容器原先只有内部类名 `.ce-list-prepend`，没暴露 `part`，折叠态（`grid-template-columns: 1fr 0 0`，图标列吃满整行）无法从外部把图标居中——消费方只能改库内样式。现在 `::part(prepend)` 可用，属于纯新增，不影响既有选择器。
- **折叠动画的时长开关**（默认值全部等于旧行为，不改像素）：
  - `ce-list` / `ce-list-item` 原先在 `:host`、`.ce-list`、`.ce-list-container`、`.ce-list-item`、content、append、heading、subheading 上各写死一条 `transition 0.3s`，消费方既无法整体关闭，也无法和外壳对齐 ⇒ 出现「行在动、外壳不动」的错帧。现在统一走 `--ce-list-transition-duration` / `--ce-list-transition-timing-function`（默认 `.3s` / `ease`），设 `0s` 即让行几何瞬时到位、把动画交给外壳。
  - hover 底色渐变拆出 `--ce-list-item-hover-transition-duration`（默认 `.3s`），不再被折叠开关牵连。
  - `ce-aside` 新增 `--ce-aside-transition-duration` / `--ce-aside-transition-timing-function`：默认 `0s`（旧行为是宽度瞬时切换），设为 `.3s` 后侧栏折叠由外壳单点拥有 width 过渡。

### Changed

- **开发脚本合并为 `gen` / `check` / `verify` 三个入口**：`scripts/gen.mjs` 统一 `entries` / `types` / `exports` 生成（`--check` 只校验），`scripts/check.mjs` 统一 `contracts` / `props` / `fonts` / `colors` 检查（`--json` / `--strict` / `--update` 仍只作用于对应子项），`scripts/verify-package.mjs` 保持独立。npm 脚本收敛为 `gen` / `check` 两个统一入口，细分项通过 `node scripts/... <target>` 调用；检查规则与退出码语义不变。
- 移除未使用的 `vite-plugin-compelem-sfc` 及 `.ce` 解析扩展：仓库已无 `.ce` 单文件组件，构建与测试统一走手写 `.ts`，少一个构建期依赖。
- 补齐 npm 元数据：MIT 许可证、repository/homepage/bugs/keywords；`browserslist` 调整为 Firefox 101 / Safari 16.4（与 `adoptedStyleSheets` 实际支持一致）；移除未使用的 `@vitest/ui`。
- 覆盖率阈值按实测基线更新为 statements/lines 28、branches 67、functions 25；`src/types/components.ts` 重新生成（103 个标签、60 个含事件）。
- 硬编码颜色/字号债务清零：表格图标改用 `--ce-color-error*`，`ce-segmented` 字号改用 `--ce-font-*`，阴影/遮罩按契约标注豁免。
- **依赖声明**：`compelem` / `myfx` / `uiik` 由 `dependencies` 改为 `peerDependencies`（范围约束），并保留在 `devDependencies` 供本地构建。避免宿主应用出现两份 compelem 运行时与重复的 customElements 注册表。
- **`exceljs` / `compelem-router` 改为可选 peer**（`peerDependenciesMeta.optional`），不再随库安装；`exportExcel` 与 `ce-card` 的 `to` 在缺失时按既有逻辑降级并给出提示。
- **子路径类型**：`compelem-ui/ce-*` 的 `types` 指向各自的 `dist/ce-*.d.ts`，不再统一指向 `dist/index.d.ts`。
- **构建产物**：每个 entry 独立产出 `.d.ts`；`vite-plugin-dts` 关闭 `insertTypesEntry`，消除 `.d.ts` 中重复的 `export *`。
- **README** 与产物对齐：移除不存在的 `umd` / `style.css` / `npm run dev` 说明，补充引入方式、主题令牌、peer 版本矩阵与发布校验流程。
- **`ce-dropdown` 的 `minWidth` 默认值**：由固定 `10rem` 改为「未显式设置时取 `width`，`width` 也未设置时才回落到 `10rem`」。原先 `width="280"` 只把 overlay 的内容容器撑到 280，菜单表面仍停在 10rem（160px），面板与可见表面不一致；显式传 `min-width` 的用法不变。
- **`ce-dropdown` 触发器排版**：宿主由 `inline-block` 改为 `inline-flex`，并把 overlay 的排版改为 `display:contents` 透传，使 `slot="trigger"` 的元素成为宿主的 flex 子项。触发按钮因此与相邻按钮同高对齐（不再被行盒基线抬升），flex 容器里也可靠 `flex:none` 保持固有宽度。
- **`ce-dropdown` 触发器命中判定**：改用 `event.composedPath()` 判断事件是否落在触发元素上。嵌套 shadow 中冒泡到 `document` 的 `event.target` 会被重定向为最外层宿主，原先的 `trigger.contains(e.target)` 恒为 false，导致「点触发器收起」失效。
- `files` 不再包含 `src/icons`（图标以 `dist/icons.es.js` 发布）。
- **`ce-menu` 勾选列**：未显示的 radio 圆点改为 `display:none`，不再以 `visibility:hidden` 占位；已选中状态的像素不变。
- **`ce-menu` 勾选单元格**：移除行模板上按渲染期 `hasCheck` / `checkPosition` 计算的外层 `visibility`，可见性统一由内层 `.ce-menu__check` / `.ce-menu__dot` 控制。`items` 晚于首次渲染赋值时，外层行样式不会被补丁更新，导致已选中项的标记被一起藏掉；现在与实际勾选状态一致，定制项（`custom`）仍由 `.is-custom` 规则隐藏勾选单元格。
- **`ce-menu` / `ce-dropdown` 的 `checkIcon` 改为图标引用**：原先接收一段「带内联样式的 SVG HTML 字符串」，消费方必须自己拼 svg 才能改尺寸——这既是重复实现，也只能绕过组件渲染 `<ce-icon>`。现在接受**已注册图标名**（`"c-svg-check"`）或**图标模板函数**（`Check`），由行内的 `<ce-icon>` 解析；默认仍是内置 `Check`。尺寸改由新令牌 `--menu-check-size` 控制（默认 `1em`，等于旧行为）。⚠️ 传 HTML 字符串的旧写法不再生效。
- **`ce-dropdown` 面板透传**：新增 `placement`（默认 `bottom-end`）、`width`（面板宽度）、`minWidth`、`maxHeight`、`radioStyle`（默认 `dot`）、`checkPosition`（默认 `start`）、`checkIcon`，均可直接对应到内部 overlay / menu；不传时行为与旧版一致。自定义面板内容（如搜索头）仍用 `ce-overlay` + `ce-menu` 组合：Overlay 会把菜单搬进自己的 shadow，声明式 `header` 插槽无法跨树转发。
- **`ce-dropdown`**：改为基于 `ce-menu` 实现（不再依赖 list-picker）。`items` 中的 `null` 现在渲染为分割线，并可使用 `section` 分组标题、`children` 子菜单、方向键导航与 `menu`/`menuitem` ARIA；`select`/`hover` 按 `data-path` 回查**原始 item**，事件顺序调整为「先 `select` 后关闭」；补齐 `open`/`close` 事件并同时派发原生 DOM 事件；`setItems` 改为 `updateProps` 整数组替换，运行期更新可靠刷新。

- **`ce-input-number` / `ce-input-mask` / `ce-input-otp` 的输入阶段不再做合法性判断**：原先在 `input` 事件里裁剪/丢弃不合规字符，输入法组合期间会把候选串清掉（`ce-input-otp` 还会 `preventDefault` 直接打断组合）。现在输入阶段只透传原文，约束统一在失焦时执行：`ce-input-number` 失焦才裁剪数字前缀、夹取 `min`/`max`、套 `precision`/`pattern`；`ce-input-mask` 的 IME 上屏文本原样保留，失焦才按掩码重排；`ce-input-otp` 失焦才清掉与 `type` 不符的字符。相应地，`ce-input-number` 的 `value` / `update:value` 只在提交时更新（输入中的实时值仍可从 `input` 事件拿到）。
- **`ce-input-mask` 的 `blocks` 范围约束延后到失焦**：输入阶段只记账（`__rangeDirty`），不再把中间态改成边界值（时间输入 `25` 点被当场改成 `23`）。失焦时统一钳制，并在提交值变化时补发一次 `change`。

### Removed

- `demo/` 及其脚本/配置、`docs/`、`_legacy-ce/`、ESLint 配置与依赖、`scripts/leak-probe.mjs`，以及无引用的 `toast.ts`、`validators.ts`、`Drawer.ts.bak`。
- `package.json` 的 `dependencies` 字段（内容全部迁至 `peerDependencies` + `devDependencies`）。
- **`DropdownItem`（`ce-dropdown-item`）**：只有空壳、没有任何行为的公开组件，连同其 `ce-dropdown-item` 入口、根导出与 `exports` 映射一并移除（本条此前已记录，但源码与 `package.json` 的映射仍在；现已随 `gen-package-exports` 重新生成，共 101 个组件入口）。原下拉菜单的声明式用法不受影响（`ce-dropdown` 一直只消费 `items` 数组）。

### Fixed

- **`toast.clear()` 漏清通知**：原先只移除 `ce-message`，`ce-notification` 仍留在页面上；现在两类浮层一并清理。
- 契约检查失败项：补声明 `Table` 的 `fillcolorchange` 与 `FieldContainer` 的 `sort`，移除重复的 `currentchange`；字号/颜色检查恢复通过。
- **`ce-input-otp` 的 `value` 从不更新**：`onInput` 只把 `valueAry` 拼接后写回 `value`，却从未把键入的字符写进 `valueAry`（删除路径依赖的 `key` 属性也从未设置，下标恒为 0）。现在按格位维护 `valueAry`（长度恒为 `length`），字符落格即同步 `value`，删除/前移按真实格位搬运。

- **`ce-list` 首帧不下发 `collapsed` / `appearance` / `space` / `size`**：这些状态原先只在 `slotChange` 与各自的 `@watch` 里透传给子项。按需加载时 `<ce-list-item>` 在 `slotChange` / `mounted` 触发的那一刻**还没被升级**，`it instanceof ListItem` 恒为 false；`@watch('collapsed')` 又是 `immediate:false`，初始值不算「变化」⇒ **一开始就折叠的列表，子项完全不知道自己折叠**（图标不居中、标题不隐藏，只有用户手动切换一次后才正常）。现在抽出 `_syncItem(it)` / `_syncItemProps()`，`List.mounted()` 补一次，`ListItem.mounted()` 反过来向父列表拉一次（两条时序都覆盖）。
- **`ce-list-item` 折叠态提示缺失**：见上方 Added 条目——组件文档承诺「折叠后悬浮显示 title」，实现里却没有这条回落。
- **`ce-input-number` 的增减按钮/滚轮/方向键对模型不可见**：三条路径原先只写内部显示值 `__innerValue`，既不写 `value`、也不发 `input` / `change` / `update:value`，只有 `addStep` / `subtractStep` 经 `onBlur` 补发一次 `change`。表现为按钮能改显示、消费方（`@update:value` 双向绑定、表单提交）收不到新值。现统一走 `__step()`：夹取 → 显示值 → `value` / model → `input` + `change`。
- **`ce-input-number` 增减按钮的点击命中区过小**：两只图标各约 20×17px，`@click` 只绑在图标本身。按下与抬起分别落在两只图标上时 click 的目标是容器 `<div>`、抬起落到容器外时目标更外层，两种情况都静默无响应。现改为容器上的 `@mousedown`，按按下位置的上下半决定方向，整个区域都可点。
- **`ce-input-number` 聚焦态步进被失焦回滚**：点按钮会让输入框失焦，随后的 blur 提交按 DOM 现值取值；若步进只改 state，DOM 还停在旧值，刚步进的结果被回滚（键入 `5` 点“上”后显示仍是 `5`）。现在步进同时写回真实 `<input>`。
- **`ce-input-number` 上下方向键无效**：`keydown` 监听注册在宿主的冒泡相位，而内层 `ce-input` 的处理器会 `stopPropagation`，事件到不了宿主。现改为捕获相位。
- **`ce-input-number` 越界输入失焦后既不夹取显示、也不夹取 `value`**：`setValue` 只改内部 `__innerValue`，夹取结果从不回写 `value`；而内层 `ce-input` 只通过 `value` 属性同步，**用户键入过的输入框带 dirty 标记、不再吃 attribute** ⇒ 键入 `123123` 失焦后显示与 model 都停在越界值（`min=0 max=10` 也一样）。现在 `Input` 新增 `syncInputValue()` 用 property 回写原生控件，`setValue` 把夹取/精度处理后的值回写 `value`。
- **`ce-input-number` 的 `value="0"` 显示空白**：`value` 与 `changeValue` 合在同一个 `@watch` 里，初始化阶段 `changeValue` 的 `undefined` 被当成"清空"，刚回显的 `0` 立刻被抹掉（`<ce-input-number min="-10" max="10" value="0">` 见空框）。现拆成两个 watch：`changeValue` 只在为空以外的情形、且 `value` 也为空时才作为值来源。

### Known issues

- **全量注册入口为 `compelem-ui/register`**：内部 `export * from './index'` 后调用 `defineComponents()`，会注册全部标签；单文件、不可 tree-shake，生产环境仍推荐 `compelem-ui/ce-*` 子路径。
- Sass legacy JS API 弃用告警仍存在（源自 `?tmpl` 的 SCSS 处理链），Dart Sass 2.0 前需升级处理链。

## [0.1.0]

首个版本。
