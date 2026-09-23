import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_GROUP,
  toUtcDate, isoOf, resolveAsOf,
  isActiveAt, isFte, computeHeadcount, computeAvgHeadcount, windowBounds,
  hiresInWindow, exitsInWindow, computeAttritionRates,
  computeFirstYearAttrition, computeRetention12mo,
  computePromotionRate, computeInternalMobilityRate,
  computeSpanOfControl, computeLayers,
  compaRatioOf, computeCompaStats, computePayEquityByLevel,
  computeENPS, computeRepresentation, computeManagerEngagementScatter, computePerformanceDistribution,
  inScopeFn, scopeName, subOrgDefinitions, computeSubOrgRow, computeAlerts,
  computeCoverage, computeHrbpMetrics, computeBenchmarkSnapshot,
  normalizeGenderValue, normalizePerfRatingValue, normalizeTermTypeValue,
  normalizeRegrettedValue, normalizeMoneyValue, normalizeCompaValue, normalizeSurveyScoreValue,
} from "../hrbp.mjs";

const ASOF = "2025-06-01";

function emp(o) {
  return { id: "e0", employmentType: "FTE", status: "Active", startDate: "2020-01-01", endDate: null, level: "IC3", dept: "Eng", ...o };
}

// ─── Date helpers / timezone safety ───

test("toUtcDate: round-trips an ISO string through a Date instance without drift", () => {
  const d = toUtcDate("2025-04-15");
  // Re-parsing the already-UTC Date must not shift the day in any timezone.
  assert.equal(isoOf(toUtcDate(d)), "2025-04-15");
});

test("resolveAsOf: sample data uses the fallback verbatim, ignoring employee dates", () => {
  const employees = [emp({ startDate: "2019-01-01", endDate: "2025-04-15" })];
  assert.equal(resolveAsOf(employees, "2025-06-01"), "2025-06-01");
});

test("resolveAsOf: imported data uses the latest date found across start/end/promo/transfer", () => {
  const employees = [
    emp({ startDate: "2019-01-01", endDate: "2025-02-15" }),
    emp({ id: "e1", startDate: "2019-01-01", endDate: "2025-04-15" }),
    emp({ id: "e2", startDate: "2019-01-01", lastPromoDate: "2025-03-01" }),
  ];
  assert.equal(resolveAsOf(employees, null), "2025-04-15");
});

test("resolveAsOf: caps at the real today when the latest date is in the future", () => {
  const employees = [emp({ startDate: "2099-01-01" })];
  const today = isoOf(new Date());
  assert.equal(resolveAsOf(employees, null), today);
});

// ─── Windowing / active-at ───

test("isActiveAt: active on the day they start, inactive on the day they end", () => {
  const e = emp({ startDate: "2024-01-01", endDate: "2024-06-01" });
  assert.equal(isActiveAt(e, "2024-01-01"), true);
  assert.equal(isActiveAt(e, "2023-12-31"), false);
  assert.equal(isActiveAt(e, "2024-06-01"), false); // endDate boundary is exclusive
  assert.equal(isActiveAt(e, "2024-05-31"), true);
});

test("windowBounds: T12M is (asOf-12mo, asOf] — exclusive start, inclusive end", () => {
  const employees = [
    emp({ id: "onBoundary", startDate: "2024-06-01" }), // exactly asOf-12mo -> excluded
    emp({ id: "justAfter", startDate: "2024-06-02" }),  // just inside -> included
    emp({ id: "onEnd", startDate: "2025-06-01" }),       // exactly asOf -> included
  ];
  const hires = hiresInWindow(employees, ASOF, 12).map(e => e.id);
  assert.deepEqual(hires.sort(), ["justAfter", "onEnd"]);
});

test("hiresInWindow / exitsInWindow: contractors are excluded", () => {
  const employees = [
    emp({ id: "fte", startDate: "2025-01-01" }),
    emp({ id: "ctr", startDate: "2025-01-01", employmentType: "Contract" }),
  ];
  assert.deepEqual(hiresInWindow(employees, ASOF, 12).map(e => e.id), ["fte"]);
});

// ─── Avg headcount denominator ───

test("computeAvgHeadcount: averages 13 month-end snapshots for a 12-month window", () => {
  // One person active the whole window -> avg headcount stays exactly 1 at every snapshot.
  const employees = [emp({ startDate: "2020-01-01" })];
  assert.equal(computeAvgHeadcount(employees, ASOF, 12), 1);
});

