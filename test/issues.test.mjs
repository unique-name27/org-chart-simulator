import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDataIssues, computeDataHealth } from "../core.mjs";

const T = { today: "2026-07-13" };
const emp = (o) => ({ id: "", first: "", last: "", title: "", level: "IC3", dept: "Eng", location: "SF", managerId: "", startDate: "", endDate: "", status: "Active", ...o });
const types = (cases) => cases.map(c => c.type);

test("clean roster produces zero cases", () => {
  const list = [
    emp({ id: "E1", first: "Ada", last: "Lovelace" }),
    emp({ id: "E2", first: "Alan", last: "Turing", managerId: "E1", startDate: "2020-06-01" }),
  ];
  assert.deepEqual(detectDataIssues(list, T), []);
});

test("id problems: missing and duplicate ids are high-severity", () => {
  const list = [emp({ id: "", first: "No", last: "Id" }), emp({ id: "E1", first: "A", last: "B" }), emp({ id: "E1", first: "C", last: "D" })];
  const ts = types(detectDataIssues(list, T));
  assert.ok(ts.includes("missing-id"));
  assert.ok(ts.includes("dup-id"));
});

test("same name under two different ids → dup-person on both records", () => {
  const list = [emp({ id: "E1", first: "John", last: "Smith" }), emp({ id: "E2", first: "John", last: "Smith" })];
  const cs = detectDataIssues(list, T).filter(c => c.type === "dup-person");
  assert.equal(cs.length, 2);
});

test("manager checks: self, unknown, ambiguous, cycle", () => {
  const list = [
    emp({ id: "E1", first: "Ada", last: "L", managerId: "E1" }),                 // self
    emp({ id: "E2", first: "Alan", last: "T", managerId: "Nobody Real" }),       // unknown
    emp({ id: "E3", first: "Jo", last: "Smith" }),
    emp({ id: "E4", first: "Jo", last: "Smith" }),
    emp({ id: "E5", first: "Grace", last: "H", managerId: "Jo Smith" }),         // ambiguous
    emp({ id: "E6", first: "X", last: "Y", managerId: "E7" }),                   // cycle E6<->E7
    emp({ id: "E7", first: "Z", last: "W", managerId: "E6" }),
  ];
  const ts = types(detectDataIssues(list, T));
  assert.ok(ts.includes("manager-self"));
  assert.ok(ts.includes("manager-unknown"));
  assert.ok(ts.includes("manager-ambiguous"));
  assert.ok(ts.includes("manager-cycle"));
});

test("span-extreme and terminated-with-reports", () => {
  const boss = emp({ id: "M1", first: "Big", last: "Boss", status: "Terminated" });
  const reports = Array.from({ length: 21 }, (_, i) => emp({ id: "R" + i, first: "R", last: String(i), managerId: "M1" }));
  const ts = types(detectDataIssues([boss, ...reports], T));
  assert.ok(ts.includes("span-extreme"));
  assert.ok(ts.includes("term-with-reports"));
});

test("date checks: bad format, future, ancient, end-before-start", () => {
  const list = [
    emp({ id: "E1", first: "A", last: "A", startDate: "13/45/2020" }),
    emp({ id: "E2", first: "B", last: "B", startDate: "2031-01-01" }),
    emp({ id: "E3", first: "C", last: "C", startDate: "1950-01-01" }),
    emp({ id: "E4", first: "D", last: "D", startDate: "2022-05-01", endDate: "2021-01-01" }),
  ];
  const ts = types(detectDataIssues(list, T));
  assert.ok(ts.includes("date-bad"));
  assert.ok(ts.includes("date-future"));
  assert.ok(ts.includes("date-ancient"));
  assert.ok(ts.includes("date-order"));
});

test("level/dept/location checks; severity ordering puts high first", () => {
  const list = [
    emp({ id: "E1", first: "A", last: "A", level: "Wizard", dept: "", location: "" }),
    emp({ id: "E2", first: "B", last: "B", managerId: "Ghost Person" }), // high
  ];
  const cs = detectDataIssues(list, T);
  const ts = types(cs);
  assert.ok(ts.includes("level-unknown"));
  assert.ok(ts.includes("dept-missing"));
  assert.ok(ts.includes("loc-missing"));
  assert.equal(cs[0].severity, "high", "high-severity cases sort first");
});

test("computeDataHealth: 100 when clean, drops with open cases, floors at 0", () => {
  assert.equal(computeDataHealth(50, []), 100);
  const some = [{ severity: "high" }, { severity: "warn" }, { severity: "info" }];
  const s = computeDataHealth(50, some);
  assert.ok(s < 100 && s > 80);
  const many = Array.from({ length: 100 }, () => ({ severity: "high" }));
  assert.equal(computeDataHealth(10, many), 0);
});
