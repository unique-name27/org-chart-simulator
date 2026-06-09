// Build step for the performance fork.
//
// The app source lives in app.jsx. This compiles the JSX to plain JS with esbuild
// and inlines it into app.template.html, producing org-chart-editable_3.html with
// NO @babel/standalone (so the browser does zero transpilation on load).
//
//   node build.mjs
//
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const compiled = execSync(
  "npx --yes esbuild@0.24.0 app.jsx --loader:.jsx=jsx --target=es2019",
  { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
);

const tpl = readFileSync("app.template.html", "utf8");
if (!tpl.includes("/*__APP_JS__*/")) throw new Error("template placeholder /*__APP_JS__*/ missing");
const out = tpl.replace("/*__APP_JS__*/", () => compiled);
writeFileSync("org-chart-editable_3.html", out);

console.log(`built org-chart-editable_3.html — ${(out.length / 1024).toFixed(0)} KB; babel present: ${/@babel\/standalone/.test(out)}`);
