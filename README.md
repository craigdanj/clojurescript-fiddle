# ClojureScript Fiddle

A JSFiddle-style, browser-only playground for ClojureScript, HTML, and CSS. Open the page, edit the code, and press **Run** or **Ctrl/Cmd + Enter**. The initial counter runs automatically.

## Features

- ClojureScript, HTML, and CSS editors with syntax highlighting and line numbers.
- ClojureScript bracket matching, automatic bracket/double-quote pairs, smart indentation, comment toggling, active-line highlighting, and enclosing-collection selection.
- HTML and CSS editors across the top; ClojureScript and Result below.
- Drag the central dividers to resize columns and rows. Focus a divider and use arrow keys (Shift for larger steps), Home/End for limits, or double-click to reset. On narrow screens, drag the handle below each pane to adjust its height.
- Maximize any pane with its header button; click Restore or press Escape to return to your previous layout. Editor contents, undo history, divider positions, and running preview state are retained. Escape also works inside Result.
- Live DOM preview in a sandboxed iframe.
- Collapsible console docked at the bottom of Result. It starts collapsed, retains output while hidden, and opens automatically on errors.
- Console captures `println`, `prn`, JavaScript console output, the final expression, errors, and async failures.
- Each Run creates a fresh interpreter, document, and state.
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
| Ctrl/Cmd+Enter | Run the fiddle. |

Shrink requires a previous Expand operation; it does not undo arbitrary manual selections.

Typing an opening bracket or double quote inserts its partner; typing a closing bracket skips over an existing partner. Backspace between an empty pair removes both. Typing an opening bracket with text selected wraps the selection. Single quotes remain Clojure reader quotes and are not paired.

Collection selection ignores delimiters inside strings, regex literals, comments, and character literals; it includes the `#` prefix for sets and anonymous functions. It selects balanced bracketed collections, not arbitrary reader forms or a full structural-editing AST. Moving the cursor or changing code clears the selection-expansion history. Reindentation changes leading whitespace, not general code formatting.

The editing helpers live in `dist/clojure-editing.js`. CodeMirror add-ons are bundled in `dist/vendor/` under CodeMirror's existing MIT license.
