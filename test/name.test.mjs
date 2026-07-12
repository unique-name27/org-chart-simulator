import test from "node:test";
import assert from "node:assert/strict";
import { parseEmployeeName } from "../core.mjs";

test("parseEmployeeName: 'Last, First' comma convention", () => {
  assert.deepEqual(parseEmployeeName("Hopper, Grace"), { first: "Grace", last: "Hopper" });
});

test("parseEmployeeName: plain 'First Last'", () => {
  assert.deepEqual(parseEmployeeName("Grace Hopper"), { first: "Grace", last: "Hopper" });
});

test("parseEmployeeName: middle name/initial is dropped", () => {
  assert.deepEqual(parseEmployeeName("Grace B. Hopper"), { first: "Grace", last: "Hopper" });
});

test("parseEmployeeName: single token", () => {
  assert.deepEqual(parseEmployeeName("Cher"), { first: "Cher", last: "" });
});

test("parseEmployeeName: blank/whitespace-only", () => {
  assert.deepEqual(parseEmployeeName("  "), { first: "", last: "" });
});

test("parseEmployeeName: multi-word last name with comma convention", () => {
  assert.deepEqual(parseEmployeeName("Van Der Berg, Jan"), { first: "Jan", last: "Van Der Berg" });
});

test("parseEmployeeName: never throws on null/undefined", () => {
  assert.deepEqual(parseEmployeeName(null), { first: "", last: "" });
  assert.deepEqual(parseEmployeeName(undefined), { first: "", last: "" });
});
