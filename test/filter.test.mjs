import { test } from "node:test";
import assert from "node:assert/strict";
import { filterSubtree } from "../core.mjs";

const t = (id, loc, kids = []) => ({ id, location: loc, children: kids });
// R(SF) -> A(SF) -> [C(NYC), D(SF)] ; B(NYC) -> E(NYC)
const tree = t("R", "SF", [t("A", "SF", [t("C", "NYC"), t("D", "SF")]), t("B", "NYC", [t("E", "NYC")])]);
const ids = (n, acc = []) => { acc.push(n.id); (n.children || []).forEach(k => ids(k, acc)); return acc; };

test("filterSubtree: keeps matches and prunes empty branches", () => {
  const f = filterSubtree(tree, (n) => n.location === "NYC");
  // R kept as root; A kept as connector to C; D pruned; B,E kept; C kept
  assert.deepEqual(ids(f).sort(), ["A", "B", "C", "E", "R"]);
});

test("filterSubtree: non-matching connectors are dimmed, matches are not", () => {
  const f = filterSubtree(tree, (n) => n.location === "NYC");
  const flat = {}; (function w(n){ flat[n.id]=n.__dim; (n.children||[]).forEach(w); })(f);
  assert.equal(flat.A, true,  "A is a pass-through connector");
  assert.equal(flat.C, false, "C matches");
  assert.equal(flat.R, false, "root always full-strength");
});

test("filterSubtree: recomputes _totalReports on the pruned tree; null when nothing matches below root", () => {
  const f = filterSubtree(tree, (n) => n.location === "NYC");
  assert.equal(f._totalReports, 4); // A,B,C,E under R
  const none = filterSubtree(tree, () => false);
  assert.equal(none, null);
});

test("filterSubtree: does not mutate the original tree", () => {
  const before = JSON.stringify(tree);
  filterSubtree(tree, (n) => n.location === "SF");
  assert.equal(JSON.stringify(tree), before);
});
