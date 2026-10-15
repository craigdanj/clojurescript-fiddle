'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load,install}=require('../dist/example-menu.js');
function harness() {
 const doc=new EventTarget();
 class Element extends EventTarget {
  constructor(){super();this.hidden=false;this.attributes={};this.dataset={};}
  setAttribute(key,value){this.attributes[key]=value;}
  focus(){doc.activeElement=this;}
  click(){this.dispatchEvent(new Event('click'));}
 }
 const container=new Element(),button=new Element(),list=new Element();
 const items=['counter','data','colors'].map(name=>{const item=new Element();item.dataset.example=name;return item;});
 list.querySelectorAll=()=>items;container.contains=target=>[container,button,list,...items].includes(target);
 const picks=[];install({container,button,list,document:doc,onSelect:name=>picks.push(name)});
 function key(target,key){const event=new Event('keydown',{cancelable:true});event.key=key;target.dispatchEvent(event);return event;}
 return {doc,container,button,list,items,picks,key,Element};
}
test('the same menu item can be selected repeatedly, restoring all Fiddle buffers and rerunning',()=>{
 const h=harness(),original={html:'<h1>Counter</h1>',css:'h1 { color: green; }',cljs:'(println "fresh")'};
 const editors=Object.fromEntries(['html','css','cljs'].map(key=>[key,{value:'',setValue(value){this.value=value;}}]));
 let runs=0;
 for(const item of h.items)item.addEventListener('click',()=>load(original,editors,()=>runs++));
 for(let cycle=0;cycle<3;cycle++) {
  for(const editor of Object.values(editors))editor.value='User modification '+cycle;
  h.button.click();assert.equal(h.list.hidden,false);assert.equal(h.button.attributes['aria-expanded'],'true');
  h.items[0].click();assert.equal(h.list.hidden,true);assert.equal(h.doc.activeElement,h.button);
  assert.deepEqual(Object.fromEntries(Object.entries(editors).map(([key,editor])=>[key,editor.value])),original);
 }
 assert.equal(runs,3);assert.deepEqual(h.picks,['counter','counter','counter']);
});
test('keyboard navigation, Escape, outside clicks, and mode switching close the dropdown',()=>{
 const h=harness();
 h.key(h.button,'ArrowUp');assert.equal(h.doc.activeElement,h.items[2]);
 h.key(h.list,'ArrowDown');assert.equal(h.doc.activeElement,h.items[0]);
 h.key(h.list,'End');assert.equal(h.doc.activeElement,h.items[2]);
 h.key(h.list,'Home');assert.equal(h.doc.activeElement,h.items[0]);
 assert(h.key(h.list,'Escape').defaultPrevented);assert(h.list.hidden);assert.equal(h.doc.activeElement,h.button);
 h.button.click();h.doc.dispatchEvent(new Event('pointerdown'));assert(h.list.hidden);
 h.button.click();h.doc.dispatchEvent(new Event('editor-mode-change'));assert(h.list.hidden);assert.equal(h.button.attributes['aria-expanded'],'false');
 h.button.click();h.key(h.list,'Tab');assert(h.list.hidden);assert.equal(h.doc.activeElement,h.button);
});
