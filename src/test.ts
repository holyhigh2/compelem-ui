import { bind, CompElem, forEach, html, model, prop, query, state, sync, tag, Template, watch } from "compelem";
import CRUD from "cruda";
import { crud, onHook } from "cruda-compelem";
import { append, each, randi, range, uuid } from "myfx";
import { Button } from "./components/button/Button";
import { SelectPanel } from "./components/dataentry/selectpanel/SelectPanel";
import { Input } from "./components/form/input/Input";
import { Select } from "./components/form/select/Select";
import { useToast } from "./components/notice";
import { useAlert, useConfirm, usePrompt } from "./components/overlays/modals";
import { ChevronDown } from "./icons/icons";

enum NodeType {
  TYPE_STATION = 1,
  TYPE_TUNNEL = 2,
  TYPE_DEV = 3,
  TYPE_POINT = 4
}
/**
 * 按钮
 * @attrs
 *  appearance {string} 按钮外观。primary 无边框有背景；secondary 无背景有边框；link 文字按钮；subtle 默认仅显示文字
 *  color {string} 按钮颜色，支持内容颜色包括：info/success/warning/error/text
 *  round {boolean} 是否圆角
 *  disabled {boolean} 是否禁用
 *  circle {boolean} 是否原型按钮
 *  block {boolean} 是否块级元素
 *  loading {boolean} 是否加载状态
 *  type {string} button类型，默认button
 *  width {string} 宽度，默认auto
 *  size {string} 尺寸可选 lg/md/sm/xs，默认md
 *
 * @slots
 *  default() 链接内容
 *
 * @author holyhigh2
 */
@tag("page-test")
export class PageTest extends CompElem {
  editingType: string = 'sddd';//当前编辑类型，会影响提交接口
  editingNode: any;//当前编辑节点
  contextNode: any;

  alertFn = useAlert()
  confirmFn = useConfirm()
  promptFn = usePrompt()

  //////////////////////////////////// props
  @prop x: string = '';

  @state name: string = '11111';
  @state value = '1212';
  @state treeData: Record<string, any>[] = [
    //[{ a: 1 }, { a: 2 }], 
    [{ a: 5 }, { a: 4 }, '11121212']
  ]
  @state showContent = true;
  @state ifContent = 111;
  @state ss = true;
  @state sv = '111';
  @state svObj = { x: '111' };
  @state sp = [];
  @state ary = ['111']
  @state obj = { a: '1212', b: 1, c: '2', d: 'vvv' }
  @state mask = '2025-66-55'
  @state mask2 = ''
  @state listData = range(150);
  @state num = 1

  @state masks: Record<string, any>[] = []
  @state masks2: Record<string, any[]> = { x: [] }
  @state progress = 66
  @state slider = 10

  @query('l-select-panel')
  lsp: SelectPanel

  @crud('/api/single')
  crud: CRUD

  @crud('/api/multiple')
  crud2: CRUD

  @state ramMarks: Record<string, any> = { 0: '12323', 20: '000', 5: '222', '-10': '666' }

  @watch('crud2.form', { deep: true })
  watchCpuColor(nv: any) {
    console.log('watchCpuColor', nv)
  }
  @watch('crud.form', { deep: false })
  watchCpuColor1(nv: any) {
    console.log('watchCpuColor1', nv)
  }
  @watch('crud.form.x', { deep: true })
  watchCpuColor2(nv: any) {
    console.log('watchCpuColor2', nv)
    this.ramMarks[30] = '777'
  }
  @watch('crud2.form.y', { deep: true })
  watchCpuColor3(nv: any) {
    console.log('watchCpuColor3', nv)
  }
  //////////////////////////////////// styles
  static get styles(): Array<string | CSSStyleSheet> {
    return [`:host{
        pointer-events:all;
        padding:1rem;
      }
        .radio-card{
          border:1px solid #aaa;
        }
        .radio-card[checked]{
          border:1px solid red;
        }
      `];
  }
  static get autoSlot() {
    return false;
  }
  static tunnelLight = `
    display:inline-block;
    background:gray;
    border-radius:100%;
    width:1rem;
    height:1rem;
    float:right;
  `
  /////////////////////////////////// watches


