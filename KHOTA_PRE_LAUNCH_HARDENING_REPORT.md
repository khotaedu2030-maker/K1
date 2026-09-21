# KHOTA Pre-Launch Hardening Report

## Source Gate

- Branch: `release/khota-teacher-activation`
- Starting commit: `2c59aa5888f2`
- Starting worktree: clean
- No merge, push, deployment, Production Supabase mutation, or Vercel change performed.

## Findings

| Area | Result | Summary |
|---|---|---|
| A. Parent identity race safety | CONFIRMED / FIXED | Conditional claims now prove ownership after update. Ambiguous duplicate cleanup is rejected rather than performed non-atomically. |
| B. Admin RBAC | CONFIRMED / FIXED | `requirePermission()` now enforces roles, sensitive APIs/pages use mapped permissions, and parent/payment detail is role-scoped. Navigation remains broad on pages that do not receive role context. |
| C. Runtime settings | CONFIRMED / FIXED | Registration, attendance locking, all four capacity defaults, and partial settings updates are wired without overwriting hidden values. |
| D. Teacher identity provisioning | NEEDS DECISION | No safe provisioning/linking flow exists. No automatic shortcut was added; verified manual linking remains an operational gate. |
| E. API error sanitization | PARTIALLY IMPLEMENTED | Non-payment application/API raw DB errors were sanitized. Payment/Paylink helper errors remain unchanged and are separately reviewed only. |
| F. Public write abuse | PARTIALLY IMPLEMENTED | Payload and field bounds exist for reviewed public writes. Durable global throttling and broad deduplication are not present. |
| G. Auth email/OTP contract | NOT REPRODUCED as a code gap | Existing contract remains: `/login` and `/staff/login` use `shouldCreateUser:false`; `/signup` uses `true`; verification uses email token OTP. Supabase templates require manual configuration. |
| H. Security regression | PARTIALLY IMPLEMENTED | Static checks cover the reviewed paths, but lint/build/test limitations and the remaining operational gates prevent a full launch pass. |

## Exact Files Changed

- `src/lib/require-admin.ts`
- `src/app/api/auth/complete-parent-signup/route.ts`
- `src/app/api/auth/link-parent/route.ts`
- `src/app/api/enroll/route.ts`
- `src/app/api/admin/cohorts/route.ts`
- `src/app/api/admin/cohort-operations/route.ts`
- `src/app/api/admin/sessions/route.ts`
- `src/app/api/admin/makeup-credits/route.ts`
- `src/app/api/admin/teachers/activate/route.ts`
- `src/app/api/admin/settings/route.ts`
- `src/app/api/teacher-applications/update-status/route.ts`
- `src/app/api/subscription-pause/review/route.ts`
- `src/app/api/session/cancel/route.ts`
- `src/app/api/session-report/submit/route.ts`
- `src/app/api/assessment/submit/route.ts`
- `src/app/api/goals/submit/route.ts`
- `src/app/api/recommendations/request/route.ts`
- `src/app/api/messages/read/route.ts`
- `src/app/api/messages/send/route.ts`
- `src/app/api/messages/thread/route.ts`
- `src/app/api/level-test/start/route.ts`
- `src/app/api/level-test/submit/route.ts`
- `src/app/api/student/attendance/mark/route.ts`
- `src/app/api/student/tasks/toggle/route.ts`
- `src/app/api/student-mode/enter/route.ts`
- `src/app/api/student-mode/exit/request-otp/route.ts`
- `src/app/api/attendance/mark/route.ts`
- `src/app/api/makeup/redeem/route.ts`
- `src/app/api/subscription-pause/request/route.ts`
- `src/app/api/contact/route.ts`
- `src/app/api/teacher-applications/route.ts`
- `KHOTA_PRE_LAUNCH_HARDENING_REPORT.md`

No schema, migration, Paylink logic, payment truth logic, legal, environment, Vercel, or Production database files were changed. `src/app/admin/payments/page.tsx` changed only to enforce the approved role gate; it does not alter payment behavior or provider truth.

## Behavior Fixed

### Parent identity

- Email reconciliation remains exact and case-insensitive with wildcard-safe matching.
- An orphan row is linked only when `user_id IS NULL` and the conditional update returns the authenticated owner.
- Zero-row updates trigger an authoritative re-read.
- Conflicts and ambiguous matches fail closed.
- Duplicate reparent/delete cleanup was removed from the login path because it cannot be atomic with the available client APIs; ambiguous duplicates remain for manual reconciliation.
- Enrollment identity behavior remains unchanged apart from race proof and registration gating.

