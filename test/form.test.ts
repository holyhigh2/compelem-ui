import { afterEach, describe, expect, it } from 'vitest'
import '../src/entries/ce-input'
import '../src/entries/ce-icon'
import '../src/entries/ce-checkbox'
import '../src/entries/ce-checkbox-group'
import '../src/entries/ce-radio'
import '../src/entries/ce-radio-group'
import '../src/entries/ce-toggle'
import '../src/entries/ce-form-item'
import { nextFrame } from './helpers'

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) await nextFrame()
}

/**
 * 返回挂载后的**根自定义元素**（不是包装 div）：
 * 包装 div 不是自定义元素，shadowRoot 恒为 null、prop 恒为 undefined，
 * 拿它断言会把「没升级」误读成「行为不对」。
 */
function mount(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.firstElementChild as any
}

/**
 * ⚠️ `emit-native` 是必需的：compelem 的 `CompElem.emit()` 默认把事件交给
 * 「包装它的 compelem 组件」（`emitEvent(this.wrapperComponent, ...)`），只有宿主带
 * `emit-native` 属性时才真正 `dispatchEvent(CustomEvent)`。纯 DOM addEventListener
 * 不加这个属性，永远收不到 change / update:value。
 */
const native = (html: string) => mount(html.replace(/^<([a-z-]+)/, '<$1 emit-native'))

const inputOf = (el: any) => el.shadowRoot!.querySelector('input')!

describe('ce-input 行为', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('value 属性初始化原生输入框', async () => {
    const el = native(`<ce-input value="hello"></ce-input>`)
    await flush()
    expect(inputOf(el).value).toBe('hello')
    expect(el.value).toBe('hello')
  })

  /**
   * 敲字只发 input / update:value，model value 直到 change 才落：
   * FormItem 的校验与 Form 读取的 control.value 依赖这个时序（边打字边校验会抖）。
   */
  it('输入过程中 value 不落，change 时才写入 model', async () => {
    const el = native(`<ce-input></ce-input>`)
    await flush()
    const input = inputOf(el)
    const updates: any[] = []
    el.addEventListener('update:value', (e: any) => updates.push(e.detail.value))
    input.value = 'abc'
    input.dispatchEvent(new Event('input'))
    await flush(1)
    expect(updates).toEqual(['abc'])
    expect(el.value).toBe('')

    input.dispatchEvent(new Event('change'))
    await flush(1)
    expect(el.value).toBe('abc')
    expect(updates).toEqual(['abc', 'abc'])
  })

  it('clear() 清空原生输入框与 model 并派发 clear', async () => {
    const el = native(`<ce-input clearable value="x"></ce-input>`)
    await flush()
    const cleared: any[] = []
    el.addEventListener('clear', (e: any) => cleared.push(e.detail.value))
    const close = el.shadowRoot!.querySelector('.ce-input-close')!
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush(1)
    expect(el.value).toBe('')
    expect(inputOf(el).value).toBe('')
    expect(cleared).toEqual([''])
  })

  /**
   * 清空是一次值变更：只发 clear 会让「@input 驱动过滤」的消费方（搜索框、过滤器）
   * 停留在旧值/旧结果上。input 必须先于 clear，与「先变更后事件」的顺序一致。
   */
  it('清空同时派发 input（空值），且 input 先于 clear', async () => {
    const el = native(`<ce-input clearable value="x"></ce-input>`)
    await flush()
    const seq: string[] = []
    el.addEventListener('input', (e: any) => seq.push('input:' + e.detail.value))
    el.addEventListener('clear', (e: any) => seq.push('clear:' + e.detail.value))
    el.shadowRoot!.querySelector('.ce-input-close')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush(1)
    expect(seq).toEqual(['input:', 'clear:'])
  })

  it('showPassword 把原生 type 切成 password', async () => {
    const el = native(`<ce-input show-password></ce-input>`)
    await flush()
    expect(inputOf(el).type).toBe('password')
  })

  it('disabled / readonly 落到原生输入框', async () => {
    const el = native(`<ce-input disabled readonly></ce-input>`)
    await flush()
    expect(inputOf(el).disabled).toBe(true)
    expect(inputOf(el).readOnly).toBe(true)
  })

  it('maxlength 透传，label + required 渲染必填标记', async () => {
    const el = native(`<ce-input maxlength="8" label="名称" required></ce-input>`)
    await flush()
    expect(inputOf(el).getAttribute('maxlength')).toBe('8')
    expect(el.shadowRoot!.querySelector('label.ce-input-label')).toBeTruthy()
    expect(el.shadowRoot!.querySelector('label b')).toBeTruthy()
  })

  it('focus 转发到原生输入框（外部框架调 focus() 应点亮内部控件）', async () => {
    const el = native(`<ce-input></ce-input>`)
    await flush()
    el.focus()
    await flush(1)
    expect(el.shadowRoot!.activeElement).toBe(inputOf(el))
  })
})