test("computeAvgHeadcount: a mid-window hire raises the average proportionally", () => {
  // Present for all 13 snapshots.
  const steady = emp({ id: "steady", startDate: "2020-01-01" });
  // Hired exactly at the window midpoint (asOf - 6mo): present for 7 of 13 month-end snapshots.
  const midHire = emp({ id: "mid", startDate: isoOf(toUtcDate("2024-12-01")) });
  const avg = computeAvgHeadcount([steady, midHire], ASOF, 12);
  // 13 snapshots: midHire present from month-end 2024-12-01 through 2025-06-01 = 7 points.
  const expected = (13 + 7) / 13;
  assert.ok(Math.abs(avg - expected) < 1e-9, `expected ~${expected}, got ${avg}`);
});

test("computeAttritionRates: annualized % = exits / avgHC * (12/windowMonths)", () => {
  const employees = [];
  for (let i = 0; i < 10; i++) employees.push(emp({ id: "e" + i, startDate: "2020-01-01" }));
  employees[0].endDate = "2025-03-01"; // one exit inside T12M
  const r = computeAttritionRates(employees, ASOF, 12);
  assert.equal(r.exitsCount, 1);
  // avgHC ~10 the whole window (only one exit near the end barely dents it)
  assert.ok(r.overall > 9 && r.overall < 11, `expected ~10%, got ${r.overall}`);
});

test("computeAttritionRates: voluntary/regretted read null (n/a) when termType is missing on every exit", () => {
  const employees = [emp({ startDate: "2020-01-01", endDate: "2025-03-01" })]; // no termType
  const r = computeAttritionRates(employees, ASOF, 12);
  assert.equal(r.voluntary, null);
  assert.equal(r.regretted, null);
  assert.ok(r.overall > 0); // overall is still computable from endDate alone
});

// ─── First-year cohort ───

test("computeFirstYearAttrition: cohort is hires in (asOf-24mo, asOf-12mo], rate = %  who left within 365d", () => {
  const employees = [
    // In cohort, left within a year -> counts against the rate
    emp({ id: "left", startDate: "2024-01-15", endDate: "2024-08-01" }),
    // In cohort, still active a year+ later -> doesn't count
    emp({ id: "stayed", startDate: "2024-01-20" }),
    // Hired too recently to be in the 12-24mo-ago cohort
    emp({ id: "tooRecent", startDate: "2025-01-01" }),
  ];
  const r = computeFirstYearAttrition(employees, ASOF);
  assert.equal(r.cohortN, 2);
  assert.equal(r.leftN, 1);
  assert.equal(r.rate, 50);
});

test("computeFirstYearAttrition: empty cohort reads null rate, not zero", () => {
  const employees = [emp({ startDate: "2025-01-01" })]; // no one hired 12-24mo ago
  const r = computeFirstYearAttrition(employees, ASOF);
  assert.equal(r.cohortN, 0);
  assert.equal(r.rate, null);
});

// ─── Compa derivation ───

test("compaRatioOf: prefers an explicit compaRatio over deriving from salary/rangeMid", () => {
  assert.equal(compaRatioOf({ compaRatio: 0.97, salary: 100000, rangeMid: 100000 }), 0.97);
});

test("compaRatioOf: derives salary / rangeMid when compaRatio is absent", () => {
  assert.equal(compaRatioOf({ salary: 95000, rangeMid: 100000 }), 0.95);
});

test("compaRatioOf: null when neither compaRatio nor a full salary/rangeMid pair is present", () => {
  assert.equal(compaRatioOf({ salary: 95000 }), null);
  assert.equal(compaRatioOf({}), null);
});

test("computeCompaStats: below/above range thresholds are < 0.90 and > 1.10", () => {
  const employees = [
    emp({ id: "below", salary: 85000, rangeMid: 100000 }),
    emp({ id: "mid", salary: 100000, rangeMid: 100000 }),
    emp({ id: "above", salary: 115000, rangeMid: 100000 }),
  ];
  const s = computeCompaStats(employees, ASOF);
  assert.equal(s.belowRangeCount, 1);
  assert.equal(s.aboveRangeCount, 1);
  assert.equal(s.n, 3);
});

// ─── Anonymity suppression ───

test("computePayEquityByLevel: suppresses a level when either gender group is under MIN_GROUP", () => {
  const employees = [];
  for (let i = 0; i < MIN_GROUP - 1; i++) employees.push(emp({ id: "w" + i, gender: "Woman", salary: 100000, rangeMid: 100000, level: "IC3" }));
  for (let i = 0; i < MIN_GROUP + 2; i++) employees.push(emp({ id: "m" + i, gender: "Man", salary: 110000, rangeMid: 100000, level: "IC3" }));
  const rows = computePayEquityByLevel(employees, ASOF);
  const row = rows.find(r => r.level === "IC3");
  assert.equal(row.suppressed, true);
});

