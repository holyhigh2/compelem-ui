import { classes, CompElem, html, prop, state, tag, Template, watch } from "compelem";
import myfx, {
  capitalize,
  clone,
  closest,
  concat,
  each,
  filter,
  get,
  isArray,
  isFunction,
  isNil,
  isObject,
  join,
  map,
  split,
  trim
} from "myfx";
import { getBox } from "uiik";
import { CaretRight, Check } from "../../../icons/icons";
import style from "./style.scss";
const enum CheckMode {
  RADIO = "radio",
  CHECKBOX = "checkbox",
}
const EDGE = 20
/**
 * 菜单列表，用于支持右键菜单，下拉(多选)菜单，导航菜单等
 * feat.
 * 1. 支持图标
 * 2. 支持子菜单
 * 3. 支持快捷键
 * 4. 支持自定义文本
 * 5. 支持自定义行
 * 6. 支持单选/复选菜单项
 * @attrs
 *  items {array} 字符串数组/对象数组，如果数组内容为非对象/字符串则显示为分割条。custom函数返回的菜单项不响应点击操作
 * {
 *  text:string|()=>html, //菜单项内容
 *  disabled,
 *  icon, //图标HTML内容
 *  iconClass, //图标样式类
 *  hotKey:['ctrl','shift','n'],
 *  children, //children是数组时显示子菜单
 *  separate, //显示子菜单时，父菜单是否可以点击
 *  custom:()=>html, //自定义整个菜单项
 *  checkMode:'radio'/'checkbox', //开启单选/多选
 *  checked: false, //是否选中
 *  checkGroup: '', //
 *  ....
 * }
 *  theme {string} light/dark
 *  round {boolean} 圆角，默认true
 * @events
 *  select({item,index,el}) 菜单项选中时触发
 *  hover({item,index,el}) 菜单项悬浮时触发
 *
 * @author holyhigh2
 */
@tag('l-menu-pane')
export class MenuPane extends CompElem {
  #expandedMap: Record<string, HTMLElement> = {};
  #timer_expand: any;
  #timer_hide: any;
  //用于替换得自定义内容id
  #customIds: Record<string, any> = {}

  #radioGroupMap: Record<string, Array<Record<string, any>>> = {};
  #checkboxGroupMap: Record<string, Array<Record<string, any>>> = {};
  #radioCheckedMap: Record<string, Record<string, any>> = {};
  //////////////////////////////////// props
  @prop({ type: Array, required: true }) items: Array<Record<string, any>>;
  @prop round = false

  @state itemList: Array<any>;

  static get styles(): string[] {
    return [style];
  }