  //////////////////////////////////// lifecycles
  constructor() {
    super();
    //测试select
    CRUD.request = function ({ url }: { url: string }) {
      return new Promise((s, ...args) => {
        console.log(s, url)
        setTimeout(() => {
          if ('/api/multiple' == url) {
            s([{ label: '111', value: '111' }, { label: '222', value: '222' }, { label: '333', value: '333' }])
          } else {
            s([{ label: 'aaa', value: '111' }, { label: 'bbb', value: '222' }, { label: 'ccc', value: '333' }])
          }

        }, 1000);
        // 
      })
    }
    console.log(this.crud)
  }
  propsReady() {
    this.crud.form.x = 1
  }

  mounted(): void {

    onHook(this, CRUD.HOOK.BEFORE_QUERY, (c: CRUD, rs) => {
      console.log(c.key, rs, 'onHook')
    })
    console.log(this.crud, this.crud2)
    this.crud.form = {};
    this.crud2.form = {};
    (window as any).xx = this
    setTimeout(() => {
      // this.sv = 'sdf'
      // (this.renderRoot.querySelector('#select') as any).value = 'dog'

      this.masks.push({ a: '11', k: uuid() })
      // this.crud.toQuery()
    }, 500);

    setTimeout(() => {
      this.masks.push({ a: '22', k: uuid() })
      this.masks.push({ a: '33', k: uuid() })
      // this.crud2.toQuery()
      this.crud.form.x = 1
    }, 1000);

    // this.lsp.setFormatter((item: Record<string, any>) => {
    //   return html`<b>-=-=${item.label}xx</b>`
    // })
  }

