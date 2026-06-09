# org-chart-tycoon-fast

Performance-focused fork of [org-chart-tycoon](https://github.com/unique-name27/org-chart-tycoon).

Live: https://unique-name27.github.io/org-chart-tycoon-fast/org-chart-editable_3.html

## What's different (performance)

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
