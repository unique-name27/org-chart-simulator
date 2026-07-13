import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSubtree } from "../core.mjs";

// Build a small tree: root(Eng) -> [A(Software), B(Hardware)]; A -> [C(Software), D(Software)]; B -> [E(Hardware)]
const tree = {
  id: "R", dept: "Exec", fn: "G&A", children: [
    { id: "A", dept: "Software", fn: "Engineering", children: [
      { id: "C", dept: "Software", fn: "Engineering", children: [] },
      { id: "D", dept: "Software", fn: "Engineering", children: [] },
    ] },
    { id: "B", dept: "Hardware", fn: "Engineering", children: [
      { id: "E", dept: "Hardware", fn: "R&D", children: [] },
    ] },
  ],
};

test("groupSubtree: counts subtree members (excludes the root) by field, sorted by count desc", () => {
  const byDept = groupSubtree(tree, "dept");
  // members: A,B,C,D,E → Software x3 (A,C,D), Hardware x2 (B,E)
  assert.deepEqual(byDept, [
    { value: "Software", count: 3 },
    { value: "Hardware", count: 2 },
  ]);
});

test("groupSubtree: groups by a different field (job family)", () => {
  const byFn = groupSubtree(tree, "fn");
  // Engineering x4 (A,B,C,D), R&D x1 (E)
  assert.deepEqual(byFn, [
    { value: "Engineering", count: 4 },
    { value: "R&D", count: 1 },
  ]);
});

test("groupSubtree: missing/blank values fall into '—'; leaf root yields empty", () => {
  const t2 = { id: "R", children: [{ id: "X", dept: "", children: [] }, { id: "Y", children: [] }] };
  assert.deepEqual(groupSubtree(t2, "dept"), [{ value: "—", count: 2 }]);
  assert.deepEqual(groupSubtree({ id: "solo", children: [] }, "dept"), []);
});
