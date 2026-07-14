// HR Data Detective — game logic. All data stays in this tab; the only "network"
// action is the user-initiated Look-up link that opens THEIR search tool.
// Detection lives in core.mjs (detectDataIssues/computeDataHealth) and is unit-tested.
import { parseCSV, detectDelimiter, parseEmployeeName, detectDataIssues, computeDataHealth, csvCell } from "./core.mjs";

const $ = (id) => document.getElementById(id);
const show = (id) => ["setup", "game", "end"].forEach(s => $(s).classList.toggle("on", s === id));
const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 1600); };

// ── column auto-map (compact version of the app's alias packs) ──
const FIELD_ALIASES = {
  id: ["id","employee id","emp id","employeeid","worker id","worker","user id","employee #","employee number","person id"],
  fullName: ["name","full name","employee name","display name","legal name","preferred name","employee"],
  first: ["first","first name","given name"], last: ["last","last name","surname","family name"],
  title: ["title","job title","business title","role","position"],
  level: ["level","grade","job level","management level","pay grade","band"],
  dept: ["dept","department","team","org unit","supervisory organization","division"],
  location: ["location","city","site","office","work location"],
  managerId: ["managerid","manager id","manager","reports to","supervisor","manager (worker)","manager name","manager employee id"],
  startDate: ["startdate","start date","hire date","original hire date","start"],
  endDate: ["enddate","end date","term date","termination date","exit date"],
  status: ["status","employment status","active"],
};
function autoMap(header) {
  const hl = header.map(h => (h || "").trim().toLowerCase());
  const used = new Set(); const m = {};
  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
    let found = hl.findIndex((h, i) => !used.has(i) && aliases.includes(h));
    if (found < 0) found = hl.findIndex((h, i) => !used.has(i) && h && aliases.some(a => h.includes(a)));
    if (found >= 0) used.add(found);
    m[key] = found;
  }
  return m;
}
function rowsToEmployees(header, rows) {
  const m = autoMap(header);
  const g = (r, k) => (m[k] >= 0 ? String(r[m[k]] ?? "").trim() : "");
  return rows.map(r => {
    let first = g(r, "first"), last = g(r, "last");
    if ((!first || !last) && m.fullName >= 0) { const p = parseEmployeeName(g(r, "fullName")); first = first || p.first; last = last || p.last; }
    return { id: g(r, "id"), first, last, title: g(r, "title"), level: g(r, "level"), dept: g(r, "dept"),
      location: g(r, "location"), managerId: g(r, "managerId"), startDate: g(r, "startDate"), endDate: g(r, "endDate"), status: g(r, "status") || "Active" };
  }).filter(e => e.id || e.first || e.last);
}

// ── sample dataset: 25 records seeded with one of everything ──
function sampleData() {
  const rows = [
    ["E001","Miranda Vale","CEO","E3","Executive","SF","","2015-02-01","",""],
    ["E002","Devon Price","VP Engineering","E1","Engineering","SF","E001","2016-03-15","",""],
    ["E003","Sana Okafor","VP People","E1","HR","NYC","Miranda Vale","2017-08-01","",""],
    ["E004","Lee Zhang","Director QA","M2","Engineering","SF","E002","13/45/2020","",""],       // bad date
    ["E005","Priya Nair","Sr Engineer","Wizard","Engineering","SF","E004","2019-04-01","",""],  // bad level
    ["E006","Tom Alvarez","Engineer","L3","Engineering","","E004","2031-06-01","",""],          // future date + no location
    ["E007","Ana Silva","Engineer","L3","Engineering","SF","E006","1950-01-01","",""],          // ancient date
    ["E008","Chris Webb","Recruiter","L3","HR","NYC","E099","2021-01-10","",""],                // unknown manager
    ["E009","Jordan Kim","Comp Analyst","L4","","NYC","E003","2020-09-01","",""],               // no dept
    ["E010","Sam Idris","HRBP","L5","HR","NYC","E010","2018-05-01","",""],                      // self-manager
    ["E011","Dana Fox","Engineer","L2","Engineering","SF","E012","2022-01-01","",""],           // cycle 11<->12
    ["E012","Raj Patel","Engineer","L2","Engineering","SF","E011","2022-01-01","",""],
    ["E013","Kim Lee","Designer","L3","Design","SF","E014","2021-03-01","",""],                 // ambiguous manager name below
    ["E014","Alex Morgan","Design Mgr","M1","Design","SF","E002","2019-01-01","",""],
    ["E015","Alex Morgan","PM","L4","Product","SF","E002","2020-01-01","",""],                  // dup-person name
    ["E016","Robin Cole","Engineer","L3","Engineering","SF","Alex Morgan","2021-07-01","",""],  // ambiguous ref
    ["E017","Maya Ross","Ops Lead","M1","Operations","AUS","E001","2020-02-01","2019-01-01","Terminated"], // end<start + term w/ reports? no reports
    ["E018","Ben Ito","Analyst","L2","Operations","AUS","E017","2023-01-01","",""],             // reports to terminated
    ["E019","","Engineer","L2","Engineering","SF","E002","2023-04-01","",""],                    // missing name (fullName blank)
    ["E020","Gus Webb","Engineer","L3","Engineering","SF","E002","2022-08-01","",""],
    ["E020","Gus Webb","Engineer","L3","Engineering","SF","E002","2022-08-01","",""],            // dup id
    ["E021","Ida Blom","Engineer","L1","Engineering","SF","E002","2024-01-01","",""],
    ["E022","Nia Cruz","Engineer","L2","Engineering","SF","E002","2024-02-01","",""],
    ["E023","Oz Duke","Engineer","L3","Engineering","SF","E002","2024-03-01","",""],
    ["E024","Pat Quinn","Engineer","L4","Engineering","SF","E002","2024-04-01","",""],
  ];
  const header = ["Employee ID","Name","Job Title","Level","Department","Location","Manager","Hire Date","Term Date","Status"];
  return rowsToEmployees(header, rows);
}

