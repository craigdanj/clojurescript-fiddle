/* Fiddle example picker. MIT License — Craig Johnson. */
(function(root,factory) {
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ExampleMenu=api;
})(typeof globalThis!=='undefined'?globalThis:this,function() {
 'use strict';
 function load(example,editors,run) {
  if(!example)return;
  // Always write a fresh copy, even when the same example was just selected.
  for(const key of ['html','css','cljs'])editors[key].setValue(example[key]);
  run();
 }
 function install({container,button,list,onSelect,document:doc}) {
  const items=[...list.querySelectorAll('[data-example]')];
  function close(focus=false) {
   list.hidden=true;button.setAttribute('aria-expanded','false');
   if(focus)button.focus();
  }
  function open(last=false) {
   list.hidden=false;button.setAttribute('aria-expanded','true');
   (last?items.at(-1):items[0])?.focus();
  }
  button.addEventListener('click',()=>list.hidden?open():close());
  button.addEventListener('keydown',event=>{
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();open(event.key==='ArrowUp');}
   else if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();close(true);}
  });
  for(const item of items)item.addEventListener('click',()=>{close(true);onSelect(item.dataset.example);});
  list.addEventListener('keydown',event=>{
   const index=items.indexOf(doc.activeElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next]?.focus();
   } else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
   else if(event.key==='Tab')close(true);
  });
  doc.addEventListener('pointerdown',event=>{if(!list.hidden&&!container.contains(event.target))close();});
  doc.addEventListener('focusin',event=>{if(!list.hidden&&!container.contains(event.target))close();});
  doc.addEventListener('editor-mode-change',()=>close());
  close();return {close};
 }
 return {load,install};
});
