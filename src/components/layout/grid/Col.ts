import { CompElem, prop, state, tag, watch } from "compelem";
import { Row } from "./Row";
/**
 * 格栅布局 - 列
 * @props
 *  span {number} 栅格占位格数最大24，或使用断点定义 如：sm="12" md="6"，可用断点包括 xxs/xs/sm/md/lg/xl/xxl。如果同row内所有列都未设置offset属性，
 * 则会自动扩展未设置该属性的列
 *  offset {number} 栅格左侧的偏移间隔格数，如果某列设置了该属性，则同row内所有列必须设置span或断点属性
 *  
 * @slots
 *  default() 
 *
 * @author holyhigh2
 */
@tag('ce-col')
export class Col extends CompElem<null> {
  @prop({ type: Number }) span: number
  @prop({ type: Number }) xxs: number
  @prop({ type: Number }) xs: number
  @prop({ type: Number }) sm: number
  @prop({ type: Number }) md: number
  @prop({ type: Number }) lg: number
  @prop({ type: Number }) xl: number
  @prop({ type: Number }) xxl: number

  @prop({ type: Number }) offset = 0

  @state colSpan = 1
  /////////////////////////////////// styles
  /////////////////////////////////// watches
  @watch(['span', 'xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'offset'])
  watchAll() {
    (this.closest('ce-row') as Row)?.calcColWidth()
  }
  //////////////////////////////////// lifecycles
  //////////////////////////////////// methods
  getSpan(bp: string) {
    switch (bp) {
      case 'xxl':
        return this.xxl ?? this.span
      case 'xl':
        return this.xl ?? this.xxl ?? this.span
      case 'lg':
        return this.lg ?? this.xl ?? this.xxl ?? this.span
      case 'md':
        return this.md ?? this.lg ?? this.xl ?? this.xxl ?? this.span
      case 'sm':
        return this.sm ?? this.md ?? this.lg ?? this.xl ?? this.xxl ?? this.span
      case 'xs':
        return this.xs ?? this.sm ?? this.md ?? this.lg ?? this.xl ?? this.xxl ?? this.span
      case 'xxs':
        return this.xxs ?? this.xs ?? this.sm ?? this.md ?? this.lg ?? this.xl ?? this.xxl ?? this.span
    }
  }
}
