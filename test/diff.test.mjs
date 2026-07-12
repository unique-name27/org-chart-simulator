import test from "node:test";
import assert from "node:assert/strict";
import { diffScenarios } from "../core.mjs";

function baseRoster() {
  return [
    { id: "E1", first: "Ada", last: "Lovelace", managerId: null, dept: "Exec", level: "C-Suite" },
    { id: "E2", first: "Alan", last: "Turing", managerId: "E1", dept: "Engineering", level: "VP" },
    { id: "E3", first: "Grace", last: "Hopper", managerId: "E1", dept: "Product", level: "VP" },
    { id: "E4", first: "Linus", last: "Torvalds", managerId: "E2", dept: "Engineering", level: "IC5" },
    { id: "E5", first: "Margaret", last: "Hamilton", managerId: "E2", dept: "Engineering", level: "IC4" },
  ];
}

test("moving one person to a new manager yields one reportingChanges entry + span deltas", () => {
  const before = baseRoster();
  const after = baseRoster().map(e => e.id === "E4" ? { ...e, managerId: "E3" } : e);
  const d = diffScenarios(before, after);

  assert.equal(d.reportingChanges.length, 1);
  const rc = d.reportingChanges[0];
  assert.equal(rc.id, "E4");
  assert.equal(rc.fromManagerId, "E2");
  assert.equal(rc.fromManagerName, "Alan Turing");
  assert.equal(rc.toManagerId, "E3");
  assert.equal(rc.toManagerName, "Grace Hopper");

  // E2 loses a report (span -1), E3 gains one (span +1)
  const spanByMgr = Object.fromEntries(d.spanChanges.map(s => [s.managerId, s]));
  assert.equal(spanByMgr.E2.fromSpan, 2);
  assert.equal(spanByMgr.E2.toSpan, 1);
  assert.equal(spanByMgr.E2.delta, -1);
  assert.equal(spanByMgr.E3.fromSpan, 0);
  assert.equal(spanByMgr.E3.toSpan, 1);
  assert.equal(spanByMgr.E3.delta, 1);
});

test("add and remove a person updates added/removed and deptDeltas", () => {
  const before = baseRoster();
  const after = baseRoster()
    .filter(e => e.id !== "E5") // remove Margaret Hamilton (Engineering)
    .concat([{ id: "E6", first: "Katherine", last: "Johnson", managerId: "E3", dept: "Product", level: "IC5" }]);
  const d = diffScenarios(before, after);

  assert.equal(d.added.length, 1);
  assert.equal(d.added[0].id, "E6");
  assert.equal(d.added[0].name, "Katherine Johnson");
  assert.equal(d.added[0].dept, "Product");

  assert.equal(d.removed.length, 1);
  assert.equal(d.removed[0].id, "E5");
  assert.equal(d.removed[0].name, "Margaret Hamilton");
  assert.equal(d.removed[0].dept, "Engineering");

  const deptByName = Object.fromEntries(d.deptDeltas.map(x => [x.dept, x]));
  assert.equal(deptByName["Engineering"].before, 3);
  assert.equal(deptByName["Engineering"].after, 2);
  assert.equal(deptByName["Engineering"].delta, -1);
  assert.equal(deptByName["Product"].before, 1);
  assert.equal(deptByName["Product"].after, 2);
  assert.equal(deptByName["Product"].delta, 1);
});

test("identical arrays produce an all-empty diff with equal layers", () => {
  const roster = baseRoster();
  const d = diffScenarios(roster, roster.map(e => ({ ...e })));

  assert.deepEqual(d.added, []);
  assert.deepEqual(d.removed, []);
  assert.deepEqual(d.reportingChanges, []);
  assert.deepEqual(d.spanChanges, []);
  assert.equal(d.layers.beforeMaxDepth, d.layers.afterMaxDepth);
  assert.deepEqual(d.layers.beforeByDepth, d.layers.afterByDepth);
  d.deptDeltas.forEach(x => assert.equal(x.delta, 0));
  d.levelDeltas.forEach(x => assert.equal(x.delta, 0));
});

test("a deleted manager reassigns the report to root (null) as a reporting change, no crash", () => {
  const before = baseRoster();
  // E2 (Alan Turing) is removed in AFTER; his reports are reassigned to null (root).
  const after = baseRoster()
    .filter(e => e.id !== "E2")
    .map(e => (e.managerId === "E2" ? { ...e, managerId: null } : e));
  const d = diffScenarios(before, after);

  assert.equal(d.removed.length, 1);
  assert.equal(d.removed[0].id, "E2");

  const reassigned = d.reportingChanges.filter(rc => rc.id === "E4" || rc.id === "E5");
  assert.equal(reassigned.length, 2);
  reassigned.forEach(rc => {
    assert.equal(rc.fromManagerId, "E2");
    assert.equal(rc.toManagerId, null);
    assert.equal(rc.toManagerName, null);
  });
});

test("a cycle in the input (A -> B -> A) does not hang and still returns a result", () => {
  const before = [
    { id: "A", first: "Cy", last: "Cle", managerId: "B", dept: "Ops", level: "IC3" },
    { id: "B", first: "Bea", last: "Loop", managerId: "A", dept: "Ops", level: "IC3" },
    { id: "C", first: "Cam", last: "Straight", managerId: "A", dept: "Ops", level: "IC3" },
  ];
  const after = before.map(e => ({ ...e }));

  const d = diffScenarios(before, after);

  // No crash/hang is the primary assertion; identical inputs should still be a no-op diff.
  assert.deepEqual(d.reportingChanges, []);
  assert.deepEqual(d.added, []);
  assert.deepEqual(d.removed, []);
  assert.ok(Number.isFinite(d.layers.beforeMaxDepth));
  assert.ok(Number.isFinite(d.layers.afterMaxDepth));
});
