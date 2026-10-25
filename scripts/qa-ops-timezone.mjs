// Regression coverage: staff and teacher operational screens must use Riyadh calendar/time.
// No browser, network, credentials, or database access. Run: node scripts/qa-ops-timezone.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const ts = createRequire(path.join(root, "package.json"))("typescript");

function loadRiyadhCalendar() {
  const module = { exports: {} };
  const transpiled = ts.transpileModule(read("src/lib/riyadh-time.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(transpiled, { exports: module.exports, module, Intl, Date, String, Number });
  return module.exports;
}

const { getRiyadhCalendarDate, formatRiyadhCalendarDate } = loadRiyadhCalendar();
const calendarKey = (iso) => formatRiyadhCalendarDate(getRiyadhCalendarDate(new Date(iso)));

assert.equal(calendarKey("2026-10-25T20:59:59Z"), "2026-10-25", "before Riyadh midnight");
assert.equal(calendarKey("2026-10-25T21:00:00Z"), "2026-10-26", "at Riyadh midnight");
assert.equal(calendarKey("2026-12-31T21:05:00Z"), "2027-01-01", "new year boundary");

const routes = {
  "src/app/teacher/page.tsx": { calendar: true, time: true },
  "src/app/teacher/schedule/page.tsx": { calendar: false, time: true },
  "src/app/teacher/session-report/page.tsx": { calendar: false, time: true },
  "src/app/admin/sessions/page.tsx": { calendar: true, time: true },
  "src/app/admin/page.tsx": { calendar: true, time: true },
};
for (const [route, checks] of Object.entries(routes)) {
  const source = read(route);
  assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/, route + ": UTC date used for Riyadh calendar");
  assert.doesNotMatch(source, /\.toLocale(?:TimeString|String)\("ar-SA",\s*\{[^}]*hour:/, route + ": server-local time used");
  if (checks.calendar && route !== "src/app/admin/page.tsx") {
    assert.match(source, /formatRiyadhCalendarDate\(getRiyadhCalendarDate\(new Date\(\)\)\)/, route + ": Riyadh date helper missing");
  }
  if (checks.time) assert.match(source, /formatSessionTime\(/, route + ": Riyadh session time formatter missing");
}
console.log("PASS Riyadh operational date/time boundaries and route integration (static + pure helper; not browser E2E)");
