/* Conservative Clojure reader-form editing. MIT License — Craig Johnson. */
(function(root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.ClojureStructure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
 'use strict';
 const pairs = {'(':')', '[':']', '{':'}'};
 const white = ch => ch !== undefined && /[\s,]/.test(ch);
 const boundary = ch => ch === undefined || /[\s,()[\]{}";@^`~\\]/.test(ch);
 // A lossless boundary reader: text stays in the original source, never printed
 // back from an AST. Unknown/incomplete reader syntax fails closed.
 function read(source) {
  let i = 0;
  const nodes = [], comments = [];
  function trivia() {
   while (i < source.length) {
    if (white(source[i])) i++;
    else if (source[i] === ';') {
     const start = i; while (i < source.length && source[i] !== '\n') i++;
     comments.push({start, end:i});
    } else break;
   }
  }
  function form(parent, depth = 0) {
   if (depth > 300) throw Error('Code is nested too deeply for structural editing.');
   trivia();
   if (i >= source.length || ')]}'.includes(source[i])) throw Error('Complete the brackets or reader form first.');
   const node = {start:i, end:i, type:'atom', children:[], parent};
   nodes.push(node);
   function child() {const value = form(node, depth + 1); node.children.push(value); return value;}
   let ch = source[i];
   if (ch === '#' && (source[i+1] === '{' || source[i+1] === '(')) {i++; ch = source[i];}
   else if (ch === '#' && source[i+1] === ':') {
    i += 2;
    while (i < source.length && !boundary(source[i])) i++;
    trivia();
    if (source[i] !== '{') throw Error('Complete the namespaced map first.');
    ch = '{';
   }
   if (pairs[ch]) {
    node.type = 'collection'; node.open = ch; node.openAt = i; node.contentStart = ++i;
    trivia();
    while (source[i] !== pairs[ch]) {
     if (i >= source.length) throw Error('Complete the brackets first.');
     child(); trivia();
    }
    node.closeAt = i++;
   } else if (ch === '"' || (ch === '#' && source[i+1] === '"')) {
    node.type = 'string'; if (ch === '#') i++;
    i++; let closed = false;
    while (i < source.length) {const c = source[i++]; if (c === '\\') i++; else if (c === '"') {closed = true; break;}}
    if (!closed) throw Error('Complete the string first.');
   } else if (ch === '\\') {
    node.type = 'character'; i++;
    if (i >= source.length) throw Error('Complete the character literal first.');
    i++; while (i < source.length && !boundary(source[i])) i++;
   } else if ("'`@~^".includes(ch)) {
    node.type = 'prefix'; node.prefix = ch; i++;
    if (ch === '~' && source[i] === '@') i++;
    if (ch === '^') child();
    node.value = child();
   } else if (ch === '#') {
    i++; node.type = 'prefix'; node.prefix = source[i];
    if ("_'?".includes(source[i] || ' ')) {
     i++; if (node.prefix === '?' && source[i] === '@') i++;
     node.value = child();
    } else if (source[i] === '#') {
     i++; while (i < source.length && !boundary(source[i])) i++;
     if (!/^##(?:Inf|-Inf|NaN)$/.test(source.slice(node.start,i))) throw Error('Unsupported symbolic value.');
     node.type = 'atom';
    } else {
     const start = i;
     while (i < source.length && !boundary(source[i])) i++;
     if (!/^[A-Za-z][\w./-]*$/.test(source.slice(start,i))) throw Error('Unsupported reader syntax at the cursor.');
     node.value = child();
    }
   } else {
    while (i < source.length && !boundary(source[i])) i++;
    if (i === node.start) throw Error('Unsupported reader syntax.');
   }
   node.end = i; return node;
  }
  const root = {start:0,end:source.length,type:'root',children:[]};
  trivia(); while (i < source.length) {root.children.push(form(root)); trivia();}
  // Discard macros inside another reader prefix require reader evaluation to
  // determine its operand; leave these uncommon cases unchanged.
  if (nodes.some(n => n.type === 'prefix' && n.children.some(c => c.type === 'prefix' && c.prefix === '_'))) throw Error('Nested discard prefixes are not supported by structural editing.');
  return {root,nodes,comments};
 }
 function unit(node) {
  while (node.parent?.type === 'prefix' && node.parent.value === node) node = node.parent;
  return node;
 }
 function containing(nodes, from, to) {
  const eligible = nodes.filter(n => n.type === 'collection' && n.start <= from && n.end >= to);
  return eligible.sort((a,b) => (a.end-a.start)-(b.end-b.start)).find(n => from !== to || from < n.end) || null;
 }
 function mapArity(tree) {
  return tree.nodes.every(n => n.type !== 'collection' || n.open !== '{' || n.openAt === n.start + 1 || n.children.filter(c => !(c.type === 'prefix' && c.prefix === '_')).length % 2 === 0);
 }
 function transform(source, anchor, head, command) {
  const unchanged = message => ({source,anchor,head,changed:false,message});
  try {
   const tree = read(source), from = Math.min(anchor,head), to = Math.max(anchor,head);
   if (tree.comments.some(c => c.start <= from && from < c.end) || tree.nodes.some(n => ['string','character'].includes(n.type) && n.start < from && from < n.end)) return unchanged('Move outside the string, character literal, or comment first.');
   const edits = []; let wrapped = null;
   const insert = (at,text) => edits.push({from:at,to:at,text});
   const remove = (a,b) => edits.push({from:a,to:b,text:''});
   function removeBoundary(a,b) {
    remove(a,b);
    if (a > 0 && b < source.length && !white(source[a-1]) && !white(source[b])) edits.at(-1).text = ' ';
   }
   if (command.startsWith('wrap-')) {
    const opener = {'wrap-list':'(', 'wrap-vector':'[', 'wrap-map':'{'}[command];
    if (!opener) return unchanged('Unknown structural command.');
    let start = from, end = to;
    if (from === to) {
     const candidates = tree.nodes.filter(n => n.start <= from && from <= n.end);
     let node = candidates.find(n => n.start === from) || candidates.sort((a,b) => (a.end-a.start)-(b.end-b.start))[0];
     if (!node) node = tree.nodes.filter(n => n.end === from).sort((a,b) => (b.end-b.start)-(a.end-a.start))[0];
     if (!node) return unchanged('Place the cursor on a form, or select complete forms to wrap.');
     node = unit(node); start = node.start; end = node.end;
    } else {
     // Only whole siblings can be wrapped; never split a token or reader prefix.
     const siblings = [tree.root,...tree.nodes.filter(n => n.type === 'collection')].find(n => {
      const inside = n.children.filter(c => c.start >= from && c.end <= to);
      return inside.length && inside[0].start === from && inside.at(-1).end === to;
     });
     if (!siblings) return unchanged('Select complete adjacent forms, without partial tokens.');
    }
    wrapped = {start,end}; insert(start,opener); insert(end,pairs[opener]);
   } else {
    const node = containing(tree.nodes,from,to);
    if (!node) return unchanged('Place the cursor inside a complete collection.');
    const outer = unit(node), parent = outer.parent, siblings = parent?.children || [];
    if (parent?.type === 'prefix') return unchanged('This collection is part of a reader prefix.');
    if (outer !== node && command === 'splice') return unchanged('Splicing a prefixed collection is ambiguous; remove its prefix explicitly first.');
    if (tree.nodes.some(n => n.type === 'prefix' && n.prefix === '?' && n.value === node)) return unchanged('Edit a branch inside the reader conditional instead.');
    const index = siblings.indexOf(outer), backward = command.endsWith('backward');
    const isMap = node.open === '{' && !(node.openAt === node.start + 1 && source[node.start] === '#');
    const count = isMap ? 2 : 1;
    const opener = source.slice(outer.start,node.contentStart), closer = source[node.closeAt];
    if (command.startsWith('slurp-')) {
     const available = backward ? siblings.slice(0,index).reverse() : siblings.slice(index+1);
     let consumed = 0, target;
     for (const next of available) {target = next; if (!(next.type === 'prefix' && next.prefix === '_')) consumed++; if (consumed >= count) break;}
     if (!target || consumed < count) return unchanged(isMap ? 'A map needs another complete key/value pair.' : 'No adjacent form to pull into this collection.');
     if (backward) {
      removeBoundary(outer.start,node.contentStart);
      insert(target.start,opener);
     } else {
      removeBoundary(node.closeAt,node.end);
      insert(target.end,closer);
     }
    } else if (command.startsWith('barf-')) {
     const children = backward ? node.children : [...node.children].reverse();
     let consumed = 0, target;
     for (const next of children) {target = next; if (!(next.type === 'prefix' && next.prefix === '_')) consumed++; if (consumed >= count) break;}
     if (!target || consumed < count) return unchanged('This collection has no complete form to push out.');
     if (backward) {
      const next = node.children[node.children.indexOf(target)+1];
      const at = next ? next.start : node.closeAt;
      removeBoundary(outer.start,node.contentStart);
      insert(at,(at > 0 && !white(source[at-1]) ? ' ' : '')+opener);
     } else {
      // Insert before the released form (not before trailing comment trivia),
      // so a closing delimiter can never land inside a line comment.
      const previous = node.children[node.children.indexOf(target)-1];
      const start = previous ? previous.end : node.contentStart;
      const gap = source.slice(start,target.start);
      removeBoundary(node.closeAt,node.end);
      if (/^[\s,]*$/.test(gap)) insert(start,closer+(gap ? '' : ' '));
      else insert(target.start,closer+' ');
     }
    } else if (command === 'splice') {
     remove(node.start,node.contentStart); remove(node.closeAt,node.end);
     // Separators prevent formerly adjacent collections becoming one symbol.
     edits[0].text = ' '; edits[1].text = ' ';
    } else return unchanged('Unknown structural command.');
   }
   const ordered = edits.sort((a,b) => a.from-b.from || a.to-b.to);
   let result = source;
   for (const edit of [...ordered].reverse()) result = result.slice(0,edit.from)+edit.text+result.slice(edit.to);
   const checked = read(result);
   if (!mapArity(checked)) return unchanged('Keep map keys and values paired; this edit would leave an incomplete map.');
   function mapPosition(position, affinity = 1) {
    let delta = 0;
    for (const edit of ordered) {
     if (position < edit.from || position === edit.from && edit.from === edit.to && affinity < 0) break;
     if (position < edit.to) return edit.from+delta+edit.text.length;
     delta += edit.text.length-(edit.to-edit.from);
    }
    return position+delta;
   }
   const affinity = position => wrapped && position === wrapped.end ? -1 : 1;
   const a = mapPosition(anchor,affinity(anchor)), h = mapPosition(head,affinity(head));
   return {source:result,anchor:a,head:h,changed:result !== source,edits:ordered,message:'Done'};
  } catch (error) {return unchanged(error.message);}
 }
 const commands = [
  ['slurp-forward','Slurp forward','Pull the next form inside','Right'],
  ['slurp-backward','Slurp backward','Pull the previous form inside','Left'],
  ['barf-forward','Barf forward','Push the last form outside','Shift-Right'],
  ['barf-backward','Barf backward','Push the first form outside','Shift-Left'],
  ['splice','Splice collection','Remove the enclosing brackets','S'],
  ['wrap-list','Wrap in ( )','Wrap a form or selection in a list','P'],
  ['wrap-vector','Wrap in [ ]','Wrap a form or selection in a vector','V'],
  ['wrap-map','Wrap in { }','Wrap selected key/value pairs in a map','M']
 ];
 function install(cm) {
  function run(command) {
   if (cm.getOption('readOnly')) return 'This editor is read-only.';
   if (cm.listSelections().length !== 1) return 'Use a single cursor or selection for structural editing.';
   const selection = cm.listSelections()[0];
   const result = transform(cm.getValue(),cm.indexFromPos(selection.anchor),cm.indexFromPos(selection.head),command);
   if (result.changed) {
    cm.operation(() => {
     // Unique non-merging origin + one operation gives one undo step per command.
     for (const edit of [...result.edits].reverse()) cm.replaceRange(edit.text,cm.posFromIndex(edit.from),cm.posFromIndex(edit.to),'structural');
     cm.setSelection(cm.posFromIndex(result.anchor),cm.posFromIndex(result.head));
    });
    cm.scrollIntoView(cm.getCursor(),24);
   }
   if (status) status.textContent = result.changed ? commands.find(c => c[0] === command)[1]+' applied. Undo with Ctrl/⌘ Z.' : result.message;
   return result.message;
  }
  let status = null;
  const keys = {};
  for (const [command,,,key] of commands) for (const mod of ['Ctrl','Cmd']) {
   const name = key.startsWith('Shift-') ? 'Shift-'+mod+'-Alt-'+key.slice(6) : mod+'-Alt-'+key;
   keys[name] = () => run(command);
  }
  cm.addKeyMap(keys);
  // A native disclosure is keyboard/touch accessible and preserves selection.
  const panel = cm.getWrapperElement().closest('.panel');
  if (panel) {
   const menu = document.createElement('details'); menu.className = 'structure-menu';
   const summary = document.createElement('summary'); summary.textContent = 'Structure'; summary.setAttribute('aria-label','Structural editing commands');
   const list = document.createElement('div'); list.className = 'structure-commands';
   for (const [command,label,description,key] of commands) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = label; button.title = description+' · Ctrl/⌘ + Alt/⌥ + '+key.replace('-', ' + ');
    button.addEventListener('mousedown',event => event.preventDefault());
    button.addEventListener('click',() => {run(command);menu.open = false;cm.focus();});
    list.append(button);
   }
   const hint = document.createElement('p'); hint.textContent = 'Ctrl/⌘ + Alt/⌥ + ←/→: slurp. Add Shift to barf. S: splice · P/V/M: wrap.'; list.append(hint);
   menu.append(summary,list); panel.querySelector('.panel-head').append(menu);
   // In-flow disclosure avoids clipping under pane overflow and small heights.
   menu.addEventListener('toggle',() => {if (menu.open) {panel.querySelector('.panel-head').after(list);list.hidden = false;} else list.hidden = true;cm.refresh();});
   list.hidden = true;
   function escape(event) {if (event.key === 'Escape' && menu.open) {event.preventDefault();event.stopPropagation();menu.open = false;summary.focus();}}
   menu.addEventListener('keydown',escape); list.addEventListener('keydown',escape);
   document.addEventListener('pointerdown',event => {if (menu.open && !menu.contains(event.target) && !list.contains(event.target)) menu.open = false;});
   status = document.createElement('div'); status.className = 'structure-status'; status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
  }
  return {run};
 }
 return {read,transform,install,commands};
});
