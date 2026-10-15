'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {build}=require('../dist/standalone-html.js');
const runtime=fs.readFileSync(require.resolve('../dist/vendor/scittle.js'),'utf8');
const license=fs.readFileSync(require.resolve('../dist/vendor/SCITTLE-LICENSE'),'utf8');
const sample={name:'Counter λ',html:'<button id="plus">+</button><span id="answer"></span>',css:'body { color: green; }',cljs:'(def n (atom 42)) (set! (.-textContent (js/document.getElementById "answer")) (str @n)) (.addEventListener (js/document.getElementById "plus") "click" (fn [] (set! (.-textContent (js/document.getElementById "answer")) (str (swap! n inc)))))',runtime,license};
function launch(options={}) {
 const text=build({...sample,...options}),scripts=[...text.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
 assert.equal(scripts.length,2,'one license data block and one executable bootstrap');
 const elements=new Map(),events={},logs=[];
 const element=()=>({textContent:'',innerHTML:'',style:{},setAttribute(){},listeners:{},addEventListener(key,fn){this.listeners[key]=fn;}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const document={querySelectorAll:()=>[],addEventListener(){},getElementById:get,createElement:element,body:{append(node){elements.set(node.id,node);}},head:{append(node){vm.runInContext(node.textContent,ctx);}}};
 const ctx={document,console:{log:(...values)=>logs.push(values),error:(...values)=>logs.push(values)},setTimeout,clearTimeout,fetch:()=>{throw Error('A standalone page must not fetch its runtime');},addEventListener:(key,fn)=>events[key]=fn};
 ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(scripts[1][2],ctx);
 return {text,scripts,get,elements,events,logs,ctx};
}
test('standalone page includes the real runtime and runs interactive code without fetching',()=>{
 const h=launch();
 assert.equal(h.get('fiddle-root').innerHTML,sample.html);assert.equal(h.get('fiddle-style').textContent,sample.css);
 assert.equal(h.get('answer').textContent,'42');h.get('plus').listeners.click();assert.equal(h.get('answer').textContent,'43');
 assert.equal(h.elements.has('fiddle-export-error'),false);
 const attribution=JSON.parse(h.scripts[0][2]);assert.equal(attribution.text,license);assert.equal(attribution.license,'EPL-1.0');
 assert(!h.text.includes('<script src='));assert(!h.text.includes('<link '));
});
test('raw HTML, CSS, Clojure, Unicode, and end tags survive embedding as data',()=>{
 const html='<p>नमस्ते 👋</p><script>throw Error("must remain inert")</script><!-- <script> -->';
 const css='p::before { content: "</style></script>"; }';
 const h=launch({name:'</title><script>bad()</script>',html,css,cljs:'(println "</script><!--<script> λ")'});
 assert(h.text.includes('&lt;/title&gt;'));assert.equal(h.get('fiddle-root').innerHTML,html);assert.equal(h.get('fiddle-style').textContent,css);
 assert.deepEqual(h.logs.at(-1),['</script><!--<script> λ']);assert.equal(h.elements.has('fiddle-export-error'),false);
});
test('runtime and async errors produce readable diagnostics; blank source works',()=>{
 const h=launch({cljs:'(throw (js/Error. "Example failed"))'});
 assert.match(h.get('fiddle-export-error').textContent,/Example failed/);
 h.events.unhandledrejection({reason:'Async failure'});assert.match(h.get('fiddle-export-error').textContent,/Async failure/);
 const blank=launch({html:'',css:'',cljs:''});assert.equal(blank.get('fiddle-root').innerHTML,'');assert.equal(blank.elements.has('fiddle-export-error'),false);
 assert.throws(()=>build({...sample,runtime:''}),/runtime/);assert.throws(()=>build({...sample,license:''}),/license/);
});
