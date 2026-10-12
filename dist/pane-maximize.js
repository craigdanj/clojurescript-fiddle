'use strict';

// Keep panels in place so editor history and the running iframe survive resizing.
(() => {
 const workspace = document.getElementById('workspace');
 const panels = [...workspace.querySelectorAll(':scope > .panel')];
 const buttons = new Map();
 let maximized = null;
 let previousScroll = 0;
 const expandIcon = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/></svg>';
 const restoreIcon = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h4V3m6 0v4h4M7 17v-4H3m14 0h-4v4"/></svg>';
 function setMaximized(panel) {
  const previous = maximized;
  if (!previous && panel) previousScroll = window.scrollY;
  maximized = panel;
  workspace.classList.toggle('is-maximized', Boolean(panel));
  document.body.classList.toggle('pane-maximized', Boolean(panel));
  for (const candidate of panels) {
   candidate.classList.toggle('is-maximized-pane', candidate === panel);
   const button = buttons.get(candidate);
   const selected = candidate === panel;
   const label = `${selected ? 'Restore' : 'Maximize'} ${candidate.querySelector('h2').textContent} pane`;
   button.setAttribute('aria-label', label);
   button.setAttribute('aria-pressed', String(selected));
   button.title = selected ? `${label} (Esc)` : label;
   button.innerHTML = selected ? restoreIcon : expandIcon;
  }
  workspace.dispatchEvent(new Event('pane-layout-change'));
  requestAnimationFrame(() => {
   if (maximized !== panel) return;
   // Do not focus an editor automatically: retain keyboard access to Restore.
   buttons.get(panel || previous)?.focus({preventScroll: true});
   window.scrollTo({top: panel ? 0 : previousScroll, behavior: 'instant'});
  });
 }
 for (const panel of panels) {
  const head = panel.querySelector('.panel-head');
  const meta = head.querySelector('.filename, #status');
  const actions = document.createElement('span');
  actions.className = 'pane-actions';
  if (meta) actions.append(meta);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pane-maximize';
  button.setAttribute('aria-label', `Maximize ${panel.querySelector('h2').textContent} pane`);
  button.setAttribute('aria-pressed', 'false');
  button.title = button.getAttribute('aria-label');
  button.innerHTML = expandIcon;
  button.addEventListener('click', () => setMaximized(maximized === panel ? null : panel));
  buttons.set(panel, button);
  actions.append(button);
  head.append(actions);
 }
 document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && maximized && !event.defaultPrevented) {
   event.preventDefault();
   setMaximized(null);
  }
 });
 // The sandboxed Result forwards Escape through the existing validated channel.
 document.addEventListener('restore-pane', () => { if (maximized) setMaximized(null); });
})();