test("computePayEquityByLevel: reports a gap once both groups reach MIN_GROUP", () => {
  const employees = [];
  for (let i = 0; i < MIN_GROUP; i++) employees.push(emp({ id: "w" + i, gender: "Woman", salary: 90000, rangeMid: 100000, level: "IC4" }));
  for (let i = 0; i < MIN_GROUP; i++) employees.push(emp({ id: "m" + i, gender: "Man", salary: 100000, rangeMid: 100000, level: "IC4" }));
  const rows = computePayEquityByLevel(employees, ASOF);
  const row = rows.find(r => r.level === "IC4");
  assert.equal(row.suppressed, false);
  assert.ok(Math.abs(row.gapPct - 10) < 1e-9);
});

test("computeENPS: suppressed below MIN_GROUP respondents", () => {
  const employees = [];
  for (let i = 0; i < MIN_GROUP - 1; i++) employees.push(emp({ id: "e" + i, surveyScore: 9 }));
  const r = computeENPS(employees, ASOF);
  assert.equal(r.suppressed, true);
  assert.equal(r.score, null);
});

test("computeENPS: score = %promoters(9-10) - %detractors(0-6) once at MIN_GROUP respondents", () => {
  const employees = [];
  const scores = [9, 9, 9, 5, 0]; // 3 promoters, 2 detractors, 5 respondents (== MIN_GROUP)
  scores.forEach((s, i) => employees.push(emp({ id: "e" + i, surveyScore: s })));
  const r = computeENPS(employees, ASOF);
  assert.equal(r.suppressed, false);
  assert.ok(Math.abs(r.score - 20) < 1e-9, `expected 20, got ${r.score}`); // (3-2)/5*100
});

test("computeRepresentation: suppressed cuts (n < MIN_GROUP) read null, not 0 or 100", () => {
  const employees = [
    emp({ id: "w0", gender: "Woman", level: "VP" }),
    emp({ id: "m0", gender: "Man", level: "VP" }),
  ];
  const r = computeRepresentation(employees, ASOF);
  assert.equal(r.leadership, null); // only 2 leaders total, under MIN_GROUP
});

// ─── Scope ancestry ───

test("inScopeFn (leader): includes the leader and everyone whose manager chain reaches them", () => {
  const employees = [
    emp({ id: "lead", managerId: null }),
    emp({ id: "mgr", managerId: "lead" }),
    emp({ id: "ic", managerId: "mgr" }),
    emp({ id: "outsider", managerId: null }),
  ];
  const inScope = inScopeFn(employees, { kind: "leader", id: "lead" });
  assert.deepEqual(employees.filter(inScope).map(e => e.id).sort(), ["ic", "lead", "mgr"]);
});

test("inScopeFn (leader): a terminated former manager still counts toward the org they left from", () => {
  const employees = [
    emp({ id: "lead", managerId: null }),
    emp({ id: "exMgr", managerId: "lead", status: "Terminated", endDate: "2023-01-01" }),
    emp({ id: "survivor", managerId: "exMgr" }), // reassigned since, but historically under exMgr
  ];
  const inScope = inScopeFn(employees, { kind: "leader", id: "lead" });
  assert.equal(inScope(employees.find(e => e.id === "survivor")), true);
});

test("inScopeFn (leader): a manager reporting cycle does not infinite-loop and resolves out-of-scope", () => {
  const employees = [
    emp({ id: "a", managerId: "b" }),
    emp({ id: "b", managerId: "a" }), // cycle, neither reaches "lead"
    emp({ id: "lead", managerId: null }),
  ];
  const inScope = inScopeFn(employees, { kind: "leader", id: "lead" });
  assert.equal(inScope(employees.find(e => e.id === "a")), false);
  assert.equal(inScope(employees.find(e => e.id === "b")), false);
});

test("inScopeFn (field): matches on the given field/value pair only", () => {
  const employees = [
    emp({ id: "a", dept: "Eng" }),
    emp({ id: "b", dept: "Sales" }),
  ];
  const inScope = inScopeFn(employees, { kind: "field", field: "dept", value: "Eng" });
  assert.deepEqual(employees.filter(inScope).map(e => e.id), ["a"]);
});

test("inScopeFn (company): everyone is in scope", () => {
  const employees = [emp({ id: "a" }), emp({ id: "b" })];
  const inScope = inScopeFn(employees, { kind: "company" });
  assert.equal(employees.filter(inScope).length, 2);
});

// ─── Normalizers ───

test("normalizeGenderValue: common aliases map to the 4 canonical values", () => {
  assert.equal(normalizeGenderValue("F"), "Woman");
  assert.equal(normalizeGenderValue("Female"), "Woman");
  assert.equal(normalizeGenderValue("M"), "Man");
  assert.equal(normalizeGenderValue("Non-binary"), "Non-binary");
  assert.equal(normalizeGenderValue("Prefer not to say"), "Undisclosed");
  assert.equal(normalizeGenderValue("gibberish"), null);
  assert.equal(normalizeGenderValue(""), null);
  assert.equal(normalizeGenderValue(null), null);
});

