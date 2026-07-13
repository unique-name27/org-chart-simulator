import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlideLayout, SLIDE_DENSITY } from "../core.mjs";

const leaf = (id) => ({ id, first: id, last: "", title: "", dept: "D", level: "IC3", children: [], _totalReports: 0 });
const mgr = (id, kids) => ({ id, first: id, last: "", title: "", dept: "D", level: "Manager", children: kids, _totalReports: kids.length });
const dens = SLIDE_DENSITY.comfortable;

test("stack mode: single column — every wrapped child shares one x, height grows per child", () => {
  const root = mgr("R", [leaf("a"), leaf("b"), leaf("c"), leaf("d"), leaf("e"), leaf("f")]);
  const L = computeSlideLayout(root, { maxDepth: 1, dens, leafMode: "stack", stackCols: 1 });
  const children = L.cards.filter(c => c.node.id !== "R");
  assert.equal(children.length, 6);
  assert.equal(new Set(children.map(c => c.x)).size, 1, "one column → one x");
  assert.equal(new Set(children.map(c => c.y)).size, 6, "six distinct rows");
  assert.equal(L.groups.length, 1, "team box drawn");
  // stack should be dramatically narrower than a plain row of 6
  const row = computeSlideLayout(root, { maxDepth: 1, dens, leafMode: "row" });
  assert.ok(L.width < row.width / 3, `stack width ${L.width} ≪ row width ${row.width}`);
});

test("stack mode: two columns — children split across exactly two x positions", () => {
  const root = mgr("R", [leaf("a"), leaf("b"), leaf("c"), leaf("d"), leaf("e"), leaf("f")]);
  const L = computeSlideLayout(root, { maxDepth: 1, dens, leafMode: "stack", stackCols: 2 });
  const xs = new Set(L.cards.filter(c => c.node.id !== "R").map(c => c.x));
  assert.equal(xs.size, 2);
});

test("wrapThreshold: teams at or under the threshold stay a plain row", () => {
  const root = mgr("R", [leaf("a"), leaf("b"), leaf("c"), leaf("d")]); // 4 kids
  const under = computeSlideLayout(root, { maxDepth: 1, dens, leafMode: "stack", wrapThreshold: 5 });
  assert.equal(under.groups.length, 0, "4 ≤ 5 → no reshaping");
  const over = computeSlideLayout(root, { maxDepth: 1, dens, leafMode: "stack", wrapThreshold: 3 });
  assert.equal(over.groups.length, 1, "4 > 3 → stacked");
});

test("back-compat: wrap:true behaves identically to leafMode:'grid'", () => {
  const root = mgr("R", Array.from({ length: 9 }, (_, i) => leaf("k" + i)));
  const a = computeSlideLayout(root, { maxDepth: 1, dens, wrap: true, wrapCols: "auto" });
  const b = computeSlideLayout(root, { maxDepth: 1, dens, leafMode: "grid", wrapCols: "auto" });
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  assert.equal(a.count, b.count);
  assert.equal(a.groups.length, b.groups.length);
});
