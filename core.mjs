// core.mjs — pure, self-contained, dependency-closed helpers extracted from app.jsx
// for unit testing under node:test. ZERO app-only globals (React, DOM, etc).
//
// IMPORTANT: build.mjs strips the `export ` keyword from this file and prepends the
// result ahead of app.jsx before transpiling, so app.jsx's bare references to these
// names keep resolving at build time exactly as before this extraction.

// ─── LEVEL DISPLAY MAPPING (L1-L7 / M1-M4 / E1-E3) ───
// Internal data still uses IC1..C-Suite; UI surfaces the new labels via displayLevel().
export const LEVEL_ORDER = ["IC1","IC2","IC3","IC4","IC5","IC6","Manager","Director","VP","SVP","C-Suite"];

export const LEVEL_LABELS = {
  IC1: "L1", IC2: "L2", IC3: "L3", IC4: "L4", IC5: "L5", IC6: "L6",
  Manager: "M1", Director: "M2",
  VP: "E1", SVP: "E2", "C-Suite": "E3",
};
export const ALL_DISPLAY_LEVELS = ["L1","L2","L3","L4","L5","L6","L7","M1","M2","M3","M4","E1","E2","E3"];
export const EARLY_DISPLAY_LEVELS = new Set(["L1","L2"]);
export function displayLevel(level) { return LEVEL_LABELS[level] || level; }
export function isEarlyCareer(level) { return EARLY_DISPLAY_LEVELS.has(displayLevel(level)); }
export function levelTier(displayLvl) {
  if (displayLvl?.startsWith("L")) return "IC";
  if (displayLvl?.startsWith("M")) return "Manager";
  if (displayLvl?.startsWith("E")) return "Executive";
  return "Other";
}

