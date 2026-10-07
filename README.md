# slidecraft

Open-source AI presentation maker. A deck is one JSON file (the schema is the source of truth); it is
rendered to a live HTML preview and exported to a `.pptx` where every text box, shape, table and chart
stays editable in PowerPoint.

Two ways to make decks:

- **Your coding agent** (Claude Code, Codex, Antigravity…): open this folder and ask for a deck. It writes
  `decks/<name>.json`, checks it with the CLI, and the preview updates live. No API key needed.
- **In-app chat** with your own Gemini API key (coming soon).

> Status: early MVP — the local server, live reload and project setup work; schema, renderers, CLI
> checks/export and the editor UI are in progress.

## Run it

```
npm install
npm run dev        # UI on http://localhost:5173, local server on :5175
```

## Scripts

| Command                      | What it does                                         |
| ---------------------------- | ---------------------------------------------------- |
| `npm run dev`                | UI + local server with live reload                   |
| `npm run check`              | lint (oxlint) + typecheck + tests (Vitest)           |
| `npm run slidecraft -- list` | CLI (more commands coming: `new`, `check`, `export`) |
| `npm run build`              | production build of the UI                           |

## Layout

- `src/` — UI and the shared engine: `schema/`, `layout/`, `render/html/`, `render/pptx/`, `ui/`
- `server/` — local server: deck files, live updates (SSE)
- `bin/` — CLI
- `decks/` — your decks (git-ignored, except `example-*.json`)

## License

MIT