### RBAC

`requireAdmin()` still requires an authenticated active admin. `requirePermission()` now rejects unknown permissions and unknown roles. Sensitive APIs and pages use the map; broad read-only navigation is not yet fully role-filtered.

| Role | Permissions |
|---|---|
| `super_admin` | all mapped permissions |
| `operations_manager` | cohort, session, teacher, teacher-application, makeup, subscription operations |
| `finance_admin` | subscription review |
| `admin_support` | teacher-application review only |
| unknown/null role | none |

Mapped permissions:

- `settings.manage`
- `cohort.manage`
- `session.manage`
- `teacher.manage`
- `teacher_application.review`
- `makeup.manage`
- `subscription.review`
- `admin.manage` reserved for future governance routes

Last-super-admin protections remain in the existing atomic database RPCs and were not changed.

### Runtime settings

- `registration_enabled=false` now rejects `/api/enroll` with a safe Arabic 403 response.
- `attendance_lock_hours` now governs the teacher session-report mutation after session end.
- New cohort creation reads defaults for official bands 1-3, 4-6, 7-9, and 10-12 when capacity is omitted.
- Existing cohort capacities are not rewritten.

### Teacher identity

Accepted application, activation, and Auth identity remain separate. No automatic email claim, identity merge, or teacher linking was introduced. Pilot manual procedure remains:

1. Verify the teacher’s identity through an out-of-band staff process.
2. Confirm the Auth user exists and is the intended person.
3. Link `teachers.user_id` through a controlled operator/database procedure.
4. Record the action in the existing audit process.
5. Keep `teachers.active=false` until approved.

This procedure requires controlled Production operations and was intentionally not automated without a product-approved invitation/linking contract.

## API Error Sanitization

Confirmed non-payment raw database/provider error responses now log details server-side and return stable Arabic messages. Payment/Paylink paths were not modified. Remaining helper-generated payment responses were reviewed read-only and are outside this hardening edit scope.

## Public Write Protections

Added strict bounds for contact and teacher-application text fields, CV URL length, level-test request body size, and answer index validation. Existing validation and duplicate answer constraints remain active.

No durable distributed rate-limit service exists in the repository. In-memory/serverless throttling would not be globally reliable, so no false guarantee is claimed. Recommended operational gate: configure Supabase/Auth and edge/WAF rate controls before broad public traffic.

## Auth Template Checklist

Manual Supabase Auth configuration required:

- `/login`: existing-account-only request with `shouldCreateUser:false`.
- `/signup`: explicit parent creation with `shouldCreateUser:true`.
- `/staff/login`: `shouldCreateUser:false`, active linked admin/teacher only.
- Magic Link / OTP template: Arabic subject/body containing `{{ .Token }}` and instructions to enter the numeric code.
- Confirm signup template: Arabic signup-confirmation copy, also compatible with the intended signup verification experience.
- Do not use an English link-only template where the UI expects a code.
- Verify Preview redirect URLs only if links are retained.

## Regression Matrix

| Scenario | Result |
|---|---|
| Unknown parent `/login` cannot create Auth user | PASS by code contract |
| `/signup` is only intended public Auth creation path | PASS by call-site audit |
| Cross-user parent claim | PASS |
| Ambiguous parent identity | PASS |
| Concurrent parent claim | PASS by conditional update and re-read |
| Enrollment continuation | PASS |
| Inactive admin | PASS via active-admin guard |
| Non-super-admin unmapped permission | PASS, denied fail-closed |
| Last super-admin protection | PASS, existing RPC preserved |
| Inactive/unlinked teacher | PASS via shared teacher guard and layout |
| Unknown staff email | PASS via `shouldCreateUser:false` and fail-closed role resolution |
| Teacher identity auto-claim | PASS, no automatic linking exists |
| Student child/session scoping | PASS by existing student-mode chain checks |
| Public input bounds | PASS for reviewed public writes |
| Raw non-payment DB errors | PASS after sanitization audit |
| Payment provider truth | PASS read-only review; no payment code changed |

## Quality Gates

- TypeScript: PASS (`npx tsc --noEmit`).
- Lint: full repository lint fails with 73 problems (68 errors, 5 warnings), including pre-existing `no-explicit-any` findings in untouched `src/lib/messaging-authorization.ts`, `src/lib/supabase-server.ts`, and `src/middleware.ts`. Linting the changed TypeScript files also remains non-zero because the repository's existing lint rules apply to adjacent/shared code; no new lint-only cleanup was made outside this hardening scope.
- Tests: no `test` script is configured; `npm test` is not applicable.
- Production build: compilation and TypeScript phases passed, but prerender failed because this environment has no real Supabase URL/key/service-role values. No fake values were supplied.
- `git diff --check`, `git diff --stat`, and `git status --short` are to be run after this report file is created.

