// No DB, network, email or user accounts. Pure cases including truncated-record regression.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "package.json"))("typescript");
const source = fs.readFileSync(path.join(root, "src/lib/admin-attendance-review.ts"), "utf8");
const transpiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const moduleRecord = { exports: {} };
vm.runInNewContext(transpiled, {
  module: moduleRecord, exports: moduleRecord.exports,
  require: (name) => name === "server-only" ? {} : {},
  Map, Set,
});
const classify = moduleRecord.exports.classifyAttendanceReview;
const session = (id, date = "2026-10-25", cohort_id = "g1") => ({ id, cohort_id, session_date: date });
const sub = (child_id, start_date = "2026-10-01") => ({ cohort_id: "g1", child_id, start_date });
const att = (session_id, child_id) => ({ session_id, child_id });
const run = (sessions, attendance, subscriptions) => classify(sessions, attendance, subscriptions);
const expected = (value) => JSON.parse(JSON.stringify(value));
assert.deepEqual(expected(run([session("s1")], [], [sub("a"), sub("b")])), { unrecordedSessionIds:["s1"], partialSessionIds:[] });
assert.deepEqual(expected(run([session("s1")], [att("s1","a")], [sub("a"), sub("b")])), { unrecordedSessionIds:[], partialSessionIds:["s1"] });
assert.deepEqual(expected(run([session("s1")], [att("s1","a"), att("s1","b")], [sub("a"), sub("b")])), { unrecordedSessionIds:[], partialSessionIds:[] });
assert.deepEqual(expected(run([session("s1")], [att("s1","a")], [sub("a"), sub("a")])), { unrecordedSessionIds:[], partialSessionIds:[] });
assert.deepEqual(expected(run([session("s1")], [att("s1","a")], [sub("a"), sub("b","2026-10-26")])), { unrecordedSessionIds:[], partialSessionIds:[] });
assert.deepEqual(expected(run([session("s1")], [att("s1","a")], [])), { unrecordedSessionIds:[], partialSessionIds:[] });
assert.deepEqual(expected(run([session("s1"),session("s2")], [att("s1","a")], [sub("a")])), { unrecordedSessionIds:["s2"], partialSessionIds:[] });
assert.deepEqual(expected(run([], [], [])), { unrecordedSessionIds:[], partialSessionIds:[] });
for (const file of ["src/app/admin/page.tsx", "src/app/admin/attendance/page.tsx"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(text, /getRecentAttendanceReview/);
}
assert.match(source, /range\(offset, offset \+ pageSize - 1\)/, "review must paginate, independent from displayed rows");
console.log("PASS admin attendance review detects missing records, partial attendance and roster timing");
