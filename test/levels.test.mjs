import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLevel, displayLevel, LEVEL_ORDER, LEVEL_LABELS } from "../core.mjs";

test("normalizeLevel: display-code synonyms", () => {
  assert.equal(normalizeLevel("L3"), "IC3");
  assert.equal(normalizeLevel("M1"), "Manager");
  assert.equal(normalizeLevel("VP"), "VP");
});

test("normalizeLevel: 'Sr.' maps to IC4 (SR synonym)", () => {
  assert.equal(normalizeLevel("Sr."), "IC4");
});

test("normalizeLevel: bare numeric string maps to IC<n>", () => {
  assert.equal(normalizeLevel("3"), "IC3");
});

test("normalizeLevel: CEO maps to C-Suite", () => {
  assert.equal(normalizeLevel("CEO"), "C-Suite");
});

test("normalizeLevel: garbage input returns null", () => {
  assert.equal(normalizeLevel("garbage"), null);
  assert.equal(normalizeLevel("junk123"), null);
  assert.equal(normalizeLevel(""), null);
  assert.equal(normalizeLevel(null), null);
});

test("normalizeLevel: already-canonical internal levels pass through unchanged", () => {
  for (const lvl of LEVEL_ORDER) assert.equal(normalizeLevel(lvl), lvl);
});

test("normalizeLevel: other documented synonyms", () => {
  assert.equal(normalizeLevel("C-Suite"), "C-Suite");
  assert.equal(normalizeLevel("SVP"), "SVP");
  assert.equal(normalizeLevel("Director"), "Director");
  assert.equal(normalizeLevel("Manager"), "Manager");
  assert.equal(normalizeLevel("Staff"), "IC5");
  assert.equal(normalizeLevel("Principal"), "IC6");
  assert.equal(normalizeLevel("Junior"), "IC1");
  assert.equal(normalizeLevel("Intern"), "IC1");
});

test("displayLevel: inverse mapping for the canonical internal level set", () => {
  const expected = {
    IC1: "L1", IC2: "L2", IC3: "L3", IC4: "L4", IC5: "L5", IC6: "L6",
    Manager: "M1", Director: "M2",
    VP: "E1", SVP: "E2", "C-Suite": "E3",
  };
  for (const [internal, display] of Object.entries(expected)) {
    assert.equal(displayLevel(internal), display);
    assert.equal(LEVEL_LABELS[internal], display);
  }
});

test("displayLevel: unknown level returned unchanged", () => {
  assert.equal(displayLevel("Unknown"), "Unknown");
});