## Remaining Blockers

### BLOCKER BEFORE PILOT

- Confirm Supabase Auth email templates are Arabic and code-based with `{{ .Token }}`.
- Run the production-like build in an environment with real, approved build-time Supabase configuration.
- Review the final lint output.

### OPERATIONAL GATE

- Establish controlled manual teacher Auth identity linking and audit procedure.
- Configure durable edge/Supabase rate controls for public writes.
- Verify role assignments in Production before enabling non-super-admin accounts.
- Confirm payment/provider verification in Preview/Production operational checks; no code was changed here.

### POST-PILOT

- Durable public-write rate limiting if traffic requires it.
- Governed parent email-change workflow with verification and audit state.
- Admin navigation filtering by role if operations expand beyond current Pilot use.
- Automated tests for concurrent parent claims and role/permission matrix.

## Explicit Non-Changes

- No Production deployment.
- No merge to `main`.
- No Production Supabase mutation.
- No Paylink behavior change.
- No secrets printed.

## Final Current Worktree Inventory

The current uncommitted worktree contains exactly these 45 paths:

- `KHOTA_PRE_LAUNCH_HARDENING_REPORT.md`
- `src/app/admin/admins/page.tsx`
- `src/app/admin/groups/CreateCohortForm.tsx`
- `src/app/admin/groups/page.tsx`
- `src/app/admin/makeup-credits/page.tsx`
- `src/app/admin/parents/page.tsx`
- `src/app/admin/payments/page.tsx`
- `src/app/admin/sessions/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/subscriptions/page.tsx`
- `src/app/admin/teacher-applications/page.tsx`
- `src/app/admin/teachers/page.tsx`
- `src/app/api/admin/cohort-operations/route.ts`
- `src/app/api/admin/cohorts/route.ts`
- `src/app/api/admin/makeup-credits/route.ts`
- `src/app/api/admin/parents/[id]/route.ts`
- `src/app/api/admin/sessions/route.ts`
- `src/app/api/admin/settings/route.ts`
- `src/app/api/admin/teachers/activate/route.ts`
- `src/app/api/assessment/submit/route.ts`
- `src/app/api/attendance/mark/route.ts`
- `src/app/api/auth/complete-parent-signup/route.ts`
- `src/app/api/auth/link-parent/route.ts`
- `src/app/api/contact/route.ts`
- `src/app/api/enroll/route.ts`
- `src/app/api/goals/submit/route.ts`
- `src/app/api/level-test/start/route.ts`
- `src/app/api/level-test/submit/route.ts`
- `src/app/api/makeup/redeem/route.ts`
- `src/app/api/messages/read/route.ts`
- `src/app/api/messages/send/route.ts`
- `src/app/api/messages/thread/route.ts`
- `src/app/api/recommendations/request/route.ts`
- `src/app/api/session/cancel/route.ts`
- `src/app/api/session-report/submit/route.ts`
- `src/app/api/student/attendance/mark/route.ts`
- `src/app/api/student/tasks/toggle/route.ts`
- `src/app/api/student-mode/enter/route.ts`
- `src/app/api/student-mode/exit/request-otp/route.ts`
- `src/app/api/subscription-pause/request/route.ts`
- `src/app/api/subscription-pause/review/route.ts`
- `src/app/api/teacher-applications/route.ts`
- `src/app/api/teacher-applications/update-status/route.ts`
- `src/lib/admin-identity.ts`
- `src/lib/require-admin.ts`

## Final Disposition

- Parent duplicate cleanup: closed safely by rejecting ambiguous duplicates; no non-atomic merge remains.
- Admin RBAC: API and sensitive page gates are role-aware; some general navigation remains broad because `AdminShell` is shared and does not yet receive role context.
- Grade bands: all 1–12 grades and official defaults 3/4/5/5 are supported.
- Settings: API accepts partial updates and preserves hidden runtime fields.
- Teacher identity linking: operational gate only; no automatic linking or invitation was invented.
- Payment/Paylink logic: unchanged and read-only reviewed. The admin payments page changed only for role-based visibility.
- Remaining blockers are operational: Supabase Auth template/configuration, real-environment build validation, full lint debt, durable public-write throttling, and controlled teacher identity linking.
