/* ClojureScript editor helpers. MIT License — Craig Johnson. */
(function(root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.ClojureEditing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
 'use strict';
 // Balanced collection ranges, ignoring delimiters inside strings, comments,
 // regex literals and character literals. This is not a full Clojure reader.
 function collectionRanges(source) {
  const stack = [], ranges = [];
  const closing = {')':'(', ']':'[', '}':'{'};
  for (let i = 0; i < source.length; i++) {
   const ch = source[i];
   if (ch === ';') { while (i < source.length && source[i] !== '\n') i++; continue; }
   if (ch === '"') {
    for (i++; i < source.length; i++) {
     if (source[i] === '\\') i++;
     else if (source[i] === '"') break;
    }
    continue;
   }
   if (ch === '\\') {
    i++; // The first character may itself be a delimiter, e.g. \).
    while (i + 1 < source.length && !/[\s,\[\](){}";]/.test(source[i + 1])) i++;
    continue;
   }
   if ('([{'.includes(ch)) {
    const start = i > 0 && source[i - 1] === '#' && (ch === '{' || ch === '(') ? i - 1 : i;
    stack.push({ch, start});
   } else if (closing[ch]) {
    const opening = stack.pop();
    if (opening && opening.ch === closing[ch]) ranges.push({start: opening.start, end: i + 1});
    else stack.length = 0;
   }
  }
  return ranges.sort((a,b) => (a.end-a.start)-(b.end-b.start));
 }
 function enclosingRange(source, from, to) {
  const candidates = collectionRanges(source).filter(r => r.start <= from && r.end >= to && (r.start < from || r.end > to));
  // At an adjacent collection boundary, prefer the collection beginning here.
  if (from === to) return candidates.find(r => r.start === from) || candidates.find(r => r.end > from) || candidates[0] || null;
  return candidates[0] || null;
 }
 function install(cm, CodeMirror) {
  let history = [], expectedSelection = null;
  const selectionKey = () => JSON.stringify(cm.listSelections().map(r => [r.anchor.line, r.anchor.ch, r.head.line, r.head.ch]));
  function resetHistory() {
   // CodeMirror delivers cursorActivity at the end of the outer operation,
   // after a key handler returns. Compare positions instead of a temporary flag.
   if (selectionKey() !== expectedSelection) {history = [];expectedSelection = null;}
  }
  cm.on('change', () => {history = [];expectedSelection = null;});
  cm.on('cursorActivity', resetHistory);
  function select(range) {
   expectedSelection = JSON.stringify([[range.anchor.line, range.anchor.ch, range.head.line, range.head.ch]]);
   cm.setSelection(range.anchor, range.head);
   cm.scrollIntoView(range.head, 24);
  }
  function expand() {
   if (cm.listSelections().length !== 1) return;
   const range = enclosingRange(cm.getValue(), cm.indexFromPos(cm.getCursor('from')), cm.indexFromPos(cm.getCursor('to')));
   if (!range) return;
   const old = cm.listSelections()[0];
   history.push({anchor:{...old.anchor},head:{...old.head}});
   select({anchor:cm.posFromIndex(range.start),head:cm.posFromIndex(range.end)});
  }
  function shrink() {if (history.length) select(history.pop());}
  function reindent() {
   cm.operation(() => {
    if (cm.somethingSelected()) cm.indentSelection('smart');
    else for (let line = cm.firstLine(); line <= cm.lastLine(); line++) cm.indentLine(line, 'smart');
   });
  }
  cm.setOption('matchBrackets', true);
  cm.setOption('autoCloseBrackets', {pairs:'()[]{}""', explode:'()[]{}', override:true});
  cm.setOption('styleActiveLine', {nonEmpty:false});
  cm.addKeyMap({
   'Tab': editor => {
    const cursor=editor.getCursor();
    if (editor.somethingSelected() || /^\s*$/.test(editor.getLine(cursor.line).slice(0,cursor.ch))) editor.indentSelection('smart');
    else editor.execCommand('insertSoftTab');
   },
   'Shift-Tab': 'indentLess',
   'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
   'Shift-Ctrl-I': reindent, 'Shift-Cmd-I': reindent,
   'Alt-Up': expand, 'Alt-Down': shrink
  });
  return {expand, shrink, reindent};
 }
 return {collectionRanges, enclosingRange, install};
});