test("normalizePerfRatingValue: numeric passthrough and text-rating mapping", () => {
  assert.equal(normalizePerfRatingValue(4), 4);
  assert.equal(normalizePerfRatingValue("3"), 3);
  assert.equal(normalizePerfRatingValue("Exceeds"), 4);
  assert.equal(normalizePerfRatingValue("Far exceeds"), 5);
  assert.equal(normalizePerfRatingValue("Outstanding"), 5);
  assert.equal(normalizePerfRatingValue("Meets"), 3);
  assert.equal(normalizePerfRatingValue("Partially meets"), 2);
  assert.equal(normalizePerfRatingValue("Below"), 2);
  assert.equal(normalizePerfRatingValue("Does not meet"), 1);
  assert.equal(normalizePerfRatingValue(""), null);
  assert.equal(normalizePerfRatingValue(7), null);
});

test("normalizeTermTypeValue: vol/invol synonyms including layoff and rif", () => {
  assert.equal(normalizeTermTypeValue("vol"), "Voluntary");
  assert.equal(normalizeTermTypeValue("Resignation"), "Voluntary");
  assert.equal(normalizeTermTypeValue("invol"), "Involuntary");
  assert.equal(normalizeTermTypeValue("Layoff"), "Involuntary");
  assert.equal(normalizeTermTypeValue("RIF"), "Involuntary");
  assert.equal(normalizeTermTypeValue("huh"), null);
});

test("normalizeRegrettedValue: yes/no family plus unknown -> null", () => {
  assert.equal(normalizeRegrettedValue("Yes"), true);
  assert.equal(normalizeRegrettedValue("1"), true);
  assert.equal(normalizeRegrettedValue("No"), false);
  assert.equal(normalizeRegrettedValue("0"), false);
  assert.equal(normalizeRegrettedValue("maybe"), null);
});

test("normalizeMoneyValue: strips $ and commas", () => {
  assert.equal(normalizeMoneyValue("$120,000"), 120000);
  assert.equal(normalizeMoneyValue("95000"), 95000);
  assert.equal(normalizeMoneyValue(""), null);
  assert.equal(normalizeMoneyValue("not a number"), null);
});

test("normalizeCompaValue: whole-number percentages divide by 100, ratios pass through", () => {
  assert.equal(normalizeCompaValue("95"), 0.95);
  assert.equal(normalizeCompaValue("95%"), 0.95);
  assert.equal(normalizeCompaValue("0.95"), 0.95);
  assert.equal(normalizeCompaValue("1.05"), 1.05);
});

test("normalizeSurveyScoreValue: clamps to 0-10 and rounds; blank/garbage -> null", () => {
  assert.equal(normalizeSurveyScoreValue("8"), 8);
  assert.equal(normalizeSurveyScoreValue("8.6"), 9);
  assert.equal(normalizeSurveyScoreValue("15"), 10);
  assert.equal(normalizeSurveyScoreValue("-3"), 0);
  assert.equal(normalizeSurveyScoreValue(""), null);
  assert.equal(normalizeSurveyScoreValue("n/a"), null);
});

// ─── Scope-level integration smoke tests ───

test("computeHrbpMetrics: company scope includes everyone; leader scope is a strict subset", () => {
  const employees = [
    emp({ id: "ceo", managerId: null, level: "C-Suite" }),
    emp({ id: "vp", managerId: "ceo", level: "VP" }),
    emp({ id: "ic1", managerId: "vp" }),
    emp({ id: "ic2", managerId: "vp" }),
    emp({ id: "other", managerId: "ceo" }),
  ];
  const company = computeHrbpMetrics(employees, { scope: { kind: "company" }, asOf: ASOF, flightRisks: {} });
  const scoped = computeHrbpMetrics(employees, { scope: { kind: "leader", id: "vp" }, asOf: ASOF, flightRisks: {} });
  assert.equal(company.kpis.headcount.value, 5);
  assert.equal(scoped.kpis.headcount.value, 3); // vp + ic1 + ic2
});

