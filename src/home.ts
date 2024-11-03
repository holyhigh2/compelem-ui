import { CompElem, html, query, show, state, tag, Template, watch } from "compelem";
import CRUD from "cruda";
import { crud } from "cruda-compelem";
import { each, findTreeNode, randf, randi, remove, uuid } from "myfx";
import { Button } from "./components/button/Button";
import { Table } from "./components/datadisplay/table/Table";
import { Tree } from "./components/datadisplay/tree/Tree";
import { ContextMenu } from "./components/nav/contextmenu/ContextMenu";
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
@tag("page-home")
export class PageHome extends CompElem {
  editingType: string = 'sddd';//当前编辑类型，会影响提交接口
  editingNode: any;//当前编辑节点
  contextNode: any;

  @crud('/api/single')
  crud: CRUD
  //////////////////////////////////// props
  @query('l-tree')
  tree: Tree;
  @query('l-context-menu')
  menu: ContextMenu;
  @query('#bb')
  bb: Button;
  @query('#pointInfo')
  pointInfo: Table

  @state editingTitle: string = '11111';
  @state showBtn = false;
  @state treeData: Record<string, any>[] = []
  @state tableData: Record<string, any>[] = []
  @state sexOpts = ['🚹', '🚺']
  @state color = 'red'

  //////////////////////////////////// styles
  static get styles(): Array<string | CSSStyleSheet> {
    return [`:host{
        pointer-events:all;
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
    width:.8rem;
    height:.8rem;
    float:right;
  `
  /////////////////////////////////// watches
  @watch('treeData')
  function(nv: any) {
    console.log('treeData.....change', nv)
  }

  //////////////////////////////////// lifecycles
  constructor() {
    super();

    //测试select
    CRUD.request = function () {
      return new Promise((s) => {
        s([{ text: 'aaa', value: '111' }, { text: 'bbb', value: '222' }, { text: 'ccc', value: '333' }])
      })
    }
  }

  mounted(): void {
    (window as any).xx = this
    setTimeout(() => {
      this.editingType = this.editingTitle = '3333'

      this.showBtn = true;
    }, 1000);
    (window as any).tree = this.tree;
    (window as any).xi = this.pointInfo
    this.pointInfo.setStyler(scope => {
      console.log('343434')
      if (scope.column.prop == 'sn' && scope.rowIndex % 2 === 0) {
        return 'color:red'
      }
      return ''
    })

    this.pointInfo.setFormatter(scope => {
      if (scope.column.prop == 'name') {
        return `<b>${scope.row.name}12--</b>`
      }
      return scope.row[scope.column.prop]
    })
    this.pointInfo.setStyle('a3', 'background:#ddd')
    setTimeout(() => {
      this.pointInfo.setNote('a1', 'sdfsdfsdfsdfsdf')
    }, 5000);

    this.tree.setFormatter((node: Record<string, any>) => {
      return html`<b>${node.label} <div style="${PageHome.tunnelLight}" name="xyz"></div></b>`
    })

    setInterval(() => {
      this.pointInfo.updateColumnCells('nickname', [randf(), 2, 3, 4, randf(), 6, 7, randi(10), 9, randi(110), ''], true)
    }, 1000);

    this.updateTree()
  }
  //   ${
  //   slot(({ data }: { data: Record<string, any> }) => html`
  //             ${data.label}
  //             ${ifTrue(data.type === NodeType.TYPE_TUNNEL, () => html`
  //               ${ifElse(data.connectStatus == 'closed', () => html`<div style="${PageHome.tunnelLight}" id="xx"></div>`, () => html`<div>连接中</div>`)}
  //             `)}
  //             </div>
  //           `)
  // }
  render(): Template {
    return html`
      <l-container>
        <l-aside class="px-4 pt-2">
        <l-tree
          .data="${this.treeData}"
          click-type="node"
          contextmenu="true"
          show-indent-line="true"
          show-check
          show-drag
          check-type1='leaf'
          @select="${this.onNodeSelect}"
          @nodecontextmenu="${this.onNodeContextMenu}"
          @check="${this.onCheck}"
        >
        </l-tree>
        <l-context-menu
          items="[]"
          theme="light"
          @close="${this.onMenuClose}"
          @beforeopen="${this.onMenuBeforeOpen}"
          @select="${this.onMenuSelect}"
        ></l-context-menu>
      </l-aside>
      <l-main>
        <l-container class="bg-gray-100">
        <l-header>
          <span>${this.editingTitle}</span> ${this.editingType}
          <l-button type="submit" size="lg" @click="${this.save}" .color="${this.color}">保存</l-button>
          <l-button id="bb" 
          ${show(this.showBtn)}
          color="red" appearance="secondary" 
          @click="${this.del}"
          >删除</l-button>
        </l-header>
        <l-main style="overflow: auto;" class="px-2 m-2 rounded-md bg-white flex flex-col">
          <l-editable
          class="info"
          id="pointInfo"
          .data="${[]}"
          stripe="false"
          border="true"
          fit="false"
          show-column-indicator="false"
          show-row-indicator="false"
          row-height="30"
          highlight-hover-column
          link="../style.css"
          edit-option="{fillable:true,copyable:true}"
          @beforecelldeactive="${this.beforeCellDeactive}"
          @change="${this.onchange2}"
          @contextmenu="${this.oncontext}"
          @beforecellactive="${this.cellActive}"
          @cellclick="${this.onCellClick}"
          @contextmenuinsert1="${this.onContextInsert}"
          show-range="false"
        >
          <l-table-column
                                            label="编号"
                                            prop="id"
                                            header-align="center"
                                            align="center"
                                            data-type="number"
                                    >
                                        <div slot="header">
                                            编号<span style="color: red">*</span>
                                        </div>
                                    </l-table-column>
                                    <l-table-column
                                            label="名称"
                                            prop="name"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                    >
                                        <div slot="header">
                                            名称<span style="color: red">*</span>
                                        </div>
                                    </l-table-column>
                                    <l-table-column
                                            label="测量类型"
                                            prop="measureType"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                            data-selection-option="{constraint:true,multiple: false}"
                                    >
                                        <div slot="header">
                                            测量类型<span style="color: red">*</span>
                                        </div>
                                    </l-table-column>
                                    <l-table-column
                                            label="计量单位"
                                            prop="unit"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                            data-selection-option="{constraint:true,multiple: false}"
                                    ></l-table-column>
                                    <l-table-column
                                            label="地址"
                                            prop="addr"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                    >
                                        <div slot="header">
                                            地址<span style="color: red">*</span>
                                        </div>
                                    </l-table-column>
                                    <l-table-column
                                            label="倍率"
                                            prop="rate"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                    >
                                        <div slot="header">
                                            倍率<span style="color: red">*</span>
                                        </div>
                                    </l-table-column>
                                    <l-table-column
                                            label="上限"
                                            prop="upper"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                    ></l-table-column>
                                    <l-table-column
                                            label="下限"
                                            prop="lower"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                    ></l-table-column>
                                    <l-table-column
                                            label="数据类型"
                                            prop="dataType"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                            .data-selection="${[{ text: 1, value: 1 }, { text: 2, value: 2 }, { text: 3, value: 3 }]}"
                                            .crud-data="${{ url: '/api/xxx' }}"
                                            data-selection-option="{constraint:true,multiple: false}"
                                    >
                                        <div slot="header">
                                            数据类型<span style="color: red">*</span>
                                        </div>
                                    </l-table-column>
                                    <l-table-column
                                            label="属性标识"
                                            prop="attribute"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                            data-selection-option="{constraint:true,multiple: false}"
                                    ></l-table-column>
                                    <l-table-column
                                            label="备注"
                                            prop="comments"
                                            header-align="center"
                                            align="center"
                                            data-type="text"
                                    ></l-table-column>
          </l-editable>
        </l-main>
      </l-container>
      </l-main>
      </l-container>
    `;
  }

  //////////////////////////////////// methods
  save() {
    this.treeData[0].children[0].children[0].children.push({ "id": "0d71b1fcf5474200bceb49c8506ad0b2", "label": "测点111", "type": 4 })
    // this.tableData = [
    //   { aa: 'aa', bb: 'bb' }, { aa: 'aa1', bb: 'bb1' }, { aa: 'aa2', bb: 'bb2' }, { aa: 'aa2', bb: 'bb2' }, { aa: 'aa2', bb: 'bb2' }, { aa: 'aa2', bb: 'bb2' }, { aa: 'aa2', bb: 'bb2' }, { aa: 'aa2', bb: 'bb2' }, { aa: 'aa2', bb: 'bb2' }
    // ]

    // this.pointInfo.setData([{ sn: 111, name: '111', nickname: '111' }])
    // this.sexOpts.push('' + randf())
    // this.color = 'blue'
  }
  del() {
    let node = this.tree.getNode()
    //模拟重置
    this.treeData = [{ "id": "9daa90cc-4bc4-4371-a81b-aceabd56bbd3", "label": "绿能吉鲁1", "code": "6", "isCopy": false, "type": 1, "children": [{ "id": "31268e76-45d0-40f3-9a4a-a4077bfc93f3", "label": "金风通道1", "code": "6", "isCopy": false, "type": 2, "children": [{ "id": "101", "label": "30101", "code": "6", "isCopy": false, "channelId": "31268e76-45d0-40f3-9a4a-a4077bfc93f3", "type": 3, "children": [] }, { "id": "12312", "label": "123213", "code": "6", "isCopy": false, "channelId": "31268e76-45d0-40f3-9a4a-a4077bfc93f3", "type": 3, "children": [] }] }] }]

    // this.treeData[0].children[0].children[0].children = []
    console.log(node, this.treeData)
  }
  beforeCellDeactive(e: CustomEvent) {
    let { cancel, lock } = e.detail
    // lock('提示信息...', { type: 'info', closable: false })
    this.nextTick(() => {
      // this.pointInfo.reload()
    })


    // setTimeout(() => {
    // cancel()
    //   console.log('beforeCellDeactive...cancel')
    // }, 3000);
  }
  cellActive(e: CustomEvent) {
    let { cancel } = e.detail
    // cancel()
    console.log('cellActive...')
  }
  onCellClick(e: CustomEvent) {
    console.log('onCellClick...', e.detail)
  }
  onContextInsert(e: CustomEvent) {
    let data = e.detail.data
    data((rowCount: number, props: Record<string, any>) => {
      let rs = {
        addr: 1,
        unit: 2,
        name: '1212'
      }
      return [rs]
    })
  }
  onchange2(e: CustomEvent) {
    console.log('onchange2...', e)
  }
  oncontext(e: CustomEvent) {
    let detail = e.detail
    each<Record<string, any>>(detail.items, item => {
      // if (item) item.disabled = true;
    })
    detail.items.push({ text: "插入行1111" });
    console.log('oncontext...', detail)
  }
  onClick(e: CustomEvent) {
    debugger
  }
  updateTree() {
    this.treeData = [{ "id": "9daa90cc-4bc4-4371-a81b-aceabd56bbd3", "label": "绿能吉鲁", "code": "6", "isCopy": false, "type": 1, "children": [{ "id": "31268e76-45d0-40f3-9a4a-a4077bfc93f3", "label": "金风通道1", "code": "6", "isCopy": false, "type": 2, "children": [{ "id": "101", "label": "30101", "code": "6", "isCopy": false, "channelId": "31268e76-45d0-40f3-9a4a-a4077bfc93f3", "type": 3, "children": [] }, { "id": "12312", "label": "123213", "code": "6", "isCopy": false, "channelId": "31268e76-45d0-40f3-9a4a-a4077bfc93f3", "type": 3, "children": [] }] }] }, { "id": "e2ae0daf-ab62-4112-b462-2e6d225b659e", "label": "123", "code": "123123", "isCopy": false, "type": 1, "children": null }]
  }
  onCheck(e: CustomEvent) {
    console.log(e)
  }
  onNodeContextMenu(e: CustomEvent) {
    let t = e.target;
    let me = e.detail.event;

    this.contextNode = e.detail.data;
  }
  onNodeSelect(e: CustomEvent) {
    let t = e.target;
    let data = e.detail.data;
    let node = e.detail.node;
    this.editingType = data.type
    this.editingNode = { node, data }
    switch (data.type) {
      case NodeType.TYPE_STATION:
        this.editingTitle = '编辑厂站'
        break;
      case NodeType.TYPE_TUNNEL:
        this.editingTitle = '编辑通道'
        break;
      case NodeType.TYPE_DEV:
        this.editingTitle = '编辑设备'
        break;
      case NodeType.TYPE_POINT:
        this.editingTitle = '编辑测点'
        break;

      default:
        break;
    }
  }
  onMenuBeforeOpen(e: CustomEvent) {
    let ev = e.detail.event;

    if (this.contextNode) {
      switch (this.contextNode.type) {
        case NodeType.TYPE_STATION:
          this.menu.setItems([{ text: "新增通道" }]);
          break;
        case NodeType.TYPE_TUNNEL:
          this.menu.setItems([{ text: "新增设备" }, { text: "删除设备" }]);
          break;

        default:
          e.detail.cancel();
          break;
      }

    } else {
      this.menu.setItems([
        {
          text: "新增厂站"
        }
      ]);
    }
  }
  onMenuClose() {
    this.contextNode = null;
  }
  onMenuSelect(e: CustomEvent) {
    let item = e.detail.item
    let id = uuid()

    switch (item.text) {
      case "新增厂站":
        this.treeData.push({ id, label: '未保存的厂站', type: NodeType.TYPE_STATION, unsave: true });
        break;
      case "新增通道":
        let tunnel = { id, label: '未保存的通道', type: NodeType.TYPE_TUNNEL, unsave: true, connectStatus: 'closed' }
        if (!this.editingNode.data.children) {
          this.editingNode.data.children = [tunnel]
        } else {
          this.editingNode.data.children.push(tunnel)
        }
        break;
      case "新增设备":
        let dev = { id, label: '未保存的设备', type: NodeType.TYPE_DEV, unsave: true, children: [{ id: uuid(), label: '测点', type: NodeType.TYPE_POINT }] }
        if (!this.editingNode.data.children) {
          this.editingNode.data.children = [dev]
        } else {
          this.editingNode.data.children.push(dev)
        }
        break;
      case "删除设备":
        let parentNode;
        let currentNode = findTreeNode(this.treeData, (node, pNode) => {
          let isEq = node.id == this.editingNode.data.id
          if (isEq) {
            console.log(pNode);
            parentNode = pNode;
          }
          return isEq
        })
        remove(parentNode!.children, n => n === currentNode)
        break;

      default:
        break;
    }

    //选中
    setTimeout(() => {
      this.tree.selectNode(id)
    }, 110);
  }
}
