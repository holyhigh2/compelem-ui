import { template } from "myfx";

/**
 * @param columns {Array}
 */
const colGroupRender = template(
  `
    [% _.each(columns,(col)=>{ %]
      <col style="width:[%= col.width %]px"/>
  [% }) %]`,
  {
    stripWhite: true,
  }
);
/**
 * @param headerHeight {number} 行高
 * @param header {Array<[]>}
 * @param maxLevel {number}
 * @param render {function}
 * @param columns {Array}
 */
const theadRender = template(`
[% let i = 0;_.each(header,(row,rIndex)=>{ 
   let leftWidth = 0;
%]
  <tr>
  [% _.each(row,(col,cIndex)=>{
    let colIndex = _.findIndex(columns,c=>c.prop===col.prop);
  %]
    <th class="[%=columns.length-1 == cIndex?'__end':''%] [%=col.fixed?(col.fixed=='right'?'fixed-cell-right':'fixed-cell-left'):''%] [%= col.isFixedEnd?'fixed-end':'' %] [%= col.headerClass %]" style="left:[%=col.fixed?leftWidth+'px':'auto'%];text-align:[%=col.headerAlign%];" rowspan="[%= (maxLevel - col.rowspan)||1%]" colspan="[%= col.colspan||1 %]" data-column-index="[%=colIndex%]">
      <div class="c-table-header-wrapper" style="height:[%= headerHeight?headerHeight+'px':'auto' %];line-height:[%= headerHeight?headerHeight+'px':'auto' %];">
        <span class="c-table-header-label">[%= render(col,rIndex,cIndex,i) %]</span>
        [%if(!col.hasSub && col.sort){%]
          <span class="c-table-header-sort" data-column-index="[%=colIndex%]">
          <i>▲</i>
          <i>▼</i>
          </span>
        [%}%]
        [%if(!col.hasSub && col.filters && col.prop){%]
          <l-dropdown name="filtermenu" items="[]" trigger="click" hide-on-click="false">
            <svg slot="trigger" xmlns="http://www.w3.org/2000/svg" width="16" height="16" class="c-table-header-filters" viewBox="0 0 16 16" data-column-index="[%=colIndex%]">
              <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2z"/>
            </svg>
          </l-dropdown>
        [%}%]
        [%if(!col.hasSub && col.resizable){if((cIndex != row.length-1 && rIndex==0)||(rIndex>0)){%]
        <div class="resizable-handle" data-column-index="[%=colIndex%]"></div>
        [%}
          leftWidth += col.width;
        }%]
      </div>
    </th>
  [% i++;}) %]
  
  </tr>
[% }) %]
`);

/**
 * @param columns {Array}
 * @param rowHeight {number}
 * @param startIndex {number}
 * @param data {Array}
 * @param renderBody {function}
 * @param renderInput {function}
 * @param renderInputSlot {function}
 * @param stripe {boolean}
 * @param stripeColor {string}
 * @param tableId {string}
 * @param lockedMap {object}
 * @param styler {function}
 * @param formatter {function}
 * 
 */
const tbodyRender = template(`
[% _.each(data,(d,rIndex)=>{
  if(!d)return;
  let isAppend = rIndex==data.length-1;
  let leftWidth = 0;
  %]
  <tr class="[%= rIndex%2==1?'c-table-row-striped':'' %] [%= rIndex==0?'top-loader':'' %] [%= isAppend?'bottom-loader':'' %]" [% if(isAppend || rIndex==0)print('data-index="'+(rIndex+startIndex)+'"') %]>
  [% _.each(columns,(c,cIndex)=>{
    let rowIndex = startIndex + rIndex;
    let style = cellStyleMap[rowIndex+":"+cIndex]||'';
    if(_.last(style) !== ';')style += ';';
    if(c.prop && c.prop.indexOf('__')!=0){
      let col = _.cloneDeepWith(c, _.clone, (v, k) => k === 'slots')
      style += styler?(styler({row:_.cloneDeep(d),column:col,rowIndex,colIndex:cIndex})||''):''
    }
    let note = cellNoteMap[rowIndex+":"+cIndex]
  %]
    <td class="c-table-cell [%= c.cellClass %] [%=c.fixed?(c.fixed=='right'?'fixed-cell-right':'fixed-cell-left'):''%] [%= c.isFixedEnd?'fixed-end':'' %] [%= (c.slots.input||c.dataType)?'__editable':''%] [%= c.slots.default?'__slotted':''%] [%=columns.length-1 == cIndex?'__end':''%] [%=c.dataSelection?'__selection':''%]" 
        data-column-prop="[%=c.prop%]" 
        data-column-index="[%=cIndex%]" 
        data-row-index="[%=startIndex+rIndex%]" 
        style="text-align:[%=c.align%];left:[%=c.fixed?leftWidth+'px':'auto'%];[%=style%]" 
        onmouseenter="cell_enter_[%=tableId%](this)"
        [%=_.isBlank(note)?'':'data-note="'+note+'"'%]
    >
      <div class="c-table-cell-wrapper" style="height:[%= rowHeight %]px;line-height:[%= rowHeight %]px;">
      [% if(c.type == 'index'){ %]
        [%= rIndex+1+startIndex %]
      [% } else{ %]
        <div class="view">
          [%= renderBody(c,d,startIndex+rIndex,cIndex,formatter) %]
        </div>
        <div class="input">
        [% 
            if(c.slots.input){
              print(renderInputSlot(c,d,rIndex,cIndex))
            }else if(c.dataType){
              print(renderInput(c.dataType,c.dataSelection,c.dataSelectionOption,c.dataOption,d[c.prop]))
            }else{
            }
          
        %]
        </div>
      [% } %]
      </div>
    </td>
  [%
    leftWidth += c.width;
   }) %]
  </tr>
[% }) %]
`);

export { colGroupRender, tbodyRender, theadRender };

