# org-chart-simulator

Interactive org chart simulator — explore your organization as a 3D galaxy, fly through
it first-person at warp speed, or walk a SimCity-style isometric **City** of your company
(step inside buildings, team-aware interiors, day/night + weather). Plus org-health
analytics, a drag-and-drop reorg simulator, and a multi-year growth timeline.

## ▶ Live site

- **Open the app:** https://unique-name27.github.io/org-chart-simulator/org-chart-editable_3.html
- **Landing page:** https://unique-name27.github.io/org-chart-simulator/

## Companion tools

- **🕵️ HR Data Detective** — https://unique-name27.github.io/org-chart-simulator/data-detective.html — a local-only game that turns HRIS data cleanup into cases: import your export, verify each suspicious record against your source of truth (Glean/Workday/the directory), and export a corrected CSV + audit log. Same zero-network privacy stance as the main app.

## Docs

- [Discovery interview questions](docs/discovery-questions.md) — what to ask the comp partner / HRBP to fine-tune (or remake) this tool for their real workflow.

## Performance (this is the "fast" build)

This repo is the performance-tuned version of the simulator. Key wins:

- **No in-browser Babel.** The original transpiled ~680 KB of JSX with
  `@babel/standalone` (~3 MB) on every page load. Here the JSX is **precompiled**
  to plain JS and inlined, so the browser does zero transpilation and downloads
  ~3 MB less. This is the biggest load-time win.
- **Idle render loops pause.** The isometric City keeps a `requestAnimationFrame`
  loop, but it now early-outs while a building **interior** is open (it used to
  redraw the whole city behind the overlay) and whenever the **tab is hidden**.
- **Cached glow sprites.** Every light source (building/lamp night glows, interior
  monitors, ceiling pools, server/break glows) used to call
  `createRadialGradient` + fill every frame. They now blit a cached, color-keyed
  sprite via `drawImage`.
- **Viewport culling.** City buildings/trees/cars/pedestrians/fountains/lamps
  outside the visible canvas are no longer assembled, depth-sorted, or drawn.
- **Lazy three.js.** The 3D Galaxy view only loads three.js the first time it's opened,
  so normal page loads carry no WebGL weight.

## Editing

The source of truth is **`app.jsx`** (the React app). The deployed
`org-chart-editable_3.html` is generated:

```
node build.mjs
```

`build.mjs` compiles `app.jsx` with esbuild (`--loader:.jsx=jsx --target=es2019`)
and injects it into `app.template.html` (the HTML shell, which has the CDN
`<script>` tags for React/Recharts/etc. but **not** Babel), writing
`org-chart-editable_3.html`. Commit the regenerated HTML — that's what GitHub
Pages serves.

Append `#fps` to the app URL for an on-screen FPS meter.
