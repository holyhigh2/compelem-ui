import { max, min, reduce } from "myfx";

export function SUM(valAry: any[]) {
    return reduce(valAry, (acc, v) => acc + (parseFloat(v) || 0), 0)
}
export function AVG(valAry: any[]) {
    return reduce(valAry, (acc, v) => acc + (parseFloat(v) || 0), 0) / valAry.length
}
export function MAX(valAry: any[]) {
    return max(valAry)
}
export function MIN(valAry: any[]) {
    return min(valAry)
}