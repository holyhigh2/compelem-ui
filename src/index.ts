import { setDefaults } from "compelem";
import { values } from "myfx";
import { appearanceStyleSheet, resetStyleSheet } from "./css/styleSheets";
// registerIconsSubset 需要本地引用这两个符号（下方 export 语句只负责对外暴露，不引入本地绑定）
import { registerIcons, type IconFactory } from "./icons/registry";
// 标签→类映射（HTMLElementTagNameMap）与事件类型；export * 保证声明产物保留该引用
export * from './types/components';
// API 词汇表（尺寸/语义色/事件名/slot 名），组件消费方做字面量联合校验用
export { AppearanceSize, AppearanceSpace, ComponentEvent, ComponentSlot, SemanticColor } from "./constants";
//components
export { Board } from "./components/datadisplay/board/Board";
export { BoardBar } from "./components/datadisplay/board/BoardBar";
export { Panel } from "./components/datadisplay/panel/Panel";
export { PanelGroup } from "./components/datadisplay/panel/PanelGroup";
export { Scroller } from "./components/datadisplay/scroller/Scroller";
export { Stat } from "./components/datadisplay/stat/Stat";
export { Column } from "./components/datadisplay/table/Column";
export { ColumnConfigPane } from "./components/datadisplay/table/ColumnConfigPane";
export { ColumnFoot } from "./components/datadisplay/table/ColumnFoot";
export { Editable } from "./components/datadisplay/table/Editable";

export { Table } from "./components/datadisplay/table/Table";
export { TableBar } from "./components/datadisplay/table/TableBar";
export { Tag } from "./components/datadisplay/tag/Tag";
export { Toolbar } from "./components/datadisplay/toolbar/Toolbar";
export { Tree } from "./components/datadisplay/tree/Tree";

export { Link } from "./components/link/Link";
export { ContextMenu } from "./components/nav/contextmenu/ContextMenu";
export { Dropdown } from "./components/nav/dropdown/Dropdown";
export { Menu } from "./components/nav/menu/Menu";

export { Badge } from "./components/feedback/badge/Badge";
export { Empty } from "./components/feedback/empty/Empty";
export { Hover } from "./components/feedback/hover/Hover";
export { Loader } from "./components/feedback/loader/Loader";
export { Message } from "./components/feedback/message/Message";
export { Notification } from "./components/feedback/notification/Notification";
export { ProgressCircular } from "./components/feedback/progress/ProgressCircular";
export { ProgressLinear } from "./components/feedback/progress/ProgressLinear";
export { Rate } from "./components/feedback/rate/Rate";
export { SkeletonLoader } from "./components/feedback/skeleton/SkeletonLoader";

export { Card } from "./components/datadisplay/card/Card";
export { Portal } from "./components/datadisplay/portal/Portal";
export { PortalEditor } from "./components/datadisplay/portal/PortalEditor";
export { PortalWidget } from "./components/datadisplay/portal/PortalWidget";
export { PortalWidgetEditor } from "./components/datadisplay/portal/PortalWidgetEditor";

// 门户布局工具（唯一实现）：宿主若需在传给 `<ce-portal>` 之前自行清洗布局，
// 必须复用这里的几何规整，而不是再写一份 —— 两份规则一旦分叉，就会出现
// 「宿主认为合法、组件认为非法」的静默偏差。
export {
    compactItems as compactPortalItems,
    findFreeCell as findPortalFreeCell,
    makePortalItemId,
    normalizeLayout as normalizePortalLayout,
    parseWidgetSize, LAYOUT_VERSION as PORTAL_LAYOUT_VERSION,
    MAX_ROWS as PORTAL_MAX_ROWS, widgetKey as portalWidgetKey, resolveColumns as resolvePortalColumns
} from "./components/datadisplay/portal/layout";
export type {
    ColumnCountOptions as PortalColumnCountOptions, PortalLayout as PortalLayoutData, LayoutItem as PortalLayoutItem, WidgetSize as PortalWidgetSize
} from "./components/datadisplay/portal/layout";
export { Aside } from "./components/layout/container/Aside";
export { Container } from "./components/layout/container/Container";
export { Footer } from "./components/layout/container/Footer";
export { Header } from "./components/layout/container/Header";
export { Main } from "./components/layout/container/Main";
export { Divider } from "./components/layout/divider/Divider";
export { List } from "./components/layout/list/List";
export { ListGroup } from "./components/layout/list/ListGroup";
export { ListHeader } from "./components/layout/list/ListHeader";
export { ListItem } from "./components/layout/list/ListItem";
export { LoopList } from "./components/layout/list/LoopList";
export { Spacer } from "./components/layout/spacer/Spacer";

export { Col } from "./components/layout/grid/Col";
export { Grid } from "./components/layout/grid/Grid";
export { Row } from "./components/layout/grid/Row";