test("computeHrbpMetrics: runs well under 50ms for a few thousand employees", () => {
  const employees = [];
  const mgrIds = [];
  employees.push(emp({ id: "root", managerId: null, level: "C-Suite" }));
  for (let d = 0; d < 8; d++) {
    const mgrId = "mgr" + d;
    employees.push(emp({ id: mgrId, managerId: "root", level: "Director", dept: "Dept" + d }));
    mgrIds.push(mgrId);
  }
  for (let i = 0; i < 3000; i++) {
    const mgrId = mgrIds[i % mgrIds.length];
    employees.push(emp({
      id: "ic" + i, managerId: mgrId, level: "IC3", dept: employees.find(e => e.id === mgrId).dept,
      startDate: "2021-0" + ((i % 9) + 1) + "-01",
      gender: i % 2 === 0 ? "Woman" : "Man", perfRating: (i % 5) + 1, salary: 120000, rangeMid: 120000,
      surveyScore: i % 11,
    }));
  }
  const start = Date.now();
  computeHrbpMetrics(employees, { scope: { kind: "company" }, asOf: ASOF, flightRisks: {} });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 200, `computeHrbpMetrics took ${elapsed}ms for 3000+ employees`); // generous CI margin over the ~50ms target
});

test("computeCoverage: pay unlocks with either compaRatio alone or salary+rangeMid together", () => {
  const withCompaRatio = computeCoverage([emp({ compaRatio: 1.0 })]);
  assert.equal(withCompaRatio.sections.pay, true);
  const withSalaryOnly = computeCoverage([emp({ salary: 100000 })]);
  assert.equal(withSalaryOnly.sections.pay, false);
  const withBoth = computeCoverage([emp({ salary: 100000, rangeMid: 100000 })]);
  assert.equal(withBoth.sections.pay, true);
  const withNeither = computeCoverage([emp({})]);
  assert.equal(withNeither.sections.pay, false);
  assert.ok(withNeither.missingFields.includes("salary"));
});

// ─── Round 4, item 1: stale scope (a saved leader id / field value that no longer
// resolves against the current data) ───

test("inScopeFn: a leader scope whose id no longer exists in the data matches nobody — this is what drives the app's stale-scope fallback to Whole company", () => {
  const employees = [emp({ id: "a" }), emp({ id: "b", managerId: "a" })];
  const inScope = inScopeFn(employees, { kind: "leader", id: "ghost" });
  assert.equal(employees.filter(inScope).length, 0);
});

test("inScopeFn: a field scope whose value no longer exists in the data matches nobody", () => {
  const employees = [emp({ id: "a", dept: "Eng" })];
  const inScope = inScopeFn(employees, { kind: "field", field: "dept", value: "Sales" });
  assert.equal(employees.filter(inScope).length, 0);
});

test("scopeName: an unresolvable leader id reads 'Unknown leader' (the app treats this as invalid and resets to company)", () => {
  const employees = [emp({ id: "a" })];
  assert.equal(scopeName(employees, { kind: "leader", id: "ghost" }), "Unknown leader");
});

// ─── Round 4, item 2: missing ≠ zero — rates read null, not 0, when the source field is
// entirely absent from the scope ───

test("computePromotionRate: reads null (not 0%) when nobody in scope has a lastPromoDate", () => {
  const employees = [emp({ id: "a" }), emp({ id: "b" })];
  assert.equal(computePromotionRate(employees, ASOF, 12).rate, null);
});

test("computePromotionRate: reads a real rate once at least one person carries lastPromoDate", () => {
  const employees = [emp({ id: "a", lastPromoDate: "2025-01-01" }), emp({ id: "b" })];
  const r = computePromotionRate(employees, ASOF, 12);
  assert.notEqual(r.rate, null);
  assert.ok(r.rate > 0);
});

test("computeInternalMobilityRate: reads null when neither lastPromoDate nor lastTransferDate exists anywhere in scope", () => {
  const employees = [emp({ id: "a" }), emp({ id: "b" })];
  assert.equal(computeInternalMobilityRate(employees, ASOF, 12).rate, null);
});

test("computeInternalMobilityRate: lastTransferDate alone (no promotions at all) still unlocks a real rate", () => {
  const employees = [emp({ id: "a", lastTransferDate: "2025-01-01" }), emp({ id: "b" })];
  const r = computeInternalMobilityRate(employees, ASOF, 12);
  assert.notEqual(r.rate, null);
  assert.ok(r.rate > 0);
});

test("computePerformanceDistribution: notRated equals total when nobody has a perfRating", () => {
  const employees = [emp({ id: "a" }), emp({ id: "b" })];
  const perf = computePerformanceDistribution(employees, ASOF);
  assert.equal(perf.notRated, perf.total);
});

test("computeSubOrgRow: highPerfPct reads null (not 0%) when nobody in scope has a perfRating", () => {
  const employees = [
    emp({ id: "lead", managerId: null }),
    emp({ id: "a", managerId: "lead" }),
    emp({ id: "b", managerId: "lead" }),
  ];
  const row = computeSubOrgRow(employees, { key: "lead", kind: "leader", leaderId: "lead" }, ASOF);
  assert.equal(row.highPerfPct, null);
});