describe('ce-checkbox 行为', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('点击原生输入框翻转 checked 并派发 change({value,checked})', async () => {
    const el = native(`<ce-checkbox value="a">选项A</ce-checkbox>`)
    await flush()
    const events: any[] = []
    // 原生 input 的 change 会 retarget 冒泡到宿主（detail 为 null），
    // 组件自己发的是带 detail 的 CustomEvent，只收后者
    el.addEventListener('change', (e: any) => { if (e.detail) events.push(e.detail) })
    inputOf(el).click()
    await flush()
    expect(el.checked).toBe(true)
    expect(inputOf(el).checked).toBe(true)
    expect(events.map(d => [d.value, d.checked])).toEqual([['a', true]])
  })

  /** 文档契约：value 为空时取默认插槽文本，保证表单提交带上可读值 */
  it('未给 value 时用插槽文本作为 input.value', async () => {
    const el = native(`<ce-checkbox>只有文本</ce-checkbox>`)
    await flush()
    expect(el.label).toBe('只有文本')
    expect(inputOf(el).value).toBe('只有文本')
  })

  it('disabled 禁用原生输入框，toggleCheck 仍可点亮', async () => {
    const el = native(`<ce-checkbox value="a" disabled></ce-checkbox>`)
    await flush()
    expect(inputOf(el).disabled).toBe(true)
    el.toggleCheck(true)
    await flush()
    expect(el.isChecked()).toBe(true)
    expect(inputOf(el).checked).toBe(true)
  })

  it('indeterminate 属性体现在 box 的 is-indeterminate 类上', async () => {
    const el = native(`<ce-checkbox value="a" indeterminate></ce-checkbox>`)
    await flush()
    expect(el.shadowRoot!.querySelector('.ce-form-checkbox').classList.contains('is-indeterminate')).toBe(true)
  })
})

describe('ce-checkbox-group 行为', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('受控 value 初始回放选中态', async () => {
    const group = native(`<ce-checkbox-group value='["a"]'>
      <ce-checkbox value="a">A</ce-checkbox><ce-checkbox value="b">B</ce-checkbox>
    </ce-checkbox-group>`)
    await flush()
    const boxes = Array.from(group.querySelectorAll('ce-checkbox')) as any[]
    expect(boxes[0].isChecked()).toBe(true)
    expect(boxes[1].isChecked()).toBe(false)
  })

  it('点击子项追加组值并派发 update:value', async () => {
    const group = native(`<ce-checkbox-group>
      <ce-checkbox value="a">A</ce-checkbox><ce-checkbox value="b">B</ce-checkbox>
    </ce-checkbox-group>`)
    await flush()
    const models: any[] = []
    group.addEventListener('update:value', (e: any) => models.push(e.detail.value))
    const boxes = Array.from(group.querySelectorAll('ce-checkbox')) as any[]
    inputOf(boxes[0]).click()
    await flush()
    expect(group.value).toEqual(['a'])
    inputOf(boxes[1]).click()
    await flush()
    expect(group.value).toEqual(['a', 'b'])
    expect(models).toEqual([['a'], ['a', 'b']])
  })

  it('再次点击已选中项从组值里移除', async () => {
    const group = native(`<ce-checkbox-group>
      <ce-checkbox value="a">A</ce-checkbox><ce-checkbox value="b">B</ce-checkbox>
    </ce-checkbox-group>`)
    await flush()
    const boxes = Array.from(group.querySelectorAll('ce-checkbox')) as any[]
    inputOf(boxes[0]).click()
    await flush()
    // 第一次点击后原生 input 已处于 checked，第二次点击把它取消
    inputOf(boxes[0]).click()
    await flush()
    expect(group.value).toEqual([])
    expect(boxes[0].isChecked()).toBe(false)
  })

  it('max 达上限后未选中项被禁用', async () => {
    const group = native(`<ce-checkbox-group max="1">
      <ce-checkbox value="a">A</ce-checkbox><ce-checkbox value="b">B</ce-checkbox>
    </ce-checkbox-group>`)
    await flush()
    const boxes = Array.from(group.querySelectorAll('ce-checkbox')) as any[]
    inputOf(boxes[0]).click()
    await flush()
    expect(group.value).toEqual(['a'])
    expect(inputOf(boxes[1]).disabled).toBe(true)
  })

  it('组级 disabled 下发到子项', async () => {
    const group = native(`<ce-checkbox-group disabled>
      <ce-checkbox value="a">A</ce-checkbox>
    </ce-checkbox-group>`)
    await flush()
    const box = group.querySelector('ce-checkbox') as any
    expect(box.disabled).toBe(true)
    expect(inputOf(box).disabled).toBe(true)
  })

  it('clear() 清空组值与全部选中态', async () => {
    const group = native(`<ce-checkbox-group value='["a","b"]'>
      <ce-checkbox value="a">A</ce-checkbox><ce-checkbox value="b">B</ce-checkbox>
    </ce-checkbox-group>`)
    await flush()
    group.clear()
    await flush()
    expect(group.value).toEqual([])
    const boxes = Array.from(group.querySelectorAll('ce-checkbox')) as any[]
    expect(boxes.map(b => b.isChecked())).toEqual([false, false])
  })
})

