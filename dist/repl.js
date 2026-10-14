'use strict';
(() => {
 const byId=id=>document.getElementById(id);
 const starter=`;; Run the whole file: Ctrl/Cmd + Enter
;; Run selection or top-level form: Alt/Option + Enter

(def scores [72 88 95 61 84])

(defn average [numbers]
  (/ (reduce + numbers) (count numbers)))

(println "Scores:" scores)
(average scores)

;; Try (average [10 20 30]) in the terminal.
`;
 const editor=CodeMirror.fromTextArea(byId('repl-code'),{value:starter,mode:'clojure',lineNumbers:true,lineWrapping:true,tabSize:2,indentUnit:2,extraKeys:{'Ctrl-Enter':runFile,'Cmd-Enter':runFile,'Alt-Enter':runExpression}});
 editor.setValue(starter);ClojureEditing.install(editor,CodeMirror);ClojureStructure.install(editor);
 const prompt=byId('repl-input'),terminal=byId('terminal-output');
 let mode='fiddle',queue=Promise.resolve(),generation=0,sequence=0,rowCount=0,namespace='user';
 const groups=new Map(),history=[];let historyIndex=0,draft='';
 const session=new FiddleRepl.Session({loadSource:loadRuntime,onMessage:message=>{
  if(message.kind==='done'){namespace=String(message.values[0]||'user');byId('repl-prompt').textContent=namespace+'=>';return;}
  write(message.kind,(message.values||[]).map(String).join(' '),groups.get(message.id));
 }});
 function write(kind,text,parent=terminal) {
  if(rowCount>=1000)return;
  const row=document.createElement('div');row.className='terminal-line '+kind;row.textContent=String(text).slice(0,20000);(parent||terminal).append(row);rowCount++;
  terminal.scrollTop=terminal.scrollHeight;
 }
 function setStatus(text){byId('repl-status').textContent=text;}
 function evaluate(code,label) {
  if(!code.trim())return;
  const epoch=generation,id=++sequence;
  const group=document.createElement('div');group.className='terminal-entry';terminal.append(group);groups.set(id,group);
  write('command',`${namespace}=> ${label==='file'?'[Run file]\n':''}${code}`,group);
  // Retain a bounded transcript and drop references to old request groups.
  while(groups.size>100){const key=groups.keys().next().value;const old=groups.get(key);rowCount-=old.childElementCount;old.remove();groups.delete(key);}
  setStatus('Queued');
  queue=queue.then(async()=>{
   if(epoch!==generation)return;
   setStatus('Evaluating…');
   try{await session.evaluate(code,id);}catch(error){if(epoch===generation)write('error',error.message,groups.get(id));}
   if(epoch===generation)setStatus('Ready');
  });
 }
 function runFile(){evaluate(editor.getValue(),'file');}
 function runExpression(){
  if(editor.somethingSelected()){evaluate(editor.getSelection(),'expression');return;}
  const source=editor.getValue(),cursor=editor.indexFromPos(editor.getCursor());
  const range=FiddleRepl.expressionAt(source,cursor);
  if(!range){write('info','Place the cursor in an expression or select some code.');return;}
  evaluate(source.slice(range.start,range.end),'expression');
 }
 function submit(){
  const code=prompt.value;if(!code.trim())return;
  if(history.at(-1)!==code)history.push(code);if(history.length>100)history.shift();
  historyIndex=history.length;draft='';prompt.value='';resizePrompt();evaluate(code,'prompt');
 }
 function resizePrompt(){prompt.style.height='auto';prompt.style.height=Math.min(prompt.scrollHeight,160)+'px';}
 function restart(){
  generation++;queue=Promise.resolve();session.reset();namespace='user';byId('repl-prompt').textContent='user=>';setStatus('Ready');write('info','Session restarted. Definitions cleared.');
 }
 function switchMode(next) {
  if(next===mode)return;
  document.dispatchEvent(new Event('restore-pane'));
  mode=next;document.body.classList.toggle('repl-mode',mode==='repl');
  byId('workspace').hidden=mode==='repl';byId('repl-workspace').hidden=mode!=='repl';
  byId('fiddle-tools').hidden=mode==='repl';
  byId('mode-fiddle').setAttribute('aria-pressed',String(mode==='fiddle'));
  byId('mode-repl').setAttribute('aria-pressed',String(mode==='repl'));
  byId('run-label').textContent=mode==='repl'?'Run file':'Run';
  byId('run').title=mode==='repl'?'Evaluate the REPL file (Ctrl/Cmd+Enter)':'Run fiddle (Ctrl/Cmd+Enter)';
  requestAnimationFrame(()=>{
   if(mode==='repl'){editor.refresh();editor.focus();}
   else {Object.values(editors).forEach(cm=>cm.refresh());byId('workspace').dispatchEvent(new Event('pane-layout-change'));}
  });
 }
 byId('mode-fiddle').addEventListener('click',()=>switchMode('fiddle'));
 byId('mode-repl').addEventListener('click',()=>switchMode('repl'));
 byId('eval-expression').addEventListener('mousedown',event=>event.preventDefault());
 byId('eval-expression').addEventListener('click',runExpression);
 byId('repl-send').addEventListener('click',()=>{submit();prompt.focus();});
 byId('repl-restart').addEventListener('click',restart);
 byId('repl-clear').addEventListener('click',()=>{terminal.replaceChildren();groups.clear();rowCount=0;});
 prompt.addEventListener('input',resizePrompt);
 prompt.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();submit();}
  else if(event.key==='ArrowUp'&&prompt.selectionStart===0&&prompt.selectionEnd===0&&historyIndex>0){event.preventDefault();if(historyIndex===history.length)draft=prompt.value;prompt.value=history[--historyIndex];resizePrompt();prompt.setSelectionRange(0,0);}
  else if(event.key==='ArrowDown'&&prompt.selectionStart===prompt.value.length&&historyIndex<history.length){event.preventDefault();prompt.value=++historyIndex===history.length?draft:history[historyIndex];resizePrompt();prompt.setSelectionRange(prompt.value.length,prompt.value.length);}
 });
 editor.on('cursorActivity',()=>{const c=editor.getCursor();byId('repl-cursor').textContent=`Ln ${c.line+1}, Col ${c.ch+1}`;});
 const observer=new ResizeObserver(()=>editor.refresh());observer.observe(byId('repl-workspace'));
 window.ReplUI={isActive:()=>mode==='repl',runFile,runExpression,refresh:()=>editor.refresh()};
 write('info','ClojureScript REPL · Definitions persist until Restart session.\nRun the file, evaluate an expression, or type at the prompt below.');
})();
