# ClojureScript Fiddle

A JSFiddle-style, browser-only playground for ClojureScript, HTML, and CSS. Open the page, edit the code, and press **Run** or **Ctrl/Cmd + Enter**. The initial Fiddle counter runs automatically. Use the Fiddle / REPL toggle in the header to change editor mode.

## Features

- Download and import named projects from the Project menu in either mode. One portable file keeps all four code buffers and the active mode; Undo import restores the previous code.
- ClojureScript, HTML, and CSS editors with syntax highlighting and line numbers.
- ClojureScript bracket matching, automatic bracket/double-quote pairs, smart indentation, comment toggling, active-line highlighting, and enclosing-collection selection.
- Structural editing in both code editors: forward/backward slurp and barf, splice, and wrap with a compact Structure menu and keyboard shortcuts.
- HTML and CSS editors across the top; ClojureScript and Result below.
- Drag the central dividers to resize columns and rows. Focus a divider and use arrow keys (Shift for larger steps), Home/End for limits, or double-click to reset. On narrow screens, drag the handle below each pane to adjust its height.
- Maximize any pane with its header button; click Restore or press Escape to return to your previous layout. Editor contents, undo history, divider positions, and running preview state are retained. Escape also works inside Result.
- Live DOM preview in a sandboxed iframe.
- Collapsible console docked at the bottom of Result. It starts collapsed, retains output while hidden, and opens automatically on errors.
- Console captures `println`, `prn`, JavaScript console output, the final expression, errors, and async failures.
- Each Fiddle Run creates a fresh interpreter, document, and state; REPL evaluations share a persistent interpreter until Restart session.
- Run discards the previous preview and its asynchronous callbacks before starting fresh. Clear clears the console only.
- Counter, sequences/maps, and color examples. Reset restores the selected example.
- Responsive layout and accessible button labels.
- Runtime and editor assets are bundled locally. No CDN or code execution server is needed.

## Run locally

Serve the `dist` directory with any static HTTP server, for example:

```sh
python3 -m http.server 8080 --directory dist
```

Then open http://localhost:8080. Static hosting is only for downloading files; all user code executes in the browser. Opening `index.html` with `file://` is unsupported because runtime loading uses `fetch`.

## Runtime scope

Uses **Scittle 0.8.33 / SCI**, an interpreter for a substantial ClojureScript subset, rather than the complete ClojureScript compiler. Supports core data structures and functions, atoms, functions, common namespaces such as `clojure.string`, and JavaScript / DOM interop. Full compiler features, arbitrary Maven/npm dependencies, and externally loaded macro libraries are not included. There is no generated-JavaScript pane because execution is interpreted.

HTML is inserted into the preview document. Write behavior in the ClojureScript panel; scripts embedded in the HTML panel are not executed. Run does not persist edits. Selecting an example or Reset replaces current edits.

The iframe has `sandbox="allow-scripts"` without same-origin access. Preview code cannot access the parent page's DOM or storage. The console accepts messages only from the active iframe with its per-run identifier. User code can still make browser network requests where permitted. This is a convenience playground, not a security boundary for hostile code.

A synchronous infinite loop can block the browser thread. Reload or close the tab in that case. Console is capped at 500 rows and 20,000 characters per row.

## Files

- `dist/index.html`: page layout and asset references.
- `dist/style.css`: responsive workspace theme.
- `dist/app.js`: editors, examples, preview lifecycle, execution, and console.
- `dist/project-files.js`: versioned project format, validation, serialization, and import/undo controller.
- `dist/projects.js`: Project menu, browser file download/import, and workspace restoration.
- `tests/projects.cjs`: round trips, invalid-file handling, file controls, and undo checks.
- `dist/repl-core.js`: persistent sandboxed REPL session and top-level expression boundaries.
- `dist/repl.js`: REPL editor, terminal, prompt history, and mode switching.
- `tests/repl.cjs`: runtime, session lifecycle, and expression-boundary checks (`npm test`).
- `dist/structural-editing.js`: reader-form boundaries, structural transformations, shortcuts, and the Structure menu.
- `tests/structural-editing.cjs`: structural editing, reader edge cases, cursor/selection, and editor integration checks.
- `dist/pane-maximize.js`: pane maximize/restore controls and keyboard handling.
- `dist/vendor/`: locally bundled runtime, editors, and dependency licenses.
- `package.json` / `package-lock.json`: exact dependency versions.

