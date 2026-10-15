/* Portable project documents. MIT License — Craig Johnson. */
(function(root,factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.FiddleProjects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this,function() {
 'use strict';
 const FORMAT = 'clojurescript-fiddle', VERSION = 1, MAX_BYTES = 5 * 1024 * 1024;
 const files = ['index.html','style.css','main.cljs','repl.cljs'];
 const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
 function validate(value) {
  if (!object(value) || value.format !== FORMAT) throw Error('Choose a project downloaded from ClojureScript Fiddle (.cljsfiddle.json).');
  if (value.version !== VERSION) throw Error('This project version is not supported. Expected version 1.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 || /[\u0000-\u001f\u007f]/.test(value.name)) throw Error('Project name must be 1–120 characters without control characters.');
  if (!['fiddle','repl'].includes(value.mode)) throw Error('Project mode must be fiddle or repl.');
  if (!object(value.files) || files.some(key => !Object.prototype.hasOwnProperty.call(value.files,key) || typeof value.files[key] !== 'string')) throw Error('Project must contain text for index.html, style.css, main.cljs, and repl.cljs.');
  // Pick known fields, never merge arbitrary file data into app configuration.
  return {format:FORMAT,version:VERSION,name:value.name.trim(),mode:value.mode,files:Object.fromEntries(files.map(key => [key,value.files[key]]))};
 }
 function checkSize(text) {
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw Error('Projects must be 5 MB or smaller.');
 }
 function parse(text) {
  if (typeof text !== 'string') throw Error('Could not read the project as text.');
  checkSize(text);
  let data;
  try {data = JSON.parse(text.replace(/^\uFEFF/,''));} catch {throw Error('This file is not valid project JSON. Your current code is unchanged.');}
  return validate(data);
 }
 function serialize(value) {
  const text = JSON.stringify(validate(value),null,2)+'\n'; checkSize(text); return text;
 }
 function filename(name) {
  const base = name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64) || 'project';
  return base.toLowerCase()+'.cljsfiddle.json';
 }
 function controller({readWorkspace,writeWorkspace}) {
  let previous = null;
  return {
   download() {const project = validate(readWorkspace());return {filename:filename(project.name),text:serialize(project)};},
   import(text) {
    const project = parse(text), before = validate(readWorkspace());
    writeWorkspace(project); previous = before; return project;
   },
   canUndo:() => previous !== null,
   undo() {if (!previous) return false;writeWorkspace(previous);previous = null;return true;}
  };
 }
 return {FORMAT,VERSION,MAX_BYTES,validate,parse,serialize,filename,controller};
});
