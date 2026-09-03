import * as fx from 'myfx'
import { compareDate, filter, includes, isArray, isBlank, isDefined, isEmpty, isNil, keys, max, mean, median, min, size, some, sum, test, toFixed } from "myfx"
export const RandomColors = [
    '#F44336',//red
    '#E91E63',//pink
    '#9C27B0',//purple
    '#2196F3',//blue
    '#009688',//teal
    '#4CAF50',//green
    '#8BC34A',//light-green
    '#FF9800',//orange
    '#795548',//brown
    '#607D8B',//blue-grey
    '#757575',//grey
    '#CDDC39',//lime
    '#3F51B5',//indigo
    '#FFC107',//amber
]
export enum DataType {
    Text = 'text',
    Number = 'number',
    Time = 'time',
    Date = 'date',
    DateTime = 'datetime',
    Tag = 'tag',
    User = 'user',
    Image = 'image'
}

export enum AlignType {
    Justify = 'justify',
    Left = 'left',
    Center = 'center',
    Right = 'right'
}
export enum SortType {
    Asc = 'asc',
    Desc = 'desc'
}
export enum FilterType {
    Time = 'time',
    DateTime = 'datetime',
    Number = 'number',
    Text = 'text',
    Tag = 'tag',
    User = 'user'
}

export enum Direction {
    Left = 'left',
    Right = 'right',
    Top = 'top',
    Bottom = 'bottom'
}
export enum Side {
    Start = 'start',
    End = 'end'
}
export enum TipPlacement {
    Start = 'start',
    End = 'end',
    InsideStart = 'insidestart',
    InsideEnd = 'insideend',
    Center = 'center'
}
const MetricsNumber = {
    max: { k: '最大', v: max },
    min: { k: '最小', v: min },
    median: { k: '中间', v: median },
    mean: { k: '平均', v: mean },
    sum: { k: '求和', v: sum },
    range: { k: '极差', v: (nums: number[]) => fx.max(nums) - fx.min(nums) }
}
const MetricsDate = {
    min: {
        k: '最早', v: (dates: string[]) => {
            let dateMap = new Map<number, string>();
            dates.forEach(date => {
                if (!date) return;
                let d = fx.toDate(date).getTime();
                dateMap.set(d, date);
            });
            return dateMap.get(fx.min(fx.keys(dateMap)))
        }
    },
    max: {
        k: '最晚', v: (dates: string[]) => {
            let dateMap = new Map<number, string>();
            dates.forEach(date => {
                if (!date) return;
                let d = fx.toDate(date).getTime();
                dateMap.set(d, date);
            });
            return dateMap.get(fx.max(fx.keys(dateMap)))
        }
    },
    range: {
        k: '极差（天）', v: (dates: string[]) => {
            let dateMap = new Map<number, string>();
            dates.forEach(date => {
                if (!date) return;
                let d = fx.toDate(date).getTime();
                dateMap.set(d, date);
            });
            let maxDate = dateMap.get(fx.max(fx.keys(dateMap)))!;
            let minDate = dateMap.get(fx.min(fx.keys(dateMap)))!;
            return fx.compareDate(maxDate, minDate);
        }
    }
}
const MetricsTime = {
    min: {
        k: '最早', v: (times: string[]) => {
            let timeMap = new Map<number, string>();
            times.forEach(time => {
                if (!time) return;
                // 处理时间字符串，转换为时间戳
                // 假设时间格式为 "HH:mm:ss"
                let parts = time.split(':');
                if (parts.length < 2) return; // 确保时间格式正确
                let d = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                timeMap.set(d, time);
            });
            return timeMap.get(min(keys(timeMap)))
        }
    },
    max: {
        k: '最晚', v: (times: string[]) => {
            let timeMap = new Map<number, string>();
            times.forEach(time => {
                if (!time) return;
                // 处理时间字符串，转换为时间戳
                // 假设时间格式为 "HH:mm:ss"
                let parts = time.split(':');
                if (parts.length < 2) return; // 确保时间格式正确
                let d = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                timeMap.set(d, time);
            });
            return timeMap.get(max(keys(timeMap)))
        }
    },
    range: {
        k: '极差（分钟）', v: (times: string[]) => {
            let timeMap = new Map<number, string>();
            times.forEach(time => {
                if (!time) return;
                // 处理时间字符串，转换为时间戳
                // 假设时间格式为 "HH:mm:ss"
                let parts = time.split(':');
                if (parts.length < 2) return; // 确保时间格式正确
                let d = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                timeMap.set(d, time);
            });
            let maxTime = timeMap.get(max(keys(timeMap)))!;
            let minTime = timeMap.get(min(keys(timeMap)))!;
            return compareDate(maxTime, minTime, 'm');
        }
    }
}
export const STATS_METRICS: Record<string, Record<string, { k: string, v: Function }>> = {
    [DataType.Number]: MetricsNumber,
    [DataType.Date]: MetricsDate,
    [DataType.DateTime]: MetricsDate,
    [DataType.Time]: MetricsTime
}
export const STATS_METRICS_BASE = {
    filled: { k: '已填写', v: (nums: any[]) => filter(nums, n => !isBlank(n) && !isNil(n) && !fx.isNaN(n)).length },
    notfilled: { k: '未填写', v: (nums: any[]) => filter(nums, n => isBlank(n) || isNil(n) || fx.isNaN(n)).length },
    filledpercent: {
        k: '已填写占比', v: (nums: any[]) => {
            let filledNum = filter(nums, n => !isBlank(n) && !isNil(n) && !fx.isNaN(n)).length
            return toFixed(filledNum / size(nums) * 100) + '%'
        }
    },
    notfilledpercent: {
        k: '未填写占比', v: (nums: any[]) => {
            let notFilledNum = filter(nums, n => isBlank(n) || isNil(n) || fx.isNaN(n)).length
            return toFixed(notFilledNum / size(nums) * 100) + '%'
        }
    },
    none: { k: '不显示', v: () => { } }
}
export const EMPTY_TAG_LABEL_COLOR = "#a3a3a3"
export const EMPTY_TAG_LABEL = '[空]'
export const FilterFunctionMap: Record<string, Function> = {
    notfilled: (row: Record<string, any>, prop: string) => {
        let data = row[prop]
        return isBlank(data) || isNil(data) || fx.isNaN(data)
    },
    filled: (row: Record<string, any>, prop: string) => {
        let data = row[prop]
        return !isBlank(data) && !isNil(data) && !fx.isNaN(data)
    },
    tag: (row: Record<string, any>, prop: string, tags: string | Record<string, any> | string[]) => !tags ? true : some(tags, v => {
        if (isBlank(v) || isNil(v) || v === EMPTY_TAG_LABEL) {
            if (isBlank(row[prop])) return true
            if (isNil(row[prop])) return true
        }
        if (isArray(row[prop])) return includes(row[prop], v)
        return row[prop] === v
    }),
    user: (row: Record<string, any>, prop: string, users: string | Record<string, any> | string[]) => !users ? true : some(users, v => {
        if (isBlank(v) || isNil(v) || v === EMPTY_TAG_LABEL) {
            if (isBlank(row[prop])) return true
            if (isNil(row[prop])) return true
        }
        if (isArray(row[prop])) return includes(row[prop], v)
        return row[prop] === v
    }),
    text: (row: Record<string, any>, prop: string, value: string | Record<string, any> | string[]) => test(row[prop], value + '', 'i'),
    number: (row: Record<string, any>, prop: string, value: string | Record<string, any> | string[]) => {
        let v = parseFloat(row[prop]) || 0
        let rs = true
        let { min, max } = value as Record<string, any>
        if (isDefined(min) && !isBlank(min)) {
            if (v < min) {
                rs = false;
            }
        }
        if (isDefined(max) && !isBlank(max)) {
            if (v > max) { rs = false; }
        }
        return rs
    },
    time: (row: Record<string, any>, prop: string, value: string | Record<string, any> | string[]) => {
        let v = row[prop]
        let hm = v.split(':')
        let rs = true
        let { min, max } = value as Record<string, any>
        if (isDefined(min)) {
            let minHm = min.split(':')
            if (hm[0] < minHm[0] || hm[1] < minHm[1]) rs = false
        }
        if (isDefined(max)) {
            let maxHm = max.split(':')
            if (hm[0] > maxHm[0] || hm[1] > maxHm[1]) rs = false
        }
        return rs
    },
    datetime: (row: Record<string, any>, prop: string, value: string | Record<string, any> | string[]) => {
        let v = row[prop]
        let rs = true
        let { min, max, type } = value as Record<string, any>
        if (isDefined(min) && !isEmpty(min)) {
            rs = compareDate(v, min, type) >= 0;
        }
        if (rs && isDefined(max) && !isEmpty(max)) {
            rs = compareDate(v, max, type) <= 0;
        }
        return rs
    }
}

