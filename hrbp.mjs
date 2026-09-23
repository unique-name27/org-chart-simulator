// hrbp.mjs — pure HRBP metrics engine. Same conventions as core.mjs: pure functions,
// `export`, dependency-closed (ZERO app-only globals — no React/DOM, no bare references
// to app.jsx/core.mjs names). build.mjs merges this file (export stripped) into the build
// scope right after core.mjs, so app.jsx's bare references to these names resolve at
// build time exactly like core.mjs's.
//
// Grouping keys that echo raw employee data (e.g. "by level") use the INTERNAL level
// string (IC1..C-Suite) rather than the display code (L1/M1/E1) — callers in app.jsx
// already have displayLevel()/LEVEL_ORDER in scope and do that translation for the UI.
//
// Dates: every date field on an employee is an ISO "YYYY-MM-DD" string (or null). All
// date math here goes through toUtcDate(), which parses "YYYY-MM-DD" as UTC midnight —
// this avoids the classic local-timezone off-by-one-day bug when comparing window edges.

// ─── Anonymity threshold ───
// Any cut (engagement, gender, pay-equity) with fewer than this many people is
// suppressed in the UI as "—" rather than shown.
export const MIN_GROUP = 5;

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Date helpers ──
// ─────────────────────────────────────────────────────────────────────────────────────

// String-keyed parse cache: employee date fields are read over and over (once per
// month-end snapshot, once per metric, once per quarter, per sub-org...) and the same
// employee object's startDate/endDate string is passed in every time, so memoizing the
// parse is the single biggest win for computeHrbpMetrics' ~50ms budget on a few thousand
// employees. Cached Date instances are never mutated anywhere in this module (every
// derived date is built with `new Date(Date.UTC(...))`), so sharing instances is safe.
// Module-level and never evicted — bounded by the number of distinct date strings that
// have ever appeared in a loaded roster (at most a few tens of thousands), not by time.
const _parseCache = new Map();

function _parseDateString(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = +m[1], mo = +m[2], day = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, day));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== day) return null;
    return dt;
  }
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

// Parses a Date, or an ISO-ish string, into a UTC-midnight Date. Returns null on failure.
export function toUtcDate(d) {
  if (d == null) return null;
  if (typeof d === "string") {
    const cached = _parseCache.get(d);
    if (cached !== undefined) return cached;
    const result = _parseDateString(d);
    _parseCache.set(d, result);
    return result;
  }
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return null;
    // Use UTC getters, not local getters: every Date this module produces (addMonthsUtc,
    // monthEndPoints, "latest" scans, etc.) is already UTC-midnight-normalized, and local
    // getters would shift it a calendar day in any negative-UTC-offset timezone. For a
    // genuine "now" Date (e.g. the asOf-capping call in resolveAsOf), this reads its UTC
    // calendar day — a deterministic, timezone-independent notion of "today".
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return null;
}

// ISO "YYYY-MM-DD" for a UTC Date (or any value toUtcDate can parse).
export function isoOf(d) {
  const u = toUtcDate(d);
  return u ? u.toISOString().slice(0, 10) : null;
}

function addMonthsUtc(d, n) {
  const u = toUtcDate(d);
  return new Date(Date.UTC(u.getUTCFullYear(), u.getUTCMonth() + n, u.getUTCDate()));
}

const MS_PER_DAY = 86400000;
const DAYS_PER_YEAR = 365.25;

// ─────────────────────────────────────────────────────────────────────────────────────
// ── asOf resolution ──
// ─────────────────────────────────────────────────────────────────────────────────────

