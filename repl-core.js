/* Browser REPL runtime and expression boundaries. MIT License — Craig Johnson. */
(function(root, factory) {
 const api=factory();
 if(typeof module==='object' && module.exports) module.exports=api;
 else root.FiddleRepl=api;
})(typeof globalThis!=='undefined'?globalThis:this, function() {
 'use strict';
 // Locate complete top-level reader forms; evaluation remains Scittle's job.
 function expressionAt(source, cursor) {
  let i=0;
  const white=c=>c!==undefined && /[\s,]/.test(c);
  function skip() {while(i<source.length){if(white(source[i]))i++;else if(source[i]===';'){while(i<source.length&&source[i]!=='\n')i++;}else break;}}
  function form() {
   skip();const start=i;if(i>=source.length)return;
   const c=source[i++];
   if(c==='"') {while(i<source.length){const ch=source[i++];if(ch==='\\')i++;else if(ch==='"')break;}return;}
   if(c==='\\'){if(i<source.length)i++;while(i<source.length&&!/[\s,\[\](){}";]/.test(source[i]))i++;return;}
   if('([{'.includes(c)) {
    const close={'(':')','[':']','{':'}'}[c];
    while(i<source.length){skip();if(source[i]===close){i++;return;}if(')]}'.includes(source[i]||' ')){i++;return;}const before=i;form();if(i===before)break;}return;
   }
   if(c==='\''||c==='`'||c==='@'){form();return;}
   if(c==='~'){if(source[i]==='@')i++;form();return;}
   if(c==='^'){form();form();return;}
   if(c==='#') {
    if(source[i]==='"'||source[i]==='{'||source[i]==='('){form();return;}
    if(source[i]==='_'||source[i]==='\''){i++;form();return;}
    if(source[i]==='?'){i++;if(source[i]==='@')i++;form();return;}
    if(source[i]==='#'){i++;while(i<source.length&&!/[\s,\[\](){}";]/.test(source[i]))i++;return;}
    // Tagged values and namespaced maps include the following value.
    while(i<source.length&&!/[\s,\[\](){}";]/.test(source[i]))i++;
    form();return;
   }
   while(i<source.length&&!/[\s,\[\](){}";]/.test(source[i]))i++;
   if(i===start)i++;
  }
  const ranges=[];
  while(i<source.length){skip();if(i>=source.length)break;const start=i;form();ranges.push({start,end:Math.min(i,source.length)});}
  return ranges.find(r=>r.start<=cursor&&cursor<r.end) || ranges.find(r=>r.end===cursor) || ranges.find(r=>r.start>cursor) || null;
 }
 // Runs inside a dedicated sandboxed iframe. Keep its SCI context across requests.
 function runner(channel) {
  let activeId=null;
  const send=(kind,values=[],id=activeId)=>parent.postMessage({channel,kind,values,id},'*');
  const stringify=value=>{try{return typeof value==='string'?value:JSON.stringify(value)??String(value);}catch{return String(value);}};
  for(const kind of ['log','info','warn','error'])console[kind]=(...args)=>send(kind,args.map(stringify));
  window.__replPrint=(...args)=>send('log',args.map(String));
  window.__replError=(...args)=>send('error',args.map(String));
  window.addEventListener('error',e=>send('error',[e.message]));
  window.addEventListener('unhandledrejection',e=>send('error',[String(e.reason)]));
  scittle.core.disable_auto_eval();
  const evaluate=scittle.core.eval_string;
  evaluate('(set! *print-fn* js/__replPrint) (set! *print-err-fn* js/__replError)');
  window.addEventListener('message',e=>{
   if(e.source!==parent || e.data?.channel!==channel || e.data.kind!=='eval' || typeof e.data.code!=='string')return;
   activeId=e.data.id;
   try {
    window.__replValue=evaluate(e.data.code);
    send('result',[evaluate('(pr-str js/__replValue)')]);
   } catch(error){send('error',[error.message||String(error)]);}
   finally {
    let ns='user';try{ns=evaluate('(str (ns-name *ns*))');}catch{}
    send('done',[ns]);activeId=null;
   }
  });
  send('ready',[],null);
 }
 class Session {
  constructor({loadSource,onMessage}) {this.loadSource=loadSource;this.onMessage=onMessage;this.frame=null;this.readyPromise=null;this.pending=new Map();this.generation=0;this.channel='';this.listener=e=>this.receive(e);window.addEventListener('message',this.listener);}
  receive(e) {
   if(!this.frame || e.source!==this.frame.contentWindow || e.data?.channel!==this.channel)return;
   const data=e.data;
   if(data.kind==='ready'){clearTimeout(this.timer);this.resolveReady?.();this.resolveReady=null;this.rejectReady=null;return;}
   if(!['log','info','warn','error','result','done'].includes(data.kind))return;
   this.onMessage(data);
   if(data.kind==='done'){this.pending.get(data.id)?.resolve();this.pending.delete(data.id);}
  }
  ready() {
   if(this.readyPromise)return this.readyPromise;
   const generation=this.generation;
   this.readyPromise=new Promise((resolve,reject)=>{
    this.resolveReady=resolve;this.rejectReady=reject;
    this.timer=setTimeout(()=>{if(generation===this.generation){this.reset(new Error('REPL runtime did not respond. Restart the session to try again.'));}},15000);
    this.loadSource().then(source=>{
     if(generation!==this.generation)return;
     const frame=document.createElement('iframe');frame.hidden=true;frame.title='REPL execution environment';frame.setAttribute('sandbox','allow-scripts');
     this.frame=frame;this.channel=crypto.randomUUID();
     const script=source+'\n;('+runner.toString()+')('+JSON.stringify(this.channel)+');';
     frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"></head><body><script>'+script.replace(/<\/script/gi,'<\\/script')+'<\/script></body></html>';
     document.body.append(frame);
    }).catch(error=>{if(generation===this.generation){this.reset(error);}});
   });
   return this.readyPromise;
  }
  async evaluate(code,id) {
   const generation=this.generation;await this.ready();
   if(generation!==this.generation)throw new Error('Session restarted.');
   return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.frame.contentWindow.postMessage({channel:this.channel,kind:'eval',code,id},'*');});
  }
  reset(reason=new Error('Session restarted.')) {
   this.generation++;clearTimeout(this.timer);
   this.rejectReady?.(reason);this.resolveReady=null;this.rejectReady=null;
   for(const request of this.pending.values())request.reject(reason);
   this.pending.clear();this.frame?.remove();this.frame=null;this.readyPromise=null;
  }
 }
 return {expressionAt,runner,Session};
});
