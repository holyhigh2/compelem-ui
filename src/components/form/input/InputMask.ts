import { clone, compact, each, find, findIndex, first, get, isBlank, isNil, isObject, isString, last, map, merge, range, repeat, size, slice, some, startsWith, trim } from "myfx";

import { bind, csscope, Csscope, debounced, emits, h, prop, query, state, tag, Template, watch } from "compelem";
import { ControlBox } from "../../../base/ControlBox";
import { formStyleSheet } from "../styleSheets";
import { Input } from "./Input";
import { inputStyleSheet } from "./styleSheets";
enum PatternChar {
  DIGIT = "0",
  LETTER = "a",
  ANY = "*",
  SHIFT = "\\",
  OPTION_START = "[",
  OPTION_END = "]",
  RANGE_START = "{",
  RANGE_DIVIDER = ",",
  RANGE_END = "}",
}
const EXP_DIGIT = /\d/;
const EXP_LETTER = /[a-zA-Z]/;
const EXP_ANY = /./;

interface MaskBit {
  optional?: boolean;
  nextBitIndex?: number;
  exp?: RegExp;
  char?: string;
}
interface Range {
  min: any;
  max: any;
}
/**
 * 掩码输入框
 * @attrs
 *  value {string} 掩码值，model 属性
 *  mask {string} 掩码格式，字符串格式为
 *  - 0 数字0-9
 *  - a 字母a-zA-Z
 *  - * 任意字符或空
 *  - \\ 用于转义0/a/* 等字符
 *  - [] 一组可选项，同RegExp语法。可选内容跳过可键入跳过字符或与下一个block的连接符
 *  - {,} 范围标记，控制紧挨着{符号左侧的字符重复次数，签名为 {min,max}
 *  placeholderChar {string} 占位字符，默认 _
 *  guide {boolean} 指导模式会始终显示掩码，默认false
 *  greedy {boolean} 贪婪模式，启用后会在输入/删除每组最后/第一个字符时自动追加/删除分隔符。默认false
 *  blocks {string} 由,号分割的多组范围符号，用于控制每个“分区”输入值范围。“分区”是由静态字符分割的掩码段。
 *    支持数字和字符，如果是字符则按照charcode计算范围。输入过程中只记账，失焦时才钳制越界值
 *  skipOptionalChar {string} 跳过可选内容的字符，默认空格
 *  selectSegment {boolean} 获焦 / 跨分隔符移动时自动选中光标所在的掩码段，默认false
 * @slots
 *  prepend
 *  append
 * @events
 *  focus
 *  blur 失去焦点前会按掩码重排一次显示值，清掉不符合掩码的内容
 *  input
 *  clear
 *  change
 * @methods
 *  getUnmaskedValue() 返回剔除掩码后的内容
 *
 * @author holyhigh2
 */
@emits('focus', 'blur', 'input', 'clear', 'change', 'update:value')
@tag("ce-input-mask")
export class InputMask extends ControlBox {
  changeDisplay(stateName: string, enabled: boolean): void {
    // 对齐 FormControl 抽象契约：按显示态名切换对应布尔 prop
    // （readonly/disabled/plaintext/error 等继承 prop）；无同名布尔 prop 时
    // 退回 is-${stateName} class 切换（如 is-plaintext/is-readonly），
    // 与 :host([readonly]) / .is-xxx 等 CSS 选择器语义一致。
    const target = (this as Record<string, any>)[stateName]
    if (typeof target === 'boolean') {
      (this as Record<string, any>)[stateName] = enabled
    } else {
      this.classList.toggle('is-' + stateName, enabled)
    }
  }
  @query('ce-input')
  input!: Input;
  //////////////////////////////////// props
  @prop({ type: [String], required: true }) mask: string;
  @prop placeholderChar = "_";
  @prop guide = false;
  @prop greedy = false;
  @prop blocks = "";
  @prop skipOptionalChar = ' '
  /**
   * 段选中：获焦 / 点击进入段 / 方向键跨过分隔符时，自动选中光标所在的「掩码段」
   * （由连续可编辑位构成的游程，如 12:33:44 的 33、1999/12/22 的 12）。
   * 对齐原生 time/date 输入的交互；默认关闭以保持非破坏性。
   */
  @prop selectSegment = false

  @prop({ type: String, model: true }) value = ''

  @state __innerValue: string = '';
  @state refreshCloseTag = 0

  __maskBitList: Array<MaskBit> = [];
  __maskBlockStartBitList: Array<number> = []
  __maskBlockDividerList: Array<string> = []
  __lastValue: string;
  __blockRanges: Array<Range> = [];
  //保存输入值为空时的掩码字符
  __maskHolder: string;
  __maskedValue: string = '';
  //mask开头的静态内容
  __startStaticValue: string = '';
  __lastPass: boolean = false;
  __staticCharSet: Set<string> = new Set<string>()
  __staticCharRegExp: RegExp
  // __minLen = 0
  __minBitInBlock: number[] = [];
  __maxBitInBlock: number[] = [];
  __blocks: string[] = [];
  __maskedBlocks: string[] = [];

  __lastValidBlockSize = 0
  /** 输入阶段检测到 blocks 越界但未改写（留给失焦兑现），见 `_maskValue` 的 enforce */
  __rangeDirty = false

  @csscope(Csscope.INNER)
  static get css() {
    return [formStyleSheet, inputStyleSheet];
  }