export { Accordion } from "./components/nav/accordion/Accordion";
export { AccordionItem } from "./components/nav/accordion/AccordionItem";
export { CommandPalette } from "./components/nav/commandpalette/CommandPalette";
export { CommandPaletteContent } from "./components/nav/commandpalette/CommandPaletteContent";
export { Nav } from "./components/nav/nav/Nav";
export { Navbar } from "./components/nav/navbar/Navbar";
export { Pagination } from "./components/nav/pagination/Pagination";
export { Tab } from "./components/nav/tabs/Tab";
export { Tabs } from "./components/nav/tabs/Tabs";

export { Checkbox } from "./components/form/checkbox/Checkbox";
export { CheckboxGroup } from "./components/form/checkbox/CheckboxGroup";
export { Combobox } from "./components/form/combobox/Combobox";
export { Form } from "./components/form/Form";
export { FormItem } from "./components/form/FormItem";
export { Input } from "./components/form/input/Input";
export { InputColor } from "./components/form/input/InputColor";
export { InputDate } from "./components/form/input/InputDate";
export { InputDateRange } from "./components/form/input/InputDateRange";
export { InputMask } from "./components/form/input/InputMask";
export { InputNumber } from "./components/form/input/InputNumber";
export { InputNumberRange } from "./components/form/input/InputNumberRange";
export { InputOTP } from "./components/form/input/InputOTP";
export { InputTag } from "./components/form/input/InputTag";
export { InputTime } from "./components/form/input/InputTime";
export { InputTimeRange } from "./components/form/input/InputTimeRange";
export { RangeInput } from "./components/form/input/RangeInput";
export { Radio } from "./components/form/radio/Radio";
export { RadioGroup } from "./components/form/radio/RadioGroup";
export { Segmented } from "./components/form/segmented/Segmented";
export { Select } from "./components/form/select/Select";
export { Slider } from "./components/form/slider/Slider";
export { Toggle } from "./components/form/toggle/Toggle";

export { ColorPicker } from "./components/picker/colorpicker/ColorPicker";
export { DatePicker } from "./components/picker/datepicker/DatePicker";
export { YearMonthPanel } from "./components/picker/datepicker/YearMonthPanel";
export { ListPicker } from "./components/picker/listpicker/ListPicker";
export { TimerPicker } from "./components/picker/timepicker/TimePicker";

export { Button } from "./components/button/Button";
export { ButtonGroup } from "./components/button/ButtonGroup";


export { Avatar } from "./components/icons_images/avatar/Avatar";
export { AvatarGroup } from "./components/icons_images/avatar/AvatarGroup";
export { Icon } from "./components/icons_images/icon/Icon";
export { Img } from "./components/icons_images/img/Img";
export { SvgThumb } from "./components/icons_images/svgthumb/SvgThumb";

export { Dialog } from "./components/overlays/dialog/Dialog";
export { Drawer } from "./components/overlays/drawer/Drawer";
export { Alert } from "./components/overlays/modals/Alert";
export { Confirm } from "./components/overlays/modals/Confirm";
export { Prompt } from "./components/overlays/modals/Prompt";
export { Overlay } from "./components/overlays/overlay/Overlay";
export { Tooltip } from "./components/overlays/tooltip/Tooltip";

export { Heading } from "./components/text/heading/Heading";
export { Highlight } from "./components/text/highlight/Highlight";

export * from "./directives/a11y/Activatable";
export * from "./directives/ripples/Ripples";
export * from "./directives/splits/Splits";
export * from "./directives/tooltip/Tooltip";

export * from './components/overlays/modals/index';
export * from './components/overlays/toast/toast';

export * from './icons/icons';
export { getIcon, hasIcon, iconCount, registerIcons, type IconFactory } from './icons/registry';

export * from "./locale";
export * from "./utils/utils";

(() => {
    setDefaults({
        css: [resetStyleSheet, appearanceStyleSheet]
    })
})()

let IconSets: Record<string, string> = {}
/**
 * 创建字体图标
 * 1. 引入图标库样式文件
 * 2. 创建图标集合
 * @param iconSets {Record<string, string>} 字体图标集合 {fontFamily: styleSheetStr}
 */
export function createIcons(iconSets: Record<string, string>) {
    IconSets = iconSets
    defaultCss()
}
let Styles: Array<string | CSSStyleSheet> = []
export function createStyles(css: Array<string | CSSStyleSheet>) {
    Styles = css
    defaultCss()
}
const defaultCss = () => {
    setDefaults({
        css: [resetStyleSheet, appearanceStyleSheet, ...values(IconSets), ...Styles]
    })
}

/**
 * 按需注册图标子集：只注册 icons 参数中列出的图标工厂。
 * 避免全量注册80+个图标带来的内存和启动开销。
 * @param icons 形如 { Search, Close } 的图标映射，只传实际用到的图标
 */
export function registerIconsSubset(icons: Record<string, IconFactory>): void {
    registerIcons(icons);
}