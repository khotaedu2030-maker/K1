// No network/secrets: parent reports must be scoped to authenticated parent's owned children.
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
vm.runInNewContext(ts.transpileModule(read("src/lib/parent-child-selection.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:moduleRecord,exports:moduleRecord.exports});
const pick=moduleRecord.exports.resolveOwnedChild;
const a={id:"owned-A",first_name:"أحمد"},b={id:"owned-B",first_name:"سارة"};
assert.equal(pick([a,b],undefined),a);
assert.equal(pick([a,b],"owned-B"),b);
assert.equal(pick([a,b],"foreign-child"),null);
assert.equal(pick([], "owned-A"),null);
for(const name of ["src/app/parent/page.tsx","src/app/parent/reports/page.tsx","src/app/parent/reports/weekly/page.tsx"]){
 const src=read(name);
 assert.match(src,/resolveOwnedChild\(children \?\? \[\],/,name+" must scope child selection to owned rows");
 assert.match(src,/ParentChildTabs/,name+" must offer child selection");
}
const weekly=read("src/app/parent/reports/weekly/page.tsx");
assert.match(weekly,/riyadhWallClockToUtcInstant\(weekAgoInRiyadh, 0, 0\)/);
assert.doesNotMatch(weekly,/weekAgo\.setDate\(/);
console.log("PASS multi-child parent reports select only owned children and use Riyadh weekly boundaries");
