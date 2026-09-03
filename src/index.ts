import { setDefaults } from "compelem";
import { values } from "myfx";
import { appearanceStyleSheet, resetStyleSheet } from "./css/styleSheets";
//components
export { Board } from "./components/datadisplay/board/Board";
export { BoardBar } from "./components/datadisplay/board/BoardBar";
export { Panel } from "./components/datadisplay/panel/Panel";
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
export { DropdownItem } from "./components/nav/dropdown/DropdownItem";
export { MenuPane } from "./components/nav/menupane/MenuPane";

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

export { Dialog } from "./components/overlays/dialog/Dialog";
export { Drawer } from "./components/overlays/drawer/Drawer";
export { Alert } from "./components/overlays/modals/Alert";
export { Confirm } from "./components/overlays/modals/Confirm";
export { Prompt } from "./components/overlays/modals/Prompt";
export { Overlay } from "./components/overlays/overlay/Overlay";
export { Tooltip } from "./components/overlays/tooltip/Tooltip";

export { Heading } from "./components/text/heading/Heading";
export { Highlight } from "./components/text/highlight/Highlight";

export * from "./directives/ripples/Ripples";
export * from "./directives/splits/Splits";
export * from "./directives/tooltip/Tooltip";

export * from './components/overlays/modals/index';
export * from './components/overlays/toast/toast';

export * from './icons/icons';

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