import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCSV, detectDelimiter, normNameKey, linkManagers, previewImportStats } from "../core.mjs";

// ─── detectDelimiter ───
test("detectDelimiter: comma / tab / semicolon / pipe / fallback", () => {
  assert.equal(detectDelimiter("a,b,c\n1,2,3"), ",");
  assert.equal(detectDelimiter("a\tb\tc\n1\t2\t3"), "\t");
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a|b|c"), "|");
  assert.equal(detectDelimiter("single-column"), ",");
  assert.equal(detectDelimiter("﻿a;b;c"), ";"); // BOM tolerated
});

// ─── parseCSV with a delimiter ───
test("parseCSV: tab and semicolon delimiters split into columns", () => {
  const tsv = parseCSV("id\tname\nE1\tGrace Hopper", "\t");
  assert.deepEqual(tsv, [["id", "name"], ["E1", "Grace Hopper"]]);
  const scsv = parseCSV("id;name\nE1;Ada", ";");
  assert.deepEqual(scsv, [["id", "name"], ["E1", "Ada"]]);
  // default is still comma (locks existing behavior)
  assert.deepEqual(parseCSV("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
});

// ─── normNameKey ───
test("normNameKey: Last,First and First Last collapse to the same key", () => {
  assert.equal(normNameKey("Smith, John"), normNameKey("John Smith"));
  assert.equal(normNameKey("  JOHN   SMITH "), "john smith");
  assert.equal(normNameKey("John B. Smith"), "john smith");
  assert.equal(normNameKey(""), "");
  assert.equal(normNameKey(null), "");
});

// ─── linkManagers ───
const emp = (id, first, last, managerId) => ({ id, first, last, managerId });

test("linkManagers: valid id reference is kept", () => {
  const list = [emp("E1", "Ada", "Lovelace", null), emp("E2", "Alan", "Turing", "E1")];
  const s = linkManagers(list);
  assert.equal(list[1].managerId, "E1");
  assert.equal(s.resolvedByName, 0);
  assert.equal(s.orphaned.length, 0);
});

test("linkManagers: manager referenced by full name resolves to the id", () => {
  const list = [emp("E1", "Ada", "Lovelace", null), emp("E2", "Alan", "Turing", "Ada Lovelace")];
  const s = linkManagers(list);
  assert.equal(list[1].managerId, "E1");
  assert.equal(s.resolvedByName, 1);
});

test("linkManagers: manager referenced as 'Last, First' resolves", () => {
  const list = [emp("E1", "Ada", "Lovelace", null), emp("E2", "Alan", "Turing", "Lovelace, Ada")];
  linkManagers(list);
  assert.equal(list[1].managerId, "E1");
});

test("linkManagers: ambiguous name (two matches) is orphaned + logged", () => {
  const list = [
    emp("E1", "John", "Smith", null),
    emp("E2", "John", "Smith", null),
    emp("E3", "Alan", "Turing", "John Smith"),
  ];
  const s = linkManagers(list);
  assert.equal(list[2].managerId, null);
  assert.equal(s.ambiguous.length, 1);
  assert.equal(s.ambiguous[0].id, "E3");
});

test("linkManagers: unknown manager ref, self-ref, and cycle are all cleared", () => {
  const list = [
    emp("E1", "Ada", "Lovelace", "Nobody Here"),  // unknown
    emp("E2", "Alan", "Turing", "E2"),             // self
    emp("E3", "A", "B", "E4"),                      // cycle E3->E4->E3
    emp("E4", "C", "D", "E3"),
  ];
  const s = linkManagers(list);
  assert.equal(list[0].managerId, null);
  assert.equal(s.orphaned.length, 1);
  assert.equal(list[1].managerId, null);
  assert.equal(s.selfRef.length, 1);
  assert.ok(s.cyclesBroken.length >= 1); // at least one link in the cycle cut
  assert.ok(list[2].managerId === null || list[3].managerId === null);
});

// ─── previewImportStats ───
const rowsFrom = (arr) => arr; // arrays of string cells
test("previewImportStats: managers matched by id and by name are counted", () => {
  // columns: 0=id, 1=name, 2=manager
  const rows = [
    ["E1", "Ada Lovelace", ""],
    ["E2", "Alan Turing", "E1"],          // by id
    ["E3", "Grace Hopper", "Ada Lovelace"], // by name
    ["E4", "Katherine Johnson", "Nobody"],  // orphan
  ];
  const mapping = { id: 0, fullName: 1, managerId: 2 };
  const s = previewImportStats(rows, mapping);
  assert.equal(s.willImport, 4);
  assert.equal(s.managersById, 1);
  assert.equal(s.managersByName, 1);
  assert.equal(s.topLevel, 1); // E1 has blank manager
  assert.equal(s.orphan, 1);   // "Nobody"
  assert.equal(s.hasMgr, true);
});

test("previewImportStats: no manager column → everyone top-level; dups/blanks counted", () => {
  const rows = [["E1", "Ada"], ["E1", "Ada dup"], ["", "blank"], ["E2", "Alan"]];
  const mapping = { id: 0, fullName: 1 }; // no managerId
  const s = previewImportStats(rows, mapping);
  assert.equal(s.willImport, 2);   // E1, E2
  assert.equal(s.dup, 1);          // second E1
  assert.equal(s.blank, 1);        // empty id
  assert.equal(s.hasMgr, false);
  assert.equal(s.topLevel, 2);     // no manager column
});