export enum KeyboardKey {
    Backspace = ' ',
    Esc = 'Escape'
}

export const Operators = [
    { label: '=', tooltip: '等于', value: '=', applies: [DataType.Tag, DataType.Text, DataType.User, DataType.Date, DataType.DateTime, DataType.Time, DataType.Number] },//文本
    { label: '≠', tooltip: '不等于', value: '≠', applies: [DataType.Tag, DataType.Text, DataType.User, DataType.Date, DataType.DateTime, DataType.Time, DataType.Number] },//文本
    { label: '>', tooltip: '大于', value: '>', applies: [DataType.Date, DataType.DateTime, DataType.Time, DataType.Number] as string[] },//数字，日期
    { label: '<', tooltip: '小于', value: '<', applies: [DataType.Date, DataType.DateTime, DataType.Time, DataType.Number] as string[] },//数字，日期
    { label: '><', tooltip: '介于', value: '><', applies: [DataType.Date, DataType.DateTime, DataType.Time, DataType.Number] as string[] },//数字，日期
    { label: '⊇', tooltip: '包含', value: '⊇', applies: [DataType.Tag, DataType.Text, DataType.User] },//文本
    { label: '⊉', tooltip: '不包含', value: '⊉', applies: [DataType.Tag, DataType.Text, DataType.User] },//文本
    { label: '∃', tooltip: '非空', value: '∃', applies: null },
    { label: '∄', tooltip: '空', value: '∄', applies: null },
]