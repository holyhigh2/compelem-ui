import { classes, CompElem, forEach, html, ifElse, prop, query, queryAll, QueryCache, state, styles, tag, Template } from "compelem";
import { each, filter, get, isUndefined, map, range, remove, size, throttle } from "myfx";
import style from "./style.scss";
/**
 * 动态列表容器
 * 提供无限加载/虚拟列表/循环滚动/惰性加载等特性
 * @props
 *  data {array} 数据
 *  divider {boolean} 是否显示分隔符
 *  loop {boolean} 是否启用循环列表，启用后隐藏滚动条仅支持滚轮，默认false。开启虚拟化后生效
 *  virtualized {boolean} 是否启用虚拟化，启用后可支持大数据列表，默认false
 *  hover {boolean} 悬浮效果
 *  size {boolean} 尺寸，sm/md/lg，默认md
 *  renderItem {function} (item,i)列表项渲染函数，返回字符串或模版
 *  renderMore {function} (count)更多渲染函数，返回字符串或模版。可在函数中加载更多数据
 *  row-height {number} 默认 30px
 * @slots
 *  - 
 * @events
 *  visiblechange([{ count, el, data }]) 变动元素数组
 *
 * @author holyhigh2
 */
@tag("l-listbox")
export class ListBox extends CompElem {
  //////////////////////////////////// props
  // @prop maxHeight = '10rem';
  @prop divider = true;
  @prop virtualized = false;
  @prop loop = false;
  @prop hover = false;
  @prop rowHeight = 30
  @prop size = 'md';//small, medium, large
  @prop({ type: Array }) data = []
  @prop({ type: Function }) renderItem: (item: any, i: number) => string | Template;
  @prop({ type: Function }) renderMore: (showCount: number) => string | Template;

  @state _renderItem: (item: any, i: number) => string | Template = () => ``;
  @state _renderMore: (showCount: number) => string | Template = () => ``;

  @state moreInfo: string | Template = ''

  @query('#more', QueryCache.ONCE)
  moreEl: HTMLElement
  @query('#vrod')
  vrod: HTMLElement
  @query('#vlist')
  vlist: HTMLElement
  @queryAll('.--vitem')
  vitems: HTMLElement[]

  showCounts = new WeakMap();
  showMoreCount = 0;

  //虚拟化属性
  vRowCount = 0;
  vScrollHeight = 0;
  vListHideUp: HTMLElement[] = []
  vListHideDown: HTMLElement[] = []
  vLastScrollTop = 0
  vLastScrollDir = ''
  vMaxY = 0
  vBufferSize = 3;
  //当前显示最大索引
  vMaxRowIndex = 0
  vMinRowIndex = 0
  #scrollHandler: Function
  // @computed
  // get vScrollHeight() {
  //   return size(this.data) * this.vRowCount
  // }



