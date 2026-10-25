// Pure regression: session alert correctness for Supabase relation object/array/null.
// Never connects to Supabase and does not require Auth users or secrets.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "package.json"))("typescript");

function loadTs(rel, mocks = {}) {
  const source = fs.readFileSync(path.join(root, rel), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRecord = { exports: {} };
  vm.runInNewContext(code, {
    module: moduleRecord,
    exports: moduleRecord.exports,
    require: (name) => {
      if (name in mocks) return mocks[name];
      throw new Error("Unexpected import in QA: " + name);
    },
  });
  return moduleRecord.exports;
}

const relations = loadTs("src/lib/supabase-relations.ts");
const { getSessionTeacherAlert: check } = loadTs("src/lib/admin-session-alerts.ts", {
  "./supabase-relations": relations,
});
const withTeacher = (teachers, status = "scheduled", teacherId = "teacher-1") => ({
  status, teacher_id: teacherId, teachers,
});

assert.equal(check(withTeacher({ full_name: "أحمد", active: true })), null, "to-one object active teacher must NOT be flagged");
assert.equal(check(withTeacher([{ full_name: "أحمد", active: true }])), null, "array form active teacher must NOT be flagged");
assert.equal(check(withTeacher({ full_name: "أحمد", active: false })), "المعلم المعيّن (أحمد) غير نشط");
assert.equal(check(withTeacher([{ full_name: "أحمد", active: false }])), "المعلم المعيّن (أحمد) غير نشط");
assert.equal(check(withTeacher({ full_name: null, active: null })), "المعلم المعيّن (غير محدد) غير نشط");
assert.equal(check(withTeacher(null, "scheduled", null)), "بدون معلم");
assert.equal(check(withTeacher(null)), "بيانات المعلم المعيّن غير متاحة");
assert.equal(check(withTeacher(null, "completed")), null, "historical completed session is not an assignment alert");
assert.equal(check(withTeacher({ full_name: "أحمد", active: false }, "cancelled")), null);
assert.doesNotMatch(fs.readFileSync(path.join(root, "src/app/admin/page.tsx"), "utf8"), /s\.(teachers|cohorts)\[0\]/, "admin overview must not assume array-only embedded relations");
console.log("PASS operational teacher alert classification and Supabase to-one relation shapes");
