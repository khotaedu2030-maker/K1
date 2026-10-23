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


const supportTransition = read("src/app/api/admin/support-cases/transition/route.ts");
assert.match(supportTransition, /adminLookupError/, "support assignment must fail closed on assignee lookup errors");

const exceptionTransition = read("src/app/api/admin/exceptions/transition/route.ts");
assert.match(exceptionTransition, /adminLookupError/, "exception assignment must fail closed on assignee lookup errors");

const adminCycles = read("src/app/api/admin/cycles/route.ts");
assert.match(adminCycles, /currentError/, "cycle update must fail closed on cycle lookup errors");
assert.match(adminCycles, /if \(!updated\)/, "cycle update must detect concurrent terminal-state transitions");


const levelTestSubmit = read("src/app/api/level-test/submit/route.ts");
assert.match(levelTestSubmit, /sessionError/, "level test must fail closed when session lookup fails");
assert.match(levelTestSubmit, /answersError/, "level test must fail closed when answer history lookup fails");
assert.match(levelTestSubmit, /if \(!advancedSession\)/, "level test must detect concurrent session advancement");
assert.match(levelTestSubmit, /if \(!finishedSession\)/, "level test must detect concurrent session completion");


const messagingAuth = read("src/lib/messaging-authorization.ts");
assert.match(messagingAuth, /threadError/, "message authorization must fail closed on thread lookup errors");
assert.match(messagingAuth, /parentError \|\| childError/, "message parent authorization must fail closed on relationship lookup errors");
assert.match(messagingAuth, /teacherError/, "message teacher authorization must fail closed on teacher lookup errors");
assert.match(messagingAuth, /linksError/, "message teacher authorization must fail closed on subscription lookup errors");

const messageSend = read("src/app/api/messages/send/route.ts");
assert.match(messageSend, /threadId.length > 100/, "message send must bound thread identifiers");
assert.match(messageSend, /threadUpdateError/, "message send must surface thread timestamp write failures to logs");


const sessionReport = read("src/app/api/session-report/submit/route.ts");
assert.match(sessionReport, /sessionError/, "session report must fail closed on session lookup errors");
assert.match(sessionReport, /activeSubscriptionByChild/, "session report must reuse verified active subscription identities");
assert.match(sessionReport, /if \(!completedSession\)/, "session report must detect completion state races");
assert.match(sessionReport, /formatRiyadhCalendarDate/, "session report follow-up dates must use Riyadh calendar time");

const teacherApplicationStatus = read("src/app/api/teacher-applications/update-status/route.ts");
assert.match(teacherApplicationStatus, /uuidPattern\.test\(applicationId\)/, "teacher application status updates must validate identifiers");
assert.match(teacherApplicationStatus, /if \(!updated\)/, "teacher application status updates must detect missing rows");

const studentTasks = read("src/app/api/student/tasks/toggle/route.ts");
assert.match(studentTasks, /taskError/, "student tasks must fail closed on lookup errors");
assert.match(studentTasks, /eq\("status", task\.status\)/, "student task toggles must guard against state races");
assert.match(studentTasks, /if \(!updated\)/, "student task toggles must detect zero-row race outcomes");

const roleResolution = read("src/app/api/auth/resolve-role/route.ts");
assert.match(roleResolution, /adminError/, "role resolution must fail closed on admin lookup errors");
assert.match(roleResolution, /teacherError/, "role resolution must fail closed on teacher lookup errors");
assert.match(roleResolution, /parentError/, "role resolution must fail closed on parent lookup errors");

const studentAttendance = read("src/app/api/student/attendance/mark/route.ts");
assert.match(studentAttendance, /subsError/, "student attendance must fail closed on subscription lookup errors");
assert.match(studentAttendance, /sessionRowError/, "student attendance must fail closed on session lookup errors");

const messageThread = read("src/app/api/messages/thread/route.ts");
assert.match(messageThread, /childError/, "message thread creation must fail closed on child lookup errors");
assert.match(messageThread, /subscriptionError/, "message thread creation must fail closed on subscription lookup errors");
assert.match(messageThread, /cohortError/, "message thread creation must fail closed on cohort lookup errors");
assert.match(messageThread, /teacherError/, "message thread creation must fail closed on teacher lookup errors");

const assessmentSubmit = read("src/app/api/assessment/submit/route.ts");
assert.match(assessmentSubmit, /linkError/, "assessment submission must fail closed on ownership lookup errors");
assert.match(assessmentSubmit, /teacherNotes.length > 2000/, "assessment teacher notes must be bounded");

const recommendationRequest = read("src/app/api/recommendations/request/route.ts");
assert.match(recommendationRequest, /parentError/, "recommendation requests must fail closed on parent lookup errors");
assert.match(recommendationRequest, /recommendationError/, "recommendation requests must fail closed on recommendation lookup errors");


