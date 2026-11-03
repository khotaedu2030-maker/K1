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
5. Run Supabase Security Advisor, CI, and end-to-end school/parent flows. GitHub CI now runs **actual PostgreSQL 17 authenticated-role reads** on a fresh synthetic fixture in addition to static checks, including active/inactive/NULL teachers, unrelated users, parents, and message recursion. This validates the fixture only, not real Supabase staging conditions, Auth/JWT wiring, or the deployed 40-table schema.
6. Capture redacted before/after test evidence. Only then request a **separate explicit production rollout decision**, including backup/rollback and a maintenance window if appropriate.

## Remaining separate advisory items
- `enforce_cohort_days_match_plan`: inspect function body before choosing a safe fixed `search_path` migration; avoid changing search_path blindly.
- Leaked-password protection: Auth dashboard setting. Review whether the site is OTP-only and choose an appropriate setting; no change made.
- Historical student visibility for active teachers, RPC privilege review and PostgREST role tests remain separate.

## CI finding and resolution
- First PostgreSQL behavior test identified **pre-existing infinite recursion** between the `subscriptions_of_own_teacher` policy and `cohorts_of_own_children`; the original `subscriptions` read walked into `cohorts` RLS, which walked back into `subscriptions`.
- The migration replaces only that teacher-subscription condition with the equivalent `khota_rls.current_teacher_owns_cohort(cohort_id)` helper. This deliberately changes its implementation, while preserving permitted teacher-cohort access and requiring `active IS TRUE`.
- The disposable PostgreSQL 17 test has passed all role scenarios as of commit `f9cf257b`; the isolated Supabase staging requirement remains open.

## Rollback design
Create an explicit rollback migration from the **original policy conditions** captured before changing staging. Never automatically roll back by deleting the RLS helper alone: the ten policies reference it. Do not run DDL outside of the reviewed deployment process.


## Supabase staging validation — 2026-10-15

**Created a separate Supabase Free-plan project** in organization Khota K1, region ap-southeast-1, project ref `iteskfrpeeclzshauxog`. The project creation quote was **$0/month** at creation. Production remains `jylenzphqkmucwxqlzmq` and was **not modified**.

The new project was initially empty. Two migrations were applied **to this staging project only**:
1. `staging_rls_synthetic_fixture`: 12 synthetic public tables with the 10 reviewed legacy teacher SELECT policies, relevant parent policies, and fake identities/rows. Uses Supabase-managed auth schema and roles; no data from production was copied.
2. `staging_inactive_teacher_rls_guard_validation`: the exact RLS SQL from this draft PR.

**Verified on the actual Supabase staging PostgreSQL service** by executing statements under `SET LOCAL ROLE authenticated`, with `request.jwt.claim.sub` set to each synthetic identity. Counted visible rows on all 10 affected tables for each case:

| Identity | Expected rows per protected table | Observed on all 10 |
| --- | ---: | ---: |
| Linked active teacher | 1 | 1 |
| Active unrelated teacher | 0 | 0 |
| Same teacher with `active=false` | 0 | 0 |
| Same teacher with `active=NULL` | 0 | 0 |
| Correct parent | 1 | 1 |
| Unrelated parent | 0 | 0 |

All 60 table/read assertions passed and **no RLS recursion occurred**. Teacher status changes happened in ROLLBACK transactions, leaving the staging fixture in its initial state.

Other verified staging state:
- 12 synthetic public tables, all with RLS enabled.
- Exactly 10 teacher policies include the new active-teacher guard.
- Two `khota_rls` SECURITY DEFINER helpers are owned by `postgres` and have fixed empty `search_path`; `anon` cannot execute either, `authenticated` can.
- Supabase Security Advisor reported no security lints for this **synthetic 12-table staging fixture** at verification time.

**Limits — still a DRAFT, not approved for production:**
- This project does **not** yet contain the complete production-equivalent 40-table schema or a deployed isolated Vercel Preview, and the tests are impersonated Postgres roles rather than real Supabase Auth session/JWT and PostgREST/API end-to-end tests.
- The Supabase production migration ledger is empty despite 40 existing public tables. Do not blindly replay all historical migration files or the legacy `schema.sql`; stage schema reconciliation must be independently reviewed.
- Check explicitly that `khota_rls` is not among exposed API schemas. No claim of this settings validation is made here.
- Decide expired-subscription teacher visibility and historical retention separately.
- Keep PR #55 in draft and request explicit approval before any production merge or migration.

