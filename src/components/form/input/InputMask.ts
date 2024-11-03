import { clone, each, eachRight, first, get, isBlank, isEmpty, map, merge, range, slice, startsWith, tail, trim } from "myfx";

import { bind, html, prop, query, state, tag, Template, watch } from "compelem";
import { FormControl } from "../FormControl";
import formStyle from "../style.scss";
import { Input } from "./Input";
import style from "./style.scss";
enum PatternChar {
  CHAR_DIGIT = "0",
  CHAR_LETTER = "a",
  CHAR_ANY = "*",
  CHAR_SHIFT = "\\",
  CHAR_OPTION_START = "[",
  CHAR_OPTION_END = "]",
  CHAR_RANGE_START = "{",
  CHAR_RANGE_DIVIDER = ",",
  CHAR_RANGE_END = "}",
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
 *  mask {array|string|function} 掩码格式，可以是按位设置的正则/静态字符数组，或返回数组的函数，或字符串。字符串格式为
 *  - 0 数字0-9
 *  - a 字母a-zA-Z
 *  - * 任意字符或空
 *  - \\ 用于转义0/a/* 等字符
 *  - [] 一组可选项，同RegExp语法
 *  - {,} 范围标记，控制紧挨着{符号左侧的字符重复次数，签名为 {min,max}
 *  placeholderChar {string} 占位字符，默认 _
 *  showMask {boolean} 输入值为空时显示掩码替代placeholder，默认true
 *  guide {boolean} 指导模式会始终显示掩码，默认false
 *  greedy {boolean} 贪婪模式，启用后会在输入/删除时自动追加/删除分隔符。默认true
 *  blocks {string} 由,号分割的多组范围符号，用于控制每个“分区”输入值范围。“分区”是由静态字符分割的掩码段，每个段输入完成后会自动进行范围匹配。
 *    支持数字和字符，如果是字符则按照charcode计算范围
 * @slots
 *  leading
 *  trailing
 * @events
 *  focus
 *  blur
 *  section
 * @methods
 *  getUnmaskedValue() 返回剔除掩码后的内容
 *
 * @author holyhigh2
 */
@tag("l-input-mask")
export class InputMask extends FormControl {
  changeDisplay(stateName: string, enabled: boolean): void {
    throw new Error("Method not implemented.");
  }
  @query('l-input')
  input: Input;
  //////////////////////////////////// props
  @prop({ type: [String], required: true }) mask: string;
  @prop placeholderChar = "_";
  @prop showMask = true;
  @prop guide = false;
  @prop greedy = true;
  @prop blocks = "";

  @prop({ type: String, sync: true })
  get value() {
    return this.__lastPass ? this.__innerValue : ''
  }
  //仅用于外部变更
  set value(v: string) {
    if (this.__innerValue === v) return;
    v = v ?? ''
    if (this.__maskBitList) {
      this._maskValue(v, -1);
    } else {
      this.nextTick(() => {
        this._maskValue(v, 0);
      })
    }
    this.__innerValue = v
  }
  @state __innerValue: string = '';
  @state __initValue = '';

  __maskBitList: Array<MaskBit> = [];
  __maskBlockStartBitList: Array<number> = []
  __maskBlockDividerList: Array<string> = []
  __lastValue: string;
  __blockRanges: Array<Range>;
  //保存输入值为空时的掩码字符
  __maskHolder: string;
  __unmaskedValue: string = '';
  __maskedValue: string = '';
  //mask开头的静态内容
  __startStaticValue: string = '';
  __endHolderExp = new RegExp(this.placeholderChar + '+$')
  __lastPass: boolean;

  static get styles(): string[] {
    return [formStyle, style];
  }