// CSV cell escaper: handles RFC-4180 quoting AND blocks Excel formula injection
// by prefixing any value starting with =, +, -, @, tab, or CR with a single quote.
export function csvCell(v) {
  if (v == null) return "";
  let s = Array.isArray(v) ? v.join("|") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// RFC-4180-ish parser. `delimiter` defaults to comma but can be a tab/semicolon/pipe
// so tab-separated (Excel copy-paste), European semicolon CSVs, etc. all parse.
export function parseCSV(text, delimiter = ",") {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [], cell = "", inQuotes = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delimiter) { row.push(cell); cell = ""; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += ch; i++;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

// Sniff the most likely column delimiter from the first non-empty line. Handles the
// common cases: comma CSV, tab (TSV / Excel copy-paste), semicolon (European Excel),
// and pipe. Falls back to comma.
export function detectDelimiter(text) {
  if (!text) return ",";
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const firstLine = (text.split(/\r?\n/).find(l => l.trim() !== "") || "");
  const candidates = [",", "\t", ";", "|"];
  let best = ",", bestCount = 0;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

// Normalize a person name to a comparison key: handles "Last, First" vs "First Last",
// case, punctuation and extra spaces. Used to resolve manager references by name.
export function normNameKey(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const p = parseEmployeeName(s);
  const full = `${p.first} ${p.last}`.trim() || s;
  return full.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

// Resolve each employee's `managerId` against the roster: first as an employee ID,
// then — the big real-world win — by matching a manager NAME ("Reports To: John Smith")
// to a unique person. Self-references, unknown refs, ambiguous names, and reporting
// cycles are cleared to top-level. Mutates in place; returns stats for the report.
export function linkManagers(employees) {
  const idSet = new Set(employees.map(e => e.id));
  const nameIndex = new Map(); // normNameKey -> [ids]
  for (const e of employees) {
    const k = normNameKey(`${e.first || ""} ${e.last || ""}`);
    if (!k) continue;
    if (!nameIndex.has(k)) nameIndex.set(k, []);
    nameIndex.get(k).push(e.id);
  }
  const stats = { resolvedByName: 0, orphaned: [], ambiguous: [], selfRef: [], cyclesBroken: [] };
  for (const e of employees) {
    const ref = e.managerId;
    if (ref == null || ref === "") { e.managerId = null; continue; }
    if (ref === e.id) { e.managerId = null; stats.selfRef.push({ id: e.id, ref }); continue; }
    if (idSet.has(ref)) continue; // already a valid id
    const k = normNameKey(ref);
    const matches = k ? (nameIndex.get(k) || []).filter(id => id !== e.id) : [];
    if (matches.length === 1) { e.managerId = matches[0]; stats.resolvedByName++; continue; }
    if (matches.length > 1) { e.managerId = null; stats.ambiguous.push({ id: e.id, ref }); continue; }
    e.managerId = null; stats.orphaned.push({ id: e.id, ref });
  }
  // break reporting cycles (walk up to a root; if we revisit a node, cut the link)
  const idMap = new Map(employees.map(e => [e.id, e]));
  for (const e of employees) {
    const seen = new Set(); let cur = e;
    while (cur && cur.managerId) {
      if (seen.has(cur.id)) { e.managerId = null; stats.cyclesBroken.push({ id: e.id }); break; }
      seen.add(cur.id); cur = idMap.get(cur.managerId);
    }
  }
  return stats;
}

// Live preview stats for the import wizard: given raw rows + the column mapping, how
// many rows will import and how many managers will actually link (by id or name) vs.
// land at top-level — shown BEFORE importing so mis-mappings are caught early.
export function previewImportStats(rows, mapping) {
  const col = k => (mapping[k] ?? -1);
  const g = (row, i) => (i >= 0 ? String(row[i] ?? "").trim() : "");
  const idCol = col("id"), mgrCol = col("managerId");
  const fullCol = col("fullName"), firstCol = col("first"), lastCol = col("last");
  const hasId = idCol >= 0, hasMgr = mgrCol >= 0;
  const ids = new Set();
  const nameCount = new Map();
  let willImport = 0, blank = 0, dup = 0;
  for (const row of rows) {
    const id = g(row, idCol);
    if (!id) { blank++; continue; }
    if (ids.has(id)) { dup++; continue; }
    ids.add(id); willImport++;
    let first = g(row, firstCol), last = g(row, lastCol);
    if ((!first || !last) && fullCol >= 0) { const p = parseEmployeeName(g(row, fullCol)); first = first || p.first; last = last || p.last; }
    const k = normNameKey(`${first} ${last}`);
    if (k) nameCount.set(k, (nameCount.get(k) || 0) + 1);
  }
  let managersById = 0, managersByName = 0, topLevel = 0, orphan = 0, ambiguous = 0;
  if (hasMgr) {
    const seen = new Set();
    for (const row of rows) {
      const id = g(row, idCol);
      if (!id || seen.has(id)) continue; seen.add(id);
      const ref = g(row, mgrCol);
      if (!ref) { topLevel++; continue; }
      if (ids.has(ref) && ref !== id) { managersById++; continue; }
      const cnt = nameCount.get(normNameKey(ref)) || 0;
      if (cnt === 1) { managersByName++; continue; }
      if (cnt > 1) { ambiguous++; orphan++; continue; }
      orphan++;
    }
  } else {
    topLevel = willImport;
  }
  return { total: rows.length, willImport, blank, dup, hasId, hasMgr, managersById, managersByName, topLevel, orphan, ambiguous };
}

// Normalize any level input (internal IC1.., display L1/M1/E1, or common synonyms) to a canonical
// internal level. Returns null if unrecognized (caller defaults it).
export const _LVL_FROM_DISPLAY = Object.fromEntries(Object.entries(LEVEL_LABELS).map(([k, v]) => [v.toUpperCase(), k]));
export function normalizeLevel(raw) {
  if (!raw) return null;
  const v = raw.toString().trim();
  if (LEVEL_ORDER.includes(v)) return v;
  const u = v.toUpperCase();
  const internal = LEVEL_ORDER.find(l => l.toUpperCase() === u);
  if (internal) return internal;
  if (_LVL_FROM_DISPLAY[u]) return _LVL_FROM_DISPLAY[u];
  const s = u.replace(/[^A-Z0-9]/g, "");
  const SYN = {
    CEO: "C-Suite", CSUITE: "C-Suite", CLEVEL: "C-Suite", EXEC: "C-Suite", EXECUTIVE: "C-Suite", CXO: "C-Suite",
    SVP: "SVP", SENIORVP: "SVP", SENIORVICEPRESIDENT: "SVP",
    VP: "VP", VICEPRESIDENT: "VP",
    DIRECTOR: "Director", DIR: "Director", SENIORDIRECTOR: "Director", SRDIRECTOR: "Director",
    MANAGER: "Manager", MGR: "Manager", SENIORMANAGER: "Manager", SRMANAGER: "Manager", PEOPLEMANAGER: "Manager",
    IC: "IC3", INDIVIDUALCONTRIBUTOR: "IC3", STAFF: "IC5", PRINCIPAL: "IC6", SENIOR: "IC4", SR: "IC4", JUNIOR: "IC1", ENTRY: "IC1", INTERN: "IC1",
  };
  if (SYN[s]) return SYN[s];
  const num = parseInt(v, 10);
  if (!isNaN(num) && num >= 1 && num <= 6) return "IC" + num;
  return null;
}

// Density presets — the "compress the chart" control. Smaller cards, gaps and
// fonts pack more people into less space so a chart fits a smaller slide (or a
// corner of one) while staying legible. `lines` caps how many text rows a card
// shows so tight cards don't overflow.
export const SLIDE_DENSITY = {
  comfortable: { key: "comfortable", label: "Comfortable", cardW: 188, cardH: 66, hGap: 22, vGap: 52, nameSz: 14, subSz: 11, metaSz: 10, lines: 3 },
  compact:     { key: "compact",     label: "Compact",     cardW: 150, cardH: 50, hGap: 14, vGap: 40, nameSz: 12, subSz: 9,  metaSz: 8.5, lines: 3 },
  tight:       { key: "tight",       label: "Tight",       cardW: 118, cardH: 38, hGap: 10, vGap: 30, nameSz: 10, subSz: 8,  metaSz: 7.5, lines: 2 },
  micro:       { key: "micro",       label: "Micro",       cardW: 92,  cardH: 26, hGap: 7,  vGap: 24, nameSz: 8.5, subSz: 7, metaSz: 6.5, lines: 1 },
};

// Tidy top-down tree layout. Shows the root plus `maxDepth` generations of reports.
// Two compression levers:
//   • `dens` — card/gap sizing (see SLIDE_DENSITY).
//   • `wrap` — when a manager's reports are all leaves, pack them into a grid of
//     `wrapCols` columns (auto by default) instead of one very wide row, and draw
//     a light "team box" behind them with a single bracket connector. This is what
//     turns an unreadable 18-wide strip into a tidy block that scales up big.
// Returns cards (px x/y/w/h), links (polyline point lists), group rects, and bounds.
export function computeSlideLayout(root, { maxDepth, dens = SLIDE_DENSITY.comfortable, wrap = false, wrapCols = "auto", nodeCap = 200, openByManager = {} }) {
  const { cardW, cardH, hGap, vGap } = dens;
  const rowGap = Math.max(8, Math.round(vGap * 0.32)); // tighter vertical gap between wrapped grid rows
  const cards = [];
  const links = [];   // each: { pts: [[x,y], …] }
  const groups = [];  // each: { x, y, w, h } — team-box behind a wrapped grid
  let cursorX = 0;
  let truncated = false;

  // Shown children = real reports + any user-added "open position" ghost cards for
  // this manager. Open cards are synthetic leaves (children: []).
  const shown = (node, d) => {
    if (d >= maxDepth) return [];
    const real = node.children || [];
    const opens = openByManager[node.id] || [];
    return opens.length ? [...real, ...opens] : real;
  };
  // A child at depth d+1 will itself show children (is a "branch") when:
  const childBranches = (k, d) => (d + 1 < maxDepth) && k.children && k.children.length > 0;

  function place(node, d) {
    if (cards.length >= nodeCap) { truncated = true; return null; }
    const card = { node, depth: d, w: cardW, h: cardH, x: 0, y: d * (cardH + vGap), kids: [] };
    cards.push(card);
    const kids = shown(node, d);
    if (kids.length === 0) {
      if (d >= maxDepth && node.children && node.children.length > 0) truncated = true;
      card.x = cursorX; cursorX += cardW + hGap; return card;
    }

    const allLeaves = kids.every(k => !childBranches(k, d));
    // Grid-wrap only when it helps: wrapping on, every child a leaf, and enough of
    // them that a single row would be wide.
    if (wrap && allLeaves && kids.length > 3) {
      const n = kids.length;
      const cols = wrapCols === "auto"
        ? Math.max(2, Math.min(n, Math.round(Math.sqrt(n) * 1.6)))
        : Math.max(1, Math.min(n, wrapCols));
      const rows = Math.ceil(n / cols);
      const blockW = cols * cardW + (cols - 1) * hGap;
      const spanW = Math.max(blockW, cardW);
      const originX = cursorX;
      const bX = originX + (spanW - blockW) / 2;
      const childBaseY = (d + 1) * (cardH + vGap);
      kids.forEach((k, i) => {
        if (cards.length >= nodeCap) { truncated = true; return; }
        const cc = { node: k, depth: d + 1, w: cardW, h: cardH, kids: [],
          x: bX + (i % cols) * (cardW + hGap),
          y: childBaseY + Math.floor(i / cols) * (cardH + rowGap) };
        cards.push(cc); card.kids.push(cc);
      });
      card.x = originX + (spanW - cardW) / 2;
      cursorX = originX + spanW + hGap;
      const gh = rows * cardH + (rows - 1) * rowGap;
      groups.push({ x: bX - 9, y: childBaseY - 9, w: blockW + 18, h: gh + 18 });
      // bracket: parent bottom → down → across → down to top-center of the team box
      const busY = card.y + cardH + vGap * 0.45;
      links.push({ pts: [[card.x + cardW / 2, card.y + cardH], [card.x + cardW / 2, busY],
        [bX + blockW / 2, busY], [bX + blockW / 2, childBaseY - 9]] });
      return card;
    }

    // Normal tidy layout — recurse each child; children may themselves wrap.
    kids.forEach(k => { const cc = place(k, d + 1); if (cc) card.kids.push(cc); });
    if (card.kids.length === 0) { card.x = cursorX; cursorX += cardW + hGap; }
    else card.x = (card.kids[0].x + card.kids[card.kids.length - 1].x) / 2;
    const midY = card.y + cardH + vGap / 2;
    card.kids.forEach(c => links.push({ pts: [
      [card.x + cardW / 2, card.y + cardH], [card.x + cardW / 2, midY],
      [c.x + cardW / 2, midY], [c.x + cardW / 2, c.y]] }));
    return card;
  }
  place(root, 0);

  const minX = Math.min(...cards.map(c => c.x), ...groups.map(g => g.x));
  if (minX !== 0) {
    cards.forEach(c => (c.x -= minX));
    groups.forEach(g => (g.x -= minX));
    links.forEach(l => l.pts.forEach(p => (p[0] -= minX)));
  }
  const width  = Math.max(...cards.map(c => c.x + c.w), ...groups.map(g => g.x + g.w));
  const height = Math.max(...cards.map(c => c.y + c.h), ...groups.map(g => g.y + g.h));

  return { cards, links, groups, width, height, count: cards.length, truncated };
}

// ─── FULL ORG BOOK (recursive multi-slide deck) ───
// Breadth-first walk of the tree producing a flat, plain-data slide plan: an overview
// slide for the root, then one slide per manager (a node with children), shallower
// depths first. Cycle-safe via a visited set. Returns only ids + strings (no node
// objects) so the deck-building UI stays free to resolve nodes however it likes.
export function enumerateBookNodes(root, { slideCap = 60 } = {}) {
  if (!root) return { slides: [], truncated: false };
  const name = `${root.first || ""} ${root.last || ""}`.trim();
  const slides = [{
    nodeId: root.id, depth: 0,
    title: `${name}'s organization`,
    subtitle: `${(root.children || []).length} direct reports`,
  }];
  let truncated = false;
  const visited = new Set([root.id]);
  let queue = (root.children || []).map(c => ({ node: c, depth: 1 }));
  while (queue.length) {
    const next = [];
    for (const { node, depth } of queue) {
      if (!node || visited.has(node.id)) continue;
      visited.add(node.id);
      const kids = node.children || [];
      if (kids.length > 0) {
        if (slides.length >= slideCap) { truncated = true; continue; }
        const nm = `${node.first || ""} ${node.last || ""}`.trim();
        const prefix = node.title ? `${node.title} · ` : "";
        slides.push({
          nodeId: node.id, depth,
          title: `${nm}'s team`,
          subtitle: `${prefix}${kids.length} reports`,
        });
      }
      kids.forEach(k => next.push({ node: k, depth: depth + 1 }));
    }
    queue = next;
  }
  return { slides, truncated };
}

// ─── HRIS-GRADE IMPORT HELPERS ───
// Split a single "full name" cell into { first, last }. Tolerant of extra
// whitespace and never throws — worst case both fields come back empty.
// "Last, First" convention (comma present) takes priority over space-splitting,
// since that's the dominant HRIS export convention (Workday, SAP, etc).
export function parseEmployeeName(raw) {
  const s = (raw == null ? "" : String(raw)).trim();
  if (!s) return { first: "", last: "" };
  const commaIdx = s.indexOf(",");
  if (commaIdx >= 0) {
    const last = s.slice(0, commaIdx).trim();
    const first = s.slice(commaIdx + 1).trim();
    return { first, last };
  }
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: "", last: "" };
  if (tokens.length === 1) return { first: tokens[0], last: "" };
  if (tokens.length === 2) return { first: tokens[0], last: tokens[1] };
  return { first: tokens[0], last: tokens[tokens.length - 1] }; // 3+: drop middle token(s)
}

// Parse a raw HRIS date cell into { iso: "YYYY-MM-DD"|null, ok, raw }. Accepts:
// ISO (YYYY-MM-DD), YYYY/MM/DD, US M/D/YYYY, D-Mon-YYYY (month name, case-insensitive),
// and Excel serial-date integers (epoch 1899-12-30, the standard JS conversion trick
// that already accounts for Excel's 1900-leap-year bug) in a plausible 20000-60000
// range (~1954-2064). Never guesses ambiguous formats, always validates the resulting
// calendar date is real (rejects e.g. 2020-02-30), and never throws.
const _HRIS_MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
function _hrisPad2(n) { return String(n).padStart(2, "0"); }
function _hrisValidYMD(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
export function parseHrisDate(raw) {
  try {
    const s = (raw == null ? "" : String(raw)).trim();
    const fail = { iso: null, ok: false, raw };
    if (!s) return fail;

    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      if (n >= 20000 && n <= 60000) {
        const dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
        const y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + 1, d = dt.getUTCDate();
        if (_hrisValidYMD(y, mo, d)) return { iso: `${y}-${_hrisPad2(mo)}-${_hrisPad2(d)}`, ok: true, raw };
      }
      return fail;
    }

    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const y = +m[1], mo = +m[2], d = +m[3];
      return _hrisValidYMD(y, mo, d) ? { iso: `${y}-${_hrisPad2(mo)}-${_hrisPad2(d)}`, ok: true, raw } : fail;
    }

    m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (m) {
      const y = +m[1], mo = +m[2], d = +m[3];
      return _hrisValidYMD(y, mo, d) ? { iso: `${y}-${_hrisPad2(mo)}-${_hrisPad2(d)}`, ok: true, raw } : fail;
    }

    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const mo = +m[1], d = +m[2], y = +m[3];
      return _hrisValidYMD(y, mo, d) ? { iso: `${y}-${_hrisPad2(mo)}-${_hrisPad2(d)}`, ok: true, raw } : fail;
    }

    m = s.match(/^(\d{1,2})-([A-Za-z]{3,9})-(\d{4})$/);
    if (m) {
      const mo = _HRIS_MONTHS[m[2].toLowerCase().slice(0, 3)];
      const d = +m[1], y = +m[3];
      if (mo && _hrisValidYMD(y, mo, d)) return { iso: `${y}-${_hrisPad2(mo)}-${_hrisPad2(d)}`, ok: true, raw };
      return fail;
    }

    return fail;
  } catch {
    return { iso: null, ok: false, raw };
  }
}

// ─── SCENARIO COMPARE / DIFF ───
// Pure diff over two plain employee-array snapshots. No React/DOM. O(n) via lookup maps.
function _nameOf(rec) { return rec ? `${rec.first || ""} ${rec.last || ""}`.trim() : ""; }

function _spanByManager(list) {
  const spans = new Map();
  for (const e of list) {
    if (e.managerId == null) continue;
    spans.set(e.managerId, (spans.get(e.managerId) || 0) + 1);
  }
  return spans;
}

function _countBy(list, key) {
  const counts = new Map();
  for (const e of list) {
    const k = e[key] == null ? "—" : e[key];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

// Depth of each node (root = 0), walking managerId chains. Guards cycles with a
// per-walk visited set so a malformed chain (or a cycle) can't hang the function.
function _computeDepths(list, byId) {
  const depth = new Map();
  for (const e of list) {
    if (depth.has(e.id)) continue;
    const chain = [];
    let cur = e;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      if (depth.has(cur.id)) break;
      seen.add(cur.id);
      chain.push(cur.id);
      cur = cur.managerId != null ? byId.get(cur.managerId) : null;
    }
    let base = cur && depth.has(cur.id) ? depth.get(cur.id) + 1 : 0;
    for (let i = chain.length - 1; i >= 0; i--) { depth.set(chain[i], base); base++; }
  }
  return depth;
}

function _depthCounts(list, byId) {
  const depth = _computeDepths(list, byId);
  const byDepth = {};
  let maxDepth = 0;
  for (const e of list) {
    const d = depth.get(e.id) ?? 0;
    byDepth[d] = (byDepth[d] || 0) + 1;
    if (d > maxDepth) maxDepth = d;
  }
  return { maxDepth, byDepth };
}

export function diffScenarios(beforeEmployees, afterEmployees) {
  const before = beforeEmployees || [];
  const after = afterEmployees || [];
  const beforeById = new Map(before.map(e => [e.id, e]));
  const afterById = new Map(after.map(e => [e.id, e]));

  const added = [];
  for (const e of after) {
    if (!beforeById.has(e.id)) added.push({ id: e.id, name: _nameOf(e), dept: e.dept ?? null, managerId: e.managerId ?? null });
  }
  const removed = [];
  for (const e of before) {
    if (!afterById.has(e.id)) removed.push({ id: e.id, name: _nameOf(e), dept: e.dept ?? null, managerId: e.managerId ?? null });
  }

  const reportingChanges = [];
  for (const e of after) {
    const b = beforeById.get(e.id);
    if (!b) continue; // handled by added/removed
    const fromMgrId = b.managerId ?? null;
    const toMgrId = e.managerId ?? null;
    if (fromMgrId !== toMgrId) {
      reportingChanges.push({
        id: e.id,
        name: _nameOf(e) || _nameOf(b),
        fromManagerId: fromMgrId,
        fromManagerName: fromMgrId != null ? _nameOf(beforeById.get(fromMgrId)) : null,
        toManagerId: toMgrId,
        toManagerName: toMgrId != null ? _nameOf(afterById.get(toMgrId)) : null,
      });
    }
  }

  const beforeSpans = _spanByManager(before);
  const afterSpans = _spanByManager(after);
  const spanChanges = [];
  const allManagerIds = new Set([...beforeSpans.keys(), ...afterSpans.keys()]);
  for (const mgrId of allManagerIds) {
    const fromSpan = beforeSpans.get(mgrId) || 0;
    const toSpan = afterSpans.get(mgrId) || 0;
    if (fromSpan !== toSpan) {
      const mgrRec = afterById.get(mgrId) || beforeById.get(mgrId);
      spanChanges.push({ managerId: mgrId, name: _nameOf(mgrRec), fromSpan, toSpan, delta: toSpan - fromSpan });
    }
  }

  const beforeDept = _countBy(before, "dept");
  const afterDept = _countBy(after, "dept");
  const deptDeltas = [];
  for (const dept of new Set([...beforeDept.keys(), ...afterDept.keys()])) {
    const b = beforeDept.get(dept) || 0;
    const a = afterDept.get(dept) || 0;
    deptDeltas.push({ dept, before: b, after: a, delta: a - b });
  }

  const beforeLevel = _countBy(before, "level");
  const afterLevel = _countBy(after, "level");
  const levelDeltas = [];
  for (const level of new Set([...beforeLevel.keys(), ...afterLevel.keys()])) {
    const b = beforeLevel.get(level) || 0;
    const a = afterLevel.get(level) || 0;
    levelDeltas.push({ level, before: b, after: a, delta: a - b });
  }

  const beforeDepth = _depthCounts(before, beforeById);
  const afterDepth = _depthCounts(after, afterById);

  return {
    added,
    removed,
    reportingChanges,
    spanChanges,
    deptDeltas,
    levelDeltas,
    layers: {
      beforeMaxDepth: beforeDepth.maxDepth,
      afterMaxDepth: afterDepth.maxDepth,
      beforeByDepth: beforeDepth.byDepth,
      afterByDepth: afterDepth.byDepth,
    },
  };
}
