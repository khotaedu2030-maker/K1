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
const adminPage = fs.readFileSync(path.join(root, "src/app/admin/page.tsx"), "utf8");
assert.match(adminPage, /\.eq\("status", "pending_payment"\)/, "dashboard must count stored pending enrollments");
assert.match(adminPage, /pendingSubs: pendingSubs \?\? 0/, "dashboard must expose pending request count");
assert.match(adminPage, /cohortsMissingOperations/, "dashboard must count groups missing teacher or session URL");
assert.match(adminPage, /href: "\/admin\/pilot-activations"/, "pending pilot requests must have an admin review route");
assert.match(adminPage, /href: "\/admin\/groups"/, "incomplete groups must have an operational action link");
const navigation = fs.readFileSync(path.join(root, "src/components/AdminShell.tsx"), "utf8");
assert.match(navigation, /\/api\/admin\/navigation-badges/, "admin menu must load notification counts");
assert.match(navigation, /admin-os-nav-badge/, "admin links must display the star badge");
assert.match(navigation, /45_000/, "admin menu must refresh when new items arrive");
assert.match(navigation, /badgeCounts\[s.href\]/, "badges must be section-specific");
const badgeRoute = fs.readFileSync(path.join(root, "src/app/api/admin/navigation-badges/route.ts"), "utf8");
assert.match(badgeRoute, /await requireAdmin\(\)/, "notification API must reject unauthenticated visitors");
assert.match(badgeRoute, /adminRoleHasPermission\(identity.role/, "counts must honor each admin role");
assert.match(badgeRoute, /count: "exact", head: true/, "notification API must use efficient counts");
assert.match(badgeRoute, /"messages"\)/, "admin message notifications must only count message metadata");
assert.doesNotMatch(badgeRoute, /\.select\("body"/, "admin notifications must never return message text");
const reviewRoute = fs.readFileSync(path.join(root, "src/app/api/admin/navigation-badges/review-messages/route.ts"), "utf8");
assert.match(reviewRoute, /requirePermission\("messages.metadata.read"\)/);
assert.match(reviewRoute, /admin_navigation_seen/);
assert.doesNotMatch(reviewRoute, /\.from\("messages"\)\.update\(/, "administrative review must not mutate private messages");
const badgeMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261027_admin_navigation_message_review.sql"), "utf8");
assert.match(badgeMigration, /enable row level security/);
assert.match(badgeMigration, /revoke all on table public.admin_navigation_seen from anon, authenticated/);
console.log("PASS operational teacher alert classification and Supabase to-one relation shapes");
