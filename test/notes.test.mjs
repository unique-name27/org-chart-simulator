import { test } from "node:test";
import assert from "node:assert/strict";
import { notesOnSlide } from "../core.mjs";

const layoutWith = (...ids) => ({ cards: ids.map(id => ({ node: { id } })) });
const notes = [
  { id: "n1", text: "free note" },                       // no anchor
  { id: "n2", text: "on E2", anchorId: "E2" },
  { id: "n3", text: "on E9", anchorId: "E9" },           // E9 not on these slides
];

test("notesOnSlide: primary slide gets free notes + anchored notes whose card is present", () => {
  const got = notesOnSlide(notes, layoutWith("E1", "E2"), { primary: true });
  assert.deepEqual(got.map(n => n.id), ["n1", "n2"]);
});

test("notesOnSlide: child slides get ONLY anchored notes whose card is present", () => {
  assert.deepEqual(notesOnSlide(notes, layoutWith("E1", "E2")).map(n => n.id), ["n2"]);
  assert.deepEqual(notesOnSlide(notes, layoutWith("E9")).map(n => n.id), ["n3"]);
  assert.deepEqual(notesOnSlide(notes, layoutWith("E5")).map(n => n.id), []);
});

test("notesOnSlide: empty/degenerate inputs are safe", () => {
  assert.deepEqual(notesOnSlide([], layoutWith("E1"), { primary: true }), []);
  assert.deepEqual(notesOnSlide(null, layoutWith("E1")), []);
  assert.deepEqual(notesOnSlide(notes, null), []);
});
