import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function source(path) { return fs.readFileSync(path, "utf8"); }
const code = ts.transpileModule(source("src/lib/teaching-readiness.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(code, { exports: mod.exports, module: mod, URL, Set, String, Boolean });
const { teachingReadinessIssues, isTeamsMeetingUrl } = mod.exports;

const plan = { id: "test-plan", active: true, product: "motabaa", days_per_week: 2 };
const group = {
  id: "test-group", title: "مجموعة اختبار", status: "open", capacity: 20,
  teacher_id: "test-teacher", meeting_url: "https://teams.microsoft.com/l/meetup-join/test",
  plan_id: "test-plan", product: "motabaa", days_of_week: [1, 3],
  start_time: "17:00:00", end_time: "17:45:00",
};
const teacher = { id: "test-teacher", active: true, user_id: "verified-identity", verifiedLogin: true };
assert.deepEqual(Array.from(teachingReadinessIssues(group, teacher, plan)), []);
assert.ok(teachingReadinessIssues({ ...group, teacher_id: null }, null, plan).some(s => s.includes("لم يُسنَد معلم")));
assert.ok(teachingReadinessIssues(group, { ...teacher, user_id: null }, plan).some(s => s.includes("حساب دخول")));
assert.ok(teachingReadinessIssues(group, { ...teacher, verifiedLogin: false }, plan).some(s => s.includes("لم يُوثّق")));
assert.ok(teachingReadinessIssues({ ...group, meeting_url: null }, teacher, plan).some(s => s.includes("Teams")));
assert.ok(teachingReadinessIssues({ ...group, days_of_week: [1] }, teacher, plan).some(s => s.includes("أيام")));
assert.ok(teachingReadinessIssues({ ...group, status: "closed" }, teacher, plan).some(s => s.includes("غير متاحة")));
assert.equal(isTeamsMeetingUrl("https://teams.microsoft.com/l/meetup-join/test"), true);
for (const url of ["https://teams.microsoft.com.evil.example/l/meetup-join/test", "javascript:alert(1)", "https://example.org/meet", "https://teams.microsoft.com/", "https://teams.microsoft.com@evil.example/meet"]) {
  assert.equal(isTeamsMeetingUrl(url), false, "invalid Teams URL: " + url);
}
const gate = source("supabase/migrations/20261027_pilot_teacher_identity_guard.sql");
assert.match(gate, /t\.user_id is not null and u\.email_confirmed_at is not null/);
assert.match(gate, /from public\.teachers t join auth\.users u/);
assert.match(gate, /revoke all on function public\.activate_pilot_trial_atomic/);
assert.doesNotMatch(gate, /insert into public\.payments|update public\.payments/);
const adminPage = source("src/app/admin/pilot-activations/page.tsx");
assert.match(adminPage, /disabled=\{!ready\}/);
assert.match(adminPage, /getUserById\(teacher\.user_id\)/);
assert.match(adminPage, /teachingReadinessIssues\(cohort \?\? null/);
const operations = source("src/app/admin/teaching-readiness/page.tsx");
assert.match(operations, /getAdminIdentity\("cohort.manage"\)/);
assert.match(operations, /جاهزية التشغيل التعليمي/);
assert.match(source("src/components/AdminShell.tsx"), /\/admin\/teaching-readiness/);
const emailGuard = source("src/lib/teacher-email-eligibility.ts");
const acceptRoute = source("src/app/api/teacher-applications/update-status/route.ts");
const teacherActivateRoute = source("src/app/api/admin/teachers/activate/route.ts");
const selectControl = source("src/app/admin/teacher-applications/StatusSelect.tsx");
assert.match(emailGuard, /listUsers\(\{ page, perPage: pageSize \}\)/);
assert.match(emailGuard, /data\.users\.some/, "must detect existing auth accounts");
assert.match(emailGuard, /بريدًا جديدًا مستقلًا للمعلم/, "must instruct on using new teacher identity");
assert.match(acceptRoute, /if \(status === "accepted"\)/);
assert.match(acceptRoute, /checkNewTeacherEmail\(admin, application\.email\)/);
assert.match(teacherActivateRoute, /checkNewTeacherEmail\(admin, application\.email\)/);
assert.match(selectControl, /role="alert"/, "approval errors must be shown in teacher requests");
console.log("PASS educational onboarding: verified teacher, safe Teams, plan schedule, restricted pilot activation");