const studentModeGuard = read("src/lib/student-mode.ts");
assert.match(studentModeGuard, /getActiveStaffRole\(user\.id\)/, "student mode must reject a parent session that becomes a staff identity");
assert.match(studentModeGuard, /select\("first_name, grade, parent_id"\)/, "student mode must check current child ownership");
assert.match(studentModeGuard, /eq\("user_id", user\.id\)/, "student mode must invalidate old cookies after a child ownership transfer");

const studentExitOtpVerify = read("src/app/api/student-mode/exit/verify/route.ts");
assert.match(studentExitOtpVerify, /deactivateError/, "student exit must check persistence errors after OTP");
assert.match(studentExitOtpVerify, /if \(!deactivated\)/, "student exit must not report success without deactivating the session");
assert.match(studentExitOtpVerify, /eq\("active", true\)/, "student exit deactivation must be conditional");

const studentExitOtpRequest = read("src/app/api/student-mode/exit/request-otp/route.ts");
assert.match(studentExitOtpRequest, /parentError/, "student exit OTP requests must fail closed on parent lookup errors");

const studentModeEnter = read("src/app/api/student-mode/enter/route.ts");
assert.match(studentModeEnter, /childError/, "student mode entry must fail closed when ownership lookup fails");

const makeupRedeem = read("src/app/api/makeup/redeem/route.ts");
assert.match(makeupRedeem, /creditError/, "makeup redemption must fail closed when credit lookup fails");
assert.match(makeupRedeem, /childError/, "makeup redemption must fail closed when child ownership lookup fails");

const cancellation = read("src/app/api/session/cancel/route.ts");
assert.match(cancellation, /sessionError/, "cancellation must fail closed on session lookup errors");
assert.match(cancellation, /if \(!cancelledSession\)/, "cancellation must detect scheduled status races");
const cancelWriteAt = cancellation.indexOf('.update({ status: "cancelled", cancelled_by: cancelledBy })');
const creditIssueAt = cancellation.indexOf('for (const sub of activeSubs ?? [])');
assert.ok(cancelWriteAt !== -1 && creditIssueAt !== -1 && cancelWriteAt < creditIssueAt, "cancellation must commit before issuing compensation");


const pilotIdentity = read("src/lib/pilot-auth.ts");
const pilotResolver = read("src/lib/pilot-parent.ts");
const pilotLogin = read("src/app/api/pilot-auth/login/route.ts");
assert.match(pilotIdentity, /KHOTA_PILOT_PARENT_ID/, "pilot authentication must require explicit demo parent config");
assert.match(pilotIdentity, /session\.parentId !== configuredId/, "pilot tokens must remain bound to the configured demo identity");
assert.match(pilotResolver, /verifyPilotSessionParentId\(token\)/, "pilot parent resolution must rely on a signed parent-bound token");
assert.ok(!pilotResolver.includes('.order("created_at"'), "pilot parent resolution must never choose a latest unlinked parent");
assert.ok(!pilotResolver.includes("khota_pilot_last_subscription"), "pilot parent resolution must not trust an unbound subscription cookie");
assert.match(pilotLogin, /\.is\("user_id", null\)/, "pilot login must allow only unlinked dedicated demo parents");

const paylinkGateway = read("src/lib/paylink.ts");
const paylinkCreate = read("src/app/api/payments/paylink/create/route.ts");
assert.match(paylinkGateway, /unknown response shape|unrecognized response shape/, "Paylink unknown response must not be treated as zero transactions");
assert.match(paylinkGateway, /ambiguous: true/, "Paylink ambiguous invoice outcomes must remain pending");
assert.match(paylinkCreate, /FINAL_UNPAID_PAYLINK_STATUSES\.has\(status\)/, "only recognized terminal invoice states can clear pending rows");
assert.match(paylinkCreate, /if \(!\(await markPendingPaymentFailed/, "pending payment release must check write success");

// لا يجوز إظهار صفة تسجيل نظامي غير مثبتة قبل تأسيس كيان خُطى.
const legalProfile = read("src/lib/legal-profile.ts");
const legalPage = read("src/app/legal/page.tsx");
assert.match(legalProfile, /registrationType: null,/, "unconfirmed commercial/freelance registration must remain unset");
assert.match(legalPage, /legalProfile\.registrationNumber \? legalProfile\.registrationType : null/, "registration type must not display without a registration number");
assert.match(legalPage, /legalProfile\.registrationType \? legalProfile\.registrationNumber : null/, "registration number must not display without a documented type");
assert.match(legalPage, /\["اسم العلامة", legalProfile\.brandName\]/, "unregistered brand must not be presented as a registered trade name");

console.log("ALL INTEGRITY REGRESSION CHECKS PASSED");
