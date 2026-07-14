// qa.mjs — final release gate for org-chart-simulator.
//
//   node qa.mjs
//
// Runs the full unit suite, rebuilds the deployable HTML, then makes release-level
// assertions against the BUILT artifact (org-chart-editable_3.html) and the repo:
// privacy/security invariants (local-first, tight CSP, no dead network features),
// presence of every shipped feature, and vendored-dependency integrity.
// Exits non-zero with a ✗ list if anything fails — safe to wire into CI later.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

let failures = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const bad = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));

console.log("── 1. Unit test suite ──");
try {
  const out = execSync("node --test", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const tests = +(out.match(/tests (\d+)/)?.[1] ?? 0);
  const fail = +(out.match(/fail (\d+)/)?.[1] ?? 1);
  check(tests >= 80 && fail === 0, `node --test: ${tests} tests, ${fail} failures`);
} catch (e) {
  bad("node --test exited non-zero");
  console.error(String(e.stdout || e).slice(-2000));
}

console.log("── 2. Build ──");
try {
  const out = execSync("node build.mjs", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  check(/babel present: false/.test(out), "build clean (no @babel/standalone)");
} catch (e) { bad("build.mjs failed"); console.error(String(e.stdout || e).slice(-2000)); }

console.log("── 3. Built artifact: privacy & security invariants ──");
const html = readFileSync("org-chart-editable_3.html", "utf8");
const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
check(/connect-src 'self' blob:;/.test(csp), "CSP connect-src is exactly 'self' blob: (no outbound data hosts)");
check(!/esm\.sh|api\.anthropic\.com|wss:/.test(csp), "CSP has no esm.sh / anthropic / wss remnants");
check(!/trystero|joinRoom\(\{ appId/.test(html), "no Trystero/co-op code in the bundle");
check(!/api\.anthropic\.com/.test(html), "no Anthropic API calls in the bundle");
check(!/NaturalLanguageQuery/.test(html), "Ask-the-org component fully removed");
check(/never leaves this browser/.test(html), "privacy banner states local-only truthfully");
check(/\.\/vendor\/xlsx\.full\.min\.js/.test(html), "xlsx loaded from self-hosted vendor file (not a CDN)");
check(!/cdn\.jsdelivr\.net\/npm\/xlsx/.test(html), "no CDN xlsx reference remains");

console.log("── 4. Built artifact: shipped features present ──");
[
  ["function diffScenarios", "scenario compare/diff engine"],
  ["Capture as A", "scenario capture toolbar"],
  ["function linkManagers", "manager matching by name"],
  ["function detectDelimiter", "delimiter auto-detection"],
  ["function previewImportStats", "live pre-import validation"],
  ["function groupSubtree", "breakdown-by-dimension engine"],
  ["Breakdown", "breakdown chart mode UI"],
  ["Job family", "job-family option surfaced"],
  ["function enumerateBookNodes", "full org book exporter"],
  ["DM_SANS_WOFF2_B64", "embedded PNG export font (cards)"],
  ["CAVEAT_WOFF2_B64", "embedded PNG export font (sticky notes)"],
  ["function notesOnSlide", "per-slide sticky-note routing"],
  ["Floating (this slide only)", "note attach-to-person control"],
  ["Company Confidential", "confidential footer on exports"],
  ["import-exceptions-", "import exceptions report"],
  ["Drop your headcount file", "drag-and-drop import overlay"],
  ["orgSimSession", "autosave/session persistence"],
  ["Download full org book", "org book button"],
  ["OPEN", "open-position ghost cards"],
].forEach(([needle, label]) => check(html.includes(needle), label));

console.log("── 5. Vendored dependency integrity ──");
check(existsSync("vendor/xlsx.full.min.js"), "vendor/xlsx.full.min.js exists");
const sha = createHash("sha256").update(readFileSync("vendor/xlsx.full.min.js")).digest("hex");
const pinned = (readFileSync("vendor/README.md", "utf8").match(/`([0-9a-f]{64})`/) || [])[1];
check(pinned && sha === pinned, `xlsx sha256 matches vendor/README pin (${sha.slice(0, 12)}…)`);
check(existsSync("vendor/dmsans-latin.woff2"), "vendor/dmsans-latin.woff2 exists");
check(readFileSync("fonts.mjs", "utf8").includes("DM_SANS_WOFF2_B64"), "fonts.mjs exports the font constant");

console.log("── 6. HR Data Detective (companion game) ──");
check(existsSync("data-detective.html") && existsSync("data-detective.mjs"), "game page + module exist");
const game = readFileSync("data-detective.html", "utf8");
const gameJs = readFileSync("data-detective.mjs", "utf8");
const gameCsp = game.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
check(/connect-src 'self'/.test(gameCsp) && !/https?:\/\//.test(gameCsp), "game CSP is fully local (no external hosts)");
check(gameJs.includes('from "./core.mjs"'), "game imports the tested core detectors");
check(/detectDataIssues|computeDataHealth/.test(gameJs), "game uses detectDataIssues/computeDataHealth");
check(/glean\.com\/search\?q=\{query\}/.test(gameJs), "Glean look-up template wired");
check(/corrected-roster-/.test(gameJs) && /data-fix-log-/.test(gameJs), "corrected CSV + audit log exports present");

console.log("── 7. Repo hygiene ──");
check(!existsSync("._merged.jsx"), "no build scratch file left behind");
const gi = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";
check(gi.includes("._merged.jsx"), ".gitignore covers the build scratch file");

console.log("");
if (failures) { console.error(`QA FAILED — ${failures} check(s) failed.`); process.exit(1); }
console.log("QA PASSED — all checks green.");
