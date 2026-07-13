# Discovery interview — fine-tuning the org chart & slide tool for comp/HRBP work

Questions for the compensation partner / HRBP who would use this tool day-to-day.
Goal: decide what to fine-tune, what to delete, and whether parts should be remade.
**Bold** questions are the highest-leverage ones. Each section notes what the answers
change in the build. Bring a laptop with the live tool open and let them drive.

> Live tool: https://unique-name27.github.io/org-chart-simulator/org-chart-editable_3.html

---

## 1. Their job & the deliverable

- **Walk me through the last time you had to make org slides. What triggered it, what
  did you deliver, to whom, and how long did it take?** *(Grounds everything in a real
  workflow instead of our guesses.)*
- What does the final artifact actually look like — PowerPoint in the corporate
  template? A page in a QBR deck? A PDF for a leader 1:1?
- Who consumes it: execs, managers, finance, recruiters? What questions do *they* ask
  when they see an org slide?
- How often does this happen — weekly ritual, quarterly cycle, or ad-hoc reorg fire
  drills?

*Changes: which export formats matter, default slide styling, whether the exec-deck
PDF is worth keeping.*

## 2. Data in (the make-or-break)

- **What system does your headcount come from, and can you show me a real (redacted)
  export?** Workday? SuccessFactors? A finance-owned Excel? *(One real file would
  validate or kill the column-alias packs and parsers instantly.)*
- Which columns do you actually have? Do managers appear as IDs, names, or
  "supervisory organization"?
- How dirty is it — duplicate people, contractors mixed in, terminated employees
  included, matrix/dotted-line reporting?
- How stale is acceptable? Is "snapshot as of the export date" fine, or does this need
  to stay current without re-importing?
- Do you need to combine sources (e.g., HRIS export + a recruiting req list + a
  finance headcount plan)?

*Changes: the import pipeline (aliases, name/date parsing, manager matching),
whether multi-source merge becomes a feature.*

## 3. Comp-specific needs (the "remake it?" fork)

- **Do your slides ever need comp data on them — band/grade, salary range position,
  budget cost of a team, cost of open reqs?** *(If yes, this becomes a materially
  different, more sensitive tool.)*
- During merit/comp cycles, what org views do you wish you had? (e.g., "everyone in
  band X under this VP," compa-ratio heat by team, span-of-control vs. grade)
- Is "cost of this org / cost of Option B" the number leadership actually wants on a
  reorg slide?
- What must *never* appear on a slide, even internally? (comp figures, performance
  ratings, flight-risk labels?)

*Changes: fine-tune vs. remake decision; data-sensitivity posture; possible overlap
with a dedicated comp tool.*

## 4. Reorg & planning workflow

- When you model a reorg, where does it happen today — PowerPoint boxes? Excel?
  Visio? A whiteboard photo?
- **Is "Option A vs Option B" (the scenario diff) the way you actually present
  choices, or do leaders want something else — a phased timeline, or before/after
  side-by-side pictures?**
- Open positions: do these come from a req system with IDs and target dates? Should
  an open box show cost, recruiter, or time-open?
- Who approves a reorg, and what artifact do they sign off on?

*Changes: the shape of scenario compare (diff table vs. side-by-side charts vs.
timeline), what open-position cards display.*

## 5. Slide conventions & taste

- Show me an org slide you were *proud of* and one you hated making. What's the
  difference?
- Corporate template rules: fonts, colors, logo, classification labels? Is "Company
  Confidential" the right stamp or is there an official marking scheme?
- How do you handle big teams on slides today (long rows vs. grids vs. stacked name
  lists)? What does your best-looking deck do?
- Do you name every IC, or do bottom levels collapse into "12 Engineers" rollups?

*Changes: PPTX branding/templating, default wide-team layout, whether a "rollup
card" mode is needed.*

## 6. Trust, privacy & IT reality

- **If you used this with real employee data, who would need to approve it — IT
  security, HR ops, legal? What would they ask?** *(Determines whether
  local-first-in-browser is sellable or whether it must live inside the firewall.)*
- Is "data never leaves your browser, saved only on your machine" a feature or a
  problem (shared laptops, needing access from two machines)?
- Do multiple HRBPs need to see the *same* org/slides, or does each own their client
  group independently? *(This decides whether a backend/collaboration tier ever gets
  built.)*

*Changes: hosting/architecture; whether the local-first identity holds.*

## 7. Scope & scale

- How many employees are in your client group, and in the biggest org you'd ever put
  on one slide?
- Which current features would you honestly never use? *(Permission to delete is as
  valuable as a feature request.)*
- If this tool disappeared tomorrow, what's the pain, and what would you go back to?

*Changes: performance targets, slide caps, and the deletion list.*

---

## The three answers that most change the build

1. **A real export file** (§2) → reshapes the import pipeline end to end.
2. **Comp data on slides: yes/no** (§3) → decides fine-tune vs. remake.
3. **Shared vs. solo use + who approves it** (§6) → decides whether the local-first
   architecture holds or a backend tier becomes real.

---

## Answer sheet

| # | Question (short) | Answer | Follow-up owed |
|---|---|---|---|
| 1 | Last org-slide task, start to finish | | |
| 2 | Source system + sample export obtained? | | |
| 3 | Comp data on slides? | | |
| 4 | How reorg options are presented | | |
| 5 | Template/branding rules | | |
| 6 | Who must approve real-data use | | |
| 7 | Shared or solo? | | |
| 8 | Features to delete | | |