test("computeSubOrgRow: highPerfPct is a real percentage once at least one person in scope is rated", () => {
  const employees = [
    emp({ id: "lead", managerId: null }),
    emp({ id: "a", managerId: "lead", perfRating: 5 }),
    emp({ id: "b", managerId: "lead", perfRating: 3 }),
  ];
  const row = computeSubOrgRow(employees, { key: "lead", kind: "leader", leaderId: "lead" }, ASOF);
  assert.notEqual(row.highPerfPct, null);
  assert.ok(row.highPerfPct > 0);
});

test("computeManagerEngagementScatter: team voluntaryAttrition reads null (not a false 0%) when termType is absent everywhere", () => {
  const employees = [
    emp({ id: "mgr", managerId: null }),
    ...Array.from({ length: 6 }, (_, i) => emp({ id: "r" + i, managerId: "mgr", surveyScore: 8 })),
  ];
  const points = computeManagerEngagementScatter(employees, ASOF);
  assert.equal(points.length, 1);
  assert.equal(points[0].voluntaryAttrition, null);
});

test("computeManagerEngagementScatter: team voluntaryAttrition is a real rate once termType exists anywhere in the dataset", () => {
  const employees = [
    emp({ id: "mgr", managerId: null }),
    ...Array.from({ length: 6 }, (_, i) => emp({ id: "r" + i, managerId: "mgr", surveyScore: 8 })),
    emp({ id: "gone", managerId: "mgr", status: "Terminated", endDate: "2025-02-01", termType: "Voluntary" }),
  ];
  const points = computeManagerEngagementScatter(employees, ASOF);
  assert.notEqual(points[0].voluntaryAttrition, null);
});

// ─── Round 4, item 3: small-N guards on alerts, and the KPI-tile sample-size signal ───

test("computeAlerts: first-year attrition alert is suppressed below a 5-person cohort (a 1-of-2 exit shouldn't fire a 50% alert)", () => {
  const employees = [
    emp({ id: "h1", startDate: "2023-08-01", endDate: "2023-12-01" }), // left within a year -> early leaver
    emp({ id: "h2", startDate: "2023-08-01" }), // still active
  ];
  const metrics = computeHrbpMetrics(employees, { scope: { kind: "company" }, asOf: ASOF, flightRisks: {} });
  assert.equal(metrics.attrition.firstYear.cohortN, 2);
  assert.equal(metrics.attrition.firstYear.rate, 50);
  assert.ok(!metrics.alerts.some(a => a.id === "first-year-attrition"));
});

test("computeAlerts: first-year attrition alert fires once the cohort reaches 5", () => {
  const employees = [
    emp({ id: "h1", startDate: "2023-08-01", endDate: "2023-12-01" }),
    emp({ id: "h2", startDate: "2023-08-01", endDate: "2023-12-15" }),
    emp({ id: "h3", startDate: "2023-08-01" }),
    emp({ id: "h4", startDate: "2023-08-01" }),
    emp({ id: "h5", startDate: "2023-08-01" }),
  ];
  const metrics = computeHrbpMetrics(employees, { scope: { kind: "company" }, asOf: ASOF, flightRisks: {} });
  assert.equal(metrics.attrition.firstYear.cohortN, 5);
  assert.ok(metrics.attrition.firstYear.rate > 20);
  assert.ok(metrics.alerts.some(a => a.id === "first-year-attrition"));
});

test("computeAlerts: 'voluntary attrition above company' is suppressed below a 10-person scope average headcount", () => {
  const employees = [
    emp({ id: "a", endDate: "2025-01-01", termType: "Voluntary" }),
    emp({ id: "b", endDate: "2025-02-01", termType: "Voluntary" }),
    emp({ id: "c" }),
  ];
  const companyBenchmark = { attrition: { voluntary: 5 } };
  const spanInfo = computeSpanOfControl(employees, ASOF);
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark, payEquityRows: [], spanInfo });
  assert.ok(!alerts.some(a => a.id === "attrition-vs-company"));
});

test("computeAlerts: 'voluntary attrition above company' fires once scope average headcount reaches 10", () => {
  const employees = [
    emp({ id: "a", endDate: "2025-01-01", termType: "Voluntary" }),
    emp({ id: "b", endDate: "2025-02-01", termType: "Voluntary" }),
    ...Array.from({ length: 10 }, (_, i) => emp({ id: "s" + i })),
  ];
  const companyBenchmark = { attrition: { voluntary: 5 } };
  const spanInfo = computeSpanOfControl(employees, ASOF);
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark, payEquityRows: [], spanInfo });
  assert.ok(alerts.some(a => a.id === "attrition-vs-company"));
});

