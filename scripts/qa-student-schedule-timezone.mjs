// Student schedule regression: use Riyadh midnight for day cutoff and explicit
// Asia/Riyadh clock/day presentation, even when the server/browser is not in Riyadh.
// No DB, network or passwords; included in qa:release.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root,file),"utf8");
const ts = createRequire(path.join(root,"package.json"))("typescript");
function load(rel) {
  const moduleRecord={exports:{}};
  const code=ts.transpileModule(read(rel),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  vm.runInNewContext(code,{module:moduleRecord,exports:moduleRecord.exports,Intl,Date,String,Number});
  return moduleRecord.exports;
}
const riyadh=load("src/lib/riyadh-time.ts");
const arabic=load("src/lib/arabic-time.ts");
const cutoff=(iso)=>riyadh.riyadhWallClockToUtcInstant(riyadh.getRiyadhCalendarDate(new Date(iso)),0,0).toISOString();

assert.equal(cutoff("2026-10-25T20:59:59Z"),"2026-10-24T21:00:00.000Z","before Riyadh midnight");
assert.equal(cutoff("2026-10-25T21:00:00Z"),"2026-10-25T21:00:00.000Z","at Riyadh midnight");
assert.equal(cutoff("2026-12-31T22:05:00Z"),"2026-12-31T21:00:00.000Z","new-year rollover");
assert.equal(riyadh.formatRiyadhCalendarDate(riyadh.getRiyadhCalendarDate(new Date("2026-10-25T21:00:00Z"))),"2026-10-26");
const localTime=arabic.formatSessionTime("2026-10-26T14:00:00Z");
assert.match(localTime,/5:00/,"14:00 UTC session must display as 5 PM in Riyadh");
assert.match(arabic.formatSessionDay("2026-10-25T22:00:00Z"),/الاثنين/,"cross-midnight weekday must be Riyadh Monday");

const today=read("src/app/student/today/page.tsx");
const schedule=read("src/app/student/schedule/page.tsx");
const card=read("src/app/student/today/StudentSessionCard.tsx");
assert.match(today,/\.gte\("ends_at", new Date\(\)\.toISOString\(\)\)/,"next session should not select already-ended sessions");
assert.match(schedule,/riyadhWallClockToUtcInstant\(getRiyadhCalendarDate\(new Date\(\)\), 0, 0\)/,"schedule query must start at Riyadh midnight");
assert.match(schedule,/formatSessionDay\(s\.starts_at\)/,"schedule day uses Riyadh formatter");
assert.match(schedule,/formatSessionTime\(s\.starts_at\)/,"schedule time uses Riyadh formatter");
assert.match(card,/formatSessionTime\(start\)/,"student card clock uses Riyadh formatter");
assert.match(card,/isTodayInRiyadh \? "جلستك اليوم"/,"card does not call future session 'today'");
for(const [file,source] of [["today",today],["schedule",schedule],["card",card]]) {
  assert.doesNotMatch(source,/new Date\(new Date\(\)\.setHours\(0,\s*0,\s*0,\s*0\)\)/,file+" cannot use server-local midnight");
  assert.doesNotMatch(source,/\.toLocale(?:DateString|TimeString)\("ar-SA",\s*\{/,file+" cannot use device-local times");
}
console.log("PASS student Riyadh schedule/clock cutoff and nearest unfinished session regression");
