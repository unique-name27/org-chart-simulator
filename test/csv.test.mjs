import test from "node:test";
import assert from "node:assert/strict";
import { parseCSV, csvCell } from "../core.mjs";

test("parseCSV: quoted field containing a comma", () => {
  assert.deepEqual(parseCSV('a,"b,c",d\n'), [["a", "b,c", "d"]]);
});

test("parseCSV: escaped double-quotes inside a quoted field", () => {
  assert.deepEqual(parseCSV('a,"b""c",d\n'), [["a", 'b"c', "d"]]);
});

test("parseCSV: embedded newline inside a quoted field", () => {
  assert.deepEqual(parseCSV('a,"b\nc",d\n'), [["a", "b\nc", "d"]]);
});

test("parseCSV: CRLF line endings", () => {
  assert.deepEqual(parseCSV("a,b\r\nc,d\r\n"), [["a", "b"], ["c", "d"]]);
});

test("parseCSV: LF line endings", () => {
  assert.deepEqual(parseCSV("a,b\nc,d\n"), [["a", "b"], ["c", "d"]]);
});

test("parseCSV: trailing newline vs none produce the same rows", () => {
  assert.deepEqual(parseCSV("a,b\n"), [["a", "b"]]);
  assert.deepEqual(parseCSV("a,b"), [["a", "b"]]);
});

test("parseCSV: empty cells are preserved", () => {
  assert.deepEqual(parseCSV("a,,c\n"), [["a", "", "c"]]);
});

test("parseCSV: ragged rows (differing column counts) are kept as-is", () => {
  assert.deepEqual(parseCSV("a,b,c\nd,e\n"), [["a", "b", "c"], ["d", "e"]]);
});

test("parseCSV: rows that are entirely blank cells are filtered out", () => {
  assert.deepEqual(parseCSV("a,b\n,\nc,d\n"), [["a", "b"], ["c", "d"]]);
});

test("parseCSV: strips a leading UTF-8 BOM", () => {
  assert.deepEqual(parseCSV("﻿a,b\n"), [["a", "b"]]);
});

test("csvCell: plain value needs no quoting", () => {
  assert.equal(csvCell("plain"), "plain");
});

test("csvCell: null/undefined become empty string", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
});

test("csvCell: array values are joined with |", () => {
  assert.equal(csvCell(["a", "b", "c"]), "a|b|c");
});

test("csvCell: values needing quoting round-trip through parseCSV", () => {
  for (const v of ["hello, world", "line\nbreak", 'quote"here', "a,b,c\nd"]) {
    const row = [csvCell(v)].join(",") + "\n";
    const parsed = parseCSV(row);
    assert.deepEqual(parsed, [[v]]);
  }
});

test("csvCell: formula-injection prefixes get a leading single-quote and still parse as one cell", () => {
  for (const v of ["=cmd", "+1", "-1", "@at", "\ttab"]) {
    const cell = csvCell(v);
    assert.equal(cell, "'" + v);
    const parsed = parseCSV(cell + "\n");
    assert.deepEqual(parsed, [["'" + v]]);
  }
});

test("csvCell: a leading CR gets quoted (contains CR) as well as prefixed", () => {
  const cell = csvCell("\rcr");
  assert.equal(cell, '"\'\rcr"');
  const parsed = parseCSV(cell + "\n");
  assert.deepEqual(parsed, [["'\rcr"]]);
});
