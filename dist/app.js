'use strict';
const $ = id => document.getElementById(id);
const sharedCSS = `* { box-sizing: border-box; }
body {
  margin: 0; padding: 36px 24px;
  background: #f3f6fb; color: #24334a;
  font-family: system-ui, sans-serif;
}
.card {
  max-width: 340px; margin: 0 auto;
  padding: 28px; background: white;
  border: 1px solid #e0e7ee;
  border-radius: 16px; text-align: center;
  box-shadow: 0 12px 30px #24334a08;
}
.eyebrow { font-size: 12px; letter-spacing: 2px; color: #718197; }
h1 { font-size: 24px; margin: 12px 0; }
#value { font-size: 64px; margin: 18px 0; font-weight: 600; }
button {
  border: 0; border-radius: 8px;
  background: #e9f2e1; color: #365122;
  padding: 12px 22px; font-size: 18px;
  cursor: pointer; margin: 0 4px;
}
p { color: #718197; font-size: 14px; }
`;
const examples = {
 counter: {
 html: `<div class="card">
  <div class="eyebrow">HELLO, CLOJURESCRIPT</div>
  <h1>A state of possibility.</h1>
  <div id="value">0</div>
  <button id="decrease" aria-label="Decrease">−</button>
  <button id="increase" aria-label="Increase">+</button>
  <p>One atom. Endless possibilities.</p>
</div>`, css: sharedCSS,
 cljs: `;; A tiny counter, powered by an atom.
(def count-state (atom 0))

(defn render! []
  (set! (.-textContent
          (js/document.getElementById "value"))
        @count-state))

(defn change! [amount]
  (swap! count-state + amount)
  (render!)
  (println "Count:" @count-state))

(.addEventListener
  (js/document.getElementById "increase")
  "click" #(change! 1))

(.addEventListener
  (js/document.getElementById "decrease")
  "click" #(change! -1))

(render!)
(println "Hello from ClojureScript!")
{:ready true :count @count-state}`
 },
 data: {html:`<div class="card"><div class="eyebrow">DATA, TRANSFORMED</div><h1>Small functions.<br>Useful results.</h1><pre id="data"></pre><p>Check the console for each step.</p></div>`,css:sharedCSS+'\npre { white-space: pre-wrap; text-align: left; line-height: 1.8; }',cljs:`;; Compose transformations with ->>.
(def people
  [{:name "Asha" :score 92}
   {:name "Sam" :score 68}
   {:name "Noor" :score 87}])

(def passed
  (->> people
       (filter #(>= (:score %) 80))
       (map :name)
       vec))

(println "All scores:" (mapv :score people))
(println "Passed:" passed)

(set! (.-textContent
        (js/document.getElementById "data"))
      (str "Passed: " (clojure.string/join ", " passed)))

{:passed passed :total (count people)}`},
 colors: {html:`<div class="card"><div class="eyebrow">COLOR STUDIO</div><h1>A change of hue.</h1><div id="swatch"></div><button id="next">Next color</button><p id="hex"></p></div>`,css:sharedCSS+'\n#swatch { height: 130px; border-radius: 10px; margin: 20px 0; transition: background .25s; }',cljs:`(def colors ["#95c96c" "#80aee3" "#be97dc" "#e7ac72"])
(def index (atom 0))

(defn paint! []
  (let [color (nth colors @index)]
    (set! (.. (js/document.getElementById "swatch")
              -style -backgroundColor) color)
    (set! (.-textContent
            (js/document.getElementById "hex")) color)
    (println "Color:" color)))

(.addEventListener
  (js/document.getElementById "next") "click"
  (fn []
    (swap! index #(mod (inc %) (count colors)))
    (paint!)))

(paint!)`}
};
const editors = {};
for (const [name, mode] of [['cljs','clojure'],['html','text/html'],['css','css']]) {
 editors[name] = CodeMirror.fromTextArea($(name), {mode,lineNumbers:true,tabSize:2,indentUnit:2,lineWrapping:true, extraKeys: {'Ctrl-Enter':run,'Cmd-Enter':run,Tab:cm=>cm.replaceSelection('  ')}});
}
editors.cljs.on('cursorActivity',cm=>{const c=cm.getCursor();$('cursor').textContent=`Ln ${c.line+1}, Col ${c.ch+1}`;});
let activeFrame=null, runNumber=0, logCount=0, runtimePromise=null, loadingTimer=null;
function status(text,state='') { $('status').textContent=text; $('status').dataset.state=state; }
function clearConsole() {logCount=0;$('log-count').textContent='0';$('console').replaceChildren();}
function log(kind, values) {
 if (logCount >= 500) return;
 const row=document.createElement('div');row.className='log '+kind;
 const prefix=document.createElement('span');prefix.className='prefix';prefix.textContent=kind==='result'?'⇒':kind==='error'?'!':'›';
 const content=document.createElement('span'); content.textContent=values.join(' ').slice(0,20000);
 row.append(prefix,content);$('console').append(row);$('log-count').textContent=String(++logCount);$('console').scrollTop=$('console').scrollHeight;
}
function stop() {runNumber++;clearTimeout(loadingTimer);if(activeFrame) activeFrame.remove();activeFrame=null;$('stop').disabled=true;status('Stopped');$('preview').textContent='';}
function runner(channel) {
 const send=(kind,...values)=>parent.postMessage({channel,kind,values},'*');
 const stringify=v=>{try{return typeof v==='string'?v:JSON.stringify(v)??String(v);}catch{return String(v);}};
 for(const kind of ['log','warn','error','info']) console[kind]=(...args)=>send(kind,...args.map(stringify));
 window.addEventListener('error',e=>send('error',e.message));
 window.addEventListener('unhandledrejection',e=>send('error',String(e.reason)));
 window.__fiddlePrint=(...args)=>send('log',...args.map(String));
 window.__fiddleError=(...args)=>send('error',...args.map(String));
 window.addEventListener('message',e=>{
  if(e.source!==parent || e.data?.channel!==channel || e.data?.kind!=='execute') return;
  const {html,css,cljs}=e.data;
  try {
   document.getElementById('fiddle-style').textContent=css;
   document.getElementById('fiddle-root').innerHTML=html;
   scittle.core.eval_string('(set! *print-fn* js/__fiddlePrint) (set! *print-err-fn* js/__fiddleError)');
   const start=performance.now();
   window.__fiddleResult=scittle.core.eval_string(cljs);
   const result=scittle.core.eval_string('(pr-str js/__fiddleResult)');
   send('result',result);
   send('done',(performance.now()-start).toFixed(1));
  } catch(error) {send('error',error.message || String(error));send('failed');}
 });
 send('ready');
}
async function run() {
 stop();const current=runNumber;clearConsole();status('Loading runtime…');$('stop').disabled=false;
 const snapshot=Object.fromEntries(Object.entries(editors).map(([key,editor])=>[key,editor.getValue()]));
 try {
  if(!runtimePromise) runtimePromise=fetch('vendor/scittle.js').then(r=>{if(!r.ok)throw Error('Could not load Scittle.');return r.text();}).catch(e=>{runtimePromise=null;throw e;});
  const source=await runtimePromise;if(current!==runNumber)return;
  const channel=crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
  const frame=document.createElement('iframe');frame.title='ClojureScript result';frame.setAttribute('sandbox','allow-scripts');activeFrame=frame;
  frame.dataset.channel=channel;frame._snapshot=snapshot;
  const escapeScript=s=>s.replace(/<\/script/gi,'<\\/script');
  frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><style id="fiddle-style"></style></head><body><div id="fiddle-root"></div><script>'+escapeScript(source)+'<\/script><script>scittle.core.disable_auto_eval();('+runner.toString()+')('+JSON.stringify(channel)+');<\/script></body></html>';
  $('preview').replaceChildren(frame);status('Running…');
  loadingTimer=setTimeout(()=>{if(activeFrame===frame){status('Runtime did not respond','error');log('error',['The preview did not respond. Try Run again.']);}},15000);
 }catch(e){if(current!==runNumber)return;status('Could not run','error');log('error',[e.message]);$('stop').disabled=true;}
}
window.addEventListener('message',e=>{
 if(!activeFrame || e.source!==activeFrame.contentWindow || e.data?.channel!==activeFrame.dataset.channel) return;
 const {kind,values=[]}=e.data;
 if(kind==='ready') {clearTimeout(loadingTimer);activeFrame.contentWindow.postMessage({channel:activeFrame.dataset.channel,kind:'execute',...activeFrame._snapshot},'*');}
 else if(kind==='done')status(`Finished · ${values[0]} ms`,'success');
 else if(kind==='failed')status('Execution error','error');
 else if(['log','warn','error','info','result'].includes(kind))log(kind,values.map(String));
});
function loadExample(name) {stop();for(const key of Object.keys(editors))editors[key].setValue(examples[name][key]);run();}
$('run').addEventListener('click',run);$('stop').addEventListener('click',stop);$('clear').addEventListener('click',clearConsole);
$('example').addEventListener('change',()=>loadExample($('example').value));$('reset').addEventListener('click',()=>loadExample($('example').value));
function toggleHelp(show) {$('guide').hidden=!show;$('help').setAttribute('aria-expanded',String(show));Object.values(editors).forEach(editor=>editor.refresh());}
$('help').addEventListener('click',()=>toggleHelp($('guide').hidden));$('close-guide').addEventListener('click',()=>toggleHelp(false));
document.addEventListener('keydown',e=>{if(!e.defaultPrevented&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}});
for(const key of Object.keys(editors))editors[key].setValue(examples.counter[key]);
run();
