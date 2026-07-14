import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { unzipEntries, extractPptxTheme, mixHex } from "../core.mjs";

// Minimal ZIP builder (stored or deflated entries) — enough to emulate a .pptx.
function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const u16 = v => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; };
  const u32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; };
  for (const [name, text, method] of files) {
    const nameB = enc.encode(name);
    const data = enc.encode(text);
    const stored = method === 0 ? data : new Uint8Array(deflateRawSync(data));
    const m = method === 0 ? 0 : 8;
    const local = [u32(0x04034b50), u16(20), u16(0), u16(m), u32(0), u32(0), u32(stored.length), u32(data.length), u16(nameB.length), u16(0), nameB, stored];
    central.push({ nameB, m, csize: stored.length, usize: data.length, offset });
    for (const p of local) { parts.push(p); offset += p.length; }
  }
  const cdStart = offset;
  for (const c of central) {
    const rec = [u32(0x02014b50), u16(20), u16(20), u16(0), u16(c.m), u32(0), u32(0), u32(c.csize), u32(c.usize), u16(c.nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset), c.nameB];
    for (const p of rec) { parts.push(p); offset += p.length; }
  }
  const eocd = [u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(offset - cdStart), u32(cdStart), u16(0)];
  for (const p of eocd) parts.push(p);
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0; for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

const THEME_XML = `<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Corp">
<a:themeElements><a:clrScheme name="Corp">
<a:dk1><a:sysClr val="windowText" lastClr="1B2A41"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FDFBF7"/></a:lt1>
<a:dk2><a:srgbClr val="222222"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2>
<a:accent1><a:srgbClr val="C0392B"/></a:accent1>
<a:accent2><a:srgbClr val="123456"/></a:accent2>
</a:clrScheme><a:fontScheme name="Corp"><a:majorFont><a:latin typeface="Georgia"/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;

test("unzipEntries: reads stored and deflated entries by name", async () => {
  const zip = buildZip([["[Content_Types].xml", "<Types/>", 0], ["ppt/theme/theme1.xml", THEME_XML, 8]]);
  const entries = await unzipEntries(zip);
  assert.ok(entries.has("[Content_Types].xml"));
  assert.ok(entries.has("ppt/theme/theme1.xml"));
  assert.equal(entries.get("[Content_Types].xml").method, 0);
  assert.equal(entries.get("ppt/theme/theme1.xml").method, 8);
});

test("extractPptxTheme: pulls accent, dark/light (sysClr lastClr), and heading font", async () => {
  const zip = buildZip([["ppt/theme/theme1.xml", THEME_XML, 8]]);
  const t = await extractPptxTheme(zip);
  assert.equal(t.accent1, "#c0392b");
  assert.equal(t.dark, "#1b2a41");
  assert.equal(t.light, "#fdfbf7");
  assert.equal(t.fontFace, "Georgia");
});

test("extractPptxTheme: helpful errors for non-zip and themeless zip", async () => {
  await assert.rejects(() => extractPptxTheme(new Uint8Array([1, 2, 3, 4])), /Not a ZIP/);
  const zip = buildZip([["docProps/core.xml", "<x/>", 0]]);
  await assert.rejects(() => extractPptxTheme(zip), /No theme/);
});

test("mixHex blends colors", () => {
  assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mixHex("#ff0000", "#ff0000", 0.3), "#ff0000");
});