  /////////////////////////////////// watches
  @watch('__innerValue', { once: true })
  watchInnerValue(nv: string) {
    this.__initValue = nv;
  }
  @watch("mask", { immediate: true })
  watchMask(nv: string) {
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
    each<string>(nv, (char, i: number) => {
      if (inUnit && char !== PatternChar.CHAR_OPTION_END) {
        unitStr += char;
        return;
      } else if (shifting) {
        shifting = false;
        maskBitList.push({ char });
        return;
      } else if (
        inRange &&
        char !== PatternChar.CHAR_RANGE_END &&
        char !== PatternChar.CHAR_RANGE_DIVIDER
      ) {
        rangeStr += char;
        return;
      }

      switch (char) {
        case PatternChar.CHAR_DIGIT:
          lastCharHandled = false;
          maskBitList.push({ exp: EXP_DIGIT });
          return;
        case PatternChar.CHAR_LETTER:
          lastCharHandled = false;
          maskBitList.push({ exp: EXP_LETTER });
          return;
        case PatternChar.CHAR_ANY:
          lastCharHandled = false;
          maskBitList.push({ exp: EXP_ANY });
          return;
        case PatternChar.CHAR_SHIFT:
          lastCharHandled = false;
          shifting = true;
          return;
        case PatternChar.CHAR_OPTION_START:
          lastCharHandled = false;
          inUnit = true;
          unitStr = "";
          return;
        case PatternChar.CHAR_OPTION_END:
          lastCharHandled = false;
          inUnit = false;
          maskBitList.push({ exp: new RegExp(`[${unitStr}]`) });
          return;
        case PatternChar.CHAR_RANGE_START:
          lastCharHandled = false;
          inRange = true;
          rangeStr = "";
          return;
        case PatternChar.CHAR_RANGE_DIVIDER:
          lastCharHandled = false;
          rangeDivided = true;
          rangeStart = parseInt(rangeStr);
          rangeStr = "";
          return;
        case PatternChar.CHAR_RANGE_END:
          lastCharHandled = false;
          rangeDivided = inRange = false;
          rangeEnd = parseInt(rangeStr);
          let bit = maskBitList.pop();
          if (!bit || !bit.exp) return;

          let nextBitIndex = maskBitList.length + rangeEnd;
          each(range(0, rangeEnd), (i) => {
            let tmp = clone<MaskBit>(bit);
            if (i >= rangeStart) {
              tmp.optional = true;
              tmp.nextBitIndex = nextBitIndex;
            }
            maskBitList.push(tmp);
          });
          return;
        default:
          if (!maskBitList.some(bit => bit.exp)) {
            ssv += char;
          }
          maskBitList.push({ char });
          if (lastCharHandled) {
            this.__maskBlockStartBitList[this.__maskBlockStartBitList.length - 1] = maskBitList.length
            this.__maskBlockDividerList[this.__maskBlockDividerList.length - 1] += char
          } else {
            this.__maskBlockDividerList.push(char)
            this.__maskBlockStartBitList.push(maskBitList.length)
          }

          lastCharHandled = true;
      }

    });
    this.__startStaticValue = ssv;
    if (ssv.length < first(this.__maskBlockStartBitList)) {
      this.__maskBlockStartBitList.unshift(ssv.length)
    }
    if (ssv) {
      this.__maskBlockDividerList.shift()
    }

    this.__maskBitList = maskBitList;
    this.nextTick(() => {
      this._maskValue(this.__innerValue, 0);
    })
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
    return html`
      <l-input
        class="c-form-input-mask"
        @input="${this.onInput}"
        .value="${this.__initValue}"
        ?readonly="${this.readonly}" ?disabled="${this.disabled}"
        ${bind(this.attrs)} 
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
        <div slot="trailing">
          <slot name="trailing"></slot>
        </div>
      </l-input>
    `;
  }