test("computeHrbpMetrics: kpis carry a sampleN denominator for the KPI tile's 'small sample' tag", () => {
  const employees = [
    emp({ id: "h1", startDate: "2023-08-01", endDate: "2023-12-01" }),
    emp({ id: "h2", startDate: "2023-08-01" }),
  ];
  const metrics = computeHrbpMetrics(employees, { scope: { kind: "company" }, asOf: ASOF, flightRisks: {} });
  assert.equal(metrics.kpis.firstYearAttrition.sampleN, 2);
  assert.ok(metrics.kpis.firstYearAttrition.sampleN < 10);
});

// ─── Round 4, item 5: one fixed eNPS alert threshold (-20) at every scope ───

test("computeAlerts: low-eNPS-teams threshold is a fixed -20, independent of how many teams would match", () => {
  // 10 teams all sitting between -20 and -10 — under the old dynamic threshold, more than
  // 8 matching teams at -10 would have tightened the cutoff to -20 and wiped the list;
  // under a fixed -20 cutoff none of these teams (all > -20) should match at all.
  const employees = [];
  // 6 respondents per team: 2 promoters (9), 3 detractors (3), 1 passive (7) -> team eNPS
  // = (2-3)/6*100 = -16.7, which is > -20 (less negative) and must be excluded.
  const scores = [9, 9, 3, 3, 3, 7];
  for (let t = 0; t < 10; t++) {
    const mgrId = "mgr" + t;
    employees.push(emp({ id: mgrId, managerId: null }));
    scores.forEach((s, i) => employees.push(emp({ id: `${mgrId}r${i}`, managerId: mgrId, surveyScore: s })));
  }
  const companyBenchmark = { attrition: { voluntary: null } };
  const spanInfo = computeSpanOfControl(employees, ASOF);
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark, payEquityRows: [], spanInfo });
  const enpsAlert = alerts.find(a => a.id === "low-enps-teams");
  assert.equal(enpsAlert, undefined);
});

// ─── Round 5: alert rules ported from the old standalone Analytics/Dashboards insight
// engine (computeInsights in app.jsx), now folded into hrbp.mjs's computeAlerts ───

const noCompanyGap = { attrition: { voluntary: null } }; // disables rule 8 in these fixtures