## Dependencies

- [Scittle](https://github.com/babashka/scittle) 0.8.33 — EPL-1.0. License in `dist/vendor/SCITTLE-LICENSE`.
- [CodeMirror](https://codemirror.net/5/) 5.65.20 — MIT. License in `dist/vendor/CODEMIRROR-LICENSE`.

No backend, JVM, database, or build step is needed to serve the finished page.

## License

Project code is licensed under the [MIT License](LICENSE). Copyright (c) 2026 Craig Johnson.

Bundled third-party dependencies retain their own licenses: CodeMirror is MIT-licensed and Scittle is EPL-1.0-licensed. Their license files are included in `dist/vendor/`.

## ClojureScript editing

| Control | Action |
| --- | --- |
| Enter | Insert a new line with Clojure-aware indentation. Inside an empty bracket pair, create an indented line between the brackets. |
| Tab / Shift+Tab | Smart-indent the current line or selection / decrease indentation. Within code, Tab inserts spaces. |
| Ctrl/Cmd+/ | Toggle line comments on the current line or selection. |
| Ctrl/Cmd+Shift+I | Reindent the selection; when nothing is selected, reindent the whole editor. |
| Alt/Option+Up | Select the enclosing list, vector, or map. Repeat to expand outward. |
| Alt/Option+Down | Restore the previous selection from expansion history. |
| Ctrl/Cmd+Enter | Run the fiddle, or run the file in REPL mode. |
| Ctrl/Cmd+Alt/Option+Right / Left | Slurp the next / previous form into the enclosing collection. |
| Ctrl/Cmd+Alt/Option+Shift+Right / Left | Barf the last / first form out of the enclosing collection. |
| Ctrl/Cmd+Alt/Option+S | Splice the enclosing collection (remove its brackets). |
| Ctrl/Cmd+Alt/Option+P / V / M | Wrap the current form or complete selected forms in a list / vector / map. |

Shrink requires a previous Expand operation; it does not undo arbitrary manual selections.

Typing an opening bracket or double quote inserts its partner; typing a closing bracket skips over an existing partner. Backspace between an empty pair removes both. Typing an opening bracket with text selected wraps the selection. Single quotes remain Clojure reader quotes and are not paired.

Collection selection ignores delimiters inside strings, regex literals, comments, and character literals; it includes the `#` prefix for sets and anonymous functions. It selects balanced bracketed collections, not arbitrary reader forms or a full structural-editing AST. Moving the cursor or changing code clears the selection-expansion history. Reindentation changes leading whitespace, not general code formatting.

### Structural editing

Use **Structure** in the Fiddle or REPL ClojureScript pane. It exposes the same commands as the shortcuts above, including when an operating system intercepts a shortcut. Escape closes the command list. Commands operate on one cursor or selection; ordinary typing and deletion remain unchanged.

- **Slurp** pulls an adjacent form into a collection: `(a) b` → `(a b)`.
- **Barf** pushes a form outside: `(a b)` → `(a) b` (forward) or `a (b)` (backward).
- **Splice** removes the enclosing delimiters: `(a [b c])` → `(a b c)` with the cursor inside the vector.
- **Wrap** encloses the form at the cursor, or selected complete adjacent forms. Select `:name "Ada"` and choose Wrap in `{ }` to create a map. Partial tokens cannot be wrapped by a structural command.

Maps slurp/barf whole key/value pairs. Reader prefixes such as quote, metadata, tagged literals, sets, anonymous functions, and namespaced maps stay attached when forms move. Comments, strings, regexes, and character literals are recognized; commands invoked inside literal text or comments leave the code unchanged. Each successful command is one undo step. Existing whitespace is retained where possible; use Reindent when needed.

This is conservative reader-form editing, not a full compiler or a semantic refactoring tool. Commands leave incomplete/mismatched code, unsupported reader syntax, nested discard prefixes, and edits that produce an odd map arity unchanged, with a status message. Splicing a quote/metadata/tag-prefixed collection is also refused. Reader conditional shells are left intact; edit forms inside their branches. Balanced edits can still change program meaning, as expected when moving forms.

The editing helpers live in `dist/clojure-editing.js`. CodeMirror add-ons are bundled in `dist/vendor/` under CodeMirror's existing MIT license.

## REPL mode

Use the **Fiddle / REPL** toggle in the header. Fiddle keeps the existing four resizable panes. REPL shows a ClojureScript editor on the left and a terminal on the right (stacked on narrow screens).

- **Run file** or **Ctrl/Cmd+Enter** evaluates the entire REPL editor in the current session. Printed output and the final return value appear in the terminal.
- **Eval expression** or **Alt/Option+Enter** evaluates selected text. With no selection, it evaluates the top-level expression at the cursor. At a form's end it uses that form; between forms it uses the next one. Select a nested expression explicitly to evaluate it on its own.
- Type directly at the terminal prompt and press **Enter** to evaluate. **Shift+Enter** inserts a new line. Up at the beginning and Down at the end of the input recall submitted commands.
- Definitions, functions, atoms, and the current namespace persist between evaluations. Errors are printed; subsequent evaluations can continue.
- **Clear** removes terminal output only. **Restart session** discards the REPL interpreter and its definitions, timers, and queued work, while preserving the editor and input history.
- Fiddle and REPL retain separate code buffers and execution environments while switching modes. REPL starts with a data/functions example and does not load the Fiddle HTML or CSS. Neither buffer is automatically saved across a page reload. Use Project → Download project to keep your work.
- The REPL retains the same Clojure editing shortcuts. It is a ClojureScript terminal, not an operating-system shell or a full terminal/ANSI emulator.

The runtime is a persistent sandboxed iframe using bundled Scittle, entirely client-side. Evaluation requests are processed in order. Terminal output is capped at 1,000 rows and 20,000 characters per row; at most 100 submitted transcript groups and 100 input-history entries are retained. As in Fiddle, a synchronous infinite loop can block the browser thread; session restart cannot interrupt it while the thread is blocked.


## Download and import projects

Open **Project** in the header (available in both modes), enter a name, and choose **Download project**. Your browser downloads a `.cljsfiddle.json` file. Choose **Import project** to reopen it from your computer; you can import from either mode.

Every project contains:

- The project name and selected editor mode.
- Fiddle HTML (`index.html`), CSS (`style.css`), and ClojureScript (`main.cljs`).
- The independent REPL editor (`repl.cljs`).

Import replaces **both** modes' code and switches to the saved mode. The current preview and REPL session are cleared; imported code is never run automatically. Press Run / Run file or evaluate an expression when ready. **Undo import** restores the code, name, and mode from before the last successful import. This backup lasts until another successful import, Undo import, or a page reload; it does not restore live definitions, output, cursor positions, or editor undo histories.

Project files contain source code only. They do not capture console/terminal output, terminal command history, live definitions or atoms, pending terminal input, pane dimensions, or external dependencies. Files are read and downloaded locally in the browser; there is no project-upload server.

The versioned JSON format uses `format: "clojurescript-fiddle"`, `version: 1`, `name`, `mode` (`"fiddle"` or `"repl"`), and a `files` object containing all four filenames above as text values. Empty code is supported. Import validates the complete document before replacing editors; malformed files, unsupported versions, missing/non-text code fields, and files over 5 MiB are rejected. Download enforces the same size limit. The download is a project document for this editor, not a standalone website or a ZIP of the playground application.
