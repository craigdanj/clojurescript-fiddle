'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {expressionAt}=require('../dist/repl-core.js');
class Element extends EventTarget {
 constructor(){super();this.value='';this.textContent='';this.style={};this.hidden=false;this.children=[];this.attributes={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};this.selectionStart=this.selectionEnd=0;}
 append(child){this.children.push(child);child.parent=this;}
 remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
 get childElementCount(){return this.children.length;}
 replaceChildren(){this.children=[];}
 setAttribute(key,value){this.attributes[key]=value;}
 focus(){this.focused=true;}
 setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('mode switch, full file, selection, current form, prompt, clear and restart controls',async()=>{
 const nodes=new Map(),document=new Element(),calls=[];let session;
 document.body=new Element();document.createElement=()=>new Element();document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const get=document.getElementById,window={};let code='',selection='',cursor=0;
 const editor={setValue:s=>code=s,getValue:()=>code,getSelection:()=>selection,somethingSelected:()=>!!selection,getCursor:()=>({line:0,ch:cursor}),indexFromPos:p=>p.ch,clearHistory(){this.historyCleared=true;},refresh(){this.refreshed=true;},focus(){this.focused=true;},on(){}};
 const FiddleRepl={expressionAt,Session:class{constructor(options){session=this;this.options=options;this.resets=0;}async evaluate(source,id){calls.push(source);this.options.onMessage({kind:'result',values:['value'],id});this.options.onMessage({kind:'done',values:['user'],id});}reset(){this.resets++;}}};
 const context={document,window,FiddleRepl,loadRuntime(){},CodeMirror:{fromTextArea:()=>editor},ClojureEditing:{install(){}},ClojureStructure:{install(){}},editors:{cljs:{refresh(){}}},ResizeObserver:class{observe(){}},Event,requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/repl.js'),'utf8'),context);
 const click=id=>get(id).dispatchEvent(new Event('click'));
 click('mode-repl');assert(get('workspace').hidden);assert(!get('repl-workspace').hidden);assert.equal(get('run-label').textContent,'Run file');
 code='(def x 5)\n(+ x 2)';window.ReplUI.runFile();await tick();assert.equal(calls.at(-1),code);
 cursor=14;click('eval-expression');await tick();assert.equal(calls.at(-1),'(+ x 2)');
 selection='(+ 40 2)';click('eval-expression');await tick();assert.equal(calls.at(-1),selection);selection='';
 get('repl-input').value='(inc x)';click('repl-send');await tick();assert.equal(calls.at(-1),'(inc x)');assert.equal(get('repl-input').value,'');
 click('repl-clear');assert.equal(get('terminal-output').children.length,0);assert.equal(session.resets,0);
 click('mode-fiddle');assert(!get('workspace').hidden);assert(get('repl-workspace').hidden);assert.equal(get('run-label').textContent,'Run');
 click('mode-repl');assert.equal(editor.getValue(),code);assert.equal(session.resets,0);
 click('repl-restart');assert.equal(session.resets,1);assert.equal(editor.getValue(),code);
 const evaluations=calls.length;
 get('repl-input').value='old pending text';
 window.ReplUI.loadCode('(def imported 42)');
 assert.equal(window.ReplUI.getCode(),'(def imported 42)');assert.equal(session.resets,2);assert(editor.historyCleared);
 assert.equal(get('repl-input').value,'');assert.equal(get('repl-prompt').textContent,'user=>');
 assert.equal(get('terminal-output').children.length,1);assert.equal(calls.length,evaluations);
 window.ReplUI.switchMode('fiddle');assert.equal(window.ReplUI.isActive(),false);
});