  // <l-message closable="true" header="dfdf" descr="sdfsdfsdf"></l-message>
  // <l-message closable="true" header="dfdf" descr="sdfsdfsdf" type="error"></l-message>
  // <l-message closable="true" header="dfdf" descr="sdfsdfsdf" type="warning"></l-message>
  // <l-message closable="true" header="dfdf" descr="sdfsdfsdf" type="success"></l-message>
  render(): Template {
    return html`
        <l-progress-circular .value="${this.progress}" r="32" indeterminate="false">
        ${this.progress}%
      </l-progress-circular>
      <l-progress-linear .value="${this.progress}" indeterminate="true">
        ${this.progress}%
      </l-progress-linear>
      <l-empty @action="${this.onAction}" title="Add team members" text="You haven’t added any team members to your project yet. As the owner of this project, you can manage team member permissions." action-text="New Project"></l-empty>
      
      <l-slider .value="${this.progress}"  step="5" show-ticks min="0" max="100" .marks="${this.ramMarks}" tooltip="false">
        <div slot="thumb" style="color: #fff;padding:0 1rem">
          ${this.progress}
        </div>
        <div slot="trailing">
          ??
        </div>
      </l-slider>
      
      <l-card title="sdfsdf" subtitle="dddddddddddfdf" shadow="hover">
      sdfsdfsdf
      <l-button slot="actions" block loading>地方
      </l-button>
      </l-card>
      <br/>
        <l-message class="xx" closable header="dfdf" descr="sdfsdfsdf"></l-message>
    <l-notification closable header="dfdf" descr="sdfsdfsdf"></l-notification>
        <l-button-group >
          <l-button @click="${this.testLoading}">111</l-button>
          <l-dropdown .items="${[{ text: 1112 }]}" trigger="click">
              <l-button active inner-style="padding-left:.2rem;padding-right:.2rem;" slot="trigger" @click="${() => alert(34)}"><l-icon .svg="${ChevronDown}" ></l-icon></l-button>
          </l-dropdown>
        </l-button-group>
<br>
<br>
        <l-input appearance="underline" label="xxx" round="true" clearable placeholder="士大夫士大夫士大夫" >
          <div slot="trailing"></div>
        </l-input>
        <br>
        <br>
        <l-tag size="sm"  closable dot>sm</l-tag>
        <l-tag color="success" border closable pill dot flat>md</l-tag>
        <l-tag size="lg" color="red" border closable dot>lg</l-tag>
        <l-input type="date" value="2023-12-23"></l-input>
<br/>
<br/>
        <l-input-number ${model(this.num)} label="xxx" appearance="underline" round="false" clearable min="0" max="10"></l-input-number>
        ${this.mask}|${this.mask2}
        <l-input-mask appearance="underline" label="xxx" placeholder="sdfsdf" ${model(this.mask)} mask="[12]000-00-0:0" greedy="false" clearable blocks="{1999,2025},{1,12},{1,31}" show-mask="false"  block-select></l-input-mask>
        
        <l-input-mask  ${model(this.mask2)} 
        blocks="{0,255},{0,255},{0,255},{0,255}" clearable guide
        mask="()[0-9]{1,3}.[0-9]{1,3}..[0-9]{1,3}...[0-9]{1,3}"
        name="ip" greedy="true"></l-input-mask>
        <br/>
        ===${JSON.stringify(this.masks)}---
        ${forEach(this.masks, (item, i) => html`
          <l-input-mask key="${i}" ${model(item.a)} 
        blocks="{0,255},{0,255},{0,255},{0,255}" clearable guide
        mask="()[0-9]{1,3}.[0-9]{1,3}..[0-9]{1,3}...[0-9]{1,3}"
        name="ip" greedy="true"></l-input-mask>  
        `)}
        <br/>
                                                   1${this.obj.a}1
                                                    <l-input-number  min="0" max="10" placeholder="xxxx" ${model(this.obj.a)} name="realFreq" pattern="xxx ###.## ms" precision="2">
                                                    </l-input-number>
        <br/>
        <l-toggle ${model(this.ss)} @change="${(e: CustomEvent) => console.log(e.detail)}" active-text="1111" inactive-text="2222" width="60" inset="false" checked>
          ${this.ss}toggle标签 
        </l-toggle>
<br/>
        <l-radio .checked=${sync(this.ss)} value="r1">radio1</l-radio>
        <l-radio .checked=${sync(this.ss)} value="r2">
          232323
        </l-radio>
        --=${this.sv}=--
        <l-radio-group ${model(this.sv)} inline>
          <l-radio value="111" title="343434" subtitle=""></l-radio>
          <l-radio value="222" card title="8GB" subtitle=""></l-radio>
          <l-radio value="333" card title="16GB" subtitle=""></l-radio>
          <l-radio value="444" card title="32GB" subtitle=""></l-radio>
          <button>3434</button>
        </l-radio-group>
<br/>
        <l-checkbox .indeterminate="${this.ss}" >2222</l-checkbox>
        <l-checkbox .checked="${sync(this.ss)}" name="xx"  @change="${this.checkChange}" >打发打发</l-checkbox> ==${this.ss}==
        ${(this.ary)}
        <l-checkbox-group ${model(this.ary)}>
          <l-checkbox value="111">1111</l-checkbox>
          <l-checkbox name="xx" value="222">2222</l-checkbox>
          <button>3434</button>
        </l-checkbox-group>
<br/>
${(this.svObj.x)}
        <l-select ${model(this.svObj.x)} clearable @change="${this.onSelect}" appearance1="underline" label="选择动物">
          <optgroup label="4-legged pets">
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="hamster" disabled>Hamster</option>
          </optgroup>
          <optgroup label="yjyjhfg">
            <option value="ddd">aaa</option>
            <option value="fff">bbb</option>
            <option value="dfsdf" disabled>dfsdf</option>
          </optgroup>
        </l-select>

        <l-select-panel clearable  multiple >
          <option value="111">${this.sv}111</option>
          <option value="222" selected>${this.sv}222</option>
          <optgroup label="4-legged pets">
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="hamster" disabled>Hamster</option>
          </optgroup>
          <optgroup label="yjyjhfg">
            <option value="ddd">aaa</option>
            <option value="fff">bbb</option>
            <option value="dfsdf" disabled>dfsdf</option>
          </optgroup>
        </l-select-panel>

        
      <l-accordion>
      <l-accordion-item header="111">
        xxxxxxxxx3
      </l-accordion-item>
      <l-accordion-item header="33333">
        xxxxxxxxx2
      </l-accordion-item>
      <l-accordion-item >
        <div slot="header" style="display:flex;">
          <span>sdfsdfsdf</span>112
        </div>
        xxxxxxxxx1
      </l-accordion-item>
    </l-accordion>

    <l-panel header="sdfsdf" collapsible>
    <div slot="header" style="display:flex;">
    00000
    </div>
    内容
    </l-panel>
      <div data-name="xx${this.name}xx" ?size="${this.ss}" ${bind(this.attrs)}>
        ${forEach(this.treeData, (x, i) => html`
          <div key="${x[2]}">
            --- ${JSON.stringify(x)} --- 
            <l-button round="false" .flat="${false}" pill @click="${() => { console.log(i); this.remove1(i) }}">
            
            删除(${i})
            
          </div>`
    )}

        ${this.subRender()}
      </div>


    <l-drawer
        class="c-alert"
        show-close="true"
        backdrop="none"
        placement="right"
        esc="false"
        width="40%"
        .visible="${this.sv == '111'}"
        title="${123123123}"
      >
        ${this.sv}
        <l-button slot="footer" >123123</l-button>
      </l-drawer>

      <l-listbox virtualized style="border:1px solid red;height:10rem;width:15rem;margin:1rem 0;" @visiblechange="${this.onVisibleChange}" .data="${this.listData}" .render-item="${(item: any) => `这里不是静态的${item}`}" .render-more="${this.loadMore.bind(this)}">
        这里是静态的
      </l-listbox>
      <l-button @click="${this.addMore}">追加</l-button>
        
    `;
  }