  mounted(): void {
    this.onFocus('');
  }
  //////////////////////////////////// methods
  _checkRange(range: Range, value: string) {
    if (!range || !value) return value;
    if (isNaN(range.min)) {
      return "";
    } else {
      let min = parseInt(range.min);
      let max = parseInt(range.max);
      let numVal = parseInt(value);
      if (numVal < min) numVal = min;
      if (numVal > max) numVal = max;
      return numVal + "";
    }
  }
  _maskValue(value: string, curPoint: number, isDel: boolean = false) {
    let maskedBlocks = [];
    let maskedValue = "";
    let valueIndex = 0;
    let maskIndex = 0;
    //每个块的索引
    let blockMaskIndex = 0;
    //记录每个block（默认1个）的mask check结果
    let checkedMap: Record<string, boolean> = {};
    let unmaskedValue = '';
    let staticStrLen = 0;
    this.__maskedValue = '';
    let allPassed = true;
    let lastCharHandled = false;
    let isLastCharPlaceHolder = false;
    let mbll = this.__maskBitList.length;
    if (mbll < 1) return;

    let minMbll = mbll;
    eachRight(this.__maskBitList, bit => {
      if (bit.optional) {
        minMbll--;
      } else {
        return false;
      }
    })

    while (maskIndex <= mbll) {
      if (valueIndex >= value.length) {
        if (!this.__maskBitList[maskIndex]) {
          checkedMap[maskedBlocks.length] = true;
        }
        if (maskIndex < minMbll) {
          allPassed = false;
        }

        break;
      }
      let bit = this.__maskBitList[maskIndex];
      if (!bit) {
        checkedMap[maskedBlocks.length] = true;
        break;
      }

      blockMaskIndex++;
      let v = value[valueIndex++];
      if (bit.exp) {
        isLastCharPlaceHolder = false;
        lastCharHandled = false;
        if (v !== this.placeholderChar && bit.exp.test(v)) {
          unmaskedValue += v;
          maskedValue += v;
          this.__maskedValue += v;
        } else if (bit.optional) {
          //是占位符就当作占位符
          if (v === this.placeholderChar) {
            isLastCharPlaceHolder = true;
          } else if (bit.nextBitIndex && this.__maskBitList[bit.nextBitIndex] && this.__maskBitList[bit.nextBitIndex].char === v) {
            maskIndex = bit.nextBitIndex!;
            valueIndex--;
            continue;
          } else {
            maskIndex--;
          }
        } else {
          allPassed = false;
          maskIndex--;
          blockMaskIndex--;
        }
      } else if (!isLastCharPlaceHolder) {
        blockMaskIndex = 0
        let tmp = maskedValue;
        maskedValue += bit.char;
        this.__maskedValue += bit.char;

        if (maskedValue !== bit.char) {
          maskedBlocks.push(tmp + bit.char);
        } else if (lastCharHandled && maskedBlocks.length > 0) {
          maskedBlocks[maskedBlocks.length - 1] += bit.char
        }

        if (v !== bit.char) {
          valueIndex--;
        }
        //autocheck block
        if (!isEmpty(this.__blockRanges) && maskedBlocks.length > 0 && !isBlank(tmp)) {
          let blockIndex: number = maskedBlocks.length - 1;
          let range = this.__blockRanges[blockIndex];
          let newVal = this._checkRange(range, tmp);
          if (newVal !== tmp) {
            maskedBlocks[blockIndex] = newVal + bit.char;
            this.__maskedValue = this.__maskedValue.substring(0, this.__maskedValue.length - tmp.length - 1) + maskedBlocks[blockIndex]
          }
        }

        //cursor offset
        if (maskedBlocks.join('').length + maskedValue.length > curPoint) {
          staticStrLen++;
        }
        maskedValue = "";
        lastCharHandled = true;
      }
      maskIndex++;

      //自动补充分隔符
      if (this.greedy) {
        let blockMaskBit = this.__maskBlockStartBitList[maskedBlocks.length]
        let bitI = blockMaskIndex + blockMaskBit
        let maskBit = this.__maskBitList[bitI]
        if (valueIndex >= value.length && maskBit && maskBit.char) {
          if (isDel) {
            continue;
          }
          if (!this.guide) {
            let dividers = this.__maskBlockDividerList[maskedBlocks.length]
            value += dividers
          }
        }
      }//end if
    }
    this.__unmaskedValue = unmaskedValue
    //每个block长度满足时才进行check
    let checkedRange = maskedValue;
    if (checkedMap[maskedBlocks.length]) {
      let newVal = this._checkRange(
        get(this.__blockRanges, maskedBlocks.length),
        maskedValue
      )
      if (newVal !== checkedRange) {
        this.__maskedValue = this.__maskedValue.substring(0, this.__maskedValue.length - checkedRange.length) + newVal;
        checkedRange = newVal
      }
    }

    maskedValue =
      this.__startStaticValue +
      maskedBlocks.join("") + checkedRange;

    if (this.guide) {
      let blockMaskBit = this.__maskBlockStartBitList[maskedBlocks.length]
      let bitI = checkedRange.length + blockMaskBit

      maskedValue += this._getMaskValue(bitI);
    }

    let displayValue = this.__maskedValue;
    if (this.showMask || this.guide) {
      displayValue = maskedValue
    }
    this.nextTick(() => {
      this.input.inputRef.current.value = displayValue;
    })

    if (allPassed) {
      this.__innerValue = maskedValue
      this.__lastPass = true
      this.emit('update:value', { value: this.__maskedValue })
    } else if (this.__lastPass) {
      this.__innerValue = ''
      this.__lastPass = false
      this.emit('update:value', { value: this.__innerValue })
    }
    // if (this.guide) {
    this.nextTick(() => {
      if (isDel) staticStrLen = 0
      let currentCIndex = curPoint + staticStrLen
      let cIndex = this.__maskedValue.length;
      if (curPoint < 0 || cIndex < currentCIndex) {
        currentCIndex = cIndex
      }
      //fix cursor pos
      if (currentCIndex < this.__startStaticValue.length) {
        currentCIndex = this.__startStaticValue.length
      }
      this.nextTick(() => {
        this.input.inputRef.current.selectionStart = this.input.inputRef.current.selectionEnd = currentCIndex
      })

    })
    // }
  }
  onClear() {
    this.__unmaskedValue = this.__innerValue = this.__maskedValue = "";
    this.emit('update:value', { value: this.__innerValue })
    this.onFocus('');
  }
  onInput(e: CustomEvent) {
    let value = e.detail.value;
    let ev = e.detail.event as InputEvent;
    let inputType = ev.inputType
    let isDel = startsWith(inputType, 'delete')
    let p = e.detail.event.target.selectionStart;
    if (isDel && this.greedy) {
      each(tail(this.__maskBlockStartBitList), (bitIndex, i: number) => {

        let dividerSize = this.__maskBlockDividerList[i].length
        let startIndex = bitIndex - dividerSize
        if (p >= startIndex && p <= bitIndex - 1) {
          let suffix = value.substring(bitIndex - 1, value.length)
          value = value.substring(0, bitIndex - dividerSize - 1) + suffix
        }
      })
    }
    this._maskValue(value, p, isDel);
  }
  onBlur(e: CustomEvent) {
    this.__innerValue = this.input.inputRef.current.value
  }
  onFocus(e: CustomEvent | string) {
    let value = e instanceof CustomEvent ? e.detail.value : e;

    if (e instanceof CustomEvent) {
      e.detail.event.preventDefault();
      e.detail.event.stopPropagation();
    }

    if (this.showMask && !trim(value) && this.__maskBitList.length > 0 && isEmpty(this.__maskedValue)) {
      let startIndex = 0;
      value = map(this.__maskBitList, (bit, i) => {
        if (bit.char && i == startIndex) {
          startIndex++;
        }
        return bit.char || this.placeholderChar;
      });

      this.input.inputRef.current.value =
        // this.input.value =
        this.__maskHolder =
        value.join("");

      return;
    }

    if (this.showMask || this.guide) {
      this.nextTick(() => {
        let focusCurPos = e instanceof CustomEvent ? this.input.inputRef.current.selectionStart || 0 : 0;
        let cIndex = this.__maskedValue.length;
        if (focusCurPos < cIndex) {
          cIndex = focusCurPos
        }
        if (cIndex < 1) {
          cIndex = cIndex + this.__startStaticValue.length
        }
        this.input.inputRef.current.setSelectionRange(cIndex, cIndex);
      })
    }

  }
  _getMaskValue(startIndex: number) {
    let value = map(slice(this.__maskBitList, startIndex), (bit, i) => {

      return bit.char || this.placeholderChar;
    }).join("");
    return value;
  }
  getUnmaskedValue() {
    return this.__unmaskedValue
  }
}
