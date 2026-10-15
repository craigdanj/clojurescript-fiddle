/* Standalone Fiddle pages. MIT License — Craig Johnson. */
(function(root,factory) {
 const api=factory();
 if(typeof module==='object' && module.exports) module.exports=api;
 else root.FiddleHTML=api;
})(typeof globalThis!=='undefined'?globalThis:this,function() {
 'use strict';
 // Embed text as JS data so HTML/CSS/Clojure strings cannot terminate scripts,
 // including mixed-case end tags or the HTML parser's script escape sequences.
 const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function boot(data) {
  const showError=error=>{
   console.error(error);
   // Visible diagnostics only on failure; normal pages have no playground UI.
   let box=document.getElementById('fiddle-export-error');
   if(!box) {
    box=document.createElement('pre');box.id='fiddle-export-error';box.setAttribute('role','alert');
    box.style.cssText='position:fixed;z-index:2147483647;bottom:12px;left:12px;right:12px;max-height:35vh;overflow:auto;margin:0;padding:16px;border:1px solid #ffaaaa;border-radius:6px;background:#191b22;color:#ffcccc;white-space:pre-wrap;font:13px/1.6 monospace;';
    document.body.append(box);
   }
   box.textContent='ClojureScript error: '+String(error?.message||error).slice(0,20000);
  };
  window.addEventListener('error',event=>showError(event.error||event.message));
  window.addEventListener('unhandledrejection',event=>showError(event.reason));
  try {
   const runtime=document.createElement('script');runtime.textContent=data.runtime;document.head.append(runtime);
   scittle.core.disable_auto_eval();
   document.getElementById('fiddle-style').textContent=data.css;
   document.getElementById('fiddle-root').innerHTML=data.html;
   window.__fiddlePrint=(...args)=>console.log(...args);
   window.__fiddleError=(...args)=>console.error(...args);
   scittle.core.eval_string('(set! *print-fn* js/__fiddlePrint) (set! *print-err-fn* js/__fiddleError)');
   window.__fiddleResult=scittle.core.eval_string(data.cljs);
  } catch(error) {showError(error);}
 }
 function build({name,html,css,cljs,runtime,license}) {
  if([name,html,css,cljs,runtime,license].some(value=>typeof value!=='string')) throw Error('HTML export requires the Fiddle source and bundled runtime.');
  if(!runtime.trim()||!license.trim()) throw Error('Could not load the bundled runtime or its license. Try downloading again.');
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>'+escape(name)+'</title>\n<style id="fiddle-style"></style>\n</head>\n<body>\n<div id="fiddle-root"></div>\n'+
   '<script type="application/json" id="fiddle-runtime-license">'+json({runtime:'Scittle 0.8.33 / SCI',license:'EPL-1.0',source:'https://github.com/babashka/scittle',text:license})+'</script>\n'+
   '<script>\n('+boot.toString()+')('+json({html,css,cljs,runtime})+');\n</script>\n</body>\n</html>\n';
 }
 return {build};
});