// ── game state ──
let employees = [], cases = [], idx = 0, score = 0, streak = 0, bestStreak = 0, log = [], startedAt = 0, fixedCount = 0;

function openCases() { const done = new Set(log.filter(l => l.action !== "follow-up").map(l => l.key)); return cases.filter(c => !done.has(c.key)); }
function health() { return computeDataHealth(employees.length, openCases()); }

function start(emps) {
  employees = emps;
  cases = detectDataIssues(employees, { today: new Date().toISOString().slice(0, 10) });
  if (!cases.length) { alert("This file is spotless — no cases to solve! Try the sample data to see the game."); return; }
  idx = 0; score = 0; streak = 0; bestStreak = 0; log = []; fixedCount = 0; startedAt = Date.now();
  show("game"); render();
}

function render() {
  if (idx >= cases.length) return finish();
  const c = cases[idx];
  $("caseNo").textContent = `${idx + 1}/${cases.length}`;
  $("score").textContent = score;
  $("streak").textContent = streak >= 5 ? `${streak} 🔥x2` : streak;
  const h = health();
  $("healthFill").style.width = h + "%"; $("healthPct").textContent = h + "/100";
  $("sev").textContent = c.severity.toUpperCase(); $("sev").className = "sev " + c.severity;
  $("caseName").textContent = c.name || c.empId || "(unnamed record)";
  $("caseWho").textContent = `${c.empId ? "ID " + c.empId + " · " : ""}field: ${c.field}${c.value ? ` · current value: “${c.value}”` : ""}`;
  $("caseIssue").textContent = c.issue;
  $("caseHint").textContent = "💡 " + c.suggestion;
  $("fixRow").classList.remove("on"); $("fixInput").value = c.value || "";
}

function resolve(action, newValue) {
  const c = cases[idx];
  const mult = streak >= 5 ? 2 : 1;
  if (action === "verified") { score += 10 * mult; streak++; toast(`+${10 * mult} verified`); }
  else if (action === "fixed") {
    score += 15 * mult; streak++; fixedCount++;
    const emp = employees.find(e => e.id === c.empId && `${e.first} ${e.last}`.trim() === c.name) || employees.find(e => e.id === c.empId);
    if (emp) emp[c.field] = newValue;
    toast(`+${15 * mult} fixed`);
  } else { streak = 0; toast("flagged for follow-up"); }
  bestStreak = Math.max(bestStreak, streak);
  log.push({ key: c.key, empId: c.empId, name: c.name, field: c.field, issue: c.issue, action, newValue: newValue || "" });
  idx++; render();
}

