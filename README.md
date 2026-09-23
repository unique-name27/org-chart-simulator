# org-chart-simulator

Interactive org chart simulator — explore your organization as a 3D galaxy, fly through
it first-person at warp speed, or walk a SimCity-style isometric **City** of your company
(step inside buildings, team-aware interiors, day/night + weather). Plus a people-metrics
dashboard (headcount composition, org-health alerts, flight risk, manager health — org-wide
analytics all live here, not in a separate view), a drag-and-drop reorg simulator, and a
multi-year growth timeline.

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

## Dashboard

The **Dashboard** nav item (next to Org Chart) is a client-group-scoped metrics dashboard for
HR business partners: Overview, Workforce, Attrition, Movement, Talent, Pay, Org design,
and Engagement tabs, a searchable scope picker (whole company / a leader's org / a
business unit / department / location), a generated "Needs attention" alert list, a
sub-org scorecard, and a "Copy talking points" summary for a leader 1:1. All of its HR
fields (gender, performance rating, salary/range midpoint, termination type/reason,
regretted, last promotion/transfer date, engagement survey score) are **optional** — a
roster imported without them still renders the dashboard, with a coverage chip and
per-tab empty states naming which columns to add to unlock the rest.

The former standalone **Dashboards** and **Analytics** nav items were folded into the Dashboard
(they overlapped heavily with it): composition charts, semiconductor-discipline mix, and
skills coverage moved into the **Workforce** tab (the semiconductor-specific pieces only
show when the data carries a `taxo`/`productBU` field); the org-health insight feed and
manager-health lists became new "Needs attention" alert rules and a sortable manager table
on **Org design**; and the standalone flight-risk list moved into **Talent** as a
sortable, filterable table.

Metric definitions (also shown in-app via the "i" tooltips on Advanced+ tutorial mode):

- **asOf**: sample data uses the generator's fixed reference date; imported data uses the
  latest date found in the roster, capped at today.
- **Active at date d**: `startDate <= d` and (no `endDate` or `endDate > d`). Contractors
  (`employmentType !== "FTE"`) are excluded from headcount and every rate metric, and
  reported separately.
- **Trailing 12 months (T12M)**: `(asOf - 12mo, asOf]`.
- **Attrition (annualized)**: exits in the window ÷ average headcount (mean of the 13
  month-end snapshots spanning the window) × (12 ÷ window months). Voluntary/Involuntary/
  Regretted read "n/a" if no exit in the window has a termination type recorded.
- **First-year attrition**: of FTEs hired 12-24 months ago, % whose tenure was under 365
  days.
- **Promotion / internal mobility rate**: promotions (or promotions + lateral transfers)
  in the window ÷ average headcount.
- **Span of control**: mean/median direct reports for managers (active FTE with ≥1 active
  direct report). **Layers**: max depth below the scope root. **Manager ratio**: ICs per
  manager.
- **Compa-ratio**: `compaRatio` if present, else `salary / rangeMid`. Below range < 0.90,
  above > 1.10.
- **Pay equity gap** (by level): (median compa men − median compa women) ÷ median compa
  men, only when both groups have ≥5 people.
- **eNPS**: among survey respondents, % scoring 9-10 minus % scoring 0-6.
- **Anonymity rule**: any engagement, gender, or pay-equity cut with fewer than 5 people
  shows "—" ("Hidden to protect anonymity") instead of a number.

The metric engine lives in `hrbp.mjs` (pure functions, unit tested in
`test/hrbp.test.mjs`) — the UI (`HrbpDashboardView` and friends, in `app.jsx`) never
computes a rate or applies a suppression rule itself, only formats what the engine
returns.

## Editing

The source of truth is **`app.jsx`** (the React app), plus `core.mjs` and `hrbp.mjs`
(pure, unit-tested helper modules — see `test/`). The deployed `org-chart-editable_3.html`
is generated:

```
node build.mjs
```

`build.mjs` merges `core.mjs` + `hrbp.mjs` (both with their `export` keywords stripped) +
`app.jsx` into one scope, compiles the result with esbuild
(`--loader:.jsx=jsx --target=es2019`), and injects it into `app.template.html` (the HTML
shell, which has the CDN `<script>` tags for React/Recharts/etc. but **not** Babel),
writing `org-chart-editable_3.html`. Commit the regenerated HTML — that's what GitHub
Pages serves.

Append `#fps` to the app URL for an on-screen FPS meter.
