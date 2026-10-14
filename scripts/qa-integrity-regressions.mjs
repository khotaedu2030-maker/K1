import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const pause = read("src/app/api/subscription-pause/request/route.ts");
const makeup = read("src/lib/makeup-credits.ts");
const cancel = read("src/app/api/session/cancel/route.ts");
const report = read("src/app/api/session-report/submit/route.ts");

assert.ok(pause.includes('const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/'), "pause dates must be strict YYYY-MM-DD");
assert.match(pause, /durationDays < settings\.pauseMinDays/, "pause minimum must be enforced");
assert.match(pause, /durationDays > settings\.pauseMaxDays/, "pause maximum must be enforced");
assert.match(pause, /صيغة التاريخ غير صحيحة/, "invalid dates must be rejected explicitly");

assert.match(makeup, /const \{ error \} = await admin\.from\("makeup_credits"\)\.upsert/, "makeup upsert error must be captured");
assert.match(makeup, /error: "persistence_failed"/, "makeup persistence failures must be explicit");
assert.match(makeup, /return \{ issued: true \}/, "successful issuance result must remain explicit");

assert.match(cancel, /"error" in result/, "session cancellation must detect makeup persistence failure");
assert.match(cancel, /alreadyCancelled/, "cancel retry path must remain recoverable/idempotent");
assert.match(cancel, /session\.status !== "scheduled"/, "only scheduled sessions may be newly cancelled");
assert.match(cancel, /activeSubsError/, "active subscription lookup errors must block cancellation");
assert.match(report, /"error" in makeupResult/, "session report must fail visibly when eligible makeup credit cannot persist");


const parentContext = read("src/lib/pilot-parent.ts");
const parentSignup = read("src/app/api/auth/complete-parent-signup/route.ts");
const parentLink = read("src/app/api/auth/link-parent/route.ts");
const enroll = read("src/app/api/enroll/route.ts");
assert.match(parentContext, /getActiveStaffRole\(user\.id\)/, "parent context must reject active staff identities");
assert.match(parentSignup, /getActiveStaffRole\(user\.id\)/, "parent signup must reject active staff identities");
assert.match(parentLink, /getActiveStaffRole\(user\.id\)/, "parent linking must reject active staff identities");
assert.match(enroll, /getActiveStaffRole\(user\.id\)/, "enrollment must reject active staff identities");


const goals = read("src/app/api/goals/submit/route.ts");
assert.match(goals, /validStatuses/, "goal updates must validate status values");
assert.match(goals, /progress < 0 \|\| progress > 100/, "goal progress must be constrained to 0..100");
assert.match(goals, /validDateOnly\(weekStart\)/, "goal creation must validate weekStart");
assert.match(goals, /Object\.keys\(patch\)\.length === 0/, "empty goal updates must be rejected");


const requireParent = read("src/lib/require-parent.ts");
assert.match(requireParent, /getActiveStaffRole\(userId\)/, "parent API identity must reject active staff users");
for (const path of [
  "src/app/api/attendance/mark/route.ts",
  "src/app/api/student-mode/enter/route.ts",
  "src/app/api/makeup/redeem/route.ts",
  "src/app/api/messages/thread/route.ts",
  "src/app/api/recommendations/request/route.ts",
  "src/app/api/subscription-pause/request/route.ts",
]) {
  assert.match(read(path), /resolveParentIdentityForUser\(user\.id\)/, `${path} must enforce the parent/staff boundary`);
}
assert.match(read("src/lib/messaging-authorization.ts"), /getActiveStaffRole\(userId\)/, "message parent authorization must reject active staff users");


const adminActive = read("src/app/api/admin/admin-users/active/route.ts");
assert.match(adminActive, /typeof active !== "boolean"/, "admin activation must require an explicit boolean");
const adminSettings = read("src/app/api/admin/settings/route.ts");
assert.match(adminSettings, /isValidTimeHHMM/, "admin quiet hours must validate real clock times");
const cohortOps = read("src/app/api/admin/cohort-operations/route.ts");
assert.match(cohortOps, /UUID_RE\.test\(cohortId\)/, "cohort operations must validate cohort identifiers");
assert.match(cohortOps, /meetingUrl\.length > 2048/, "cohort operations must bound meeting URL length");
const requireAdmin = read("src/lib/require-admin.ts");
assert.match(requireAdmin, /isKnownAdminRole\(adminRow\.role\)/, "unknown admin roles must fail closed");
assert.match(requireAdmin, /status: 503/, "admin lookup failures must not masquerade as authorization denials");


const adminMakeup = read("src/app/api/admin/makeup-credits/route.ts");
assert.match(adminMakeup, /subscription\.child_id !== childId/, "manual makeup credit must not link a child to another child's subscription");
assert.match(adminMakeup, /Number\.isNaN\(Date\.parse\(expiresAt\)\)/, "manual makeup expiry must be validated");
assert.match(adminMakeup, /source_type", "manual_admin"/, "manual makeup cancellation must constrain source type in the write");
assert.match(adminMakeup, /if \(!cancelled\)/, "manual makeup cancellation must detect zero-row race outcomes");

const adminSessions = read("src/app/api/admin/sessions/route.ts");
assert.match(adminSessions, /overlappingError/, "session teacher override must fail closed if overlap lookup fails");
assert.match(adminSessions, /if \(!updatedSession\)/, "session teacher override must detect status races");

const pauseReview = read("src/app/api/subscription-pause/review/route.ts");
assert.match(pauseReview, /decision !== "approved" && decision !== "rejected"/, "pause review must validate decision before RPC");


const adminCohorts = read("src/app/api/admin/cohorts/route.ts");
assert.match(adminCohorts, /new Set\(daysOfWeek\)\.size !== daysOfWeek\.length/, "cohort creation must reject duplicate weekdays");
assert.match(adminCohorts, /startTime >= endTime/, "cohort creation must reject invalid time ranges");
assert.match(adminCohorts, /parsedUrl\.protocol !== "http:" && parsedUrl\.protocol !== "https:"/, "cohort meeting URLs must be limited to http/https");
assert.match(adminCohorts, /teacherSessionsError/, "cohort creation must fail closed when teacher conflict lookup fails");
assert.match(adminCohorts, /planError/, "cohort creation must fail closed when plan lookup fails");

console.log("ALL INTEGRITY REGRESSION CHECKS PASSED");
