import test from "node:test";
import assert from "node:assert/strict";
import { parseHrisDate } from "../core.mjs";

test("parseHrisDate: ISO YYYY-MM-DD", () => {
  assert.deepEqual(parseHrisDate("2020-06-01"), { iso: "2020-06-01", ok: true, raw: "2020-06-01" });
});

test("parseHrisDate: US M/D/YYYY", () => {
  assert.deepEqual(parseHrisDate("6/1/2020"), { iso: "2020-06-01", ok: true, raw: "6/1/2020" });
});

test("parseHrisDate: US MM/DD/YYYY", () => {
  assert.deepEqual(parseHrisDate("06/01/2020"), { iso: "2020-06-01", ok: true, raw: "06/01/2020" });
});

test("parseHrisDate: D-Mon-YYYY", () => {
  const r = parseHrisDate("1-Jun-2020");
  assert.equal(r.ok, true);
  assert.equal(r.iso, "2020-06-01");
});

test("parseHrisDate: D-Mon-YYYY is case-insensitive", () => {
  assert.equal(parseHrisDate("1-JUN-2020").iso, "2020-06-01");
  assert.equal(parseHrisDate("1-jun-2020").iso, "2020-06-01");
});

test("parseHrisDate: DD-Mon-YYYY", () => {
  assert.equal(parseHrisDate("15-Dec-2019").iso, "2019-12-15");
});

test("parseHrisDate: YYYY/MM/DD", () => {
  assert.deepEqual(parseHrisDate("2020/06/01"), { iso: "2020-06-01", ok: true, raw: "2020/06/01" });
});

test("parseHrisDate: Excel serial date (real computed value)", () => {
  // Excel epoch 1899-12-30 (the standard JS conversion that already accounts for
  // Excel's 1900 leap-year bug). Cross-checked against well-known references:
  // serial 43831 = 2020-01-01, serial 25569 = 1970-01-01. Serial 43983 computes
  // to 2020-06-01 (NOT 2020-05-01 — verified via direct computation).
  const r = parseHrisDate("43983");
  assert.equal(r.ok, true);
  assert.equal(r.iso, "2020-06-01");
});

test("parseHrisDate: rejects empty string", () => {
  assert.deepEqual(parseHrisDate(""), { iso: null, ok: false, raw: "" });
});

test("parseHrisDate: rejects garbage text", () => {
  assert.deepEqual(parseHrisDate("garbage"), { iso: null, ok: false, raw: "garbage" });
});

test("parseHrisDate: rejects out-of-range month/day", () => {
  assert.deepEqual(parseHrisDate("13/45/2020"), { iso: null, ok: false, raw: "13/45/2020" });
});

test("parseHrisDate: rejects non-existent calendar date", () => {
  assert.deepEqual(parseHrisDate("2020-02-30"), { iso: null, ok: false, raw: "2020-02-30" });
});

test("parseHrisDate: never throws on null/undefined/number input", () => {
  assert.equal(parseHrisDate(null).ok, false);
  assert.equal(parseHrisDate(undefined).ok, false);
  assert.equal(parseHrisDate(20000).ok, true); // numeric input coerced to string, still a valid serial
});