function finish() {
  const h = health();
  const grade = h >= 95 ? "A+" : h >= 90 ? "A" : h >= 80 ? "B" : h >= 65 ? "C" : h >= 50 ? "D" : "F";
  const mins = Math.round((Date.now() - startedAt) / 6000) / 10;
  $("grade").textContent = grade;
  $("endSummary").innerHTML = `Data health <b>${h}/100</b> · ${score} points · ${cases.length} cases in ${mins} min`;
  const badges = [];
  if (fixedCount > 0) badges.push("🔧 First Fix");
  if (bestStreak >= 10) badges.push("🔥 Sharp Eye (10 streak)");
  if (!openCases().some(c => c.severity === "high")) badges.push("🚨 Case Closer — no high-severity left");
  if (!log.some(l => l.action === "follow-up")) badges.push("🧹 Perfect Sweep — nothing punted");
  if (mins <= 3 && cases.length >= 10) badges.push("⚡ Speed Run");
  $("badges").innerHTML = badges.map(b => `<span>${b}</span>`).join("") || "<span>🕵️ Case file closed</span>";
  $("logTable").innerHTML = "<tr><th>Person</th><th>Field</th><th>Issue</th><th>Action</th><th>New value</th></tr>" +
    log.map(l => `<tr><td>${l.name || l.empId}</td><td>${l.field}</td><td>${l.issue}</td><td>${l.action}</td><td>${l.newValue}</td></tr>`).join("");
  show("end");
}

// ── ingest paths ──
function download(name, content) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function ingestText(text) {
  const rows = parseCSV(text, detectDelimiter(text));
  if (rows.length < 2) { alert("Need a header row plus at least one data row."); return; }
  start(rowsToEmployees(rows[0], rows.slice(1)));
}
function ingestFile(file) {
  const r = new FileReader();
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    r.onload = (ev) => {
      const wb = window.XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
      const aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false, blankrows: false });
      const rows = aoa.map(x => x.map(c => String(c ?? "")));
      if (rows.length < 2) { alert("The first sheet has no data rows."); return; }
      start(rowsToEmployees(rows[0], rows.slice(1)));
    };
    r.readAsArrayBuffer(file);
  } else { r.onload = (ev) => ingestText(String(ev.target.result || "")); r.readAsText(file); }
}

// ── wire up ──
const LS_KEY = "orgSimDetectiveLookup";
$("providerUrl").value = localStorage.getItem(LS_KEY) || $("providerUrl").value;
$("providerSel").onchange = () => { if ($("providerSel").value !== "custom") $("providerUrl").value = $("providerSel").value; };
$("providerUrl").oninput = () => localStorage.setItem(LS_KEY, $("providerUrl").value);

$("drop").onclick = () => $("file").click();
$("file").onchange = (e) => { const f = e.target.files?.[0]; if (f) ingestFile(f); e.target.value = ""; };
window.addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("on"); });
window.addEventListener("dragleave", (e) => { if (!e.relatedTarget) $("drop").classList.remove("on"); });
window.addEventListener("drop", (e) => { e.preventDefault(); $("drop").classList.remove("on"); const f = e.dataTransfer?.files?.[0]; if (f) ingestFile(f); });
window.addEventListener("paste", (e) => {
  if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
  const t = e.clipboardData?.getData("text"); if (t && t.split(/\r?\n/).length > 1) { e.preventDefault(); ingestText(t); }
});
$("sampleBtn").onclick = () => start(sampleData());

$("lookupBtn").onclick = () => {
  const c = cases[idx]; if (!c) return;
  const q = encodeURIComponent(`${c.name || c.empId} ${c.field === "managerId" && c.value ? c.value : ""}`.trim());
  window.open(($("providerUrl").value || "https://app.glean.com/search?q={query}").replace("{query}", q), "_blank", "noopener");
};
$("okBtn").onclick = () => resolve("verified");
$("skipBtn").onclick = () => resolve("follow-up");
$("fixBtn").onclick = () => { $("fixRow").classList.add("on"); $("fixInput").focus(); };
$("fixApply").onclick = () => resolve("fixed", $("fixInput").value.trim());
$("fixInput").onkeydown = (e) => { if (e.key === "Enter") resolve("fixed", $("fixInput").value.trim()); };

$("dlFixed").onclick = () => {
  const cols = ["id", "first", "last", "title", "level", "dept", "location", "managerId", "startDate", "endDate", "status"];
  download(`corrected-roster-${new Date().toISOString().slice(0, 10)}.csv`,
    [cols.join(","), ...employees.map(e => cols.map(k => csvCell(e[k])).join(","))].join("\n"));
};
$("dlLog").onclick = () => {
  download(`data-fix-log-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Employee ID,Name,Field,Issue,Action,New value", ...log.map(l => [l.empId, l.name, l.field, l.issue, l.action, l.newValue].map(csvCell).join(","))].join("\n"));
};
$("again").onclick = () => { show("setup"); };
