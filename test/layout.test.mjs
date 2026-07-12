import test from "node:test";
import assert from "node:assert/strict";
import { computeSlideLayout } from "../core.mjs";

// Fixture tree: root -> [m1 -> [c1..c5], m2 -> []]
function mkNode(id, children = []) {
  return {
    id,
    first: "First" + id,
    last: "Last" + id,
    title: "Title " + id,
    dept: "Dept",
    level: "IC3",
    children,
    _totalReports: children.length,
  };
}

function buildFixture() {
  const leaves = [1, 2, 3, 4, 5].map(i => mkNode("c" + i));
  return mkNode("root", [mkNode("m1", leaves), mkNode("m2", [])]);
}

test("computeSlideLayout: maxDepth:1 shows only root + its direct reports", () => {
  const root = buildFixture();
  const layout = computeSlideLayout(root, { maxDepth: 1 });
  // root, m1, m2 — grandchildren (c1..c5) are beyond depth 1
  assert.equal(layout.count, 3);
  assert.equal(layout.truncated, true); // m1 has children hidden by the depth cutoff
});

test("computeSlideLayout: maxDepth:2 shows root + reports + their reports", () => {
  const root = buildFixture();
  const layout = computeSlideLayout(root, { maxDepth: 2 });
  // root, m1, m2, c1..c5 = 8
  assert.equal(layout.count, 8);
  assert.equal(layout.truncated, false);
});

test("computeSlideLayout: truncated===true when nodeCap is below the node count", () => {
  const root = buildFixture();
  const layout = computeSlideLayout(root, { maxDepth: 2, nodeCap: 3 });
  assert.equal(layout.count, 3);
  assert.equal(layout.truncated, true);
});

test("computeSlideLayout: nodeCap at or above the node count is not truncated", () => {
  const root = buildFixture();
  const layout = computeSlideLayout(root, { maxDepth: 2, nodeCap: 200 });
  assert.equal(layout.count, 8);
  assert.equal(layout.truncated, false);
});

test("computeSlideLayout: wrap:true packs >3 leaf children into a grid with a group box", () => {
  const root = buildFixture();
  const layout = computeSlideLayout(root, { maxDepth: 2, wrap: true });
  assert.ok(layout.groups.length >= 1);
});

test("computeSlideLayout: without wrap, no group boxes are produced", () => {
  const root = buildFixture();
  const layout = computeSlideLayout(root, { maxDepth: 2, wrap: false });
  assert.equal(layout.groups.length, 0);
});

test("computeSlideLayout: positive overall bounds", () => {
  const root = buildFixture();
  const layout = computeSlideLayout(root, { maxDepth: 2, wrap: true });
  assert.ok(layout.width > 0);
  assert.ok(layout.height > 0);
});

test("computeSlideLayout: every card sits within [0,width] x [0,height]", () => {
  const root = buildFixture();
  const layout = computeSlideLayout(root, { maxDepth: 2, wrap: true });
  for (const c of layout.cards) {
    assert.ok(c.x >= 0 && c.x + c.w <= layout.width, `card ${c.node.id} x out of bounds`);
    assert.ok(c.y >= 0 && c.y + c.h <= layout.height, `card ${c.node.id} y out of bounds`);
  }
});

test("computeSlideLayout: leaf-only tree (no children) yields a single card", () => {
  const root = mkNode("solo");
  const layout = computeSlideLayout(root, { maxDepth: 2 });
  assert.equal(layout.count, 1);
  assert.equal(layout.truncated, false);
  assert.equal(layout.groups.length, 0);
});