describe('ce-radio-group 行为', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('单选互斥：点第二个后第一个熄灭，组值同步', async () => {
    const group = native(`<ce-radio-group value="a">
      <ce-radio value="a">A</ce-radio><ce-radio value="b">B</ce-radio>
    </ce-radio-group>`)
    await flush()
    const models: any[] = []
    group.addEventListener('update:value', (e: any) => models.push(e.detail.value))
    const radios = Array.from(group.querySelectorAll('ce-radio')) as any[]
    expect(inputOf(radios[0]).checked).toBe(true)
    inputOf(radios[1]).click()
    await flush()
    expect(group.value).toBe('b')
    expect(inputOf(radios[0]).checked).toBe(false)
    expect(inputOf(radios[1]).checked).toBe(true)
    expect(models).toEqual(['b'])
  })

  it('外部改 value 属性回放选中态', async () => {
    const group = native(`<ce-radio-group value="a">
      <ce-radio value="a">A</ce-radio><ce-radio value="b">B</ce-radio>
    </ce-radio-group>`)
    await flush()
    group.setAttribute('value', 'b')
    await flush()
    const radios = Array.from(group.querySelectorAll('ce-radio')) as any[]
    expect(inputOf(radios[0]).checked).toBe(false)
    expect(inputOf(radios[1]).checked).toBe(true)
  })

  it('组级 disabled 下发到子项', async () => {
    const group = native(`<ce-radio-group disabled value="a">
      <ce-radio value="a">A</ce-radio><ce-radio value="b">B</ce-radio>
    </ce-radio-group>`)
    await flush()
    const radios = Array.from(group.querySelectorAll('ce-radio')) as any[]
    expect(inputOf(radios[1]).disabled).toBe(true)
  })
})

describe('ce-toggle 行为', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('字符串值按 activeValue 判定选中，点击后派发 change', async () => {
    const el = native(`<ce-toggle active-value="on" inactive-value="off" value="off"></ce-toggle>`)
    await flush()
    const changes: any[] = []
    // 同上：过滤掉原生 input 冒泡上来的无 detail 的 change
    el.addEventListener('change', (e: any) => { if (e.detail) changes.push(e.detail) })
    expect(inputOf(el).checked).toBe(false)
    inputOf(el).click()
    await flush()
    expect(changes.map(c => [c.value, c.checked])).toEqual([['on', true]])
    expect(inputOf(el).checked).toBe(true)
  })

  it('布尔 value=true 直接点亮', async () => {
    const el = native(`<ce-toggle value="true"></ce-toggle>`)
    await flush()
    expect(inputOf(el).checked).toBe(true)
  })

  it('readonly 拦截点击', async () => {
    const el = native(`<ce-toggle readonly value="inactive"></ce-toggle>`)
    await flush()
    inputOf(el).click()
    await flush()
    expect(el.getAttribute('value')).toBe('inactive')
  })

  it('布尔模式下 change 载荷的 value 与组件值同为布尔', async () => {
    const el = native(`<ce-toggle></ce-toggle>`) as any
    await flush()
    el.updateProps({ value: false })
    await flush()
    const changes: any[] = []
    el.addEventListener('change', (e: any) => { if (e.detail) changes.push(e.detail) })
    inputOf(el).click()
    await flush()
    expect(changes.map(c => [c.value, typeof c.value])).toEqual([[true, 'boolean']])
    expect(el.value).toBe(true)
  })

  it('toggleCheck() 走 value 管道：同步 value、原生输入框并派发 change', async () => {
    const el = native(`<ce-toggle active-value="on" inactive-value="off" value="off"></ce-toggle>`) as any
    await flush()
    const changes: any[] = []
    el.addEventListener('change', (e: any) => { if (e.detail) changes.push(e.detail) })
    el.toggleCheck()
    await flush()
    expect(inputOf(el).checked).toBe(true)
    expect(el.value).toBe('on')
    expect(changes.map(c => [c.value, c.checked])).toEqual([['on', true]])
  })
})