  //////////////////////////////////// styles
  static get styles(): Array<string | CSSStyleSheet> {
    return [style];
  }
  /////////////////////////////////// watches
  //////////////////////////////////// lifecycles
  constructor() {
    super();

    this.#scrollHandler = throttle(this.onScroll, 100)
  }
  mounted(): void {
    const that = this

    if (this.virtualized) {
      let count = Math.ceil(this.offsetHeight / this.rowHeight)
      this.vRowCount = count + this.vBufferSize * 2;
      this.vScrollHeight = size(this.data) * this.rowHeight
      this.vrod.style.height = this.vScrollHeight + 'px'
      // this.vlist.style.marginTop = -60px;
      //插入占位符
      let str = ''

      each(range(this.vRowCount), v => {
        str += `
        <div unobserved data-row-index="${v}" data-index="${v}" class="--item --vitem" style="height:${this.rowHeight + 'px'};line-height: ${this.rowHeight + 'px'};transform:translateY(${v * this.rowHeight}px)">
        ${v}
        </div>
      `
      })
      this.vMaxRowIndex = this.vRowCount
      this.vlist.innerHTML = str;
      each(this.vlist.children, (c, i) => {
        (c as any).transY = i * this.rowHeight
      })
      const root = this.renderRoot
      this.observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            const el = entry.target as HTMLElement

            //首次不触发
            if (el.hasAttribute('unobserved')) {
              el.removeAttribute('unobserved')
              return;
            }

            const elRect = el.getBoundingClientRect()
            const rootRect = root.getBoundingClientRect()
            const direction = elRect.y < rootRect.y ? 'up' : 'down';
            // console.log('元素', el, direction, entry.isIntersecting, entry.intersectionRatio)
            if (entry.intersectionRatio === 0) {
              // hiddenEls.push(el)

              //根据消失方向定位新的高度
              if (direction === 'up') {

                if (!this.vListHideUp.includes(el))
                  this.vListHideUp.push(el)
                if (this.vListHideUp.length > 2) {
                  //隐藏超过2个时更新
                  while (this.vListHideUp.length > 2) {
                    let el = this.vListHideUp.shift()
                    // let el = topHiddenEl
                    let rIndex = parseInt(el?.getAttribute('row-index') + '')
                    let newRIndex = this.vRowCount + rIndex
                    el?.setAttribute('row-index', newRIndex + "");
                    // (el as any).transY = newRIndex * this.rowHeight
                    el?.setAttribute('data-y', newRIndex * this.rowHeight + "")
                    el!.style.transform = `translateY(${newRIndex * this.rowHeight}px)`
                    this.vListHideDown.push(el!)
                  }

                }
              } else {
                if (!this.vListHideDown.includes(el))
                  this.vListHideDown.push(el)
                if (this.vListHideDown.length > 2) {
                  //隐藏超过2个时更新
                  while (this.vListHideDown.length > 2) {
                    let el = this.vListHideDown.shift()
                    // let el = bottomHiddenEl
                    let rIndex = parseInt(el?.getAttribute('row-index') + '')
                    let newRIndex = rIndex - this.vRowCount
                    el?.setAttribute('row-index', newRIndex + "")
                    el!.style.transform = `translateY(${newRIndex * this.rowHeight}px)`
                    this.vListHideUp.push(el!)
                  }

                }
              }
              console.log('元素消失', el, direction)
            } else if (entry.intersectionRatio) {
              // remove(hiddenEls,x=>x===el)
              remove(this.vListHideUp, x => x === el)
              remove(this.vListHideDown, x => x === el)

              console.log('元素显示', el, direction,)
            }
          })

        }, { root: this.renderRoot, threshold: [0.01] }
      );

      this.vlist.querySelectorAll('.--vitem').forEach((el: HTMLElement) => {
        // this.observer.observe(el);
      })
    } else {
      this.observer = new IntersectionObserver(
        entries => {
          let hasMoreInfo = false;
          let showEls = filter(entries, item => {
            if (item.intersectionRatio > 0 && item.target.id === 'more') { hasMoreInfo = true; return false }
            return item.intersectionRatio > 0
          })
          if (showEls.length < 1 && !hasMoreInfo) return;

          if (hasMoreInfo) {
            that.moreInfo = (that.renderMore || that._renderMore)(that.showMoreCount++)
          }
          let changeEls: Record<string, any>[] = []
          each(showEls, el => {
            let t = el.target as HTMLElement
            let count = that.showCounts.get(t)
            if (isUndefined(count)) {
              count = 1
            }
            that.showCounts.set(t, count++)
            let i = t.dataset.index as string
            let data = get(that.data, i)
            changeEls.push({ count, el: t, data })
          })
          that.emit('visiblechange', changeEls)

        }, { root: this }
      );

      this.observer.observe(
        this.moreEl
      );
      this.renderRoot.querySelectorAll('.--item').forEach((el: HTMLElement) => {
        (el as any)._o = '1';
        this.observer.observe(el);
      })
    }
  }
  disconnectedCallback() {
    this.observer.disconnect()
  }

  render(): Template {
    return html`<div class="c-listbox ${classes({
      __hover: this.hover,
      __divider: this.divider,
      __card: this.card,
      [`__size-` + this.size]: true
    })}" @scroll.throttle:100="${this.onScroll}" @scrollend="${this.onScrollEnd}">
      ${ifElse(this.virtualized, this.renderVirtual.bind(this), this.renderAll.bind(this))}
    </div> `;
  }
  renderVirtual() {
    return html`<div id="vrod"></div><div id="vlist" style="${styles({ marginTop: this.rowHeight * 0 + 'px' })}"></div>`
  }
  renderAll() {
    return html`
      ${forEach(this.data, (item, i) => html`
        <div key="${i}" data-index="${i}" class="--item">
          ${i}::${(this.renderItem || this._renderItem)(item, i)}
        </div>
      `)}
      <div id="more">
        ${this.moreInfo}
      </div>
    `
  }

  updated(changed: Record<string, any>): void {
    if (!this.virtualized && changed.data) {
      this.renderRoot.querySelectorAll('.--item').forEach((el: HTMLElement) => {
        if ((el as any)._o) return;
        (el as any)._o = '1';
        this.observer.observe(el);
      })
    }
  }


  //////////////////////////////////// methods
  onScroll(e: Event) {
    const top = this.renderRoot.scrollTop
    let startRowIndex = Math.floor(top / this.rowHeight)
    if (startRowIndex > this.data.length - 1 - this.vRowCount) {
      startRowIndex = this.data.length - 1 - this.vRowCount
    }

    let offset = this.renderRoot.scrollTop - this.vLastScrollTop
    this.vLastScrollTop = this.renderRoot.scrollTop
    const topY = this.vBufferSize * this.rowHeight * -1
    const bottomY = this.clientHeight + (this.vBufferSize - 1) * this.rowHeight
    let appendList: HTMLElement[] = []
    let prependList: HTMLElement[] = []
    let dir = offset > 0 ? 'up' : 'down'

    //测试代码
    let rowIndexMap: Record<string, any> = {}
    each(this.vlist.children, (c: HTMLElement, i) => {
      let transY = (c as any).transY
      let newTy = transY - offset;
      (c as any).transY = newTy
      //重复
      if (rowIndexMap[c.dataset.rowIndex!]) {
        if (this.vLastScrollDir === 'up') {
          if (!appendList.includes(c))
            appendList.push(c)
        } else {
          if (!prependList.includes(c))
            prependList.push(c)
        }
        return;
      }
      rowIndexMap[c.dataset.rowIndex!] = rowIndexMap[c.dataset.rowIndex!] ? rowIndexMap[c.dataset.rowIndex!] + 1 : 1;


      //up
      if (newTy < topY && this.vLastScrollDir === 'up'
      ) {
        if (!appendList.includes(c))
          appendList.push(c)
        return;
      }
      //down
      if (newTy > bottomY && this.vLastScrollDir === 'down'
      ) {
        if (!prependList.includes(c))
          prependList.push(c)
        return;
      }
    })

    //思路，当vMaxY == 0时表示滚动过快，此时使用startRowIndex定位所有元素位置及加载对应数据
    console.log(appendList.length, prependList.length, this.vLastScrollDir, dir, startRowIndex)
    if (offset > 0) {
      startRowIndex = Math.floor(this.renderRoot.scrollTop / this.rowHeight)
      console.log('zzzzzzzzzzzzzzzzzzzzzz=<>', startRowIndex)
      if (this.vLastScrollDir && this.vLastScrollDir !== 'up') {
        //切换方向时需要检测bottom元素是否需要填充可视区
        //1. 找到所有prepend元素
        let prepends = filter<HTMLElement>(this.vlist.children, c => (c as any).transY > bottomY || (c as any).transY < topY)

        appendList = prepends
        // this.vMaxRowIndex = startRowIndex + this.vRowCount - this.vBufferSize
      }
      console.log('top0', this.renderRoot.scrollTop)
      let oppositeIndex = 1;
      let appendSize = appendList.length
      let startR = startRowIndex - this.vBufferSize
      appendList.forEach((c, i) => {
        let r = startR++//this.vMaxRowIndex
        if (r >= this.data.length) {
          // return;
          //到达底部时，反向定位剩余元素，否则上滚时没有可用元素
          do {
            r = startRowIndex - oppositeIndex++
          } while (rowIndexMap[r]);
          if (oppositeIndex > appendSize) return;
          rowIndexMap[r] = 1
        }

        if (rowIndexMap[r]) {
          //存在重复index直接返回，保持位置不变可作为后续可滚动元素
          do {
            r++
          } while (rowIndexMap[r]);
          if (r >= this.data.length) return;
          rowIndexMap[r] = 1
        }

        let newTy = r * this.rowHeight;
        (c as any).transY = newTy - top;
        c.dataset.rowIndex = r + ''
        // vMaxY = newTy
        c.style.transform = `translateY(${newTy}px`;
        c.innerHTML = r + '' //+ ":" + c.dataset.index
        // this.vMaxRowIndex++
      })
    } else {
      startRowIndex = Math.floor(this.renderRoot.scrollTop / this.rowHeight)
      console.log('xxxxxxxxxxxxx=<>', startRowIndex)
      if (this.vLastScrollDir && this.vLastScrollDir !== 'down') {
        //切换方向时需要检测bottom元素是否需要填充可视区
        //1. 找到所有prepend元素
        let appends = filter<HTMLElement>(this.vlist.children, c => (c as any).transY > bottomY || (c as any).transY < topY)

        console.log('appends....', appends.length, startRowIndex)

        prependList = appends//toArray(this.vlist.children)
      }
      console.log('top0', this.renderRoot.scrollTop)

      let rowIndexM = map(this.vlist.children, (c: HTMLElement) => c.dataset.rowIndex)
      console.log(prependList.length, '9090909090', rowIndexMap, rowIndexM)

      let oppositeIndex = 0;
      let startR = startRowIndex - this.vBufferSize
      if (startR < 0) startR = 0
      let prependSize = prependList.length
      prependList.forEach(c => {
        let r = startR++//this.vMaxRowIndex - 1 //- this.vRowCount
        if (r < 0) {
          //到达top时，反向定位剩余元素，否则上滚时没有可用元素
          do {
            r = oppositeIndex++
          } while (rowIndexMap[r]);
          if (oppositeIndex > prependSize) return;
          rowIndexMap[r] = 1
        }
        if (rowIndexMap[r]) {
          do {
            r++
          } while (rowIndexMap[r]);
          if (r >= this.data.length) return;
          rowIndexMap[r] = 1
        }
        let newTy = r * this.rowHeight;
        (c as any).transY = newTy - top;
        c.dataset.rowIndex = r + ''
        // vMaxY = newTy
        c.style.transform = `translateY(${newTy}px`;
        c.innerHTML = r + ":" //+ c.dataset.index
        // this.vMaxRowIndex--
      })
    }


    console.log('this.vMaxRowIndex===>', map(this.vlist.children, (c: HTMLElement) => c.dataset.rowIndex), Math.floor(this.renderRoot.scrollTop / this.rowHeight))
    this.vLastScrollDir = dir;
    console.log('top2', this.renderRoot.scrollTop)
  }
  onScrollEnd(e: Event) {
    console.log('top-end', this.renderRoot.scrollTop)
  }
  //////////////////////////////////// APIs
  setRenderItem(formatter: (item: any) => string | Template) {
    this._renderItem = formatter
  }
  setRenderMore(formatter: (showCount: number) => string | Template) {
    this._renderMore = formatter
  }
}