test("computeAlerts: flags a new manager (<12mo tenure) with a team of >=5", () => {
  const employees = [
    emp({ id: "mgr", managerId: null, startDate: "2025-02-01" }), // 4mo tenure as of ASOF
    ...Array.from({ length: 5 }, (_, i) => emp({ id: "r" + i, managerId: "mgr" })),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  const a = alerts.find(x => x.id === "new-manager-large-team");
  assert.ok(a);
  assert.equal(a.severity, "warning");
});

test("computeAlerts: does not flag a long-tenured manager or a team under 5", () => {
  const employees = [
    emp({ id: "mgr", managerId: null, startDate: "2020-01-01" }), // long tenure
    ...Array.from({ length: 5 }, (_, i) => emp({ id: "r" + i, managerId: "mgr" })),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  assert.ok(!alerts.some(x => x.id === "new-manager-large-team"));
});

test("computeAlerts: flags a single-report chain whose lone report manages >=8 people", () => {
  const employees = [
    emp({ id: "top", managerId: null }),
    emp({ id: "mid", managerId: "top" }), // top's only direct report
    ...Array.from({ length: 8 }, (_, i) => emp({ id: "s" + i, managerId: "mid" })),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  assert.ok(alerts.some(x => x.id === "single-report-chains"));
});

test("computeAlerts: does not flag a single-report chain whose subtree is under 8", () => {
  const employees = [
    emp({ id: "top", managerId: null }),
    emp({ id: "mid", managerId: "top" }),
    ...Array.from({ length: 3 }, (_, i) => emp({ id: "s" + i, managerId: "mid" })),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  assert.ok(!alerts.some(x => x.id === "single-report-chains"));
});

test("computeAlerts: org-depth flags chains deeper than 7 levels, info severity for depth 8-9", () => {
  const employees = [];
  for (let i = 0; i <= 8; i++) employees.push(emp({ id: "p" + i, managerId: i === 0 ? null : "p" + (i - 1) }));
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  const a = alerts.find(x => x.id === "org-depth");
  assert.ok(a);
  assert.equal(a.severity, "info");
});

test("computeAlerts: org-depth is warning once max depth exceeds 9", () => {
  const employees = [];
  for (let i = 0; i <= 10; i++) employees.push(emp({ id: "p" + i, managerId: i === 0 ? null : "p" + (i - 1) }));
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  const a = alerts.find(x => x.id === "org-depth");
  assert.equal(a.severity, "warning");
});

test("computeAlerts: rapid-growth flags a department growing >=35% in 6 months (base >=5)", () => {
  const employees = [
    ...Array.from({ length: 5 }, (_, i) => emp({ id: "old" + i, dept: "Eng", startDate: "2023-01-01" })),
    ...Array.from({ length: 3 }, (_, i) => emp({ id: "new" + i, dept: "Eng", startDate: "2025-05-01" })), // within last 6mo of ASOF
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  const a = alerts.find(x => x.id === "rapid-growth");
  assert.ok(a);
  assert.equal(a.severity, "info");
});

test("computeAlerts: rapid-growth does not fire below the 5-person base threshold", () => {
  const employees = [
    ...Array.from({ length: 3 }, (_, i) => emp({ id: "old" + i, dept: "Eng", startDate: "2023-01-01" })),
    ...Array.from({ length: 3 }, (_, i) => emp({ id: "new" + i, dept: "Eng", startDate: "2025-05-01" })),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  assert.ok(!alerts.some(x => x.id === "rapid-growth"));
});

test("computeAlerts: new-hire-concentration flags a team (n>=5) where >=50% joined in the last 6 months, info below 65%", () => {
  const employees = [
    emp({ id: "mgr", managerId: null }),
    emp({ id: "a", managerId: "mgr", startDate: "2025-05-01" }),
    emp({ id: "b", managerId: "mgr", startDate: "2025-04-01" }),
    emp({ id: "c", managerId: "mgr", startDate: "2025-03-01" }),
    emp({ id: "d", managerId: "mgr", startDate: "2020-01-01" }),
    emp({ id: "e", managerId: "mgr", startDate: "2020-01-01" }),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  const a = alerts.find(x => x.id === "new-hire-concentration");
  assert.ok(a); // 3 of 5 = 60%
  assert.equal(a.severity, "info");
});

test("computeAlerts: new-hire-concentration is a warning (never critical) at >=65% concentration", () => {
  const employees = [
    emp({ id: "mgr", managerId: null }),
    ...["a", "b", "c", "d"].map(id => emp({ id, managerId: "mgr", startDate: "2025-04-01" })),
    emp({ id: "e", managerId: "mgr", startDate: "2020-01-01" }),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  const a = alerts.find(x => x.id === "new-hire-concentration");
  assert.equal(a.severity, "warning"); // 4 of 5 = 80%
});

test("computeAlerts: new-hire-concentration ignores teams smaller than MIN_GROUP", () => {
  const employees = [
    emp({ id: "mgr", managerId: null }),
    ...["a", "b", "c", "d"].map(id => emp({ id, managerId: "mgr", startDate: "2025-04-01" })),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  assert.ok(!alerts.some(x => x.id === "new-hire-concentration")); // 4 of 4 = 100%, but n < 5
});

test("computeAlerts: succession-gaps flags a leader role (Director+) with no ready successor", () => {
  const employees = [
    emp({ id: "dir", managerId: null, level: "Director" }),
    emp({ id: "r1", managerId: "dir", perfRating: 3 }),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [], flightRisks: {} });
  const a = alerts.find(x => x.id === "succession-gaps");
  assert.ok(a);
  assert.equal(a.severity, "warning");
});

test("computeAlerts: succession-gaps does not fire when overall bench coverage is healthy (>=70%) despite a few uncovered roles", () => {
  const employees = [];
  for (let i = 0; i < 10; i++) {
    employees.push(emp({ id: "dir" + i, managerId: null, level: "Director" }));
    employees.push(emp({ id: "r" + i, managerId: "dir" + i, perfRating: i < 8 ? 4 : 3 })); // 8 ready, 2 not = 80% coverage
  }
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [], flightRisks: {} });
  assert.ok(!alerts.some(x => x.id === "succession-gaps"));
});

test("computeAlerts: succession-gaps does not fire when a ready successor exists", () => {
  const employees = [
    emp({ id: "dir", managerId: null, level: "Director" }),
    emp({ id: "r1", managerId: "dir", perfRating: 4 }),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [], flightRisks: {} });
  assert.ok(!alerts.some(x => x.id === "succession-gaps"));
});

test("computeAlerts: every rule attaches a suggestedAction (the UI's expanded 'Suggested action' text)", () => {
  const employees = [
    emp({ id: "h1", startDate: "2023-08-01", endDate: "2023-12-01" }),
    emp({ id: "h2", startDate: "2023-08-01", endDate: "2023-12-15" }),
    emp({ id: "h3", startDate: "2023-08-01" }),
    emp({ id: "h4", startDate: "2023-08-01" }),
    emp({ id: "h5", startDate: "2023-08-01" }),
  ];
  const alerts = computeAlerts(employees, { asOf: ASOF, companyBenchmark: noCompanyGap, payEquityRows: [] });
  assert.ok(alerts.length > 0);
  alerts.forEach(a => assert.ok(typeof a.suggestedAction === "string" && a.suggestedAction.length > 0, `${a.id} is missing suggestedAction`));
});
