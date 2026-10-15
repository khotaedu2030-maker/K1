# KHOTA — inactive teacher RLS remediation (staging gate)

**Status: DRAFT. Never apply to production without explicit approval and real-role tests on isolated staging.**

## Evidence
- Read-only inspection of production (15 Oct 2026): 40/40 public tables have RLS enabled; anon grants no direct table SELECT; authenticated has SELECT on 21 tables; both lack direct table writes.
- The supplied `pg_policies` export establishes 10 teacher-oriented SELECT policies that test `teachers.user_id = auth.uid()` but do not test `teachers.active IS TRUE`.
- 30 SECURITY DEFINER functions reportedly have no anon/authenticated EXECUTE; the additional helper in this draft **intentionally** grants authenticated EXECUTE in an **unexposed dedicated schema**, returning only whether the caller is an active teacher. This is a new, review-required exception, not an unchanged audit result.

## Why the helper is necessary
- Existing `teachers_visible_to_messaging_parents` RLS references `message_threads`.
- A direct `teachers` subquery inside the `message_threads` teacher RLS condition can trigger policy recursion (teachers <-> threads).
- `khota_rls.current_teacher_is_active()` has no arguments, reads **only `auth.uid()`**, requires `active IS TRUE`, fixes `search_path`, and uses SECURITY DEFINER to avoid recursive application of teachers' RLS when evaluating the flag.
- `khota_rls.current_teacher_owns_cohort(cohort_id)` is a similarly constrained, non-public membership checker used **only** by `subscriptions_of_own_teacher`: it tests the caller's active teacher identity against the cohort without invoking the recursive `cohorts`/`subscriptions` RLS chain.
- This helper must be owned by a role that bypasses the `teachers` table RLS (normal Supabase migration-owner expectations); if that condition cannot be verified, STOP.
- **Do not add `khota_rls` to PostgREST Exposed Schemas**. Give `authenticated` only USAGE on this dedicated schema and EXECUTE on this specific helper.

## Scope
Only the ten policies referenced in `20261015_revoke_inactive_teacher_reads.sql` are modified. Nine existing USING qualifiers are preserved from `pg_policies`; the subscription-teacher qualifier is replaced with an equivalent caller-scoped membership helper because its old nested `cohorts` read recursively invokes `subscriptions` RLS. All ten additionally require active teacher status. Parent self-read, historical parent messages, parent teacher-profile visibility, and teacher self-profile access are unchanged. Active teacher access to students of **expired/ended subscriptions** is **not** changed here: retention and alumni visibility need separate business approval.

## Safe validation process
1. Provision a fully **isolated Supabase staging database**; import schema/migrations and synthetic demo accounts/children. **Never copy production customer data, secrets, or live Paylink credentials.**
2. Verify the 10 policy names, SELECT-only commands and PUBLIC role baselines match. The migration checks these and aborts atomically if there is drift.
3. Apply the migration **only to staging**. Check that `khota_rls` is **not in PostgREST exposed schemas**, and inspect BOTH helper functions' ownership, SECURITY DEFINER, fixed search_path and EXECUTE privileges. Anon must not be able to invoke the function.
4. With **real authenticated sessions** (or staging role impersonation with JWT claims), test:
   - **Active teacher** can read their linked student's data, sessions, subscriptions and own message history.
   - **Inactive teacher (active=false)** cannot read those rows from any of the ten affected tables, including old threads/messages.
   - **NULL active teacher** cannot read any of the same rows.
   - **Another active teacher** cannot read that student's data or messages.
   - **Correct parent** can still read their own child, subscription and earlier teacher message history.
   - **Unrelated parent/anon** cannot read the student's private data.
   - Server teacher routes still reject disabled teachers; legitimate active teacher / parent UI stays functional.
5. Run Supabase Security Advisor, CI, and end-to-end school/parent flows. A green CI here includes **static policy assertions only** and **does not establish real database behavior**.
6. Capture redacted before/after test evidence. Only then request a **separate explicit production rollout decision**, including backup/rollback and a maintenance window if appropriate.

## Remaining separate advisory items
- `enforce_cohort_days_match_plan`: inspect function body before choosing a safe fixed `search_path` migration; avoid changing search_path blindly.
- Leaked-password protection: Auth dashboard setting. Review whether the site is OTP-only and choose an appropriate setting; no change made.
- Historical student visibility for active teachers, RPC privilege review and PostgREST role tests remain separate.

## Rollback design
Create an explicit rollback migration from the **original policy conditions** captured before changing staging. Never automatically roll back by deleting the RLS helper alone: the ten policies reference it. Do not run DDL outside of the reviewed deployment process.
