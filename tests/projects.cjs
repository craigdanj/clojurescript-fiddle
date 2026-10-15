'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Projects = require('../dist/project-files.js');
const sample = (mode = 'fiddle') => ({format:Projects.FORMAT,version:1,name:'My λ project',mode,files:{'index.html':'<h1>नमस्ते 👋</h1>','style.css':'body { color: red; }','main.cljs':'(println "a \\"b\\" ")\n','repl.cljs':'(def x 42)\n(+ x 1)'}});
test('project documents round-trip both modes and all four buffers, including empty code and Unicode',() => {
 for (const mode of ['fiddle','repl']) {
  const data = sample(mode);
  assert.deepEqual(Projects.parse(Projects.serialize(data)),data);
  for (const key of Object.keys(data.files)) data.files[key] = '';
  assert.deepEqual(Projects.parse('\uFEFF'+Projects.serialize(data)),data);
 }
 assert.equal(Projects.filename('../../My project / 💚'),'my-project.cljsfiddle.json');
 assert.equal(Projects.filename('λ'),'project.cljsfiddle.json');
});
test('invalid or oversized projects fail before any workspace mutation',() => {
 let writes = 0;
 const controller = Projects.controller({readWorkspace:sample,writeWorkspace:() => writes++});
 const bad = [null,[],{}, {...sample(),version:2}, {...sample(),mode:'unknown'}, {...sample(),name:'x\n'}, {...sample(),name:'x'.repeat(121)}, {...sample(),files:{'main.cljs':'x'}}, {...sample(),files:{...sample().files,'repl.cljs':23}}];
 for (const data of bad) assert.throws(() => controller.import(JSON.stringify(data)));
 assert.throws(() => controller.import('{bad json'),/JSON/);
 assert.throws(() => controller.import(' '.repeat(Projects.MAX_BYTES + 1)),/5 MB/);
 assert.throws(() => Projects.serialize({...sample(),files:{...sample().files,'main.cljs':'λ'.repeat(Projects.MAX_BYTES/2)}}),/5 MB/);
 assert.equal(writes,0);assert.equal(controller.canUndo(),false);
});
test('only known fields are imported; strings remain inert text',() => {
 const data = sample();data.files['index.html'] = '<script>globalThis.executed=true</script>';
 const parsed = Projects.parse(JSON.stringify({...data,unexpected:true,files:{...data.files,'../../evil':'x'}}).replace('"version":1','"__proto__":{"polluted":true},"version":1'));
 assert.deepEqual(parsed,data);assert.equal({}.polluted,undefined);assert.equal(globalThis.executed,undefined);
});
test('import and undo preserve both modes, and failed imports retain the previous backup',() => {
 let workspace = sample('repl');let writes = 0;
 const before = structuredClone(workspace);
 const controller = Projects.controller({readWorkspace:() => workspace,writeWorkspace:value => {writes++;workspace=structuredClone(value);}});
 const incoming = sample();incoming.name = 'Imported';incoming.files['repl.cljs'] = '';
 const download = controller.download();assert.deepEqual(Projects.parse(download.text),before);
 controller.import(Projects.serialize(incoming));assert.deepEqual(workspace,incoming);assert(controller.canUndo());
 assert.throws(() => controller.import('{}'));assert.deepEqual(workspace,incoming);
 assert(controller.undo());assert.deepEqual(workspace,before);assert.equal(writes,2);assert.equal(controller.canUndo(),false);
 assert.equal(controller.undo(),false);
});
test('project controls download, import, reject bad files, and undo without evaluating',async () => {
 const vm = require('node:vm'), fs = require('node:fs');
 class Element extends EventTarget {
  constructor() {super();this.value='';this.textContent='';this.dataset={};this.children=[];this.hidden=false;this.files=[];}
  append(...children) {this.children.push(...children);}
  replaceChildren(...children) {this.children=children;}
  remove(){} focus(){} click() {this.dispatchEvent(new Event('click'));}
  contains(node) {return this===node||this.children.includes(node);}
  querySelector() {return new Element();}
 }
 const nodes = new Map(), created = [], revoked = [], blobs = [];
 const get = id => {if (!nodes.has(id)) nodes.set(id,new Element());return nodes.get(id);};
 const document = new Element();document.getElementById=get;document.body=new Element();
 document.createElement=tag => {const element=new Element();element.tag=tag;created.push(element);return element;};
 const current=sample('repl'), calls={preview:0,console:0,repl:0};
 const editors=Object.fromEntries([['html','index.html'],['css','style.css'],['cljs','main.cljs']].map(([key,file]) => [key,{value:current.files[file],getValue(){return this.value;},setValue(value){this.value=value;},clearHistory(){},refresh(){}}]));
 let mode='repl',repl=current.files['repl.cljs'];
 const ReplUI={isActive:()=>mode==='repl',getCode:()=>repl,loadCode:value=>{repl=value;calls.repl++;},switchMode:value=>mode=value,refresh(){}};
 let resolveRuntime,failRuntime=false;
 const context={document,window:{ReplUI},editors,FiddleProjects:Projects,FiddleHTML:require('../dist/standalone-html.js'),loadRuntime:()=>failRuntime?Promise.reject(Error('Runtime unavailable')):new Promise(resolve=>resolveRuntime=resolve),fetch:async()=>({ok:true,text:async()=>'EPL test license'}),Event,Blob,URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:test';},revokeObjectURL:url=>revoked.push(url)},setTimeout:fn=>fn(),requestAnimationFrame:fn=>fn(),clearPreview:()=>calls.preview++,clearConsole:()=>calls.console++,status() {}};
 get('project-name').value=current.name;
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/projects.js'),'utf8'),context);
 get('project-export').click();
 assert.deepEqual(Projects.parse(await blobs[0].text()),current);
 assert.equal(created.find(e=>e.tag==='a').download,Projects.filename(current.name));assert.deepEqual(revoked,['blob:test']);
 assert.equal(get('project-download').disabled,true);get('project-download').click();assert.equal(blobs.length,1);
 const imported=sample('fiddle');imported.name='Reopened';imported.files['main.cljs']='(println "imported")';
 async function upload(text,size=text.length) {
  get('project-file').files=[{size,text:async()=>text}];
  get('project-file').dispatchEvent(new Event('change'));
  await new Promise(resolve=>setImmediate(resolve));
 }
 await upload(Projects.serialize(imported));
 assert.equal(mode,'fiddle');assert.equal(editors.cljs.value,imported.files['main.cljs']);assert.equal(get('project-name').value,'Reopened');
 assert.equal(get('project-undo').hidden,false);assert.equal(get('project-file').value,'');assert.equal(get('project-import').disabled,false);
 assert.deepEqual(calls,{preview:1,console:1,repl:1});
 document.dispatchEvent(new Event('editor-mode-change'));assert.equal(get('project-download').disabled,false);
 get('project-download').click();assert.equal(get('project-download').disabled,true);
 editors.cljs.value='Changed while preparing download';resolveRuntime('/* bundled runtime */');
 await new Promise(resolve=>setImmediate(resolve));
 const html=await blobs[1].text();assert.equal(blobs[1].type,'text/html;charset=utf-8');
 assert(html.includes(JSON.stringify(imported.files['main.cljs'])));assert(!html.includes('Changed while preparing download'));
 assert.equal(created.filter(e=>e.tag==='a').at(-1).download,'reopened.html');assert.equal(get('project-download').disabled,false);
 failRuntime=true;get('project-download').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(blobs.length,2);assert.equal(get('project-download').disabled,false);assert.match(get('project-message').textContent,/Runtime unavailable/);
 assert.deepEqual(calls,{preview:1,console:1,repl:1});
 await upload('{}');assert.equal(get('project-message').dataset.error,'true');assert.equal(calls.repl,1);
 await upload('',Projects.MAX_BYTES+1);assert.equal(calls.repl,1);assert.match(get('project-message').textContent,/5 MB/);
 get('project-undo').click();assert.equal(mode,'repl');assert.equal(repl,current.files['repl.cljs']);assert.equal(editors.cljs.value,current.files['main.cljs']);assert.equal(get('project-name').value,current.name);
 assert.equal(get('project-undo').hidden,true);
});