// Sample data: the app passes `fallback` (its FIXED_NOW) and gets it back verbatim — the
// fixed reference date is used as-is rather than derived from whatever dates happen to
// exist in the generated sample.
// Imported data: the app passes `fallback = null` and this scans startDate/endDate/
// lastPromoDate/lastTransferDate for the latest date found, capped at the real today (an
// HRIS export can't contain future data; if it somehow does, we don't want a future asOf).
export function resolveAsOf(employees, fallback) {
  if (fallback) return isoOf(fallback);
  let latest = null;
  (employees || []).forEach(e => {
    if (!e) return;
    [e.startDate, e.endDate, e.lastPromoDate, e.lastTransferDate].forEach(d => {
      if (!d) return;
      const u = toUtcDate(d);
      if (u && (!latest || u > latest)) latest = u;
    });
  });
  const today = toUtcDate(new Date());
  if (!latest) return isoOf(today);
  return isoOf(latest > today ? today : latest);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Active / FTE predicates ──
// ─────────────────────────────────────────────────────────────────────────────────────

// Active at date d: startDate <= d and (no endDate or endDate > d). Pure date logic —
// works for any employee regardless of employment type (contractors included); callers
// that need "active FTE" combine this with isFte().
export function isActiveAt(emp, d) {
  if (!emp || !emp.startDate) return false;
  const dd = toUtcDate(d);
  const sd = toUtcDate(emp.startDate);
  if (!dd || !sd || sd > dd) return false;
  if (!emp.endDate) return true;
  const ed = toUtcDate(emp.endDate);
  return !ed || ed > dd;
}

export function isFte(emp) {
  return (emp && emp.employmentType ? emp.employmentType : "FTE") === "FTE";
}

export function computeHeadcount(employees, asOf) {
  let n = 0;
  for (const e of employees) if (isFte(e) && isActiveAt(e, asOf)) n++;
  return n;
}

export function computeContractorCount(employees, asOf) {
  let n = 0;
  for (const e of employees) if (!isFte(e) && isActiveAt(e, asOf)) n++;
  return n;
}

// The 13 month-end points spanning a trailing `months`-month window (asOf-months .. asOf),
// inclusive of both ends — 13 points for the default 12-month window. Cached by (asOf,
// months): the same window gets requested from several different metric functions within
// one computeHrbpMetrics call (attrition, promotion, the quarterly loop's own avg...).
const _monthEndCache = new Map();
export function monthEndPoints(asOf, months = 12) {
  const key = isoOf(asOf) + "|" + months;
  const cached = _monthEndCache.get(key);
  if (cached) return cached;
  const end = toUtcDate(asOf);
  const pts = [];
  for (let i = months; i >= 0; i--) pts.push(addMonthsUtc(end, -i));
  _monthEndCache.set(key, pts);
  return pts;
}

// Memoized per (employees array identity, asOf, months): computeAttritionRates,
// computePromotionRate/computeInternalMobilityRate and the caller's own headline number
// all ask for the SAME 12-month avg headcount on the SAME scoped array within one
// computeHrbpMetrics call — recomputing the 13-point scan each time was the dominant cost
// (~600ms for 3k employees before this cache; low double-digit ms after).
const _avgHcCache = new WeakMap(); // employees array -> Map(`${asOfIso}|${months}` -> avg)
export function computeAvgHeadcount(employees, asOf, months = 12) {
  let cache = _avgHcCache.get(employees);
  if (!cache) { cache = new Map(); _avgHcCache.set(employees, cache); }
  const key = isoOf(asOf) + "|" + months;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const pts = monthEndPoints(asOf, months);
  const sum = pts.reduce((s, d) => s + computeHeadcount(employees, d), 0);
  const avg = sum / pts.length;
  cache.set(key, avg);
  return avg;
}

// (start, end] — exclusive start, inclusive end, matching the spec's window definition.
export function windowBounds(asOf, months = 12) {
  const end = toUtcDate(asOf);
  const start = addMonthsUtc(end, -months);
  return { start, end };
}

function inWindow(dateVal, start, end) {
  const d = toUtcDate(dateVal);
  if (!d) return false;
  return d > start && d <= end;
}

export function hiresInWindow(employees, asOf, months = 12) {
  const { start, end } = windowBounds(asOf, months);
  return employees.filter(e => isFte(e) && inWindow(e.startDate, start, end));
}

export function exitsInWindow(employees, asOf, months = 12) {
  const { start, end } = windowBounds(asOf, months);
  return employees.filter(e => isFte(e) && e.endDate && inWindow(e.endDate, start, end));
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Attrition ──
// ─────────────────────────────────────────────────────────────────────────────────────

// Annualized attrition % = exits / avgHC * (12 / windowMonths). Voluntary/Involuntary/
// Regretted read null ("n/a") when not a single exit in the window has termType set —
// i.e. the dataset simply doesn't carry that field, vs. genuinely zero of that type.
export function computeAttritionRates(employees, asOf, months = 12) {
  const avgHc = computeAvgHeadcount(employees, asOf, months);
  const exits = exitsInWindow(employees, asOf, months);
  const annualize = 12 / months;
  const rate = (n) => (avgHc > 0 ? (n / avgHc) * 100 * annualize : 0);
  const hasTermType = exits.some(e => e.termType === "Voluntary" || e.termType === "Involuntary");
  const vol = exits.filter(e => e.termType === "Voluntary");
  const invol = exits.filter(e => e.termType === "Involuntary");
  const regretted = vol.filter(e => e.regretted === true);
  return {
    avgHeadcount: avgHc,
    exitsCount: exits.length,
    overall: rate(exits.length),
    voluntary: hasTermType ? rate(vol.length) : null,
    involuntary: hasTermType ? rate(invol.length) : null,
    regretted: hasTermType ? rate(regretted.length) : null,
    voluntaryCount: vol.length,
    involuntaryCount: invol.length,
    regrettedCount: regretted.length,
    exits,
  };
}

// Cohort = FTEs hired in (asOf-24mo, asOf-12mo]. % of cohort whose endDate < startDate+365d.
export function computeFirstYearAttrition(employees, asOf) {
  const end = toUtcDate(asOf);
  const cohortStart = addMonthsUtc(end, -24);
  const cohortEnd = addMonthsUtc(end, -12);
  const cohort = employees.filter(e => isFte(e) && inWindow(e.startDate, cohortStart, cohortEnd));
  if (!cohort.length) return { rate: null, cohortN: 0, leftN: 0 };
  let left = 0;
  cohort.forEach(e => {
    if (!e.endDate) return;
    const sd = toUtcDate(e.startDate), ed = toUtcDate(e.endDate);
    if (sd && ed && (ed - sd) < 365 * MS_PER_DAY) left++;
  });
  return { rate: (left / cohort.length) * 100, cohortN: cohort.length, leftN: left };
}

// Of FTEs active at asOf-12mo, % still active at asOf.
export function computeRetention12mo(employees, asOf) {
  const end = toUtcDate(asOf);
  const start = addMonthsUtc(end, -12);
  const activeAtStart = employees.filter(e => isFte(e) && isActiveAt(e, start));
  if (!activeAtStart.length) return { rate: null, baseN: 0 };
  const stillActive = activeAtStart.filter(e => isActiveAt(e, end));
  return { rate: (stillActive.length / activeAtStart.length) * 100, baseN: activeAtStart.length };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Movement (promotion / internal mobility) ──
// ─────────────────────────────────────────────────────────────────────────────────────

// rate reads null ("n/a") when not a single person in scope carries lastPromoDate at all —
// i.e. the dataset doesn't carry that column, vs. genuinely zero promotions.
export function computePromotionRate(employees, asOf, months = 12) {
  const { start, end } = windowBounds(asOf, months);
  const avgHc = computeAvgHeadcount(employees, asOf, months);
  const hasField = employees.some(e => e && e.lastPromoDate != null);
  const people = employees.filter(e =>
    isFte(e) && e.lastPromoDate && inWindow(e.lastPromoDate, start, end) && isActiveAt(e, e.lastPromoDate));
  return { rate: !hasField ? null : (avgHc > 0 ? (people.length / avgHc) * 100 : 0), count: people.length, people };
}

// Same null-vs-zero treatment: needs at least one of lastPromoDate/lastTransferDate present
// in scope, otherwise the rate is "n/a" rather than a misleading 0.0%.
export function computeInternalMobilityRate(employees, asOf, months = 12) {
  const { start, end } = windowBounds(asOf, months);
  const avgHc = computeAvgHeadcount(employees, asOf, months);
  const hasField = employees.some(e => e && (e.lastPromoDate != null || e.lastTransferDate != null));
  const promos = employees.filter(e => isFte(e) && e.lastPromoDate && inWindow(e.lastPromoDate, start, end));
  const transfers = employees.filter(e => isFte(e) && e.lastTransferDate && inWindow(e.lastTransferDate, start, end));
  const count = promos.length + transfers.length;
  return { rate: !hasField ? null : (avgHc > 0 ? (count / avgHc) * 100 : 0), count, promoCount: promos.length, transferCount: transfers.length };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Org design (span of control / layers / manager ratio) ──
// ─────────────────────────────────────────────────────────────────────────────────────

// Manager = active FTE with >= 1 active (FTE) direct report. Returns aggregate stats plus
// a byManager map so callers (alerts, sub-org rows) don't have to re-derive it.
export function computeSpanOfControl(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const activeIds = new Set(activeFte.map(e => e.id));
  const byManager = new Map();
  activeFte.forEach(e => {
    if (e.managerId == null || !activeIds.has(e.managerId)) return;
    byManager.set(e.managerId, (byManager.get(e.managerId) || 0) + 1);
  });
  const spans = [...byManager.values()];
  const mean = spans.length ? spans.reduce((s, n) => s + n, 0) / spans.length : 0;
  const sorted = [...spans].sort((a, b) => a - b);
  const median = sorted.length
    ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : 0;
  const narrowCount = spans.filter(n => n <= 2).length;
  const wideCount = spans.filter(n => n >= 12).length;
  const managerCount = spans.length;
  const icCount = Math.max(0, activeFte.length - managerCount);
  return {
    mean, median, spans, byManager, managerCount, narrowCount, wideCount,
    managerRatio: managerCount > 0 ? icCount / managerCount : null,
    totalActive: activeFte.length,
  };
}

// Depth of each in-scope active FTE below the shallowest in-scope person(s) on their
// manager chain — i.e. relative to the scope, not the whole company. `scopeIdSet` is the
// set of employee ids considered in-scope (from inScopeFn). Cycle-guarded.
export function computeLayers(employees, asOf, scopeIdSet) {
  const byId = new Map(employees.map(e => [e.id, e]));
  const depthMemo = new Map();
  function depthOf(id, guard) {
    if (depthMemo.has(id)) return depthMemo.get(id);
    if (guard.has(id)) return 0;
    guard.add(id);
    const emp = byId.get(id);
    const mgrId = emp ? emp.managerId : null;
    const d = (mgrId != null && scopeIdSet.has(mgrId)) ? 1 + depthOf(mgrId, guard) : 0;
    depthMemo.set(id, d);
    return d;
  }
  let maxDepth = 0;
  employees.forEach(e => {
    if (!scopeIdSet.has(e.id) || !isFte(e) || !isActiveAt(e, asOf)) return;
    maxDepth = Math.max(maxDepth, depthOf(e.id, new Set()));
  });
  return maxDepth + 1; // a single flat scope (root only) reads as "1 layer"
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Tenure / performance ──
// ─────────────────────────────────────────────────────────────────────────────────────

export function computeAvgTenureYears(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  if (!activeFte.length) return 0;
  const end = toUtcDate(asOf);
  const totalYears = activeFte.reduce((s, e) => s + (end - toUtcDate(e.startDate)) / (DAYS_PER_YEAR * MS_PER_DAY), 0);
  return totalYears / activeFte.length;
}

export function computeTenureBands(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const end = toUtcDate(asOf);
  const bands = { "<1": 0, "1-2": 0, "2-5": 0, "5-10": 0, "10+": 0 };
  activeFte.forEach(e => {
    const yrs = (end - toUtcDate(e.startDate)) / (DAYS_PER_YEAR * MS_PER_DAY);
    if (yrs < 1) bands["<1"]++;
    else if (yrs < 2) bands["1-2"]++;
    else if (yrs < 5) bands["2-5"]++;
    else if (yrs < 10) bands["5-10"]++;
    else bands["10+"]++;
  });
  return bands;
}

export function computePerformanceDistribution(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let notRated = 0;
  activeFte.forEach(e => {
    if (e.perfRating == null) { notRated++; return; }
    if (dist[e.perfRating] != null) dist[e.perfRating]++;
  });
  return { dist, notRated, total: activeFte.length };
}

export function highPerformers(employees, asOf) {
  return employees.filter(e => isFte(e) && isActiveAt(e, asOf) && e.perfRating != null && e.perfRating >= 4);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Pay ──
// ─────────────────────────────────────────────────────────────────────────────────────

export function compaRatioOf(emp) {
  if (emp == null) return null;
  if (typeof emp.compaRatio === "number" && isFinite(emp.compaRatio)) return emp.compaRatio;
  if (typeof emp.salary === "number" && typeof emp.rangeMid === "number" && emp.rangeMid > 0) {
    return emp.salary / emp.rangeMid;
  }
  return null;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

export function computeCompaStats(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const compas = activeFte.map(e => compaRatioOf(e)).filter(c => c != null);
  return {
    median: median(compas),
    belowRangeCount: compas.filter(c => c < 0.90).length,
    aboveRangeCount: compas.filter(c => c > 1.10).length,
    n: compas.length,
  };
}

export function computeCompaByLevel(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const byLevel = new Map();
  activeFte.forEach(e => {
    const c = compaRatioOf(e);
    if (c == null) return;
    if (!byLevel.has(e.level)) byLevel.set(e.level, []);
    byLevel.get(e.level).push(c);
  });
  const rows = [];
  byLevel.forEach((arr, level) => rows.push({ level, median: median(arr), n: arr.length }));
  return rows;
}

// Pay equity gap by level: (median compa men - median compa women) / median compa men.
// Suppressed (women/men n < MIN_GROUP on either side) rows carry suppressed:true.
export function computePayEquityByLevel(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const byLevel = new Map();
  activeFte.forEach(e => {
    const c = compaRatioOf(e);
    if (c == null || e.gender == null) return;
    if (!byLevel.has(e.level)) byLevel.set(e.level, { women: [], men: [] });
    const bucket = byLevel.get(e.level);
    if (e.gender === "Woman") bucket.women.push(c);
    else if (e.gender === "Man") bucket.men.push(c);
  });
  const rows = [];
  byLevel.forEach((bucket, level) => {
    const nWomen = bucket.women.length, nMen = bucket.men.length;
    if (nWomen < MIN_GROUP || nMen < MIN_GROUP) { rows.push({ level, suppressed: true, nWomen, nMen }); return; }
    const medianWomen = median(bucket.women), medianMen = median(bucket.men);
    const gapPct = medianMen > 0 ? ((medianMen - medianWomen) / medianMen) * 100 : null;
    rows.push({ level, suppressed: false, medianWomen, medianMen, gapPct, nWomen, nMen });
  });
  return rows;
}

export function highPerformersBelowRange(employees, asOf) {
  return highPerformers(employees, asOf).filter(e => {
    const c = compaRatioOf(e);
    return c != null && c < 0.90;
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Talent: retention-risk matrix, succession/bench, key talent at risk ──
// (riskBand is defined further below, but function declarations hoist within the module,
// so referencing it here is safe.)
// ─────────────────────────────────────────────────────────────────────────────────────

// High performers (rating>=4) at high flight risk. Exported so both the "Talent" tab's
// "key talent at risk" list and alert #3 use the exact same definition.
export function keyTalentAtRisk(employees, asOf, flightRisks) {
  flightRisks = flightRisks || {};
  return highPerformers(employees, asOf).filter(e => {
    const r = flightRisks[e.id];
    return r && riskBand(r.score) === "high";
  });
}

// High performers (rating>=4) with no promotion in >=3 years (or never, tenure >=3 yrs).
// Executives (VP/SVP/C-Suite) are excluded — "overdue for promotion" isn't a meaningful
// frame at the top of the ladder. Exported so the Talent/Movement tabs and alert #4 use
// the exact same definition.
const OVERDUE_PROMO_EXEC_LEVELS = new Set(["VP", "SVP", "C-Suite"]);
export function overduePromotionCandidates(employees, asOf) {
  const cutoff = addMonthsUtc(toUtcDate(asOf), -36);
  return highPerformers(employees, asOf).filter(e => {
    if (OVERDUE_PROMO_EXEC_LEVELS.has(e.level)) return false;
    const tenureYears = (toUtcDate(asOf) - toUtcDate(e.startDate)) / (DAYS_PER_YEAR * MS_PER_DAY);
    if (tenureYears < 3) return false;
    if (!e.lastPromoDate) return true;
    return toUtcDate(e.lastPromoDate) < cutoff;
  });
}

// 3x3 matrix: rating band (low 1-2 / core 3 / high 4-5) x flight-risk band (low/medium/high).
// Only active FTEs with BOTH a rating and a flight-risk score contribute a cell.
export function computeRetentionRiskMatrix(employees, asOf, flightRisks) {
  flightRisks = flightRisks || {};
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const ratingBand = (r) => (r == null ? null : r <= 2 ? "low" : r === 3 ? "core" : "high");
  const matrix = {};
  ["low", "core", "high"].forEach(rb => ["low", "medium", "high"].forEach(fb => { matrix[`${rb}|${fb}`] = []; }));
  activeFte.forEach(e => {
    const rb = ratingBand(e.perfRating);
    const risk = flightRisks[e.id];
    if (!rb || !risk) return;
    matrix[`${rb}|${riskBand(risk.score)}`].push(e);
  });
  return matrix;
}

// For each active Director+ with at least one direct report: a "ready successor" is a
// direct report (their tier-below, by construction of the reporting line) with rating>=4
// and flight risk not "high". A leader with zero direct reports isn't a coverage gap by
// this definition and is excluded from the denominator.
export function computeSuccession(employees, asOf, flightRisks) {
  flightRisks = flightRisks || {};
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const activeIds = new Set(activeFte.map(e => e.id));
  const leaders = activeFte.filter(e => isLeadershipTierLevel(e.level));
  const reportsByMgr = new Map();
  activeFte.forEach(e => {
    if (e.managerId == null || !activeIds.has(e.managerId)) return;
    if (!reportsByMgr.has(e.managerId)) reportsByMgr.set(e.managerId, []);
    reportsByMgr.get(e.managerId).push(e);
  });
  const rows = leaders.map(leader => {
    const reports = reportsByMgr.get(leader.id) || [];
    const ready = reports.filter(r => r.perfRating >= 4
      && (!flightRisks[r.id] || riskBand(flightRisks[r.id].score) !== "high"));
    return { leader, directReportCount: reports.length, hasReady: ready.length > 0, readySuccessors: ready };
  });
  const withReports = rows.filter(r => r.directReportCount > 0);
  const readyCount = withReports.filter(r => r.hasReady).length;
  return {
    readyPct: withReports.length > 0 ? (readyCount / withReports.length) * 100 : null,
    totalLeaderRoles: withReports.length,
    readyCount,
    uncovered: withReports.filter(r => !r.hasReady).map(r => r.leader),
    rows: withReports,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Engagement (eNPS) ──
// ─────────────────────────────────────────────────────────────────────────────────────

// Among respondents: % scoring 9-10 minus % scoring 0-6. Suppressed if respondents < MIN_GROUP.
export function computeENPS(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const respondents = activeFte.filter(e => e.surveyScore != null);
  const responseRate = activeFte.length > 0 ? (respondents.length / activeFte.length) * 100 : null;
  if (respondents.length < MIN_GROUP) {
    return { score: null, responseRate, respondentN: respondents.length, activeN: activeFte.length, suppressed: true };
  }
  const promoters = respondents.filter(e => e.surveyScore >= 9).length;
  const detractors = respondents.filter(e => e.surveyScore <= 6).length;
  const score = ((promoters - detractors) / respondents.length) * 100;
  return { score, responseRate, respondentN: respondents.length, activeN: activeFte.length, suppressed: false };
}

// One point per manager with >= MIN_GROUP survey respondents on their active FTE team:
// team eNPS, team voluntary attrition (T12M, exits whose managerId is this manager), and
// team size. Powers the Engagement tab's eNPS-vs-attrition scatter.
export function computeManagerEngagementScatter(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  // Engagement tab unlocks on surveyScore alone — termType can still be wholly absent from
  // the scope, in which case "team voluntary attrition" must read n/a, not a false 0% that
  // would cluster every point on the axis.
  const hasTermType = employees.some(e => e && (e.termType === "Voluntary" || e.termType === "Involuntary"));
  const byManager = new Map();
  activeFte.forEach(e => {
    if (e.managerId == null) return;
    if (!byManager.has(e.managerId)) byManager.set(e.managerId, []);
    byManager.get(e.managerId).push(e);
  });
  const { exits } = computeAttritionRates(employees, asOf, 12);
  const exitsByManager = new Map();
  exits.filter(e => e.termType === "Voluntary").forEach(e => {
    if (e.managerId == null) return;
    exitsByManager.set(e.managerId, (exitsByManager.get(e.managerId) || 0) + 1);
  });
  const points = [];
  byManager.forEach((team, managerId) => {
    const respondents = team.filter(e => e.surveyScore != null);
    if (respondents.length < MIN_GROUP) return;
    const promoters = respondents.filter(e => e.surveyScore >= 9).length;
    const detractors = respondents.filter(e => e.surveyScore <= 6).length;
    const enps = ((promoters - detractors) / respondents.length) * 100;
    const teamExits = exitsByManager.get(managerId) || 0;
    const teamAvgHc = team.length; // point-in-time team size stands in for the window average here
    const voluntaryAttrition = !hasTermType ? null : (teamAvgHc > 0 ? (teamExits / teamAvgHc) * 100 : 0);
    points.push({ managerId, teamSize: team.length, enps, voluntaryAttrition, respondentN: respondents.length });
  });
  return points;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Diversity / representation ──
// ─────────────────────────────────────────────────────────────────────────────────────

function isManagerTierLevel(level) {
  return level === "Manager" || isLeadershipTierLevel(level);
}
function isLeadershipTierLevel(level) {
  return level === "Director" || level === "VP" || level === "SVP" || level === "C-Suite";
}

export function computeRepresentation(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const pct = (part, base) => (base < MIN_GROUP ? null : (part / base) * 100);

  const withGender = activeFte.filter(e => e.gender != null);
  const women = withGender.filter(e => e.gender === "Woman").length;

  const mgmt = activeFte.filter(e => isManagerTierLevel(e.level) && e.gender != null);
  const womenMgmt = mgmt.filter(e => e.gender === "Woman").length;

  const lead = activeFte.filter(e => isLeadershipTierLevel(e.level) && e.gender != null);
  const womenLead = lead.filter(e => e.gender === "Woman").length;

  return {
    overall: pct(women, withGender.length), overallN: withGender.length,
    management: pct(womenMgmt, mgmt.length), managementN: mgmt.length,
    leadership: pct(womenLead, lead.length), leadershipN: lead.length,
  };
}

export function computeRepresentationByLevel(employees, asOf) {
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf) && e.gender != null);
  const byLevel = new Map();
  activeFte.forEach(e => {
    if (!byLevel.has(e.level)) byLevel.set(e.level, { Woman: 0, Man: 0, "Non-binary": 0, Undisclosed: 0, total: 0 });
    const b = byLevel.get(e.level);
    if (b[e.gender] != null) b[e.gender]++;
    b.total++;
  });
  const rows = [];
  byLevel.forEach((b, level) => rows.push({ level, ...b, suppressed: b.total < MIN_GROUP }));
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Scope ──
// ─────────────────────────────────────────────────────────────────────────────────────

// Returns a predicate(employee) => boolean for the given scope. Ancestry for a "leader"
// scope is memoized once per call (O(n) total, cycle-guarded) so scoping thousands of
// people to a leader is cheap even when repeated across many predicate calls.
export function inScopeFn(employees, scope) {
  if (!scope || scope.kind === "company") return () => true;

  if (scope.kind === "field") {
    const { field, value } = scope;
    return (e) => !!e && e[field] === value;
  }

  if (scope.kind === "leader") {
    const byId = new Map((employees || []).map(e => [e.id, e]));
    const memo = new Map(); // id -> does this id's manager chain reach scope.id?
    function reaches(id, guard) {
      if (id == null) return false;
      if (memo.has(id)) return memo.get(id);
      if (guard.has(id)) { memo.set(id, false); return false; } // cycle guard
      guard.add(id);
      if (id === scope.id) { memo.set(id, true); return true; }
      const emp = byId.get(id);
      const result = emp ? reaches(emp.managerId, guard) : false;
      memo.set(id, result);
      return result;
    }
    return (e) => {
      if (!e) return false;
      if (e.id === scope.id) return true;
      return reaches(e.managerId, new Set());
    };
  }

  return () => true;
}

export function scopeName(employees, scope) {
  if (!scope || scope.kind === "company") return "Whole company";
  if (scope.kind === "field") return scope.value || scope.field;
  if (scope.kind === "leader") {
    const emp = (employees || []).find(e => e.id === scope.id);
    return emp ? `${emp.first} ${emp.last}` : "Unknown leader";
  }
  return "Scope";
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Sub-org rows (scorecard) ──
// ─────────────────────────────────────────────────────────────────────────────────────

// For company scope: the CEO's (topmost person's) direct reports. For a leader scope:
// that leader's direct reports. For a field scope: every distinct department within it
// (per spec — field scopes roll up by department regardless of which field was scoped on).
export function subOrgDefinitions(employees, scope) {
  if (!scope || scope.kind === "company") {
    const ids = new Set(employees.map(e => e.id));
    const roots = employees.filter(e => e.managerId == null || !ids.has(e.managerId));
    const root = roots[0];
    if (!root) return [];
    return employees.filter(e => e.managerId === root.id).map(e => ({ key: e.id, kind: "leader", leaderId: e.id }));
  }
  if (scope.kind === "leader") {
    return employees.filter(e => e.managerId === scope.id).map(e => ({ key: e.id, kind: "leader", leaderId: e.id }));
  }
  if (scope.kind === "field") {
    const inScope = inScopeFn(employees, scope);
    const depts = new Set();
    employees.forEach(e => { if (inScope(e) && e.dept) depts.add(e.dept); });
    return [...depts].sort().map(d => ({ key: d, kind: "field", field: "dept", value: d }));
  }
  return [];
}

// Lightweight per-sub-org scorecard row — only the columns the Overview scorecard needs,
// computed without building the full KPI/trend bundle (keeps subOrgs cheap).
export function computeSubOrgRow(employees, def, asOf) {
  const scope = def.kind === "leader" ? { kind: "leader", id: def.leaderId } : { kind: "field", field: def.field, value: def.value };
  const inScope = inScopeFn(employees, scope);
  const scoped = employees.filter(inScope);
  const leader = def.kind === "leader" ? employees.find(e => e.id === def.leaderId) : null;

  const hc = computeHeadcount(scoped, asOf);
  const hcPrior = computeHeadcount(scoped, isoOf(addMonthsUtc(toUtcDate(asOf), -12)));
  const attrition = computeAttritionRates(scoped, asOf, 12);
  const firstYear = computeFirstYearAttrition(scoped, asOf);
  const promo = computePromotionRate(scoped, asOf, 12);
  const enps = computeENPS(scoped, asOf);
  const compa = computeCompaStats(scoped, asOf);
  const rep = computeRepresentation(scoped, asOf);
  const span = computeSpanOfControl(scoped, asOf);
  const perf = computePerformanceDistribution(scoped, asOf);
  const highPerfPct = (perf.total > 0 && perf.notRated < perf.total) ? ((perf.dist[4] + perf.dist[5]) / perf.total) * 100 : null;

  return {
    key: def.key,
    scope, // click-to-rescope target for this row (UI passes this straight to setHrbpScope)
    label: leader ? `${leader.first} ${leader.last}` : def.value,
    sublabel: leader ? leader.title : null,
    headcount: hc,
    netChange: hc - hcPrior,
    voluntaryAttrition: attrition.voluntary,
    regrettedAttrition: attrition.regretted,
    firstYearAttrition: firstYear.rate,
    promotionRate: promo.rate,
    enps: enps.suppressed ? null : enps.score,
    avgCompa: compa.median,
    womenPct: rep.overall,
    avgSpan: span.mean,
    highPerfPct,
    peopleIds: scoped.filter(e => isFte(e) && isActiveAt(e, asOf)).map(e => e.id),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Quarterly trend ──
// ─────────────────────────────────────────────────────────────────────────────────────

// 8 quarterly points ending at `asOf` (roughly 3 months apart — not necessarily aligned
// to calendar-quarter boundaries, since asOf itself may not be). Each point carries a
// point-in-time headcount plus that quarter's hires/exits and rolling-T12M rates where
// the underlying primitive is itself a rolling window (attrition, promotion, span,
// representation). eNPS/response rate have no historical time series in this data model
// (surveyScore is "latest" only) — those two are repeated at their current value across
// all 8 points rather than fabricated; this is called out in the HRBP dashboard's info
// tooltip and in the implementation report.
export function computeQuarterlySeries(employees, asOf, quarters = 8) {
  const rows = [];
  const currentEnps = computeENPS(employees, asOf);
  for (let i = quarters - 1; i >= 0; i--) {
    const qEnd = isoOf(addMonthsUtc(toUtcDate(asOf), -3 * i));
    const hc = computeHeadcount(employees, qEnd);
    const { start, end } = windowBounds(qEnd, 3);
    const hires = employees.filter(e => isFte(e) && inWindow(e.startDate, start, end)).length;
    const exitsQ = employees.filter(e => isFte(e) && e.endDate && inWindow(e.endDate, start, end));
    const voluntaryExitsQ = exitsQ.filter(e => e.termType === "Voluntary").length;
    const involuntaryExitsQ = exitsQ.filter(e => e.termType === "Involuntary").length;
    const avgHcQ = computeAvgHeadcount(employees, qEnd, 3);
    const attritionAnnualized = avgHcQ > 0 ? (exitsQ.length / avgHcQ) * 100 * 4 : 0;
    const attritionT12M = computeAttritionRates(employees, qEnd, 12);
    const firstYear = computeFirstYearAttrition(employees, qEnd);
    const promo = computePromotionRate(employees, qEnd, 12);
    const mobility = computeInternalMobilityRate(employees, qEnd, 12);
    const span = computeSpanOfControl(employees, qEnd);
    rows.push({
      quarterEnd: qEnd,
      headcount: hc,
      hires,
      exits: exitsQ.length,
      voluntaryExits: voluntaryExitsQ,
      involuntaryExits: involuntaryExitsQ,
      attritionAnnualized,
      voluntaryAttritionT12M: attritionT12M.voluntary,
      involuntaryAttritionT12M: attritionT12M.involuntary,
      regrettedAttritionT12M: attritionT12M.regretted,
      firstYearAttrition: firstYear.rate,
      promotionRate: promo.rate,
      internalMobilityRate: mobility.rate,
      avgSpan: span.mean,
      enps: currentEnps.suppressed ? null : currentEnps.score,
      responseRate: currentEnps.responseRate,
    });
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Alerts ("Needs attention") ──
// ─────────────────────────────────────────────────────────────────────────────────────

// Mirrors app.jsx's flightRiskLabel() thresholds (score>=45 high, >=24 medium, else low).
// Duplicated here (rather than imported) because hrbp.mjs takes the risk MAP as an input
// and must stay dependency-closed for standalone unit testing — see module header.
function riskBand(score) {
  if (score >= 45) return "high";
  if (score >= 24) return "medium";
  return "low";
}

// Alert detail text names at most 5 people, then "and N more" — a well-populated sample
// dataset can easily have hundreds of matches for a broad rule (e.g. "overdue for
// promotion" across a decade of company history), and a wall of names in one line is
// unusable in the UI. personIds on the alert itself always carries the FULL list.
const MAX_NAMED_IN_DETAIL = 5;
function namesList(people) {
  const names = people.slice(0, MAX_NAMED_IN_DETAIL).map(p => `${p.first} ${p.last}`);
  const rest = people.length - names.length;
  return rest > 0 ? `${names.join(", ")}, and ${rest} more` : names.join(", ");
}

// Sort helper shared by every consolidated alert: worst (most-affected / most-severe)
// items first.
function sortByCountDesc(items, key) { return [...items].sort((a, b) => b[key] - a[key]); }

export function computeAlerts(employees, { asOf, flightRisks, companyBenchmark, payEquityRows, spanInfo } = {}) {
  const alerts = [];
  const activeFte = employees.filter(e => isFte(e) && isActiveAt(e, asOf));
  const activeById = new Map(activeFte.map(e => [e.id, e]));
  flightRisks = flightRisks || {};

  // 1. Manager whose team had >= 2 regretted exits in T12M (critical if >= 3). ONE alert
  // for the rule, with a breakdown entry per matching team.
  {
    const { exits } = computeAttritionRates(employees, asOf, 12);
    const regrettedByMgr = new Map();
    exits.filter(e => e.termType === "Voluntary" && e.regretted === true).forEach(e => {
      if (e.managerId == null) return;
      if (!regrettedByMgr.has(e.managerId)) regrettedByMgr.set(e.managerId, []);
      regrettedByMgr.get(e.managerId).push(e);
    });
    const teams = sortByCountDesc(
      [...regrettedByMgr.entries()]
        .filter(([, people]) => people.length >= 2)
        .map(([managerId, people]) => {
          const mgr = employees.find(e => e.id === managerId);
          return { managerId, mgrName: mgr ? `${mgr.first} ${mgr.last}` : managerId, people, count: people.length };
        }),
      "count");
    if (teams.length) {
      const worst = teams.slice(0, 2).map(t => `${t.mgrName} (${t.count})`).join(", ");
      alerts.push({
        id: "regretted-exits",
        severity: teams.some(t => t.count >= 3) ? "critical" : "warning",
        title: `${teams.length} team${teams.length === 1 ? "" : "s"} with ≥2 regretted exits in the last 12 months`,
        detail: `Worst: ${worst}.`,
        personIds: teams.flatMap(t => t.people.map(p => p.id)),
        affectedCount: teams.length,
        suggestedAction: "Run stay interviews with each flagged team this month and cross-reference exit themes against manager tenure and span of control.",
        breakdown: teams.map(t => ({
          label: `${t.mgrName} — ${t.count} regretted exit${t.count === 1 ? "" : "s"}`,
          detail: `Voluntary departures the org wanted to keep: ${namesList(t.people)}.`,
          personIds: t.people.map(p => p.id),
          managerId: t.managerId,
          severity: t.count >= 3 ? "critical" : "warning",
        })),
      });
    }
  }

  // 2. Team (manager with >= 6 respondents) with low eNPS: critical <= -30, warning
  // otherwise. Fixed inclusion threshold of -20 at every scope — a dynamic threshold read
  // as two different rules depending on whether you were looking at the whole company or
  // a single leader. ONE alert for the rule, with a breakdown entry per team.
  {
    const ENPS_RESPONDENT_MIN = 6;
    const threshold = -20;
    const reportsByMgr = new Map();
    activeFte.forEach(e => {
      if (e.managerId == null) return;
      if (!reportsByMgr.has(e.managerId)) reportsByMgr.set(e.managerId, []);
      reportsByMgr.get(e.managerId).push(e);
    });
    const allTeams = [];
    reportsByMgr.forEach((reports, managerId) => {
      const respondents = reports.filter(e => e.surveyScore != null);
      if (respondents.length < ENPS_RESPONDENT_MIN) return;
      const promoters = respondents.filter(e => e.surveyScore >= 9).length;
      const detractors = respondents.filter(e => e.surveyScore <= 6).length;
      const score = ((promoters - detractors) / respondents.length) * 100;
      const mgr = employees.find(e => e.id === managerId);
      allTeams.push({ managerId, mgrName: mgr ? `${mgr.first} ${mgr.last}` : managerId, respondents, score });
    });
    const teams = allTeams.filter(t => t.score < threshold);
    teams.sort((a, b) => a.score - b.score); // worst (most negative) first
    if (teams.length) {
      const worst = teams.slice(0, 2).map(t => `${t.mgrName} ${Math.round(t.score)}`).join(", ");
      alerts.push({
        id: "low-enps-teams",
        severity: teams.some(t => t.score <= -30) ? "critical" : "warning",
        title: `${teams.length} team${teams.length === 1 ? "" : "s"} with eNPS below ${threshold}`,
        detail: `Lowest: ${worst}.`,
        personIds: teams.flatMap(t => t.respondents.map(p => p.id)),
        affectedCount: teams.length,
        suggestedAction: "Schedule a skip-level listening session with each flagged team and review the manager's coaching support.",
        breakdown: teams.map(t => ({
          label: `${t.mgrName} — eNPS ${Math.round(t.score)}`,
          detail: `${t.respondents.length} respondents on this team; well below a healthy score.`,
          personIds: t.respondents.map(p => p.id),
          managerId: t.managerId,
          severity: t.score <= -30 ? "critical" : "warning",
        })),
      });
    }
  }

  // 3. High performers at high flight risk. Always critical.
  {
    const people = keyTalentAtRisk(employees, asOf, flightRisks);
    if (people.length) {
      alerts.push({
        id: "high-perf-flight-risk",
        severity: "critical",
        title: `${people.length} high performer${people.length > 1 ? "s" : ""} at high flight risk`,
        detail: `Rating 4-5 with a high retention-risk score: ${namesList(people)}.`,
        personIds: people.map(p => p.id),
        affectedCount: people.length,
        suggestedAction: "Prioritize retention conversations and a comp/growth review with each person this quarter.",
      });
    }
  }

  // 4. High performers with no promotion in >= 3 years (or never, with tenure >= 3 yrs).
  // Executives (VP/SVP/C-Suite) are excluded — "overdue for promotion" isn't a meaningful
  // frame at the top of the ladder. Always warning.
  {
    const people = overduePromotionCandidates(employees, asOf);
    if (people.length) {
      alerts.push({
        id: "high-perf-overdue-promo",
        severity: "warning",
        title: `${people.length} high performer${people.length > 1 ? "s" : ""} overdue for promotion`,
        detail: `Rating 4-5, no promotion in 3+ years: ${namesList(people)}.`,
        personIds: people.map(p => p.id),
        affectedCount: people.length,
        suggestedAction: "Run calibration for the flagged high performers in the next review cycle — delayed promotions after this tenure lose retention leverage fast.",
      });
    }
  }

  // 5. High performers paid below range (compa < 0.90). Always warning.
  {
    const people = highPerformersBelowRange(employees, asOf);
    if (people.length) {
      alerts.push({
        id: "high-perf-below-range",
        severity: "warning",
        title: `${people.length} high performer${people.length > 1 ? "s" : ""} paid below range`,
        detail: `Rating 4-5 with compa-ratio under 0.90: ${namesList(people)}.`,
        personIds: people.map(p => p.id),
        affectedCount: people.length,
        suggestedAction: "Review these compa-ratios in the next pay cycle — prioritize the largest gaps first.",
      });
    }
  }

  // 6. Pay equity gap > 4% at any level (n >= MIN_GROUP each side). Always warning. ONE
  // alert for the rule, with a breakdown entry per matching level.
  {
    const levels = sortByCountDesc(
      (payEquityRows || []).filter(row => !row.suppressed && row.gapPct != null && row.gapPct > 4),
      "gapPct");
    if (levels.length) {
      const worst = levels.slice(0, 2).map(r => `${r.level} (${r.gapPct.toFixed(1)}%)`).join(", ");
      alerts.push({
        id: "pay-equity-gaps",
        severity: "warning",
        title: `${levels.length} level${levels.length === 1 ? "" : "s"} with a pay equity gap over 4%`,
        detail: `Worst: ${worst}.`,
        personIds: [],
        affectedCount: levels.length,
        suggestedAction: "Audit the flagged levels in the next pay-equity review and correct unexplained gaps.",
        breakdown: levels.map(row => ({
          label: `${row.level} — ${row.gapPct.toFixed(1)}% gap (women vs. men)`,
          detail: `Median compa: women ${row.medianWomen.toFixed(2)} vs. men ${row.medianMen.toFixed(2)} (n=${row.nWomen}/${row.nMen}).`,
          personIds: [],
          severity: "warning",
        })),
      });
    }
  }

  // 7. Managers with >= 12 reports, or exactly 1 report. ONE alert for the rule (info),
  // with a breakdown entry per matching manager.
  if (spanInfo) {
    const outliers = sortByCountDesc(
      [...spanInfo.byManager.entries()]
        .filter(([, count]) => count >= 12 || count === 1)
        .map(([managerId, count]) => {
          const mgr = employees.find(e => e.id === managerId);
          return { managerId, mgrName: mgr ? `${mgr.first} ${mgr.last}` : managerId, count };
        }),
      "count");
    if (outliers.length) {
      const narrow = outliers.filter(o => o.count === 1).length;
      const wide = outliers.filter(o => o.count >= 12).length;
      alerts.push({
        id: "span-outliers",
        severity: "info",
        title: `${outliers.length} manager span outlier${outliers.length === 1 ? "" : "s"} (${narrow} narrow, ${wide} wide)`,
        detail: "Exactly 1 report (consider flattening) or ≥12 reports (1:1 time and onboarding quality at risk).",
        personIds: [],
        affectedCount: outliers.length,
        suggestedAction: "Flatten single-report layers where the report has no large subtree beneath them; split spans of 12+ into smaller pods.",
        breakdown: outliers.map(o => ({
          label: o.count === 1 ? `${o.mgrName} — exactly 1 direct report` : `${o.mgrName} — ${o.count} direct reports`,
          detail: o.count === 1 ? "Single-report manager layer — consider flattening." : "Wide span — 1:1 time and onboarding quality are at risk.",
          personIds: [],
          managerId: o.managerId,
          severity: "info",
        })),
      });
    }
  }

  // 8. Voluntary attrition in scope > company by >= 3 pts. Always warning. Requires scope
  // avg headcount >= 10 — below that, one or two exits swing the rate wildly and a "vs.
  // company" comparison isn't meaningful.
  if (companyBenchmark && companyBenchmark.attrition && companyBenchmark.attrition.voluntary != null) {
    const scopeAttr = computeAttritionRates(employees, asOf, 12);
    if (scopeAttr.avgHeadcount >= 10 && scopeAttr.voluntary != null && scopeAttr.voluntary - companyBenchmark.attrition.voluntary >= 3) {
      alerts.push({
        id: "attrition-vs-company",
        severity: "warning",
        title: `Voluntary attrition ${scopeAttr.voluntary.toFixed(1)}% vs. ${companyBenchmark.attrition.voluntary.toFixed(1)}% company`,
        detail: `${(scopeAttr.voluntary - companyBenchmark.attrition.voluntary).toFixed(1)} pts above the company rate over the trailing 12 months.`,
        personIds: [],
        affectedCount: scopeAttr.exitsCount,
        suggestedAction: "Run stay interviews in this scope and compare exit themes against manager tenure and promotion velocity.",
      });
    }
  }

  // 9. First-year attrition > 20%. Always warning. Requires cohort >= 5 — a 1-of-2 exit
  // shouldn't fire a 50% alert.
  {
    const fy = computeFirstYearAttrition(employees, asOf);
    if (fy.cohortN >= 5 && fy.rate != null && fy.rate > 20) {
      alerts.push({
        id: "first-year-attrition",
        severity: "warning",
        title: `First-year attrition ${fy.rate.toFixed(1)}%`,
        detail: `${fy.leftN} of ${fy.cohortN} hired 12-24 months ago left within their first year.`,
        personIds: [],
        affectedCount: fy.leftN,
        suggestedAction: "Audit onboarding quality and manager ramp support for recent hires in this scope.",
      });
    }
  }

  // ── Rules 10-15 ported from the old standalone Analytics/Dashboards insight engine
  // (computeInsights in app.jsx) — same thresholds, grouped/breakdown shape, small-n
  // rules, and severity as the rest of this list. ──

  // 10. New manager (<12mo tenure — no promotion-to-management date is tracked, so overall
  // tenure is used as the proxy, same as the old engine) with a large team (>=5 direct
  // reports). Always warning.
  {
    const byManagerAll = new Map();
    activeFte.forEach(e => {
      if (e.managerId == null) return;
      if (!byManagerAll.has(e.managerId)) byManagerAll.set(e.managerId, []);
      byManagerAll.get(e.managerId).push(e);
    });
    const flagged = [];
    byManagerAll.forEach((reports, managerId) => {
      if (reports.length < 5) return;
      const mgr = activeById.get(managerId);
      if (!mgr) return;
      const tenureMo = (toUtcDate(asOf) - toUtcDate(mgr.startDate)) / (DAYS_PER_YEAR * MS_PER_DAY) * 12;
      if (tenureMo >= 12) return;
      flagged.push({ managerId, mgrName: `${mgr.first} ${mgr.last}`, teamSize: reports.length, tenureMo, reports });
    });
    const teams = sortByCountDesc(flagged, "teamSize");
    if (teams.length) {
      const worst = teams.slice(0, 2).map(t => `${t.mgrName} (${Math.round(t.tenureMo)}mo, ${t.teamSize} reports)`).join(", ");
      alerts.push({
        id: "new-manager-large-team",
        severity: "warning",
        title: `${teams.length} new manager${teams.length === 1 ? "" : "s"} (<12mo) with a large team`,
        detail: `${worst}.`,
        personIds: teams.map(t => t.managerId),
        affectedCount: teams.length,
        suggestedAction: "Assign an executive mentor or set up a biweekly skip-level check-in for each flagged manager over the next 6 months.",
        breakdown: teams.map(t => ({
          label: `${t.mgrName} — ${Math.round(t.tenureMo)}mo, ${t.teamSize} direct reports`,
          detail: "New managers carrying an oversized team see higher direct-report attrition and lower performance ratings during their first year.",
          personIds: [t.managerId, ...t.reports.map(r => r.id)],
          managerId: t.managerId,
          severity: "warning",
        })),
      });
    }
  }

  // 11. Single-direct-report chain: a manager with exactly one direct report, whose own
  // subtree has >=5 people — a resignation away from an org-continuity gap. Distinct from
  // rule 7 (span-outliers, an "exactly 1 report" narrow-span flag with no subtree-size
  // criterion) — this rule is about structural bottleneck risk, not span health. Warning.
  {
    const childrenMap = new Map();
    activeFte.forEach(e => {
      if (e.managerId == null) return;
      if (!childrenMap.has(e.managerId)) childrenMap.set(e.managerId, []);
      childrenMap.get(e.managerId).push(e);
    });
    const subtreeMemo = new Map();
    function subtreeSize(id, guard) {
      if (subtreeMemo.has(id)) return subtreeMemo.get(id);
      if (guard.has(id)) return 0;
      guard.add(id);
      const kids = childrenMap.get(id) || [];
      const size = kids.reduce((s, k) => s + 1 + subtreeSize(k.id, guard), 0);
      subtreeMemo.set(id, size);
      return size;
    }
    const chains = [];
    childrenMap.forEach((kids, managerId) => {
      if (kids.length !== 1) return;
      const child = kids[0];
      const size = subtreeSize(child.id, new Set());
      if (size < 8) return; // a real bottleneck, not just any narrow-but-thin chain (rule 7 already covers narrow spans generally)
      const mgr = activeById.get(managerId);
      if (!mgr) return;
      chains.push({ managerId, mgrName: `${mgr.first} ${mgr.last}`, childId: child.id, childName: `${child.first} ${child.last}`, subtreeSize: size });
    });
    const sorted = sortByCountDesc(chains, "subtreeSize");
    if (sorted.length) {
      const worst = sorted.slice(0, 2).map(c => `${c.mgrName} → ${c.childName} (${c.subtreeSize})`).join(", ");
      alerts.push({
        id: "single-report-chains",
        severity: "warning",
        title: `${sorted.length} single-report chain${sorted.length === 1 ? "" : "s"} bottlenecking a large subtree`,
        detail: `${worst}.`,
        personIds: sorted.flatMap(c => [c.managerId, c.childId]),
        affectedCount: sorted.length,
        suggestedAction: "Add a second direct report or a co-lead so the subtree doesn't depend on one person's continued employment.",
        breakdown: sorted.map(c => ({
          label: `${c.mgrName} → ${c.childName}`,
          detail: `${c.childName} is ${c.mgrName}'s only direct report and manages ${c.subtreeSize} people beneath them.`,
          personIds: [c.managerId, c.childId],
          managerId: c.managerId,
          severity: "warning",
        })),
      });
    }
  }

  // 12. Org depth: anyone more than 7 reporting levels below the top of this scope.
  // Warning at max depth > 9, info otherwise — matching the old engine's split.
  {
    const activeIds = new Set(activeFte.map(e => e.id));
    const depthMemo = new Map();
    function depthOf(id, guard) {
      if (depthMemo.has(id)) return depthMemo.get(id);
      if (guard.has(id)) return 0;
      guard.add(id);
      const emp = activeById.get(id);
      const mgrId = emp ? emp.managerId : null;
      const d = (mgrId != null && activeIds.has(mgrId)) ? 1 + depthOf(mgrId, guard) : 0;
      depthMemo.set(id, d);
      return d;
    }
    const deep = activeFte.filter(e => depthOf(e.id, new Set()) > 7);
    if (deep.length) {
      const maxD = Math.max(...deep.map(e => depthOf(e.id, new Set())));
      alerts.push({
        id: "org-depth",
        severity: maxD > 9 ? "warning" : "info",
        title: `${deep.length} ${deep.length === 1 ? "person is" : "people are"} more than 7 levels deep`,
        detail: `Deepest chain reaches ${maxD} levels from the top of this scope.`,
        personIds: deep.map(e => e.id),
        affectedCount: deep.length,
        suggestedAction: "Map reporting chains beyond level 6 and look for redundant intermediate layers to flatten in the next reorg cycle.",
      });
    }
  }

  // 13. Rapid department growth: headcount up >=35% in 6 months (base >=5). Info —
  // reusing the old engine's exact thresholds. Grouped per department.
  {
    const sixMoAgoIso = isoOf(addMonthsUtc(toUtcDate(asOf), -6));
    const deptOld = new Map(), deptNow = new Map();
    activeFte.forEach(e => {
      deptNow.set(e.dept, (deptNow.get(e.dept) || 0) + 1);
      if (e.startDate && toUtcDate(e.startDate) <= toUtcDate(sixMoAgoIso)) deptOld.set(e.dept, (deptOld.get(e.dept) || 0) + 1);
    });
    const grown = [];
    deptNow.forEach((nowCount, dept) => {
      const old = deptOld.get(dept) || 0;
      if (old < 5) return;
      const growth = (nowCount - old) / old;
      if (growth < 0.35) return;
      grown.push({ dept, old, now: nowCount, growth });
    });
    const sorted = sortByCountDesc(grown, "growth");
    if (sorted.length) {
      const worst = sorted.slice(0, 2).map(g => `${g.dept} +${Math.round(g.growth * 100)}%`).join(", ");
      alerts.push({
        id: "rapid-growth",
        severity: "info",
        title: `${sorted.length} department${sorted.length === 1 ? "" : "s"} growing fast (6mo)`,
        detail: `${worst}.`,
        personIds: [],
        affectedCount: sorted.length,
        suggestedAction: "Audit onboarding quality and manager capacity for fast-growing teams — infrastructure and rituals usually lag headcount growth.",
        breakdown: sorted.map(g => ({
          label: `${g.dept} — +${Math.round(g.growth * 100)}% (${g.old} → ${g.now})`,
          detail: `Grew from ${g.old} to ${g.now} people in the last 6 months.`,
          personIds: [],
          severity: "info",
        })),
      });
    }
  }

  // 14. New-hire concentration: a manager whose team (>=MIN_GROUP direct reports) is >=50%
  // people hired in the last 6 months. An onboarding-load signal, not an emergency: warning
  // at >=65% concentration, info otherwise. Never critical.
  {
    const sixMoAgo = toUtcDate(isoOf(addMonthsUtc(toUtcDate(asOf), -6)));
    const byManagerAll = new Map();
    activeFte.forEach(e => {
      if (e.managerId == null) return;
      if (!byManagerAll.has(e.managerId)) byManagerAll.set(e.managerId, []);
      byManagerAll.get(e.managerId).push(e);
    });
    const flagged = [];
    byManagerAll.forEach((reports, managerId) => {
      if (reports.length < MIN_GROUP) return;
      const newHires = reports.filter(e => e.startDate && toUtcDate(e.startDate) >= sixMoAgo);
      const ratio = newHires.length / reports.length;
      if (ratio < 0.5) return;
      const mgr = activeById.get(managerId);
      if (!mgr) return;
      flagged.push({ managerId, mgrName: `${mgr.first} ${mgr.last}`, teamSize: reports.length, newHireN: newHires.length, ratio, newHires });
    });
    const sorted = sortByCountDesc(flagged, "ratio");
    if (sorted.length) {
      const worst = sorted.slice(0, 2).map(t => `${t.mgrName} (${Math.round(t.ratio * 100)}%)`).join(", ");
      alerts.push({
        id: "new-hire-concentration",
        severity: sorted.some(t => t.ratio >= 0.65) ? "warning" : "info",
        title: `${sorted.length} team${sorted.length === 1 ? "" : "s"} with high new-hire concentration`,
        detail: `${worst}.`,
        personIds: sorted.flatMap(t => t.newHires.map(n => n.id)),
        affectedCount: sorted.length,
        suggestedAction: "Pair each new hire with a tenured buddy and temporarily lighten the manager's other commitments to absorb coaching load.",
        breakdown: sorted.map(t => ({
          label: `${t.mgrName} — ${t.newHireN} of ${t.teamSize} joined in the last 6 months (${Math.round(t.ratio * 100)}%)`,
          detail: "Elevated onboarding and knowledge-transfer load — watch for a productivity dip and early-attrition risk.",
          personIds: t.newHires.map(n => n.id),
          managerId: t.managerId,
          severity: t.ratio >= 0.65 ? "warning" : "info",
        })),
      });
    }
  }

  // 15. Leader roles (Director+) with no ready successor — reuses computeSuccession, the
  // exact same "bench" definition the Talent tab's Succession panel shows. Always warning.
  // Requires overall bench coverage below 70% — some uncovered roles are normal (a Talent
  // tab panel already surfaces the raw count/%), this alert is for when the bench overall
  // looks thin, not for the last handful of gaps in an otherwise healthy org.
  {
    const succ = computeSuccession(employees, asOf, flightRisks);
    if (succ.uncovered.length && succ.readyPct != null && succ.readyPct < 70) {
      const worst = succ.uncovered.slice(0, 2).map(l => `${l.first} ${l.last}`).join(", ");
      alerts.push({
        id: "succession-gaps",
        severity: "warning",
        title: `${succ.uncovered.length} leader role${succ.uncovered.length === 1 ? "" : "s"} with no ready successor`,
        detail: `${worst}${succ.uncovered.length > 2 ? ", and more" : ""}.`,
        personIds: succ.uncovered.map(l => l.id),
        affectedCount: succ.uncovered.length,
        suggestedAction: "Start a formal succession review for each uncovered role — identify 1-2 high-potential candidates and build a 12-month development plan.",
        breakdown: succ.uncovered.map(l => ({
          label: `${l.first} ${l.last} — ${l.title}`,
          detail: "No direct report with rating ≥4 and flight risk below high.",
          personIds: [l.id],
          managerId: l.id,
          severity: "warning",
        })),
      });
    }
  }

  // Critical first, then warning, then info; within a severity, the rule affecting the
  // most people/teams sorts first.
  const order = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (order[a.severity] - order[b.severity]) || ((b.affectedCount || 0) - (a.affectedCount || 0)));
  return alerts;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Coverage (which optional fields exist -> which sections unlock) ──
// ─────────────────────────────────────────────────────────────────────────────────────

const OPTIONAL_FIELDS = ["gender", "perfRating", "salary", "rangeMid", "compaRatio", "termType", "termReason", "regretted", "lastPromoDate", "lastTransferDate", "surveyScore"];

export function computeCoverage(employees) {
  const present = {};
  OPTIONAL_FIELDS.forEach(f => { present[f] = employees.some(e => e && e[f] != null); });
  const hasPay = (present.salary && present.rangeMid) || present.compaRatio;
  const sections = {
    overview: true,
    attrition: true, // exits work off endDate alone; termType just adds the vol/invol split
    movement: present.lastPromoDate || present.lastTransferDate,
    talent: present.perfRating,
    pay: hasPay,
    orgDesign: true,
    diversity: present.gender,
    engagement: present.surveyScore,
  };
  // compaRatio and salary+rangeMid satisfy the SAME requirement (pay coverage) — once
  // either side is present, the other isn't "missing" anything, it's just redundant.
  const missing = OPTIONAL_FIELDS.filter(f => {
    if (present[f]) return false;
    if (f === "compaRatio" && present.salary && present.rangeMid) return false;
    if ((f === "salary" || f === "rangeMid") && present.compaRatio) return false;
    return true;
  });
  return { present, sections, missingFields: missing };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Benchmark snapshot (lean — no alerts/subOrgs/trend; used for company-vs-scope deltas) ──
// ─────────────────────────────────────────────────────────────────────────────────────

const _benchmarkCache = new WeakMap(); // employees array identity -> { asOf, snapshot }

function buildBenchmarkSnapshot(employees, asOf) {
  const attrition = computeAttritionRates(employees, asOf, 12);
  const firstYear = computeFirstYearAttrition(employees, asOf);
  const promo = computePromotionRate(employees, asOf, 12);
  const mobility = computeInternalMobilityRate(employees, asOf, 12);
  const enps = computeENPS(employees, asOf);
  const span = computeSpanOfControl(employees, asOf);
  const rep = computeRepresentation(employees, asOf);
  const compa = computeCompaStats(employees, asOf);
  const perf = computePerformanceDistribution(employees, asOf);
  return {
    headcount: computeHeadcount(employees, asOf),
    hiresT12M: hiresInWindow(employees, asOf, 12).length,
    attrition,
    firstYearAttrition: firstYear.rate,
    promotionRate: promo.rate,
    internalMobility: mobility.rate,
    enps: enps.suppressed ? null : enps.score,
    avgSpan: span.mean,
    womenOverall: rep.overall,
    avgCompa: compa.median,
    highPerfPct: (perf.total > 0 && perf.notRated < perf.total) ? ((perf.dist[4] + perf.dist[5]) / perf.total) * 100 : null,
  };
}

// Memoized per (employees array identity, asOf) — repeated calls for different scopes
// against the same dataset don't recompute the whole-company numbers each time.
export function computeBenchmarkSnapshot(employees, asOf) {
  const cached = _benchmarkCache.get(employees);
  if (cached && cached.asOf === asOf) return cached.snapshot;
  const snapshot = buildBenchmarkSnapshot(employees, asOf);
  _benchmarkCache.set(employees, { asOf, snapshot });
  return snapshot;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Import normalizers (pure — unit tested here; app.jsx's import path calls these) ──
// ─────────────────────────────────────────────────────────────────────────────────────

// "F","Female","W","Woman" -> Woman; "M","Male","Man" -> Man; "NB","Non-binary" -> Non-binary;
// "U","Undisclosed","Prefer not to say" -> Undisclosed. Unrecognized/blank text returns null
// (leave unset) rather than guessing.
export function normalizeGenderValue(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (["w", "f", "woman", "female"].includes(s)) return "Woman";
  if (["m", "male", "man"].includes(s)) return "Man";
  if (["nb", "non-binary", "nonbinary", "non binary", "enby", "x", "other"].includes(s)) return "Non-binary";
  if (["u", "undisclosed", "prefer not to say", "decline to state", "not disclosed", "na", "n/a", "unknown"].includes(s)) return "Undisclosed";
  return null;
}

// Numeric 1-5 kept as-is. Text ratings: "Exceeds"->4, "Far exceeds"/"Outstanding"->5,
// "Meets"->3, "Partially meets"/"Below"->2, "Does not meet"->1.
export function normalizePerfRatingValue(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return (raw >= 1 && raw <= 5) ? Math.round(raw) : null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isNaN(n) && n >= 1 && n <= 5) return Math.round(n);
  if (/far exceeds|outstanding/.test(s)) return 5;
  if (/exceeds/.test(s)) return 4;
  if (/does not meet/.test(s)) return 1;
  if (/partially meets|below/.test(s)) return 2;
  if (/meets/.test(s)) return 3;
  return null;
}

// "vol","voluntary","resignation","resigned" -> Voluntary; "invol","involuntary",
// "termination","terminated","layoff","rif" -> Involuntary.
export function normalizeTermTypeValue(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (/\binvol|involuntary|termination|terminated|layoff|\brif\b/.test(s)) return "Involuntary";
  if (/\bvol|voluntary|resignation|resigned/.test(s)) return "Voluntary";
  return null;
}

// yes/y/true/1/regretted -> true; no/n/false/0 -> false; anything else -> null (unknown).
export function normalizeRegrettedValue(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).trim().toLowerCase();
  if (["yes", "y", "true", "1", "regretted"].includes(s)) return true;
  if (["no", "n", "false", "0", "not regretted", "non-regretted"].includes(s)) return false;
  return null;
}

// Strips $ , and whitespace. Returns a finite number or null.
export function normalizeMoneyValue(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  const s = String(raw).replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Compa ratios are ~0.5-1.5. A value given as "95" or "95%" means 95%, i.e. 0.95 — anything
// above 3 is assumed to be a whole-number percentage without the sign and is divided by 100.
export function normalizeCompaValue(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().replace(/%/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n > 3 ? n / 100 : n;
}

// Engagement survey ("recommend as a place to work") score: integer 0-10. Clamps and
// rounds a valid number; blank or unparseable input is null (non-response), matching the
// sample generator's own "didn't respond" semantics.
export function normalizeSurveyScoreValue(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

// ─────────────────────────────────────────────────────────────────────────────────────
// ── Top-level orchestrator ──
// ─────────────────────────────────────────────────────────────────────────────────────

export function computeHrbpMetrics(employees, { scope, asOf, flightRisks } = {}) {
  scope = scope || { kind: "company" };
  const inScope = inScopeFn(employees, scope);
  const scoped = employees.filter(inScope);
  const scopedIdSet = new Set(scoped.map(e => e.id));

  const headcount = computeHeadcount(scoped, asOf);
  const headcountPrior = computeHeadcount(scoped, isoOf(addMonthsUtc(toUtcDate(asOf), -12)));
  const contractors = computeContractorCount(scoped, asOf);
  const attrition = computeAttritionRates(scoped, asOf, 12);
  const hires = hiresInWindow(scoped, asOf, 12);
  const firstYear = computeFirstYearAttrition(scoped, asOf);
  const retention = computeRetention12mo(scoped, asOf);
  const promo = computePromotionRate(scoped, asOf, 12);
  const mobility = computeInternalMobilityRate(scoped, asOf, 12);
  const span = computeSpanOfControl(scoped, asOf);
  const layers = computeLayers(employees, asOf, scopedIdSet);
  const avgTenure = computeAvgTenureYears(scoped, asOf);
  const tenureBands = computeTenureBands(scoped, asOf);
  const perf = computePerformanceDistribution(scoped, asOf);
  const compa = computeCompaStats(scoped, asOf);
  const compaByLevel = computeCompaByLevel(scoped, asOf);
  const payEquityRows = computePayEquityByLevel(scoped, asOf);
  const enps = computeENPS(scoped, asOf);
  const rep = computeRepresentation(scoped, asOf);
  const repByLevel = computeRepresentationByLevel(scoped, asOf);
  const quarterly = computeQuarterlySeries(scoped, asOf, 8);
  const coverage = computeCoverage(scoped);
  const companyBenchmark = computeBenchmarkSnapshot(employees, asOf);

  const alerts = computeAlerts(scoped, {
    asOf, flightRisks, companyBenchmark, payEquityRows,
    spanInfo: span,
  });

  const subOrgs = subOrgDefinitions(employees, scope).map(def => computeSubOrgRow(employees, def, asOf));

  const highPerfPct = (perf.total > 0 && perf.notRated < perf.total) ? ((perf.dist[4] + perf.dist[5]) / perf.total) * 100 : null;
  const trendOf = (key) => quarterly.map(q => q[key]);

  const kpis = {
    headcount: {
      value: headcount, companyValue: companyBenchmark.headcount, unit: "count", higherIsBetter: null,
      trend: trendOf("headcount"), netChange: headcount - headcountPrior, contractors,
    },
    hiresT12M: {
      value: hires.length, companyValue: companyBenchmark.hiresT12M, unit: "count", higherIsBetter: null,
      trend: trendOf("hires"),
    },
    attrition: {
      value: attrition.overall, companyValue: companyBenchmark.attrition.overall, unit: "percent", higherIsBetter: false,
      trend: trendOf("attritionAnnualized"), sampleN: attrition.avgHeadcount,
    },
    voluntaryAttrition: {
      value: attrition.voluntary, companyValue: companyBenchmark.attrition.voluntary, unit: "percent", higherIsBetter: false,
      trend: trendOf("voluntaryAttritionT12M"), sampleN: attrition.avgHeadcount,
    },
    regrettedAttrition: {
      value: attrition.regretted, companyValue: companyBenchmark.attrition.regretted, unit: "percent", higherIsBetter: false,
      trend: trendOf("regrettedAttritionT12M"), sampleN: attrition.avgHeadcount,
    },
    firstYearAttrition: {
      value: firstYear.rate, companyValue: companyBenchmark.firstYearAttrition, unit: "percent", higherIsBetter: false,
      trend: trendOf("firstYearAttrition"), cohortN: firstYear.cohortN, sampleN: firstYear.cohortN,
    },
    promotionRate: {
      value: promo.rate, companyValue: companyBenchmark.promotionRate, unit: "percent", higherIsBetter: true,
      trend: trendOf("promotionRate"), sampleN: attrition.avgHeadcount,
    },
    enps: {
      value: enps.suppressed ? null : enps.score, companyValue: companyBenchmark.enps, unit: "score", higherIsBetter: true,
      trend: trendOf("enps"), suppressed: enps.suppressed, responseRate: enps.responseRate, sampleN: enps.respondentN,
    },
    avgSpan: {
      value: span.mean, companyValue: companyBenchmark.avgSpan, unit: "ratio", higherIsBetter: null,
      trend: trendOf("avgSpan"), sampleN: span.managerCount,
    },
    internalMobility: {
      value: mobility.rate, companyValue: companyBenchmark.internalMobility, unit: "percent", higherIsBetter: true,
      trend: trendOf("internalMobilityRate"), sampleN: attrition.avgHeadcount,
    },
  };

  return {
    scope,
    scopeLabel: scopeName(employees, scope),
    asOf,
    peopleCount: scoped.filter(e => isFte(e) && isActiveAt(e, asOf)).length,
    // Raw scoped roster (every status — active + terminated), for UI-side ad-hoc cuts that
    // don't warrant their own hrbp.mjs primitive (e.g. a one-off table grouping). Every
    // WINDOW/RATE/SUPPRESSION computation itself still goes through the tested functions
    // above — this is just the filtered data, not new business logic.
    scopedEmployees: scoped,
    kpis,
    quarterly,
    attrition: {
      ...attrition,
      firstYear,
      byTenureBand: (() => {
        // Exits in T12M grouped by the tenure band they'd been in (based on tenure at exit).
        const bands = { "<1": 0, "1-2": 0, "2-5": 0, "5-10": 0, "10+": 0 };
        attrition.exits.forEach(e => {
          const sd = toUtcDate(e.startDate), ed = toUtcDate(e.endDate);
          if (!sd || !ed) return;
          const yrs = (ed - sd) / (DAYS_PER_YEAR * MS_PER_DAY);
          if (yrs < 1) bands["<1"]++;
          else if (yrs < 2) bands["1-2"]++;
          else if (yrs < 5) bands["2-5"]++;
          else if (yrs < 10) bands["5-10"]++;
          else bands["10+"]++;
        });
        return bands;
      })(),
      byLevel: (() => {
        const m = new Map();
        attrition.exits.forEach(e => m.set(e.level, (m.get(e.level) || 0) + 1));
        return [...m.entries()].map(([level, count]) => ({ level, count }));
      })(),
      byRating: (() => {
        const m = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unrated: 0 };
        attrition.exits.forEach(e => { if (e.perfRating == null) m.unrated++; else if (m[e.perfRating] != null) m[e.perfRating]++; });
        return m;
      })(),
      byReason: (() => {
        const m = new Map();
        attrition.exits.filter(e => e.termType === "Voluntary" && e.termReason).forEach(e => m.set(e.termReason, (m.get(e.termReason) || 0) + 1));
        return [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
      })(),
      topManagersByExits: (() => {
        const m = new Map();
        attrition.exits.forEach(e => { if (e.managerId != null) m.set(e.managerId, (m.get(e.managerId) || 0) + 1); });
        return [...m.entries()]
          .map(([managerId, count]) => {
            const mgr = employees.find(x => x.id === managerId);
            return { managerId, managerName: mgr ? `${mgr.first} ${mgr.last}` : managerId, count };
          })
          .sort((a, b) => b.count - a.count).slice(0, 5);
      })(),
      regrettedLeavers: attrition.exits.filter(e => e.termType === "Voluntary" && e.regretted === true),
    },
    movement: {
      promotionRate: promo, internalMobility: mobility,
      overduePromotions: overduePromotionCandidates(scoped, asOf),
      promotionRateByLevel: (() => {
        // Movement tab unlocks on lastPromoDate OR lastTransferDate — a scope with only
        // transfer data (no lastPromoDate at all) must read every level as n/a, not a
        // misleading row of 0% bars.
        const hasPromoField = scoped.some(e => e && e.lastPromoDate != null);
        const byLevel = new Map();
        const { start, end } = windowBounds(asOf, 12);
        scoped.forEach(e => {
          if (!isFte(e)) return;
          if (!byLevel.has(e.level)) byLevel.set(e.level, { promos: 0, avgHc: 0 });
        });
        const avgHcByLevel = new Map();
        [...monthEndPoints(asOf, 12)].forEach(d => {
          scoped.forEach(e => {
            if (isFte(e) && isActiveAt(e, d)) avgHcByLevel.set(e.level, (avgHcByLevel.get(e.level) || 0) + 1);
          });
        });
        scoped.forEach(e => {
          if (isFte(e) && e.lastPromoDate && inWindow(e.lastPromoDate, start, end)) {
            const row = byLevel.get(e.level) || { promos: 0 };
            row.promos = (row.promos || 0) + 1;
            byLevel.set(e.level, row);
          }
        });
        return [...byLevel.keys()].map(level => {
          const avgHc = (avgHcByLevel.get(level) || 0) / 13;
          const promos = byLevel.get(level).promos || 0;
          return { level, rate: !hasPromoField ? null : (avgHc > 0 ? (promos / avgHc) * 100 : 0), promos };
        });
      })(),
    },
    talent: {
      performance: perf,
      highPerfPct,
      retention,
      retentionRiskMatrix: computeRetentionRiskMatrix(scoped, asOf, flightRisks),
      succession: computeSuccession(scoped, asOf, flightRisks),
      keyTalentAtRisk: keyTalentAtRisk(scoped, asOf, flightRisks),
    },
    pay: {
      compa,
      compaByLevel,
      payEquityByLevel: payEquityRows,
      highPerformersBelowRange: highPerformersBelowRange(scoped, asOf),
    },
    orgDesign: {
      span, layers,
    },
    diversity: {
      representation: rep,
      byLevel: repByLevel,
    },
    engagement: {
      enps, avgTenure, tenureBands,
      managerScatter: computeManagerEngagementScatter(scoped, asOf),
    },
    alerts,
    subOrgs,
    coverage,
  };
}
