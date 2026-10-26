// Parent task statuses and owned-only access, without DB or network.
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
vm.runInNewContext(ts.transpileModule(read("src/lib/parent-task-summary.ts"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,{module:moduleRecord,exports:moduleRecord.exports});
const summarize=moduleRecord.exports.summarizeParentTasks;
const row=(id,status,due_date=null)=>({id,title:"task "+id,subject:null,status,due_date,created_at:null});
const out=summarize([
  row("a","pending","2026-10-25"),row("b","pending","2026-10-26"),
  row("c","pending","2026-10-29"),row("d","done","2026-10-20"),
  row("e","needs_review","2026-10-20"),row("f","pending",null),
],"2026-10-26");
assert.equal(out.pending.length,4);
assert.equal(out.done.length,1);
assert.equal(out.needsReview.length,1);
assert.equal(out.overdueCount,1,"done/review are not overdue");
assert.equal(out.pending[0].id,"a","earliest due first");
assert.equal(out.pending.at(-1).id,"f","pending with no due date last");
assert.equal(summarize([],"2026-10-26").overdueCount,0);
const page=read("src/app/parent/tasks/page.tsx"),home=read("src/app/parent/page.tsx");
assert.match(page,/resolveParentContext\(\)/);
assert.match(page,/\.eq\("parent_id", context\.parentId\)/);
assert.match(page,/resolveOwnedChild\(children \?\? \[\],/);
assert.match(page,/\.eq\("child_id", chosen\.id\)/);
assert.match(page,/ParentChildTabs/);
assert.match(page,/summary\.needsReview/);
assert.doesNotMatch(page,/\.update\(|\.insert\(|\.delete\(/,"parent tasks read only");
assert.match(home,/href=\{"\/parent\/tasks\?child="/);
assert.match(home,/summarizeParentTasks/);
console.log("PASS parent task statuses, Riyadh overdue dates, and owner-scoped read-only task dashboard");
