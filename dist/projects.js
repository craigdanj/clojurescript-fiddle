'use strict';
(() => {
 const byId = id => document.getElementById(id);
 const menu = byId('project-menu'), name = byId('project-name'), picker = byId('project-file');
 const message = byId('project-message'), undo = byId('project-undo'), importButton = byId('project-import');
 const controller = FiddleProjects.controller({
  readWorkspace:() => ({
   format:FiddleProjects.FORMAT,version:FiddleProjects.VERSION,
   name:name.value.trim() || 'Untitled project',mode:window.ReplUI.isActive() ? 'repl' : 'fiddle',
   files:{'index.html':editors.html.getValue(),'style.css':editors.css.getValue(),'main.cljs':editors.cljs.getValue(),'repl.cljs':window.ReplUI.getCode()}
  }),
  writeWorkspace:project => {
   document.dispatchEvent(new Event('restore-pane'));
   clearPreview(); clearConsole(); byId('console-panel').open = false;
   for (const [editor,file] of [['html','index.html'],['css','style.css'],['cljs','main.cljs']]) {
    editors[editor].setValue(project.files[file]); editors[editor].clearHistory();
   }
   window.ReplUI.loadCode(project.files['repl.cljs']);
   name.value = project.name;
   window.ReplUI.switchMode(project.mode);
   const empty = document.createElement('div'); empty.className = 'preview-empty';
   const title = document.createElement('strong'); title.textContent = 'Project ready';
   const help = document.createElement('p'); help.textContent = 'Press Run to evaluate the imported code.';
   empty.append(title,help);byId('preview').replaceChildren(empty);
   status('Ready to run');
   requestAnimationFrame(() => {Object.values(editors).forEach(editor => editor.refresh());window.ReplUI.refresh();});
  }
 });
 function report(text,error = false) {message.textContent = text;message.dataset.error = String(error);}
 function downloadFile(file,type) {
  const blob=new Blob([file.text],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=file.filename;document.body.append(link);
  try {link.click();} finally {link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 }
 byId('project-export').addEventListener('click',() => {
  try {
   const file = controller.download();
   downloadFile(file,'application/json;charset=utf-8');
   report('JSON export started: '+file.filename);
  } catch (error) {report(error.message,true);}
 });
 const htmlButton=byId('project-download');let downloadingHTML=false;
 function updateHTMLControl() {
  htmlButton.disabled=downloadingHTML||window.ReplUI.isActive();
  byId('project-html-hint').textContent=window.ReplUI.isActive()?'Switch to Fiddle to download a runnable HTML page.':'Download runnable HTML includes the Fiddle page, styles, code, and runtime.';
 }
 document.addEventListener('editor-mode-change',updateHTMLControl);
 menu.addEventListener('toggle',updateHTMLControl);updateHTMLControl();
 htmlButton.addEventListener('click',async()=>{
  if(downloadingHTML||window.ReplUI.isActive())return;
  // Capture at the click, before awaiting the runtime. Export never runs code.
  const snapshot={name:name.value.trim()||'Untitled project',html:editors.html.getValue(),css:editors.css.getValue(),cljs:editors.cljs.getValue()};
  downloadingHTML=true;updateHTMLControl();report('Preparing runnable HTML…');
  try {
   const [runtime,license]=await Promise.all([loadRuntime(),fetch('vendor/SCITTLE-LICENSE').then(response=>{if(!response.ok)throw Error('Could not load the runtime license. Try again.');return response.text();})]);
   const text=FiddleHTML.build({...snapshot,runtime,license});
   const filename=FiddleProjects.filename(snapshot.name).replace(/\.cljsfiddle\.json$/,'.html');
   downloadFile({filename,text},'text/html;charset=utf-8');
   report('HTML download started: '+filename+'. Open it directly in your browser.');
  } catch(error) {report(error.message,true);}
  finally {downloadingHTML=false;updateHTMLControl();}
 });
 importButton.addEventListener('click',() => {picker.value = '';picker.click();});
 let request = 0;
 picker.addEventListener('change',async () => {
  const file = picker.files?.[0];if (!file) return;
  const current = ++request;importButton.disabled = true;report('Reading project…');
  try {
   if (file.size > FiddleProjects.MAX_BYTES) throw Error('Projects must be 5 MB or smaller.');
   const text = await file.text();
   if (current !== request) return;
   const project = controller.import(text);
   undo.hidden = false;
   report('Imported “'+project.name+'”. Both modes are ready; press Run to evaluate. Undo import restores your previous code.');
  } catch (error) {if (current === request) report(error.message,true);}
  finally {if (current === request) {importButton.disabled = false;picker.value = '';}}
 });
 undo.addEventListener('click',() => {
  if (controller.undo()) {undo.hidden = true;report('Previous code and mode restored. Press Run to evaluate.');}
 });
 menu.addEventListener('keydown',event => {
  if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();menu.open = false;menu.querySelector('summary').focus();}
 });
 document.addEventListener('pointerdown',event => {if (menu.open && !menu.contains(event.target)) menu.open = false;});
})();