  /////////////////////////////////// watches
  @watch('items', { deep: true, immediate: true })
  watchItems(nv: any) {
    if (JSON.stringify(nv) !== JSON.stringify(this.itemList)) {
      this.itemList = concat(nv);
      this.setItems(nv)
    }
  }
  //////////////////////////////////// lifecycles
  render(): Template {
    return html`
    <ul class="c-menu-pane ${classes({ __rounded: this.round })}" @click="${this.onClick}" @mousedown="${this.onMouseDown}" @mouseleave="${this.onMouseLeave}">
    </ul>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.renderRoot.oncontextmenu = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      return false;
    };


    each(this.#customIds, (nodes: HTMLCollection, id: string) => {
      let placeholder = this.renderRoot.querySelector('b[id="' + id + '"]');
      let fragment = document.createDocumentFragment();
      fragment.append(...nodes)
      placeholder?.parentElement?.replaceChild(fragment, placeholder)
    })
    this.#customIds = {}

    this._bindChildren();
  }

  disconnectedCallback() {
    this.renderRoot.oncontextmenu = null;
  }
  //////////////////////////////////// methods
  _bindChildren() {
    let childrenLi = this.renderRoot.querySelectorAll<HTMLElement>("li.c-menu-pane-item");
    const that = this;
    each<HTMLElement>(childrenLi, (li) => {
      li.onmouseenter = function (e: MouseEvent) {
        let t = e.target as HTMLElement;

        if (that.#timer_expand) {
          clearTimeout(that.#timer_expand);
          that.#timer_expand = null;
        }
        if (that.#timer_hide) {
          clearTimeout(that.#timer_hide);
          that.#timer_hide = null;
        }

        //hover event
        let dataPath = split(li?.dataset.path, "-");
        let item = get(that.itemList, dataPath.shift()!) as any;

        each(dataPath, (p) => {
          item = get(item.children, p);
        });
        if (item.disabled) return;
        let ev = new CustomEvent("hover", {
          detail: {
            item,
            index: li?.dataset.index,
            el: li,
          },
        });
        that.dispatchEvent(ev);

        //hide children
        let level = t.dataset.level!;
        let expandedLi = that.#expandedMap[level];
        if (expandedLi != t) {
          if (expandedLi && !that.#timer_hide) {
            that.#timer_hide = setTimeout(() => {
              expandedLi.classList.remove("__expanded");
              let subMenus = expandedLi.querySelectorAll(
                ".c-menu-pane.__sub"
              );
              each(subMenus, (sm: HTMLElement) => {
                sm.style.left = "-9999px";
                sm.style.display = "none";
              });
              that.#timer_hide = null;
            }, 300);
          }
          // return;
        } else {
          clearTimeout(that.#timer_hide);
          that.#timer_hide = null;
        }

        let isSeparated = t.classList.contains("__separated");
        if (isSeparated) {
          return;
        }

        that._expandChildren(t);
      };
      let isSeparated = li.classList.contains("__separated");
      if (isSeparated) {
        let childrenBtn = li.querySelector(
          ":scope>.c-menu-pane-item-wrapper>.c-menu-pane-item-children"
        ) as HTMLElement;
        childrenBtn.onmouseenter = function (e: MouseEvent) {
          let t = e.target as HTMLElement;
          that._expandChildren(t.closest("li")!);
        };
      }
    });
  }
  _expandChildren(li: HTMLElement) {
    this.#timer_expand = setTimeout(() => {
      if (li.classList.contains('__disabled')) return;

      li.classList.add("__expanded");

      let box = getBox(
        li.querySelector(":scope>.c-menu-pane-item-wrapper")!,
        document.documentElement
      );

      let subMenu = li.querySelector(":scope>.c-menu-pane") as HTMLElement;
      if (!subMenu) return;

      let level = li.dataset.level!;
      this.#expandedMap[level] = li;

      subMenu.style.display = "block";
      subMenu.style.left = box.w + "px";
      subMenu.style.top = -4 + "px";
      // subMenu.style.width = subMenu.scrollWidth+"px";

      //check bounds
      let parentUl = closest(
        li,
        (node) => node.tagName == "UL",
        "parentElement"
      )!;
      let rect: DOMRect = parentUl.getBoundingClientRect();
      let subRect: DOMRect = subMenu.getBoundingClientRect();
      //x
      if (rect.x + parentUl.scrollWidth > window.innerWidth) {
        subMenu.style.left = -subMenu.offsetWidth + "px";
      }
      //y
      if (subRect.y + subRect.height > window.innerHeight) {
        subMenu.style.top =
          -subRect.height - subRect.y + rect.height + rect.y - 4 + "px";
      }
    }, 300);
  }
  onMouseLeave() {
    if (this.#timer_expand) {
      clearTimeout(this.#timer_expand);
      this.#timer_expand = null;
    }
  }
  onMouseDown(e: MouseEvent) {
    e.stopPropagation();
  }
  onClick(e: MouseEvent) {
    let t = e.target as Element;
    let li = closest<HTMLElement>(
      t,
      (node) => node.tagName == "LI",
      "parentNode"
    );

    if (this.renderRoot.contains(t)) {
      let disabled = li?.classList.contains("__disabled");
      let hasChildren = li?.classList.contains("__children");
      let custom = li?.classList.contains("__custom");
      let separated = li?.classList.contains("__separated");
      let checkMode = li?.dataset.checkMode;

      if (disabled || (hasChildren && !separated) || custom) {
        e.preventDefault();
        return;
      }
      if (separated && t?.classList.contains("c-menu-pane-item-children")) {
        e.preventDefault();
        return;
      }
      let dataPath = split(li?.dataset.path, "-");
      let item = get(this.itemList, dataPath.shift()!) as any;
      each(dataPath, (p) => {
        item = get(item.children, p);
      });
      let groupName = li?.dataset.checkGroup;
      if (checkMode === CheckMode.RADIO) {
        let radios = li?.parentElement?.querySelectorAll<HTMLElement>(
          'li[data-check-mode="radio"][data-check-group="' + groupName + '"]'
        );
        each<HTMLElement>(radios!, (r) => {
          //1. 修改dom
          let checkable = r.querySelector(".c-menu-pane-item-checkable");
          if (checkable) {
            checkable.innerHTML = r === li ? '<span class="c-dot"></span>' : "";
          }
          //2. 修改数据
          let rDataPath = split(r?.dataset.path, "-");
          let item = get(this.itemList, rDataPath.shift()!) as any;
          each(rDataPath, (p) => {
            item = get(item.children, p);
          });
          if (item) item.checked = r === li ? true : false;
        });
      } else if (checkMode === CheckMode.CHECKBOX) {
        //1. 修改dom
        let checkable = li?.querySelector(".c-menu-pane-item-checkable");
        if (checkable) {
          checkable.innerHTML = item.checked ? "" : Check().strings[0];
        }
        //2. 修改数据
        item.checked = !item.checked;
      }

      let ev = new CustomEvent("select", {
        detail: {
          item,
          index: li?.dataset.index,
          el: li,
        },
      });
      this.dispatchEvent(ev);
    }
  }
  setItems(items: Array<any>) {
    //todo 修改html， 临时处理方案。后续完善依赖绑定后实现自动
    //修改html会导致 radio/checkbox时重复动画
    this.renderRoot.innerHTML = this.renderItems(items);
    this.itemList = concat(items)

    each(this.#customIds, (nodes: HTMLCollection, id: string) => {
      let placeholder = this.renderRoot.querySelector('b[id="' + id + '"]');
      let fragment = document.createDocumentFragment();
      fragment.append(...nodes)
      placeholder?.parentElement?.replaceChild(fragment, placeholder)
    })
    this.#customIds = {}

    this._bindChildren();
  }
  setIcon(index: string | number, iconClass: string) {
    let li = this.renderRoot.querySelector(`li[data-index="${index}"]`);
    if (li) {
      li.querySelector(
        ".c-menu-pane-item-icon"
      )!.innerHTML = `<i class=" ${iconClass}"></i>`;
    }
  }
  reload() {
    this.setItems(this.items)
  }

  renderItems(items: Array<any>, level = 0, path: Array<number> = []) {
    let addDivider = false;
    let maxHotKeyLength = 0;
    let hasChildren = false;
    let hasCheckable = false;
    let hasIcon = false;
    let that = this;
    let innerHTML = myfx
      .chain(items)
      .map((item, i) => {
        let rs = item as any;
        if (isObject(rs)) {
          rs = clone(rs);
        } else if (!isNil(rs)) {
          rs = { text: item, value: item };
        }

        if (rs) {
          rs.hotKey = isArray(rs.hotKey)
            ? join(
              map(rs.hotKey, (k) => capitalize(k)),
              " + "
            )
            : "";
          if (rs.hotKey.length > maxHotKeyLength) {
            maxHotKeyLength = rs.hotKey.length;
          }
          if (isArray(rs.children)) {
            hasChildren = true;
            rs.childrenHTML = this.renderItems(
              rs.children,
              level + 1,
              concat(path, i)
            );
          }
          if (rs.icon || rs.iconClass) {
            hasIcon = true;
          }
          if (rs.checkMode === "radio" || rs.checkMode === "checkbox") {
            hasCheckable = true;
            let groupName = trim(rs.checkGroup);
            if (rs.checkMode === "radio") {
              let groupList = this.#radioGroupMap[groupName];
              if (!groupList) {
                groupList = this.#radioGroupMap[groupName] = [];
              }
              if (rs.checked) {
                this.#radioCheckedMap[groupName] = rs;
              }

              groupList.push(rs);
            } else {
              let groupList = this.#checkboxGroupMap[groupName];
              if (!groupList) {
                groupList = this.#checkboxGroupMap[groupName] = [];
              }
              groupList.push(rs);
            }
          }
        }
        return rs || null;
      })
      .reduce((acc, v: any, i: string) => {
        if (!v) {
          addDivider = true;
          return acc;
        }

        let text = v.text;
        if (isFunction(text)) {
          text = text();
        }

        let checkIcon = "";
        let mode = v.checkMode === "radio" || v.checkMode === "checkbox" ? v.checkMode : "";
        if (v.checkMode === "radio") {

          checkIcon =
            this.#radioCheckedMap[v.checkGroup] === v ? '<span class="c-dot"></span>' : "";
        } else if (v.checkMode === "checkbox") {
          checkIcon = v.checked ? Check().strings[0] : "";
        }

        let checkMode = hasCheckable && !v.custom
          ? `<span class="c-menu-pane-item-checkable">${checkIcon}</span>`
          : "";
        let hotKey = v.custom
          ? ""
          : `<span class="c-menu-pane-item-hotkey" style="--len:${maxHotKeyLength}">${v.hotKey}</span>`;
        let children =
          hasChildren && !v.custom
            ? `<span class="c-menu-pane-item-children">${v.childrenHTML ? CaretRight().getHTML() : ""
            }</span>`
            : "";
        let subMenu = v.childrenHTML
          ? `<ul class="c-menu-pane __sub ${this.round ? "__rounded" : ""
          }" style="left:-9999px;background: var(--menu-bg2);">${v.childrenHTML
          }</ul>`
          : "";
        let selectableParent = v.separate && children;
        let icon = hasIcon ? `<span class="c-menu-pane-item-icon">
        ` +
          (v.iconClass ? `<i class="${v.iconClass}"></i>` : "") +
          (v.icon || "") +
          `</span>` : '';

        acc +=
          `
      <li data-path="${join(
            concat(path, i),
            "-"
          )}" data-level="${level}" data-index="${i}" ${mode ? 'data-check-mode="' + mode + '"' : ""
          } data-check-group="${v.checkGroup}" class="c-menu-pane-item ${v.childrenHTML ? "__children" : ""
          } ${v.custom ? "__custom" : ""} ${addDivider ? "__divider" : ""} ${v.disabled ? "__disabled" : ""
          } ${selectableParent ? "__separated" : ""}" >
        <span class="c-menu-pane-item-wrapper">
          <button class="c-menu-pane-item-button">
            ${checkMode} 
            ${icon}
            <span class="c-menu-pane-item-text">${v.custom ? that.__getCustomHTML(v.custom) : text
          }</span>
            ${hotKey} 
          </button>
          ${children}
        </span>
        ${subMenu}
      </li>`;
        addDivider = false;
        return acc;
      }, "")
      .value();
    return innerHTML;
  }
  __getCustomHTML(tmpl: Function) {
    return tmpl()
  }
  open(left: number, top: number) {
    let w = this.renderRoot.scrollWidth;
    let h = this.renderRoot.scrollHeight;
    let x = left;
    let y = top;
    let pos = window.getComputedStyle(this).position
    if (pos === 'fixed') {
      if (x + w >= window.innerWidth) {
        x = window.innerWidth - w - EDGE;
      } else if (x < 0) {
        x = 0;
      }

      if (y + h >= window.innerHeight) {
        y = window.innerHeight - w - EDGE;
      } else if (y < 0) {
        y = 0;
      }
    } else {
      let op = this.offsetParent;
      let h = this.clientHeight;
      let maxH = (op?.clientHeight || 0) - EDGE * 2;
      let viewTop = y - (op?.scrollTop || 0);

      if (maxH > 0 && viewTop + h > maxH) {
        y = maxH - h
        if (y < 0) {
          y = EDGE;
          this.renderRoot.style.maxHeight = `${maxH}px`;
          this.renderRoot.style.overflowY = `auto`
        }
        y += (op?.scrollTop || 0);
      }

      let rect = op!.getBoundingClientRect()
      if (rect.x + x < EDGE) {
        x = EDGE - rect.x
      }
      if (rect.y + y < EDGE) {
        y = EDGE - rect.y
      }
    }

    this.style.top = `${y}px`
    this.style.left = `${x}px`
  }
  close() {
    this.style.left = `-9999px`
    each(this.#expandedMap, (li) => {
      li.classList.remove("__expanded");
      let subMenu = li.querySelector(":scope>.c-menu-pane") as HTMLElement;
      if (subMenu) {
        subMenu.style.left = "-9999px";
        subMenu.style.display = "none";
      }
    });
  }
  //返回所有复选中的项
  getCheckedItems() {
    return filter(this.itemList, item => item && item.checkMode === CheckMode.CHECKBOX && item.checked)
  }
}
