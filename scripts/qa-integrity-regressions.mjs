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

console.log("ALL INTEGRITY REGRESSION CHECKS PASSED");
