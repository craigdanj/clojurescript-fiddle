'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {read,transform,install} = require('../dist/structural-editing.js');
function edit(marked,command) {
 const cursor = marked.indexOf('|'); assert(cursor >= 0);
 const source = marked.replace('|','');
 return transform(source,cursor,cursor,command);
}
test('slurp and barf in both directions preserve nested forms and reader prefixes',() => {
 const cases = [
  ['(a|) b','slurp-forward','(a b)'],
  ['a (b|)','slurp-backward','(a b)'],
  ['(a| b)','barf-forward','(a) b'],
  ['(a b|)','barf-backward','a (b)'],
  ['(|a)b','slurp-forward','(a b)'],
  ['a(b|)','slurp-backward','(a b)'],
  ['(|a)','barf-forward','() a'],
  ['(|a)','barf-backward','a ()'],
  ["'(|a)",'barf-backward',"a '()"],
  ['#{|a}','barf-backward','a #{}'],
  ['x(a b|)','barf-backward','x a (b)'],
  ['(a| b)c','barf-forward','(a) b c'],
  ['[a (b|) [c d]]','slurp-forward','[a (b [c d])]'],
  ["'(a|) ^:private [b]",'slurp-forward',"'(a ^:private [b])"],
  ["x '(a|)",'slurp-backward',"'(x a)"],
  ['#{a|} b','slurp-forward','#{a b}'],
  ['#(+ |%) x','slurp-forward','#(+ % x)'],
  ['(|a) #inst "2020-01-01"','slurp-forward','(a #inst "2020-01-01")'],
  ['(|a) #_ ignored b','slurp-forward','(a #_ ignored b)'],
  ['#{a| b}','barf-forward','#{a} b'],
  ['[a| "escaped \\\" )" #"[)]"]','barf-forward','[a "escaped \\\" )"] #"[)]"']
 ];
 for (const [source,command,expected] of cases) {
  const result = edit(source,command);
  assert.equal(result.source,expected,source+' '+command+' '+result.message);
  assert.doesNotThrow(() => read(result.source));
 }
});
test('comments and character literals cannot swallow moved delimiters',() => {
 const cases = [
  ['(a|) ; keep this\nb','slurp-forward','(a ; keep this\nb)'],
  ['a ; keep this\n(b|)','slurp-backward','(a ; keep this\nb)'],
  ['(a| ; keep this\n b)','barf-forward','(a ; keep this\n ) b'],
  ['(a| b ; tail\n)','barf-forward','(a) b ; tail\n'],
  ['(|\\)) b','slurp-forward','(\\) b)'],
  ['\\)(b|)','slurp-backward','(\\) b)']
 ];
 for (const [source,command,expected] of cases) assert.equal(edit(source,command).source,expected);
 for (const source of ['(a "st|ring") b','(a ; com|ment\n) b','(a \\new|line) b']) assert.equal(edit(source,'slurp-forward').changed,false);
});
test('maps move key/value pairs and protect arity in their parent',() => {
 for (const [source,command,expected] of [
  ['{:a |1} :b 2','slurp-forward','{:a 1 :b 2}'],
  [':a 1 {:b |2}','slurp-backward','{:a 1 :b 2}'],
  ['{:a |1 :b 2}','barf-forward','{:a 1} :b 2'],
  ['{:a 1 :b |2}','barf-backward',':a 1 {:b 2}'],
  ['#:user{:a |1} :b 2','slurp-forward','#:user{:a 1 :b 2}'],
  ['{:a |1} #_ ignored :b 2','slurp-forward','{:a 1 #_ ignored :b 2}']
 ]) assert.equal(edit(source,command).source,expected);
 for (const source of ['{:a |1} :b','{:a (|x) :b 2}']) assert.equal(edit(source,'slurp-forward').changed,false);
});
test('wrap whole forms and selections, preserve direction and cursor position',() => {
 assert.equal(edit('fo|o','wrap-list').source,'(foo)');
 assert.equal(edit('foo|','wrap-vector').head,4);
 assert.equal(edit("'fo|o",'wrap-vector').source,"['foo]");
 assert.equal(edit('(a| b)','wrap-vector').source,'([a] b)');
 assert.equal(edit('|(a b)','wrap-vector').source,'[(a b)]');
 for (const [a,h] of [[0,4],[4,0]]) {
  const result = transform(':a 1',a,h,'wrap-map');
  assert.equal(result.source,'{:a 1}');
  assert.equal(result.anchor,a+1);assert.equal(result.head,h+1);
 }
 assert.equal(transform('alpha beta',1,8,'wrap-list').changed,false);
 assert.equal(transform("'foo bar",1,4,'wrap-list').changed,false);
 assert.equal(transform('a b c',0,5,'wrap-map').changed,false);
 assert.equal(edit('fo|o','wrap-map').changed,false);
});
test('splice preserves boundaries; incomplete or ambiguous forms are unchanged',() => {
 assert.equal(edit('a(b| c)d','splice').source,'a b c d');
 assert.equal(edit('#{a| b}','splice').source,' a b ');
 for (const source of ['(a|] b','(a| b','(a| "unterminated','(a|) #=b','(a|) #_ #_ a b',"'(a|)"]) {
  assert.equal(edit(source,'splice').changed,false,source);
 }
 for (const source of ['#?(:cljs (a)| :clj (b))','(|a)']) assert.equal(edit(source,'slurp-forward').changed,false,source);
 assert.equal(edit('(|)','barf-forward').changed,false);
});
test('editor shortcuts group each command into one undo step and preserve selections',() => {
 let source = '(a) b c', anchor = 2, head = 2, maps = [], undos = [], operations = 0;
 const cm = {
  getValue:() => source, getOption:() => false,
  listSelections:() => [{anchor:{line:0,ch:anchor},head:{line:0,ch:head}}],
  indexFromPos:p => p.ch, posFromIndex:ch => ({line:0,ch}),
  getCursor:() => ({line:0,ch:head}), getWrapperElement:() => ({closest:() => null}),
  operation(fn) {operations++;undos.push({source,anchor,head});fn();},
  replaceRange(text,from,to,origin) {assert.equal(origin,'structural');source=source.slice(0,from.ch)+text+source.slice(to.ch);},
  setSelection(a,h) {anchor=a.ch;head=h.ch;},scrollIntoView(){},addKeyMap:map => maps.push(map)
 };
 const api = install(cm), keys = maps[0];
 keys['Ctrl-Alt-Right']();assert.equal(source,'(a b) c');
 keys['Cmd-Alt-Right']();assert.equal(source,'(a b c)');assert.equal(operations,2);
 ({source,anchor,head}=undos.pop());assert.equal(source,'(a b) c');
 ({source,anchor,head}=undos.pop());assert.equal(source,'(a) b c');assert.equal(head,2);
 assert(keys['Shift-Cmd-Alt-Right']);assert(keys['Ctrl-Alt-P']);
 cm.listSelections=() => [{},{}];assert.match(api.run('splice'),/single cursor/);assert.equal(operations,2);
});