/**
 * ce-input 多行模式（type="textarea"）
 *
 * 存在的意义：AI 组屏面板要「框内右侧嵌发送按钮」的多行输入 —— 单行 input 无法
 * Shift+Enter 换行，也不具备 inside/append 插槽结构。
 * （曾有过独立的 ce-textarea 组件，能力是本模式的子集且进不了表单，已移除。）
 */
describe('ce-input 多行模式', () => {
  afterEach(() => { document.body.innerHTML = '' })

  const textareaOf = (el: any) => el.shadowRoot!.querySelector('textarea')!

  it('type=textarea 渲染 textarea 而不是 input，并按 rows 定行数', async () => {
    const el = native(`<ce-input type="textarea" rows="3"></ce-input>`)
    await flush()
    expect(el.shadowRoot!.querySelector('input')).toBeNull()
    expect(textareaOf(el).getAttribute('rows')).toBe('3')
  })

  it('resize 默认 none，显式传值时透传到 textarea 的内联 style', async () => {
    const styleOf = (e: any) => (textareaOf(e).getAttribute('style') || '').replace(/\s/g, '')

    const el = native(`<ce-input type="textarea"></ce-input>`)
    await flush()
    expect(styleOf(el)).toContain('resize:none')

    const el2 = native(`<ce-input type="textarea" resize="vertical"></ce-input>`)
    await flush()
    expect(styleOf(el2)).toContain('resize:vertical')
    expect(el2.shadowRoot!.querySelector('input')).toBeNull()
  })

  it('align 与 resize 合并进同一条 style，互不覆盖', async () => {
    const el = native(`<ce-input type="textarea" resize="vertical" align="right"></ce-input>`)
    await flush()
    const style = (textareaOf(el).getAttribute('style') || '').replace(/\s/g, '')
    expect(style).toContain('text-align:right')
    expect(style).toContain('resize:vertical')
  })

  it('单行模式不渲染 textarea（改动不能影响既有用法）', async () => {
    const el = native(`<ce-input></ce-input>`)
    await flush()
    expect(el.shadowRoot!.querySelector('textarea')).toBeNull()
    expect(inputOf(el)).toBeTruthy()
  })

  it('初始 value 灌进 textarea', async () => {
    const el = native(`<ce-input type="textarea" value="第一行"></ce-input>`)
    await flush()
    expect(textareaOf(el).value).toBe('第一行')
  })

  /**
   * 原生 textarea 的 value **属性**只在解析时生效，setAttribute 不会改内容，
   * 所以组件必须命令式同步（否则「发送后清空」会失效）。
   */
  it('外部改 value 时 textarea 内容跟着变（含清空）', async () => {
    const el = native(`<ce-input type="textarea" value="abc"></ce-input>`)
    await flush()
    el.setValue('xyz')
    await flush()
    expect(textareaOf(el).value).toBe('xyz')
    el.setValue('')
    await flush()
    expect(textareaOf(el).value).toBe('')
  })

  it('输入只 emit，不回写 model（与单行一致）', async () => {
    const el = native(`<ce-input type="textarea"></ce-input>`)
    await flush()
    const inputs: any[] = []
    el.addEventListener('input', (e: any) => { if (e.detail) inputs.push(e.detail) })
    const ta = textareaOf(el)
    ta.value = '打字'
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect(inputs.map(i => i.value)).toEqual(['打字'])
    expect(el.value).toBe('')
  })

  it('inside + append 插槽：按钮落在控制区内（而不是外侧）', async () => {
    const el = native(`<ce-input type="textarea" inside><span slot="append">发送</span></ce-input>`)
    await flush()
    const insideBox = el.shadowRoot!.querySelector('.ce-input-append-inside')!
    expect(insideBox).toBeTruthy()
    expect(el.shadowRoot!.querySelector('.ce-input-append')).toBeNull()
    const slot = insideBox.querySelector('slot[name="append"]') as HTMLSlotElement
    expect(slot.assignedElements().map((n: any) => n.textContent)).toEqual(['发送'])
  })

  it('不传 inside 时插槽在外侧（旧行为不变）', async () => {
    const el = native(`<ce-input><span slot="append">发送</span></ce-input>`)
    await flush()
    expect(el.shadowRoot!.querySelector('.ce-input-append')).toBeTruthy()
    expect(el.shadowRoot!.querySelector('.ce-input-append-inside')).toBeNull()
  })
})
