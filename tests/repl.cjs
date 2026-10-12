'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {expressionAt,runner,Session}=require('../dist/repl-core.js');
const runtime=fs.readFileSync(require.resolve('../dist/vendor/scittle.js'),'utf8');
function runtimeHarness(){
 const listeners={},messages=[];
 const parent={postMessage:m=>messages.push(m)};
 const ctx={console:{},document:{querySelectorAll:()=>[],addEventListener:()=>{}},setTimeout,clearTimeout,parent,addEventListener:(k,f)=>(listeners[k]??=[]).push(f)};
 ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(runtime,ctx);vm.runInContext(`(${runner.toString()})('test-channel')`,ctx);
 let id=0;
 return {messages,ctx,execute(code,channel='test-channel',source=parent){const from=messages.length;for(const fn of listeners.message)fn({source,data:{channel,kind:'eval',code,id:++id}});return messages.slice(from);}};
}
const result=events=>events.find(e=>e.kind==='result')?.values[0];
test('persistent definitions, file output, expression results, errors and namespaces',()=>{
 const h=runtimeHarness();assert.equal(h.messages[0].kind,'ready');
 assert.equal(result(h.execute('(def scores [10 20 30])\n(defn average [xs] (/ (reduce + xs) (count xs)))\n(println "Loaded")\n(average scores)')),'20');
 assert.equal(result(h.execute('(average [30 60])')),'45');
 assert(h.messages.some(e=>e.kind==='log'&&e.values.join('').includes('Loaded')));
 assert(h.execute('(throw (js/Error. "bad expression"))').some(e=>e.kind==='error'));
 assert.equal(result(h.execute('(+ 3 4)')),'7');
 assert.equal(result(h.execute('(def clicks (atom 0)) (swap! clicks inc)')),'1');
 assert.equal(result(h.execute('(swap! clicks inc)')),'2');
 assert.equal(result(h.execute('(ns experiment) (def answer 42) answer')),'42');
 assert.equal(result(h.execute('answer')),'42');
 assert.equal(h.messages.at(-1).values[0],'experiment');
 assert.equal(h.execute('(+ 1 2)','wrong').length,0);assert.equal(h.execute('(+ 1 2)','test-channel',{}).length,0);
 const fresh=runtimeHarness();assert(fresh.execute('scores').some(e=>e.kind==='error'));
});
test('top-level reader forms and cursor boundaries',()=>{
 const cases=[['(def x 1)\n(+ x 2)',3,'(def x 1)'],['(def x 1)\n(+ x 2)',15,'(+ x 2)'],['42 :key true',1,'42'],['\'(1 2)\n3',3,"'(1 2)"],['^:private (def x 1)',14,'^:private (def x 1)'],['#{1 2} #(+ % 1)',3,'#{1 2}'],['#{1 2} #(+ % 1)',11,'#(+ % 1)'],['#"[()]" 7',4,'#"[()]"'],['(str "a ) b" \\))',8,'(str "a ) b" \\))'],['; comment\n(+ 1 2)',0,'(+ 1 2)'],['#inst "2020-01-01"',10,'#inst "2020-01-01"'],['(a)(b)',3,'(b)'],['#_ (bad)\n(ok)',4,'#_ (bad)'],['(+ 1',3,'(+ 1']];
 for(const [source,cursor,expected] of cases){const range=expressionAt(source,cursor);assert.equal(source.slice(range.start,range.end),expected,source);}
 assert.equal(expressionAt('; comments only',4),null);
});
test('session loads once, authenticates results, resets and rejects old requests',async()=>{
 const old={window:global.window,document:global.document,crypto:global.crypto};
 const listeners=[];let frames=[],loads=0;const output=[];
 global.window={addEventListener:(_,fn)=>listeners.push(fn)};
 const deliver=(frame,data)=>listeners.forEach(fn=>fn({source:frame.contentWindow,data}));
 global.document={createElement:()=>({setAttribute(){},remove(){this.removed=true;},contentWindow:{postMessage(message){this.sent=message;}}}),body:{append(frame){frames.push(frame);queueMicrotask(()=>deliver(frame,{channel:session.channel,kind:'ready'}));}}};
 const session=new Session({loadSource:async()=>{loads++;return '';},onMessage:m=>output.push(m)});
 try{
  const first=session.evaluate('(+ 1 2)',1);await new Promise(r=>setImmediate(r));
  const frame=frames[0];assert.equal(frame.contentWindow.sent.code,'(+ 1 2)');
  deliver(frame,{channel:'wrong',kind:'result',values:['wrong'],id:1});assert.equal(output.length,0);
  deliver(frame,{channel:session.channel,kind:'result',values:['3'],id:1});deliver(frame,{channel:session.channel,kind:'done',values:['user'],id:1});await first;
  const pending=session.evaluate('(def x 1)',2);await new Promise(r=>setImmediate(r));const rejection=assert.rejects(pending,/restarted/);session.reset();await rejection;assert(frame.removed);
  deliver(frame,{channel:session.channel,kind:'result',values:['stale'],id:2});assert.equal(output.filter(m=>m.values[0]==='stale').length,0);
  const next=session.evaluate('(+ 2 3)',3);await new Promise(r=>setImmediate(r));assert.equal(loads,2);deliver(frames[1],{channel:session.channel,kind:'done',values:['user'],id:3});await next;
 }finally{session.reset();global.window=old.window;global.document=old.document;}
});