  /////////////////////////////////// watches
  @watch('value', { immediate: true })
  watchValue(nv: string) {
    if (isNil(nv)) {
      nv = ''
    }
    if (nv != this.__innerValue) {
      if (isBlank(nv)) {
        if (this.__innerValue === this.__maskHolder) {
          return // guide 模式占位态：保持占位符显示，不重置
        }
        // 非 guide 模式：清空 value 时直接置空，避免 _maskValue('') 只拼出
        // 静态分隔符（如 "////"）导致清除后输入框残留分隔符
        this.__maskedValue = ''
        this.__innerValue = ''
        this.__lastPass = false
        if (this.input?.inputRef?.current) {
          this.input.inputRef.current.value = ''
        }
        this.emit('update:value', { value: '' })
        return
      }
      nv = nv ?? ''
      if (this.__maskBitList) {
        this._maskValue(nv, -1);
      } else {
        this.nextTick(() => {
          this._maskValue(nv, 0);
          // this._matchValue(nv, 0)
        })
      }
      this.__innerValue = nv
    }
  }
  @watch("mask", { immediate: true })
  watchMask(nv: string) {
    if (!nv) return
    let shifting = false;
    let unitStr = "";
    let inUnit = false;
    let inRange = false;
    let rangeDivided = false;
    let rangeStart = 0;
    let rangeEnd = 1;
    let rangeStr = "";
    let maskBitList: MaskBit[] = [];
    let ssv = '';
    let lastCharHandled = false;
    this.__staticCharSet.clear()
    let minBitRequired = 0
    let maxBitRequired = 0
    const minBitInBlock: number[] = []
    const maxBitInBlock: number[] = []
    nv.split('').forEach((char, i: number) => {
      if (inUnit && char !== PatternChar.OPTION_END) {
        unitStr += char;
        return;
      } else if (shifting) {
        shifting = false;
        this.__staticCharSet.add(char)
        maskBitList.push({ char });
        return;
      } else if (
        inRange &&
        char !== PatternChar.RANGE_END &&
        char !== PatternChar.RANGE_DIVIDER
      ) {
        rangeStr += char;
        return;
      }
      switch (char) {
        case PatternChar.DIGIT:
          lastCharHandled = false;
          maskBitList.push({ exp: EXP_DIGIT });
          minBitRequired++
          maxBitRequired++
          return;
        case PatternChar.LETTER:
          lastCharHandled = false;
          maskBitList.push({ exp: EXP_LETTER });
          minBitRequired++
          maxBitRequired++
          return;
        case PatternChar.ANY:
          lastCharHandled = false;
          maskBitList.push({ exp: EXP_ANY });
          minBitRequired++
          maxBitRequired++
          return;
        case PatternChar.SHIFT:
          lastCharHandled = false;
          shifting = true;
          return;
        case PatternChar.OPTION_START:
          lastCharHandled = false;
          inUnit = true;
          unitStr = "";
          return;
        case PatternChar.OPTION_END:
          lastCharHandled = false;
          inUnit = false;
          maskBitList.push({ exp: new RegExp(`[${unitStr}]`) });
          minBitRequired++
          maxBitRequired++
          return;
        case PatternChar.RANGE_START:
          lastCharHandled = false;
          inRange = true;
          rangeStr = "";
          return;
        case PatternChar.RANGE_DIVIDER:
          lastCharHandled = false;
          rangeDivided = true;
          rangeStart = parseInt(rangeStr);
          rangeStr = "";
          return;
        case PatternChar.RANGE_END:
          lastCharHandled = false;
          rangeDivided = inRange = false;
          rangeEnd = parseInt(rangeStr);
          let bit = maskBitList.pop();
          if (!bit || !bit.exp) return;

          minBitRequired--
          maxBitRequired--
          let nextBitIndex = maskBitList.length + rangeEnd;
          each(range(0, rangeEnd), (i) => {
            let tmp = clone<MaskBit>(bit);
            minBitRequired++
            maxBitRequired++
            if (i >= rangeStart) {
              tmp.optional = true;
              tmp.nextBitIndex = nextBitIndex;
              minBitRequired--
            }
            maskBitList.push(tmp);
          });
          return;
        default:
          if (!maskBitList.some(bit => bit.exp)) {
            ssv += char;
          }
          this.__staticCharSet.add(char)
          maskBitList.push({ char });
          if (lastCharHandled) {
            this.__maskBlockStartBitList[this.__maskBlockStartBitList.length - 1] = maskBitList.length
            this.__maskBlockDividerList[this.__maskBlockDividerList.length - 1] += char
          } else {
            this.__maskBlockDividerList.push(char)
            this.__maskBlockStartBitList.push(maskBitList.length)

            minBitInBlock.push(minBitRequired)
            maxBitInBlock.push(maxBitRequired)
            minBitRequired = 0
            maxBitRequired = 0
          }

          lastCharHandled = true;
      }

    });
    minBitInBlock.push(minBitRequired);
    maxBitInBlock.push(maxBitRequired)
    this.__minBitInBlock = minBitInBlock
    this.__maxBitInBlock = maxBitInBlock

    this.__startStaticValue = ssv;
    if (ssv.length < first(this.__maskBlockStartBitList)) {
      this.__maskBlockStartBitList.unshift(ssv.length)
    }
    if (ssv) {
      this.__maskBlockDividerList.shift()
    }

    this.__maskBitList = maskBitList;
    this.nextTick(() => {
      // 掩码变化后必须以外部 value 为源重新格式化：__innerValue 是上一次掩码
      // 运算后的显示值，若旧掩码与值结构不符（如 HH:mm 先按 HH:mm:ss 处理），
      // 被裁剪过的显示值再套新掩码只会放大错误（09:30 → 23:）。
      const src = isBlank(this.value) ? this.__innerValue : this.value
      if (src) {
        this.__innerValue = src
        this._maskValue(src, 0);
      }
    })

    //maskholder
    let startIndex = 0;
    this.__maskHolder = map(this.__maskBitList, (bit, i) => {
      if (bit.char && i == startIndex) {
        startIndex++;
      }
      return bit.char || this.placeholderChar;
    }).join("");

    // let minLen = this.__maskBitList.length;
    // eachRight(this.__maskBitList, bit => {
    //   if (bit.optional) {
    //     minLen--;
    //   }
    // })
    // this.__minLen = minLen
    this.__staticCharRegExp = new RegExp(`[${Array.from(this.__staticCharSet).join('')}]`, 'g')
  }
  @watch("blocks", { immediate: true })
  watchBlocks(nv: any) {
    let tmp: Array<Range> = [];
    nv.replace(/\{([^,]+,[^}]+)\}/gm, (a: string, b: string) => {
      let pair = b.split(",");
      tmp.push({ min: pair[0], max: pair[1] });
    });
    this.__blockRanges = tmp;
  }
  //////////////////////////////////// lifecycles
  render(): Template {
    return h`
      <ce-input  border="${this.border}" align="${this.align}"
        .clearable="${this.clearable}" .required="${this.required}" .label="${this.label}" .placeholder="${this.placeholder}"
        .error="${this.error}" .error-message="${this.errorMessage}"
        class="ce-input-mask"
        @keydown="${this.onKeydown}"
        @keyup="${this.onKeyup}"
        @input="${this.onInput}"
        .value="${this.__innerValue}"
        ?readonly="${this.readonly}" ?disabled="${this.disabled}"
        @focus="${this.onFocus}"
        @blur="${this.onBlur}"
        @clear="${this.onClear}"
        ${bind(merge({
      appearance: this.appearance,
      color: this.color,
      size: this.size,
      round: this.round,
      loading: this.loading,
      label: this.label
    }, this.attrs))}
      >
        <slot slot="prepend" name="prepend"></slot>
        <slot slot="append" name="append"></slot>
      </ce-input>
    `;
  }

  mounted(): void {
    // 内层 ce-input 的原生 input 要等它自己挂载后才拿得到
    this.nextTick(() => this._bindComposition());
  }
  /**
   * 组合输入的收尾。输入法上屏的文本可能含掩码外字符（中文、全角标点等），
   * 此处**不套掩码**：立刻重排会把刚上屏的内容清掉，用户会看到"输入法打完就没了"。
   * 原文先留在框内并透传 input，约束（掩码重排 + blocks 范围）统一在失焦时兑现。
   */
  private _onCompositionEnd = (event: Event) => {
    const el = this.input?.inputRef?.current;
    if (!el) return;
    const value = el.value;
    // 已由 input 路径处理过的浏览器（组合末次事件 isComposing=false）不重复运算
    if (value === this.__innerValue) return;
    this.__innerValue = value;
    this._refreshCloseTag();
    this.emit('input', { value }, event);
  };
  /** 挂一次 compositionend；内层 input 若被重建则重挂（旧元素随影子树一起回收） */
  private _bindComposition() {
    const el = this.input?.inputRef?.current;
    if (!el || el === this.__compositionEl) return;
    this.__compositionEl?.removeEventListener('compositionend', this._onCompositionEnd);
    el.addEventListener('compositionend', this._onCompositionEnd);
    this.__compositionEl = el;
  }
  private __compositionEl: HTMLInputElement | HTMLTextAreaElement | null = null;
  //////////////////////////////////// methods
  _matchValue(value: string, curPoint: number, isDel: boolean = false) {
    let bitMatchBuffer: string[]
    let valueIndex = 0
    let maxValueIndex = value.length - 1
    let maskedValue = ''
    let buffers = []
    bitMatchBuffer = []
    for (let bitIndex = 0; bitIndex < this.__maskBitList.length; bitIndex++) {
      const mb = this.__maskBitList[bitIndex];

      if (valueIndex > maxValueIndex) break;

      let v = value[valueIndex]
      if (mb.exp) {
        if (mb.exp.test(v)) {
          bitMatchBuffer.push(v)
        } else {
          //todo mb的nextBitIndex属性可以不用
          if (mb.optional) {
            continue
          } else {
            //todo 如果内容不匹配直接跳过，检测下一个字符
            valueIndex++
            bitIndex--
            if (curPoint >= valueIndex)
              bitIndex--
            // curPoint--
            continue
          }
        }
      } else {
        if (v === mb.char) {
          bitMatchBuffer.push(v)
        } else {
          if (maskedValue[bitIndex] !== mb.char) {
            maskedValue += mb.char
          }

          if (value.length <= maskedValue.length)
            curPoint++
          continue
        }
        // if (v === this.skipOptionalChar || v === mb.char) {
        //   bitMatchBuffer.push(mb.char!)
        //   maskedValue += bitMatchBuffer.join('')
        //   continue
        // } else {
        //   break
        // }
      }
      valueIndex++
      // buffers.push()
      // maskedValue += bitMatchBuffer.join('')
    }
    if (this.input) this.input.inputRef.current!.value = maskedValue;
    this.__innerValue = maskedValue
    // if (maskedValue.length > curPoint) {
    //   curPoint = maskedValue.length
    // }
    this._setCaret(curPoint)
  }
  _checkRange(range: Range, value: string) {
    if (!range || !value) return value;
    // 数值范围（blocks 数字分区能力）
    if (typeof range.min === 'number' || /^\d+$/.test(range.min)) {
      let min = parseInt(range.min as string);
      let max = parseInt(range.max as string);
      let numVal = parseInt(value);
      let val: string | number = value;
      if (!isNaN(numVal)) {
        if (numVal < min) val = min;
        if (numVal > max) val = max;
      }
      return val + "";
    }
    // 字符范围（blocks 字符分区能力，按 charCode 比较）
    let minC = String(range.min).charCodeAt(0);
    let maxC = String(range.max).charCodeAt(0);
    let code = value.charCodeAt(0);
    if (isNaN(code)) return value;
    if (code < minC) return String(range.min);
    if (code > maxC) return String(range.max);
    return value;
  }
  /**
   * 按掩码重排。
   *
   * @param enforce 是否兑现 blocks 范围约束。输入阶段传 `false`：只做格式排布，
   *   不把越界值改成边界值（时间输入 25 点会被当场改成 23，用户还没输完）。
   *   越界只做记账（`__rangeDirty`），由失焦时的重排统一改写。
   */
  _maskValue(value: string, curPoint: number, isDel: boolean = false, enforce = true) {
    let mbll = this.__maskBitList.length;
    if (mbll < 1) return;

    let blocks = [];
    let maskedBlocks = [];
    let valueIndex = 0;
    let maskIndex = 0;
    let unmaskedValue = '';
    this.__maskedValue = '';
    // 光标记账：首次出现「已消费原始字符数 valueIndex == 光标位 curPoint」时，
    // 锁定当时的输出长度作为目标光标位（= 最后一枚被消费字符在输出串中的后一位）。
    // 取代旧的 staticStrLen 位置补偿——后者只判位置、不区分该分隔符是用户键入的
    // （光标已计入，不该补）还是掩码自动插入的（才需补），在替换/重排场景会多补（P0-2）。
    let caretOut: number | null = null;
    const lock = () => {
      if (caretOut === null && valueIndex === curPoint) caretOut = this.__maskedValue.length;
    };
    lock();
    let allPassed = true;

    let lastBlockStr = ''
    let lastMaskedBlockStr = ''

    value = value.replaceAll(this.placeholderChar, '')
    let lastV = last(value)

    while (maskIndex < mbll) {
      let bit = this.__maskBitList[maskIndex++];
      if (valueIndex > value.length - 1) {
        if (bit && bit.char) {
          // this.__maskedValue += bit.char
          if (isDel) {

          } else {
            curPoint++
          }
        }
        break
      }
      let v = value[valueIndex++];

      if (bit.exp) {
        if (bit.exp.test(v)) {
          unmaskedValue += v
          lastBlockStr += v
          lastMaskedBlockStr += v
          this.__maskedValue += v
          lock()
          const nextMaskIndex = maskIndex
          //如果有nextBitIndex并且与 maskIndex++相同，且开启greedy模式,且value长度==maskIndex，自动追加
          if (bit.nextBitIndex === nextMaskIndex && this.greedy && value.length === nextMaskIndex && value.length === valueIndex) {
            if (isDel) {
              maskedBlocks.push(lastMaskedBlockStr.substring(0, lastMaskedBlockStr.length - 1))
              blocks.push(lastBlockStr.substring(0, lastBlockStr.length - 1))

              this.__maskedValue = this.__maskedValue.substring(0, this.__maskedValue.length - 1)
            } else {
              let nextBit = this.__maskBitList[nextMaskIndex];
              maskedBlocks.push(lastMaskedBlockStr)
              blocks.push(lastBlockStr)
              if (nextBit) {
                let charStr = nextBit.char!
                let cIndex = 1
                let siblingBit: MaskBit
                while ((siblingBit = this.__maskBitList[nextMaskIndex + cIndex]) && siblingBit.char) {
                  charStr = charStr + siblingBit.char
                  cIndex++
                }
                this.__maskedValue += charStr
                curPoint = curPoint + size(charStr)
              }

            }

            lastBlockStr = ''
            lastMaskedBlockStr = ''
            break
          }
          continue
        } else if (v === this.placeholderChar) {
          this.__maskedValue += v
          lastMaskedBlockStr += v
          lock()
        } else if (this.__staticCharSet.has(v)) {
          //重排模型：分隔符出现在「可编辑位」上，说明本次编辑已打乱掩码结构
          //（如段内删除后的 123-567-8900）——丢弃该字符：只消费值、不推进掩码位。
          //maskIndex 在取 bit 时已自增，丢弃须回退，否则会连掩码位一起跳过。
          //掩码自身的分隔符会在对应 bit 上自动插入，无需在此「提前终结当前段」；
          //旧逻辑允许提前终结，会让段长脱离掩码定义（P1-3，与 IMask 的 123-5678-900 不符）。
          maskIndex--
          lock()
          continue
        } else if (bit.optional) {
          maskIndex = bit.nextBitIndex!
          valueIndex--
          continue
        } else {
          // 不符合掩码的字符只消费值、不推进掩码位：位被吞掉会让后续合法字符
          // 整体错位（粘贴 a1b2c3d4e5f6 到 000-0000-0000 会排成 1-23-45）
          maskIndex--
          lock()
          continue
        }
      } else if (bit.char) {
          // maskIndex 在取 bit 时已自增，当前位是 maskIndex - 1，前一位是 maskIndex - 2。
          // 旧写法判断的是当前分隔符位本身（exp 恒为 undefined），导致每段输入到分隔符时
          // 都不上栈，首段被丢弃、后续段整体前移，再被前一段的 blocks 范围钳制
          // （如 09:30 按 00:00 掩码被当成 30 分 → 小时钳到 23 → 显示 23:）。
          if (this.__maskBitList[maskIndex - 2]?.exp) {
            maskedBlocks.push(lastMaskedBlockStr)
            blocks.push(lastBlockStr)
          }
          this.__maskedValue += bit.char
          lastBlockStr = ''
          lastMaskedBlockStr = ''
          if (v === this.skipOptionalChar && value.length === valueIndex) {
            let mbdIndex = blocks.length - 1
            value = value.substring(0, valueIndex - 1) + (this.__maskBlockDividerList[mbdIndex] ?? '')
            valueIndex += size(this.__maskBlockDividerList[mbdIndex]) - 1
          } else if (bit.char !== v) {
            // 用户在分隔符位置键入了普通字符：不重写 value（会丢弃其后的数字），
            // 仅回退 valueIndex 让该字符在下一 exp 位被当作普通输入消费（与 guide 路径一致）。
            valueIndex--
          }
          // 光标记账：分隔符无论由用户键入（已消费）还是掩码自动插入（未消费），
          // 都在 valueIndex 归位后对齐一次
          lock()

      } else { continue }
    }

    const blockLen = blocks.length
    const bsbLen = this.__maskBlockStartBitList.length + (isBlank(this.__startStaticValue) ? 0 : 1)
    if (bsbLen > blockLen) {
      for (let i = 0; i < bsbLen - blockLen; i++) {
        blocks.push(lastBlockStr)
        maskedBlocks.push(lastMaskedBlockStr)
        lastBlockStr = lastMaskedBlockStr = ''
      }
    }
    // flat mask（无分隔符）或尚无任何 block 被压栈时，把残余数字串补为最后一个 block，
    // 否则 flat mask 会丢失全部输入（blocks 为空导致后续 last(blocks).length 抛错）。
    if (blocks.length === 0 && lastBlockStr) {
      blocks.push(lastBlockStr)
      maskedBlocks.push(lastMaskedBlockStr)
    }

    //使用block值进行检测，最后一个block仅在完全输入后校验
    let changed = false
    let lastIndex = this.__maskBlockStartBitList.length - 1
    blocks.forEach((block, i) => {
      let minLen = this.__minBitInBlock[i]
      if (block.length < minLen) {
        allPassed = false
      } else if (i < lastIndex) {
        let newVal = this._checkRange(get(this.__blockRanges, i), block)
        if (blocks[i] !== newVal) {
          if (enforce) {
            blocks[i] = newVal
            changed = true
          } else {
            // 输入阶段只记账，改写留给失焦
            this.__rangeDirty = true
          }
        }
      }
    })
    const lastMaxBitInBlock = last(this.__maxBitInBlock)
    lastBlockStr = last(blocks)
    if (lastBlockStr && lastBlockStr.length === lastMaxBitInBlock) {
      let newVal = this._checkRange(last(this.__blockRanges), lastBlockStr)
      if (lastBlockStr !== newVal) {
        if (enforce) {
          changed = true
          blocks[blocks.length - 1] = newVal
        } else {
          this.__rangeDirty = true
        }
      }
    }

    let compactedBlocks = compact(blocks)
    let validBlockSize = compactedBlocks.length

    let hyphenLen = 0
    let blockSizeChanged = this.__lastValidBlockSize - validBlockSize
    let newMaskValue = map(compactedBlocks, (block, i) => {
      if (compactedBlocks[i + 1] || (block.length === this.__maxBitInBlock[i]) || some(this.__maskBlockDividerList, d => d[0] === last(value))) {
        let hyphen = ''
        let appendChar = value.replace(this.__innerValue, '')
        if (i < compactedBlocks.length - 1) {
          hyphen = this.__maskBlockDividerList[i] ?? ''
        } else if (compactedBlocks.length - 1 === i) {
          if (!isDel && this.greedy) {
            hyphen = this.__maskBlockDividerList[i] ?? ''
          } else if (blockSizeChanged > 0 && !this.greedy) {
            hyphen = this.__maskBlockDividerList[i] ?? ''
          } else if (appendChar === this.skipOptionalChar || appendChar === (this.__maskBlockDividerList[i] ?? '') || (this.__maskBlockDividerList[i] && startsWith(this.__maskBlockDividerList[i], appendChar))) {
            hyphen = this.__maskBlockDividerList[i] ?? ''
          }
        }
        if (!isDel)
          hyphenLen = hyphen.length

        return block + hyphen
      }
      return block || maskedBlocks[i]
    })
    // 仅当范围校验修正了 block 时才用重建结果覆盖增量构建的 __maskedValue；
    // 否则保留增量构建结果（避免脆弱的 block 重建在完整输入时丢块/丢尾字符）。
    if (changed) {
      this.__maskedValue = (isBlank(newMaskValue) ? '' : this.__startStaticValue) + newMaskValue.join('')
    }

    this.__lastValidBlockSize = validBlockSize

    this.__blocks = blocks
    this.__maskedBlocks = maskedBlocks

    let displayValue = this.__maskedValue;

    const displayEl = this.input?.inputRef?.current;
    if (displayEl) displayEl.value = displayValue;

    const prevInner = this.__innerValue
    this.__innerValue = this.__maskedValue
    // 非 guide 模式下显示值本身就是可提交值：每次变化都同步到外部，否则在整串
    // 填满之前 update:value 一次都不发，双向绑定方读到的永远是初始空值
    if (!this.guide && this.__maskedValue !== prevInner) {
      this.emit('update:value', { value: this.__maskedValue })
    }
    if (allPassed) {
      if (!this.__lastPass) {
        this.emit('change', { value: this.__maskedValue })
      }
      this.__lastPass = true
    }
    else if (this.__lastPass) {
      this.emit('change', { value: '' })
      this.__lastPass = false
    }
    // 光标 = 最后一枚被消费的原始字符在输出串中的后一位；
    // 未命中（光标位于输入末尾之后）时回落到输出末尾
    let currentCIndex = caretOut ?? this.__maskedValue.length
    //fix cursor pos
    if (currentCIndex < this.__startStaticValue.length) {
      currentCIndex = this.__startStaticValue.length
    }
    //skip placeholder
    let maskBit = this.__maskBitList[currentCIndex]
    if (maskBit && maskBit.char && this.greedy) {
      // for (let i = currentCIndex; i < this.__maskBitList.length; i++) {
      //   const bit = this.__maskBitList[i];
      //   if (bit.char) currentCIndex++
      //   else {
      //     break
      //   }
      // }
    }
    if (this.input) {
      let ci = currentCIndex
      this._setCaret(ci)
    }
  }
  /** @param enforce 同 `_maskValue`：输入阶段不兑现 blocks 范围约束，只记账待失焦处理 */
  _maskValueGuide(value: string, curPoint: number, isDel: boolean = false, enforce = true) {
    let mbll = this.__maskBitList.length;
    if (mbll < 1) return;

    let blocks = [];
    let maskedBlocks = [];
    let valueIndex = 0;
    let maskIndex = 0;
    let unmaskedValue = '';
    // guide 模式的显示值恒为完整掩码长度（含占位符）。占位符不参与掩码运算，
    // 否则每个占位符都会消耗一个掩码位，把光标顶回已填内容之前（P0-1 跨界输入
    // 光标回退 1 位 → 后续字符两两反序）、整串粘贴光标停在 11 而非 13（P2-4）。
    // 剔除后按「光标前的占位符个数」回退光标坐标，换算到裸值坐标系。
    let phBefore = 0;
    for (let i = 0; i < curPoint && i < value.length; i++) {
      if (value[i] === this.placeholderChar) phBefore++;
    }
    curPoint -= phBefore;
    value = value.split(this.placeholderChar).join('');
    this.__maskedValue = '';
    // 光标记账（同 _maskValue）：首次出现「已消费枚数 == 光标位」时锁定输出长度
    let caretOut: number | null = null;
    const lock = () => {
      if (caretOut === null && valueIndex === curPoint) caretOut = this.__maskedValue.length;
    };
    lock();
    let allPassed = true;

    let lastBlockStr = ''
    let lastMaskedBlockStr = ''

    while (maskIndex < mbll) {
      let bit = this.__maskBitList[maskIndex++];
      if (valueIndex > value.length - 1) {
        if (bit && bit.char) {
          this.__maskedValue += bit.char
          // maskedBlocks.push(lastMaskedBlockStr)
          // blocks.push(lastBlockStr)
        } else if (this.guide && bit) {
          this.__maskedValue += this.placeholderChar
        }
        continue
        // break
      }
      let v = value[valueIndex++];

      if (bit.exp) {
        if (bit.exp.test(v)) {
          unmaskedValue += v
          lastBlockStr += v
          lastMaskedBlockStr += v
          this.__maskedValue += v
          lock()
          const nextMaskIndex = maskIndex
          //如果有nextBitIndex并且与 maskIndex++相同，且开启greedy模式,且value长度==maskIndex，自动追加
          if (bit.nextBitIndex === nextMaskIndex && this.greedy && value.length === nextMaskIndex && value.length === valueIndex) {
            if (isDel) {
              maskedBlocks.push(lastMaskedBlockStr.substring(0, lastMaskedBlockStr.length - 1))
              blocks.push(lastBlockStr.substring(0, lastBlockStr.length - 1))

              this.__maskedValue = this.__maskedValue.substring(0, this.__maskedValue.length - 1)
            } else {
              let nextBit = this.__maskBitList[nextMaskIndex];
              maskedBlocks.push(lastMaskedBlockStr)
              blocks.push(lastBlockStr)
              if (nextBit)
                this.__maskedValue += nextBit.char
            }

            lastBlockStr = ''
            lastMaskedBlockStr = ''
            break
          }
          continue
        } else if (v === this.placeholderChar) {
          this.__maskedValue += v
          lastMaskedBlockStr += v
          lock()
        } else if (this.__staticCharSet.has(v)) {
          //重排模型（同 _maskValue）：分隔符出现在可编辑位上 → 丢弃：只消费值、不推进掩码位。
          //maskIndex 在取 bit 时已自增，丢弃须回退（否则会吃掉一个应填占位符的掩码位）。
          //guide 旧逻辑会在此为「被跳过的空段」补占位符并跳转，跨界输入时光标因此回退 1 位。
          maskIndex--
          lock()
          continue
        } else if (bit.optional) {
          maskIndex = bit.nextBitIndex!
          valueIndex--
          continue
        } else {
          // 同 _maskValue：不匹配的字符丢弃且不占位，否则后续字符会错位
          maskIndex--
          lock()
          continue
        }
      } else if (bit.char) {
        // if (v === this.placeholderChar) {
        //   maskIndex--
        //   continue
        // } else {
        maskedBlocks.push(lastMaskedBlockStr)
        blocks.push(lastBlockStr)
        this.__maskedValue += bit.char
        lastBlockStr = ''
        lastMaskedBlockStr = ''
        if (bit.char !== v) {
          valueIndex--
        }
        // 光标记账（同 _maskValue）
        lock()
        // }
      } else { continue }
    }

    const blockLen = blocks.length
    const bsbLen = this.__maskBlockStartBitList.length
    if (bsbLen > blockLen) {
      for (let i = 0; i < bsbLen - blockLen; i++) {
        blocks.push(lastBlockStr)
        maskedBlocks.push(lastMaskedBlockStr)
        lastBlockStr = lastMaskedBlockStr = ''
      }
    } else {
      allPassed = false
    }

    //使用block值进行检测，最后一个block仅在完全输入后校验
    let changed = false
    let lastIndex = this.__maskBlockStartBitList.length - 1
    blocks.forEach((block, i) => {
      let minLen = this.__minBitInBlock[i]
      if (block.length < minLen) {
        allPassed = false
      } else if (i < lastIndex) {
        let newVal = this._checkRange(get(this.__blockRanges, i), block)
        if (blocks[i] !== newVal) {
          if (enforce) {
            blocks[i] = newVal
            changed = true
          } else {
            this.__rangeDirty = true
          }
        }
      }
    })
    const lastMaxBitInBlock = last(this.__maxBitInBlock)
    // 补齐空块时 lastBlockStr 已被清空，最后一段的实际文本在 blocks 末尾；
    // 不从 blocks 取会让最后一段的范围校验（如秒 {0,59}）永远不执行
    const lastBlockValue = last(blocks) || ''
    if (lastBlockValue.length === lastMaxBitInBlock) {
      let newVal = this._checkRange(last(this.__blockRanges), lastBlockValue)
      if (lastBlockValue !== newVal) {
        if (enforce) {
          changed = true
          blocks[blocks.length - 1] = newVal
        } else {
          this.__rangeDirty = true
        }
      }
    }
    if (changed) {
      let newMaskValue = map(blocks, (block, i) => (block || maskedBlocks[i]) + (this.__maskBlockDividerList[i] ?? ''))
      this.__maskedValue = newMaskValue.join('')
    }

    this.__blocks = blocks
    this.__maskedBlocks = maskedBlocks

    let displayValue = this.__maskedValue;

    // 迟到回调（防抖 / nextTick 落在销毁之后）时 inputRef 已为 null
    const displayEl = this.input?.inputRef?.current;
    if (displayEl) displayEl.value = displayValue;

    // 显示镜像恒指向当前显示值（含占位符）；但占位符不是可用值，所以 guide 模式
    // 仍只在整串填满时才对外提交
    this.__innerValue = this.__maskedValue
    if (allPassed) {
      this.__lastPass = true
      this.emit('update:value', { value: this.__maskedValue })
    }
    else if (this.__lastPass) {
      this.__lastPass = false
    }
    // 光标 = 最后一枚被消费的原始字符在输出串中的后一位；未命中则回落到输出末尾
    let currentCIndex = caretOut ?? this.__maskedValue.length
    //fix cursor pos
    if (currentCIndex < this.__startStaticValue.length) {
      currentCIndex = this.__startStaticValue.length
    }
    // //skip placeholder
    let maskBit = this.__maskBitList[currentCIndex]
    if (maskBit && maskBit.char && this.greedy) {
      for (let i = currentCIndex; i < this.__maskBitList.length; i++) {
        const bit = this.__maskBitList[i];
        if (bit.char) currentCIndex++
        else {
          break
        }
      }
    }
    this._setCaret(currentCIndex)
  }
  _getNextDivider(maskIndex: number) {
    let i = findIndex(this.__maskBlockStartBitList, b => maskIndex < b)
    if (i < 0) return ''
    return this.__maskBlockDividerList[i - 1]
  }
  _getNextExpBit(index: number) {
    let bit: MaskBit | undefined
    each(this.__maskBitList, (b, i) => {
      if (i >= index && b.exp) {
        bit = b
        return false
      }
    })
    return bit
  }
  @debounced(100)
  _refreshCloseTag() {
    this.refreshCloseTag = Math.random()
  }
  onClear() {
    this.clear();
    // guide 模式：清空后恢复占位符显示与光标置首
    if (this.guide && this.__maskHolder) {
      this.__innerValue = this.__maskHolder;
      // 同 clear()：模板上的 value 属性写不进 dirty 过的 input，必须直接赋值
      const el = this.input?.inputRef?.current;
      if (el) el.value = this.__maskHolder;
      const start = this.__startStaticValue.length;
      setTimeout(() => this._setCaret(start), 0);
    }
  }
  _changeValue = ''
  _selectionStart = 0
  _selectionEnd = 0
  // 段选中相关内部状态（对组件实例隐藏）
  private _segMouseBound = false
  private _lastArrowKey = ''
  private _prevCaret = 0
  private _prevSelStart = 0
  private _prevSelEnd = 0
  onKeydown(obj: Record<string, any>) {
    let val = obj.target.value
    let { selectionText, selectionStart, selectionEnd, event } = obj
    if (event.key === 'Control') return
    if (event.key === 'Shift') return
    if (event.key === 'Alt') return

    // 段选中：记录方向键与按键前的选区，供 onKeyup 判断「是否跨过分隔符进入新段」。
    if (this.selectSegment && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      this._lastArrowKey = event.key;
      this._prevCaret = selectionStart ?? 0;
      this._prevSelStart = selectionStart ?? 0;
      this._prevSelEnd = selectionEnd ?? 0;
    }

    this._changeValue = val
    this._selectionStart = selectionStart
    this._selectionEnd = selectionEnd
  }
  /**
   * 段选中：方向键跨过静态分隔符（如 : / -）进入相邻段时，把该段整段选中，对齐原生 time/date。
   * 触发条件：① 按键前已有选区（说明上一步刚选中某段，本次方向键应跳到相邻段）；
   *          ② 按键后光标停在分隔符上（段内逐字符移动则不干扰）。
   * 选中目标 = 以 caret 为锚点、沿 heading 方向跨过最近的静态分隔符后所在的段。
   * 通过 @keyup 组件通道触发（ce-input 已 emit keyup）。
   */
  onKeyup(obj: Record<string, any>) {
    if (!this.selectSegment) return;
    const key = this._lastArrowKey;
    this._lastArrowKey = '';
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
    const input = this.input?.inputRef?.current;
    if (!input) return;
    const caret = input.selectionStart ?? 0;
    const hadSelection = this._prevSelStart !== this._prevSelEnd;
    const list = this.__maskBitList;
    const onDivider = !list[caret]?.exp;
    if (!(hadSelection || onDivider)) return; // 段内逐字符移动，不重选
    const heading: 1 | -1 = key === 'ArrowRight' ? 1 : -1;
    const range = this._adjacentSegment(caret, heading);
    if (range) this._selectRangeAfter(range);
  }
  /** 以 caret 为锚点，沿 heading 方向跨过最近的静态分隔符，返回其相邻段的 [start,end+1]。 */
  private _adjacentSegment(caret: number, heading: 1 | -1): [number, number] | null {
    const list = this.__maskBitList;
    if (!list?.length) return null;
    if (heading === 1) {
      for (let d = caret; d < list.length; d++) {
        if (!list[d]?.exp) {
          if (list[d + 1]?.exp) return this._expandSegment(d + 1);
          break;
        }
      }
      for (let p = list.length - 1; p >= 0; p--) if (list[p]?.exp) return this._expandSegment(p);
      return null;
    } else {
      for (let d = caret; d >= 0; d--) {
        if (!list[d]?.exp) {
          if (list[d - 1]?.exp) return this._expandSegment(d - 1);
          break;
        }
      }
      for (let p = 0; p < list.length; p++) if (list[p]?.exp) return this._expandSegment(p);
      return null;
    }
  }
  /** 双保险设置已知选区范围（同 _selectSegmentAfter，但直接吃 [start,end+1]）。 */
  private _selectRangeAfter(range: [number, number]) {
    const apply = () => {
      const input = this.input?.inputRef?.current;
      if (!input) return;
      try { input.setSelectionRange(range[0], range[1]); } catch { /* 不支持选区 */ }
    };
    setTimeout(apply, 0);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
  }
  /** 原生 mouseup 监听：点击进入掩码段时整段选中（用户拖选则不干扰）。 */
  private _onInnerMouseUp = () => {
    if (!this.selectSegment) return;
    const input = this.input?.inputRef?.current;
    if (!input) return;
    const s = input.selectionStart, en = input.selectionEnd;
    if (s !== en) return; // 用户拖选，保留其选区
    this._selectSegment(s ?? 0);
  }
  onInput(obj: Record<string, any>) {
    let value = obj.value;
    let ev = obj.event as InputEvent | undefined;
    // 合成中输入（中文/IME）或粘贴：先交由浏览器处理，待最终 input 再统一掩码，避免错位
    if (ev && (ev.isComposing || ev.inputType === 'insertCompositionText')) return;
    // 无原生事件：由内层 ce-input 清空后补发的 input。值已是最终结果，
    // 没有 inputType 与光标位置可依，无法套掩码，只能原样透传。
    if (!ev) {
      this._refreshCloseTag()
      this.emit('input', { value })
      return
    }
    let inputType = ev.inputType
    let isDel = isString(inputType) && startsWith(inputType, 'delete')
    let p = (ev.target as HTMLInputElement)?.selectionStart ?? (value ?? '').length
    if (this.guide) {
      // if (isDel && this.greedy) {
      //   let oldValueLen = value.length
      //   each(tail(this.__maskBlockStartBitList), (bitIndex, i: number) => {
      //     let dividerSize = this.__maskBlockDividerList[i].length
      //     let startIndex = bitIndex - dividerSize
      //     if (p >= startIndex && p <= bitIndex - 1) {
      //       let suffix = value.substring(bitIndex - 1, value.length)
      //       value = value.substring(0, bitIndex - dividerSize - 1) + suffix
      //     }
      //   })
      //   p = p - (oldValueLen - value.length)
      // }
      // enforce=false：输入阶段只排布格式，越界值（25 点）不当场改成 23
      this._maskValueGuide(value, p, isDel, false);
    } else {
      if (isDel && this.greedy) {
        let delStr = this._changeValue.substring(Math.min(p, this._selectionStart), Math.max(p, this._selectionEnd))
        if (this.__maskBlockDividerList.includes(delStr[0])) {
          let startP = p
          while (this.__maskBlockDividerList.includes(value[startP - 1])) {
            startP--
          }
          let front = value.substring(0, startP)
          let end = value.substring(p, value.length)
          value = front.substring(0, front.length - 1) + end
          p -= p - startP + 1
        }
      }
      // this._matchValue(value, p)
      this._maskValue(value, p, isDel, false);
    }

    this._refreshCloseTag()
    this.emit('input', { value: this.__innerValue }, obj.event)
  }
  onBlur(obj: Record<string, any>) {
    // 失焦是约束的兑现点：组合输入、粘贴、浏览器自动填充都可能把不符合掩码的文本
    // 直接写进原生 input；输入阶段也未兑现 blocks 范围（__rangeDirty）。两件事都在这里做。
    const el = this.input?.inputRef?.current
    if (el && (this.__rangeDirty || el.value !== this.__maskedValue)) {
      const before = this.__maskedValue
      if (this.guide) this._maskValueGuide(el.value, el.value.length)
      else this._maskValue(el.value, el.value.length)
      this.__rangeDirty = false
      this._refreshCloseTag()
      // 范围修正改变了提交值，但 allPassed / lastPass 都没变，内部不会重发 change
      if (this.__maskedValue !== before) this.emit('change', { value: this.__maskedValue })
    }
    //check valid
    let allPassed = true
    this.__blocks.forEach((block, i) => {
      let minLen = this.__minBitInBlock[i]
      if (block.length < minLen) {
        allPassed = false
      }
    })
    if (this.__lastPass != allPassed) {
      this.__lastPass = allPassed
    }
    this.__innerValue = this.input?.inputRef?.current?.value ?? ''
    this.emit('blur', { value: this.__innerValue }, obj.event)
  }
  /**
   * 在 compelem 把 input.value 提交到 DOM（会把光标推到末尾）之后，把光标钳制到目标位。
   * 双保险：setTimeout(0) 在 headless 下稳定触发；真实浏览器中 compelem 在 rAF 阶段提交 value，
   * 故再补一个 requestAnimationFrame（晚于 compelem 的更新队列注册，后执行者胜出）兜底。
   * 两条路径目标位置一致，无论 compelem 用 microtask 还是 rAF 提交，光标最终都落在 cIndex。
   */
  private _setCaretAfter(cIndex: number) {
    setTimeout(() => this._setCaret(cIndex), 0);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this._setCaret(cIndex));
    }
  }
  onFocus(obj: Record<string, any> | string) {
    let value = isObject(obj) ? obj.value : obj;
    this._bindComposition();

    // 段选中：聚焦后把光标所在掩码段整段选中，对齐原生 time/date 交互。
    // 同时挂一次内层 input 的 mouseup 监听（原生监听，免疫 emit-native 通道泄漏），
    // 用于实现「点击进入段即选中」。
    if (this.selectSegment) {
      if (!this._segMouseBound) {
        const input = this.input?.inputRef?.current;
        if (input) {
          input.addEventListener('mouseup', this._onInnerMouseUp);
          this._segMouseBound = true;
        }
      }
      let caret = this.__startStaticValue.length;
      if (trim(value) || !this.guide) {
        // 段选语义：以获焦/点击位为锚点选中其所在段（guide 下不再回退到首个空位，
        // 否则点击右半段会被 _firstEmptyBitIndex 拉回首段）。空值兜底到首段。
        let focusCurPos = isObject(obj) ? this.input.inputRef.current?.selectionStart || 0 : 0;
        caret = Math.max(focusCurPos, this.__startStaticValue.length);
        if (!trim(value)) caret = this.__startStaticValue.length;
      } else if (this.__maskHolder) {
        this.__innerValue = this.__maskHolder;
      }
      this._selectSegmentAfter(caret);
      this.emit('focus', { value });
      return;
    }

    if (!trim(value) && this.guide && this.__maskHolder) {
      this.__innerValue = this.__maskHolder;
      // 空值引导模式：光标置于首个可编辑位（跳过前导静态字符），
      // 而非浏览器在程序化赋值后默认放到的占位符最右端。
      const start = this.__startStaticValue.length;
      this._setCaretAfter(start);
      this.emit('focus', { value });
      return;
    }

    if (this.guide) {
      // 基准必须是「当前显示值里第一个未填写的掩码位」，不能用 __maskedValue.length：
      // 后者是上次掩码运算的产物，长度恒等于完整掩码长度（含占位符），
      // 于是点击末尾时 focusCurPos == cIndex，"focusCurPos < cIndex" 不成立，
      // 光标被留在最后一个占位符之后，后续键入会被掩码整体丢弃。
      let focusCurPos = isObject(obj) ? this.input.inputRef.current?.selectionStart || 0 : 0;
      let shown = this.input?.inputRef?.current?.value ?? this.__maskedValue;
      let cIndex = this._firstEmptyBitIndex(shown);
      if (focusCurPos < cIndex) {
        cIndex = focusCurPos
      }
      if (cIndex < this.__startStaticValue.length) {
        cIndex = this.__startStaticValue.length
      }
      this._setCaretAfter(cIndex);
    }
    this.emit('focus', { value })
  }
  /**
   * 返回 shown 里第一个「尚未填写」的掩码位索引（跳过静态分隔符）；全部已填时返回 shown 长度。
   * 用于把获焦光标钳制在已填区域内：既能点选已填内容编辑，又不会落到占位符之后。
   */
  _firstEmptyBitIndex(shown: string): number {
    const bitList = this.__maskBitList
    if (!bitList) return 0
    for (let i = 0; i < bitList.length; i++) {
      const bit = bitList[i]
      if (!bit.exp) continue
      const ch = shown[i]
      if (ch === undefined || ch === this.placeholderChar) return i
    }
    return size(shown)
  }
  _setCaret(cIndex: number) {
    const input = this.input?.inputRef?.current;
    if (!input) return;
    try {
      input.setSelectionRange(cIndex, cIndex);
    } catch { /* 某些类型 input 不支持选区 */ }
  }
  /**
   * 由光标位推导所在「掩码段」的 [start, end+1]。
   * 段 = 连续的「可编辑位」(bit.exp) 最大游程，被静态分隔符(bit.char)或字符串边界夹住。
   * 光标落在静态分隔符上时，按 heading 方向选其相邻段（Right→右段，Left→左段；无则反向）。
   */
  private _segmentRange(caret: number, heading: 1 | -1 = 1): [number, number] | null {
    const list = this.__maskBitList;
    if (!list?.length) return null;
    if (!list[caret]?.exp) {
      const alt = caret + heading;
      if (list[alt]?.exp) return this._expandSegment(alt);
      const back = caret - heading;
      if (list[back]?.exp) return this._expandSegment(back);
      return null;
    }
    return this._expandSegment(caret);
  }
  private _expandSegment(p: number): [number, number] {
    const list = this.__maskBitList;
    let s = p, e = p;
    while (s - 1 >= 0 && list[s - 1]?.exp) s--;
    while (e + 1 < list.length && list[e + 1]?.exp) e++;
    return [s, e + 1];
  }
  /** 立即选中光标所在的掩码段（无段信息时不动作）。 */
  private _selectSegment(caret: number, heading: 1 | -1 = 1) {
    const range = this._segmentRange(caret, heading);
    if (!range) return;
    const input = this.input?.inputRef?.current;
    if (!input) return;
    try { input.setSelectionRange(range[0], range[1]); } catch { /* 不支持选区 */ }
  }
  /**
   * 在 compelem 把 input.value 提交到 DOM（会把光标/选区推到末尾）之后，把选区钳制到目标段。
   * 双保险：setTimeout(0) + requestAnimationFrame，后执行者胜出（同 _setCaretAfter）。
   */
  private _selectSegmentAfter(caret: number, heading: 1 | -1 = 1) {
    setTimeout(() => this._selectSegment(caret, heading), 0);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this._selectSegment(caret, heading));
    }
  }
  _getMaskValue(startIndex: number) {
    let value = map(slice(this.__maskBitList, startIndex), (bit, i) => {

      return bit.char || this.placeholderChar;
    }).join("");
    return value;
  }
  getUnmaskedValue() {
    return this.__maskedValue.replace(this.__staticCharRegExp, '').replaceAll(this.placeholderChar, '')
  }
  clear() {
    // value 为 model prop，禁止 this.value='' 直接赋值（抛 Cannot assign）。
    this.__maskedValue = ''
    this.__innerValue = ''
    this.__lastPass = false
    this.__rangeDirty = false
    // 必须直接写原生 input：已经键入过的 input 是 dirty 状态，模板上的 value 属性
    // 再赋 '' 不会改变已显示的内容，而 __innerValue 已被置空 ⇒ 后续 watchValue
    // 认为「值没变」直接跳过，界面永远停着旧文本
    const el = this.input?.inputRef?.current
    if (el) el.value = ''
    this.emit('update:value', { value: '' })
    this.emit('clear', { value: '' })
  }
}