  toast = useToast()
  //////////////////////////////////// methods
  onDel() {
    this.masks.splice(0, 1)
    // this.masks.shift()
  }
  onClick(e: CustomEvent) {
    this.confirmFn('测试测试').then(el => {
      console.log('后台调用')
    })
    return;
    // this.treeData.push([{ a: randi(10) }, { a: randi(30) }, uuid()])
    // let msg = new Message({ type: 'error', descr: 'sdfsdfsdf', showIcon: true, closable: true })
    // let tid = this.toast.push(msg)

    this.toast.pushNotice({ type: 'error', header: 'tttt', descr: 'sdfsdfsdf', closable: true })
    this.toast.pushMessage('sdfsdfsdf', { duration: 0 })
    // this.promptFn(434343)
    let { target } = e.detail;
    // (<HTMLElement>target).setAttribute('loading', !Boolean(target.loading) + '')
  }
  checkChange(e: CustomEvent) {
    console.log(e.detail)
  }
  subRender() {
    return html`<l-tooltip style="margin-left:15%;" content="sdfsdfdsf" placement="right" >
    <l-button size="sm" color="" appearance="secondary" @click1="${this.onClick}">subrender ${this.value} </l-button>
    </l-tooltip>`
  }
  @query('l-select')
  select: Select
  @query('l-input')
  input: Input

  onSelect(e: Event) {
    console.log(e)
  }
  onAction(e: CustomEvent) {
    console.log(e)
  }
  testLoading(e: CustomEvent) {
    // alert(34)
    console.log('button....')
    let target: Button = e.detail.target
    // target.setAttribute('loading', true + '')
    setTimeout(() => {
      // target.setAttribute('loading', false + '')
    }, 4000);
  }
  updateTree() {
    this.name = '2222'
    // this.value = '3333'

    this.input.value = '443434'
    this.select.forceUpdate();
  }
  remove1(i: number) {
    // remove(this.treeData, (v, index) => index == i)
  }
  loadMore(count: number) {
    setTimeout(() => {
      // append(this.listData,randi(5,10))
    }, 1000);
    return '加载中...' + count
  }
  addMore() {
    append(this.listData, randi(5, 10))
  }
  onVisibleChange(e: CustomEvent) {
    let ary = e.detail
    each(ary, ({ count, el, data }: any) => {
      // console.log(count, el, data)
    })

  }


}
