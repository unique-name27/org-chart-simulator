// Build step for the performance fork.
//
// The app source lives in app.jsx. This compiles the JSX to plain JS with esbuild
// and inlines it into app.template.html, producing org-chart-editable_3.html with
// NO @babel/standalone (so the browser does zero transpilation on load).
//
//   node build.mjs
//
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

// Merge core.mjs (strip ESM exports) + app.jsx into one scope, then transpile.
const core = readFileSync("core.mjs", "utf8").replace(/^export\s+/gm, "");
const app  = readFileSync("app.jsx", "utf8");
const mergedFile = "._merged.jsx";
writeFileSync(mergedFile, core + "\n/* ---- app.jsx ---- */\n" + app);

let compiled;
try {
  compiled = execSync(
    `npx --yes esbuild@0.24.0 ${mergedFile} --loader:.jsx=jsx --target=es2019`,
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
  );
} finally {
  try { unlinkSync(mergedFile); } catch {}
}

const tpl = readFileSync("app.template.html", "utf8");
if (!tpl.includes("/*__APP_JS__*/")) throw new Error("template placeholder /*__APP_JS__*/ missing");
writeFileSync("org-chart-editable_3.html", tpl.replace("/*__APP_JS__*/", () => compiled));
console.log(`built org-chart-editable_3.html — babel present: ${/@babel\/standalone/.test(compiled)}`);
