# ClojureScript Fiddle

A JSFiddle-style, browser-only playground for ClojureScript, HTML, and CSS. Open the page, edit the code, and press **Run** or **Ctrl/Cmd + Enter**. The initial counter runs automatically.

## Features

- ClojureScript, HTML, and CSS editors with syntax highlighting and line numbers.
- HTML and CSS editors across the top; ClojureScript and Result below.
- Live DOM preview in a sandboxed iframe.
- Collapsible console docked at the bottom of Result. It starts collapsed, retains output while hidden, and opens automatically on errors.
- Console captures `println`, `prn`, JavaScript console output, the final expression, errors, and async failures.
- Each Run creates a fresh interpreter, document, and state.
- Stop discards the preview and its asynchronous callbacks. Clear clears the console only.
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

A synchronous infinite loop can block the browser thread, including Stop. Reload or close the tab in that case. Stop is intended for timers and other asynchronous activity, not preempting synchronous computation. Console is capped at 500 rows and 20,000 characters per row.

## Files

- `dist/index.html`: page layout and asset references.
- `dist/style.css`: responsive workspace theme.
- `dist/app.js`: editors, examples, preview lifecycle, execution, and console.
- `dist/vendor/`: locally bundled runtime, editors, and dependency licenses.
- `package.json` / `package-lock.json`: exact dependency versions.

## Dependencies

- [Scittle](https://github.com/babashka/scittle) 0.8.33 — EPL-1.0. License in `dist/vendor/SCITTLE-LICENSE`.
- [CodeMirror](https://codemirror.net/5/) 5.65.20 — MIT. License in `dist/vendor/CODEMIRROR-LICENSE`.

No backend, JVM, database, or build step is needed to serve the finished page.
