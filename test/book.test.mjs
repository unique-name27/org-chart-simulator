import test from "node:test";
import assert from "node:assert/strict";
import { enumerateBookNodes } from "../core.mjs";

// Fixture: root -> [m1 -> [gm1 -> [c1, c2], gm2 (leaf)], m2 -> [c3, c4], m3 (leaf)]
// Managers (nodes with children): root, m1, gm1, m2 = 4.
function mkNode(id, children = []) {
  return { id, first: "First" + id, last: "Last" + id, title: "Title " + id, children };
}

function buildFixture() {
  const gm1 = mkNode("gm1", [mkNode("c1"), mkNode("c2")]);
  const gm2 = mkNode("gm2");
  const m1 = mkNode("m1", [gm1, gm2]);
  const c3 = mkNode("c3"), c4 = mkNode("c4");
  const m2 = mkNode("m2", [c3, c4]);
  const m3 = mkNode("m3");
  return mkNode("root", [m1, m2, m3]);
}

function countManagers(node, seen = new Set()) {
  if (!node || seen.has(node.id)) return 0;
  seen.add(node.id);
  const kids = node.children || [];
  let n = kids.length > 0 ? 1 : 0;
  kids.forEach(k => { n += countManagers(k, seen); });
  return n;
}

function allNodeIds(node, out = new Set()) {
  if (!node || out.has(node.id)) return out;
  out.add(node.id);
  (node.children || []).forEach(k => allNodeIds(k, out));
  return out;
}

test("enumerateBookNodes: first slide is the root overview", () => {
  const root = buildFixture();
  const { slides } = enumerateBookNodes(root);
  assert.equal(slides[0].nodeId, "root");
  assert.equal(slides[0].depth, 0);
  assert.equal(slides[0].title, "Firstroot Lastroot's organization");
  assert.equal(slides[0].subtitle, "3 direct reports");
});

test("enumerateBookNodes: slide count = 1 + number of managers (nodes with children)", () => {
  const root = buildFixture();
  const { slides, truncated } = enumerateBookNodes(root, { slideCap: 60 });
  // The root itself is always "a manager" (it has children) but its overview slide
  // already covers it, so the descendant-manager count is countManagers(root) - 1.
  const descendantManagerCount = countManagers(root) - 1;
  assert.equal(slides.length, 1 + descendantManagerCount);
  assert.equal(truncated, false);
});

test("enumerateBookNodes: truncated is true when slideCap is below the total slide count", () => {
  const root = buildFixture();
  const descendantManagerCount = countManagers(root) - 1;
  const cap = descendantManagerCount; // one less than the untruncated total (1 + descendantManagerCount)
  const { slides, truncated } = enumerateBookNodes(root, { slideCap: cap });
  assert.equal(slides.length, cap);
  assert.equal(truncated, true);
});

test("enumerateBookNodes: every nodeId exists in the tree", () => {
  const root = buildFixture();
  const ids = allNodeIds(root);
  const { slides } = enumerateBookNodes(root, { slideCap: 60 });
  for (const s of slides) assert.ok(ids.has(s.nodeId), `unknown nodeId ${s.nodeId}`);
});

test("enumerateBookNodes: BFS order — shallower depths come first", () => {
  const root = buildFixture();
  const { slides } = enumerateBookNodes(root, { slideCap: 60 });
  for (let i = 1; i < slides.length; i++) {
    assert.ok(slides[i].depth >= slides[i - 1].depth, `depth decreased at index ${i}`);
  }
});

test("enumerateBookNodes: manager slide title/subtitle format", () => {
  const root = buildFixture();
  const { slides } = enumerateBookNodes(root, { slideCap: 60 });
  const m1Slide = slides.find(s => s.nodeId === "m1");
  assert.equal(m1Slide.title, "Firstm1 Lastm1's team");
  assert.equal(m1Slide.subtitle, "Title m1 · 2 reports");
  assert.equal(m1Slide.depth, 1);
});

test("enumerateBookNodes: cycle-safe (does not hang or duplicate on a cyclic graph)", () => {
  const a = mkNode("a"); const b = mkNode("b", [a]); a.children = [b]; // a -> b -> a cycle
  const root = mkNode("root", [a]);
  const { slides } = enumerateBookNodes(root, { slideCap: 60 });
  const ids = slides.map(s => s.nodeId);
  assert.equal(new Set(ids).size, ids.length); // no duplicates
});

test("enumerateBookNodes: leaf-only root yields a single overview slide", () => {
  const root = mkNode("solo");
  const { slides, truncated } = enumerateBookNodes(root, { slideCap: 60 });
  assert.equal(slides.length, 1);
  assert.equal(slides[0].subtitle, "0 direct reports");
  assert.equal(truncated, false);
});
