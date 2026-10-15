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
 byId('project-download').addEventListener('click',() => {
  try {
   const file = controller.download();
   const blob = new Blob([file.text],{type:'application/json;charset=utf-8'});
   const url = URL.createObjectURL(blob), link = document.createElement('a');
   link.href = url;link.download = file.filename;document.body.append(link);
   try {link.click();} finally {link.remove();setTimeout(() => URL.revokeObjectURL(url),1000);}
   report('Download started: '+file.filename);
  } catch (error) {report(error.message,true);}
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
