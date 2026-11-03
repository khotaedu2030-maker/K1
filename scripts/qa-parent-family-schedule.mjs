// No-network regression for households with two children sharing a cohort.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const ts=createRequire(path.join(root,"package.json"))("typescript");
const moduleRecord={exports:{}};
vm.runInNewContext(ts.transpileModule(read("src/lib/parent-family-schedule.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
  module:moduleRecord,exports:moduleRecord.exports,Map,Set,Date,
});
const {groupParentCohortChildren:group,summarizeFamilyWeek:stats}=moduleRecord.exports;
const names=new Map([["A","أحمد"],["B","سارة"]]);
const grouped=group([
  {cohort_id:"G",child_id:"A"},{cohort_id:"G",child_id:"B"},
  {cohort_id:"G",child_id:"A"},{cohort_id:"G",child_id:"foreign"},
  {cohort_id:null,child_id:"A"},
],names);
assert.deepEqual([...grouped.get("G")].map(x=>x.id),["A","B"]);
assert.equal(grouped.size,1);
const week=[{id:"S1",cohort_id:"G",starts_at:"2026-11-02T14:00:00Z",status:"completed"},
{id:"S2",cohort_id:"G",starts_at:"2026-11-04T14:00:00Z",status:"scheduled"},
{id:"S3",cohort_id:"G",starts_at:"2026-11-05T14:00:00Z",status:"cancelled"}];
const attendance=[{session_id:"S1",child_id:"A",status:"present"},
{session_id:"S1",child_id:"B",status:"present"},
{session_id:"S1",child_id:"A",status:"present"},
{session_id:"S1",child_id:"foreign",status:"present"}];
const result=stats(week,attendance,grouped,new Date("2026-11-03T12:00:00Z"));
assert.equal(result.totalSessions,4,"count child-session opportunities, excluding cancelled");
assert.equal(result.attended,2,"only deduplicated own children's present records");
assert.equal(result.upcoming,2,"both siblings have an upcoming scheduled session");
const page=read("src/app/parent/schedule/page.tsx"),card=read("src/app/parent/schedule/NextSessionCard.tsx");
assert.match(page,/groupParentCohortChildren/);
assert.match(page,/summarizeFamilyWeek/);
assert.match(card,/session\.children\.map/);
assert.doesNotMatch(page,/childByCohort/,"no last-child-wins map");
console.log("PASS parent sibling cohort names/join controls and per-child weekly stats");
