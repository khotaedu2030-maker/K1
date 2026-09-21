# KHOTA — Phase 9 Migration Manifest

**Revision 3 (Step 9.2A — real Production evidence, 20 Sep 2026):** this pass received actual
read-only diagnostic evidence from the real KHOTA Supabase Production database for the first time in
this engagement's history (see `KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md` for the full evidence and
reasoning). Two consequences for this manifest:

1. **The individually-tracked migration files below are no longer the Sunday application plan.**
   Given the real evidence — `platform_settings` exists in Production but with an incompatible
   key/value schema, not the typed singleton row `20260917_platform_settings.sql` and
   `20260920_settings_foundation_extension.sql` assume — those two files must **never** be applied
   against Production under any circumstance (they would either error outright or silently corrupt
   the settings architecture). A second, independently-discovered problem — `supabase/schema.sql`
   folds several Admin-OS columns (`admins.role`, `cohorts.cycle_id`, `cohorts.grade`,
   `subscriptions.hold_expires_at`) directly into their table's base `create table if not exists`
   statement rather than as their own `alter table add column`, which means naively replaying
   `schema.sql`'s base table statements against Production's *already-existing* tables would silently
   never add these columns — the same class of trap the platform_settings evidence warned about, just
   undiagnosed for these four. Both problems are fixed in one new, reviewed, reconciled migration:
   `supabase/migrations/20261002_phase9_production_reconciliation.sql`. See
   `KHOTA_PHASE9_APPROVED_MIGRATION_DELTA.md` for the full per-file superseding table and
   `KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md` for the complete reasoning.
2. **This new migration has been tested against a Production-shaped local simulation** (not just the
   generic "approximate pre-Admin-OS baseline" used in Revision 2) — a reconstructed baseline built
   directly from the 20 Sep 2026 evidence (old key/value `platform_settings`, the six confirmed-missing
   tables genuinely absent, the seven confirmed-missing columns genuinely absent, `admin_actions.reason`
   present) — applied cleanly, twice in a row (idempotency), with a full data-preservation test (seeded
   legacy rows survived byte-for-byte). See `KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md` for the complete,
   honestly-qualified account. **This is still not Production verification** — it is a local,
   non-Supabase PostgreSQL simulation built from evidence that could itself be stale by Sunday; GATE 1
   of `KHOTA_SUNDAY_GO_LIVE_RUNBOOK.md` re-confirms the real state before anything is applied for real.

The 26-row table below (Revision 2's classifications) is kept as historical record of the
per-migration-file analysis and is still accurate for understanding what each individual file does —
but for what to actually apply on Sunday, `KHOTA_PHASE9_APPROVED_MIGRATION_DELTA.md` is now the
authoritative document, not this table's `APPLY_IF_MISSING` column.

**Revision 2 (offline finalization pass, ahead of Sunday go-live):** this pass had real (if
approximate) local PostgreSQL 16 access via this sandbox's own `postgresql-16` package — no Docker
daemon was available, but `pg_ctlcluster`/`psql` were. **This is explicitly NOT proof of Production
compatibility** (Production is a real Supabase project — with `auth`, Row Level Security, and
Supabase-managed roles this simulation only stubs approximately — not plain PostgreSQL 16). See
**"Local simulation results (this pass)"** below for the full, honest account of what was and wasn't
tested this way, and every assumption made. This does not change any row's classification — none
becomes `VERIFIED_APPLIED` from a local test, per this step's own instruction that only real
Production evidence earns that label — but it did surface one concrete correction (row #1's note,
below) and gives real (not just static-reading) confidence that the tracked migration set is
internally consistent.

**Revision 1 (Step 9.1.4):** supersedes the version written during the pre-Phase-9
correction pass. That version used a category spelled `VERIFY_APPLIED` and allowed it to be assigned
by inference ("this phase was approved/closed in an earlier round, so it is *plausibly* already
live"). **Step 9.1's own instructions are stricter and this revision follows them exactly:**

> Do not say VERIFIED_APPLIED without database evidence. For Admin OS migrations not yet proven in
> DB: use APPLY_IF_MISSING or REQUIRES_REVIEW.

This sandbox has **zero database access** — confirmed this pass: no Supabase MCP tool is present, no
connector matches `supabase`/`database`/`postgres`, no `SUPABASE_*`/`DATABASE_URL`/`POSTGRES_*`
environment variable is set, and no `.env`/`.env.local` file exists in the working tree. Because there
is no evidence of any kind for any migration, **not one of the 26 files below is classified
`VERIFIED_APPLIED` in this revision** — including ones a previous round's report speculated were
"plausibly already live." That was a softer standard than this step's instruction allows, so it is
corrected here rather than carried forward.

## How to actually get evidence

`supabase/phase9_database_reconciliation_readonly.sql` (new this pass) is a SELECT-only diagnostic —
zero INSERT/UPDATE/DELETE/CREATE/ALTER/DROP, reveals no secrets — that checks real existence,
signatures, constraints, indexes, and RLS status for every object introduced across Phases 1–8, plus
the current value of `platform_settings.pause_max_days` (needed for the one migration flagged
`REQUIRES_REVIEW` below) and, if present, the Supabase CLI's own `supabase_migrations.schema_migrations`
ledger. Run it once in the Supabase SQL Editor against the real project and its output becomes the
evidence this manifest is missing. Until that happens, every classification below is conservative by
design — it assumes nothing is applied, and instructs safe idempotent re-application where possible.

**A structural finding worth flagging before the table:** this project's `supabase/migrations/`
directory does **not** contain the original base-schema migration. `supabase/schema.sql` defines core
tables (`parents`, `children`, `teachers`, `cohorts`, `sessions`, `subscriptions`, `payments`,
`plans`, etc.) under a `-- ---------- الجداول الأساسية (من V1) ----------` heading, but no file in
`supabase/migrations/` creates them — confirmed by `grep -l "create table if not exists parents"
supabase/migrations/*.sql` returning nothing. This means the 26 files below are **not** this
database's complete migration history; an earlier, untracked baseline predates this directory's
convention. Phase 9's reconciliation query (Section 1 of the diagnostic script) checks these base
tables too, precisely because their applied state cannot be inferred from `migrations/` at all.

## Local simulation results (this pass) — NOT proof of Production compatibility

This sandbox has a real `postgresql-16` server package pre-installed (confirmed via `psql --version`
and `dpkg -l | grep postgresql`), even though the Docker daemon this environment's Docker *client*
would normally talk to is not reachable (`docker ps` fails — no `dockerd` running, and it cannot be
started here due to sandbox `ulimit` restrictions). `pg_ctlcluster 16 main start` successfully brought
up a local cluster. This is genuinely useful for catching syntax errors, ordering failures, missing
dependencies, duplicate objects, and broken functions — exactly what Step 9.1's instructions ask a
local simulation to catch — but it is **not** Supabase: no real `auth` schema, no Row Level Security
enforcement identical to Supabase's, no Supabase Auth triggers, no real `anon`/`authenticated`/
`service_role` grants beyond what was manually stubbed. Every result below is qualified accordingly.

**Bootstrap stub used** (documented so the test is reproducible and its gap from real Supabase is
clear): `create extension pgcrypto`, roles `anon`/`authenticated`/`service_role`, a minimal
`auth.users(id uuid, email, phone, created_at)` table, and stub functions `auth.uid()` (returns
`null`), `auth.role()` (returns `'service_role'`), `auth.jwt()` (returns `'{}'`). This is enough for
DDL/function-definition syntax and ordering to be tested, but **RLS policy *behavior* was never
actually exercised** (no policy was tested against a non-`service_role` caller) — only that `create
policy` statements themselves parse and execute without error.

**Test 1 — fresh install of `supabase/schema.sql` against an empty database:**
```
$ psql -d khota_sim_test1 -v ON_ERROR_STOP=1 -f schema.sql
... (186 CREATE/ALTER/INSERT/DO statements)
exit code: 0
```
**Result: PASS.** Zero syntax errors, zero missing dependencies, zero broken functions. Resulting
database: 37 tables, 67 functions in `public`. One benign, expected NOTICE (`drop trigger ... does
not exist, skipping` — correct behavior on a first run).

**Test 2 — applying `supabase/migrations/*.sql` directly, in chronological order, skipping the
superseded file, against the bootstrap-only (no `schema.sql`) database:**
```
FAIL at: 20260906_multi_stage_support.sql (exit 3)
ERROR:  relation "children" does not exist
```
**Result: FAILS IMMEDIATELY, as expected — this is concrete, executed proof (not just a `grep`
inference) of the untracked-baseline finding already documented below**: the 26 tracked migration
files genuinely cannot run standalone from empty, because none of them creates the base tables. This
is not a defect in the migrations — it confirms Production almost certainly already has these tables
from before this `migrations/` directory existed, and Phase 9's real reconciliation step must verify
that directly (diagnostic script §1) rather than trying to "fix" this by inventing a synthetic
base-schema migration from local guesswork.

**Test 3 — reconstructing an approximate pre-Admin-OS baseline, then applying the real tracked
migrations on top:** `supabase/schema.sql` lines 1–910 (its own "V1" through "Phase 3A / Student Mode"
sections, i.e. everything before its RLS-policy section) were extracted as an **approximate** stand-in
for "what Production likely already has," explicitly acknowledged as imperfect (`schema.sql` was
already shown, in the Step 9.1 report, to be hand-consolidated rather than a literal migration-by-
migration history — so this baseline may already contain some columns that a real historical
pre-migrations Production schema wouldn't have had at that exact point in time). This baseline applied
cleanly (exit 0), then **all 25 non-superseded tracked migrations were applied on top, in chronological
order, with zero errors**:
```
OK: 20260906_multi_stage_support.sql
OK: 20260908_fix_duplicate_sessions.sql
... (23 more, all OK)
OK: 20261001_phase9_pre_correction_plan_mutation_and_capacity_defaults.sql
```
**Result: PASS.** No ordering failure, no missing dependency, no duplicate-object error, no broken
function, no invalid constraint across the entire tracked migration set, tested against a real
(if approximated) schema state rather than just read statically.

**Test 4 — idempotency check: re-running the same 25 migrations a second time on the same database:**
**Result: PASS, zero failures** — including `20260906_multi_stage_support.sql`'s `insert into plans`.
**This corrects a false claim in Revision 1 of this manifest** (row #1's note below previously said
this INSERT was non-idempotent and would raise a duplicate-key error on re-run — checked now against
real execution, not assumed): the statement actually ends with `on conflict (id) do nothing`, which
was missed on the earlier static read. Row #1 below is corrected accordingly. This is exactly the kind
of claim this manifest exists to verify rather than assert from memory.

**Test 5 — idempotency check: re-running the full `schema.sql` a second time on the Test-1 database:**
```
ERROR:  policy "admins_self_select" for table "admins" already exists
```
**Result: FAILS on re-run** — a real, minor finding: at least one `create policy` statement in
`schema.sql` lacks a preceding `drop policy if exists`, unlike this project's consistent
`create or replace function` / `create table if not exists` conventions elsewhere. **This is not a
launch blocker** — normal deployment applies `schema.sql` once (fresh install) or applies
`migrations/*.sql` incrementally (never re-running the whole cumulative file), so this gap would only
matter if someone manually re-ran all of `schema.sql` against an already-provisioned database, which
is not this project's documented deployment path. Logged in the defect register as a low-severity
hygiene item, not fixed in this pass (fixing it would mean editing an already-migrated-in-place
`schema.sql` block covering many policies — riskier to touch quickly than the value it recovers,
per this pass's "don't rewrite historical migrations unless necessary" instruction).

## Classification definitions (unchanged in meaning from the prior revision)

- **VERIFIED_APPLIED** — confirmed present in the real database by the diagnostic script's output (or
  equivalent direct inspection). Not used anywhere in this revision — no such evidence exists yet.
- **APPLY_IF_MISSING** — idempotent by construction (`create table if not exists`,
  `create or replace function`, `add column if not exists`, `drop ... if exists` before `add`); safe
  to (re-)apply once its section of the diagnostic script confirms the object is actually missing.
  Applying it when the object already exists is a no-op, not an error or a data change.
- **SUPERSEDED_DO_NOT_APPLY** — must never be applied as an independent step, regardless of what the
  diagnostic script finds.
- **REQUIRES_REVIEW** — contains a real, non-idempotent, conditional data mutation (an `UPDATE`
  against existing rows, not just DDL). Needs a human decision informed by the diagnostic script's
  actual result before any application, applied or not.

## Full manifest — 26 files

| # | Filename | Classification | Evidence | Dependencies | Safe ordering | Notes |
|---|---|---|---|---|---|---|
| — | *(untracked baseline — not a file in this directory)* | REQUIRES_REVIEW | None — `supabase/schema.sql`'s "V1" section defines these tables but no migration file creates them; diagnostic script §1 checks their existence directly | None (must exist before every migration below) | Must be resolved/confirmed **first**, before any file in this list | Not a migration file; flagged so Phase 9 does not assume the 26 files below are the whole history |
| 1 | `20260906_multi_stage_support.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Requires base tables (`children`, `cohorts`, `plans`, `subscriptions`) above | 1st (oldest) | **Corrected in Revision 2:** an earlier version of this row claimed the `insert into plans (...) values (...)` had no `on conflict` clause and would raise a duplicate-key error on re-run. That was wrong — checked now, not assumed: the statement ends with `on conflict (id) do nothing`, confirmed both by reading the file and by a real local re-run (Test 4) producing zero errors. This file is fully idempotent. |
| 2 | `20260908_fix_duplicate_sessions.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #1 (operates on `sessions`/`cohorts` from base schema) | 2nd | `drop constraint if exists` + `add constraint` — fully idempotent |
| 3 | `20260908b_enforce_plan_days_integrity.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #1 | 3rd | `create or replace function` + `drop trigger if exists` before creating — idempotent |
| 4 | `20260916_admin_actions_log.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Base schema (`auth.users`) | 4th | `create table if not exists` — idempotent |
| 5 | `20260916_contact_requests.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | None beyond base schema | 4th (parallel to #4, no ordering dependency between them) | `create table if not exists` — idempotent |
| 6 | `20260916_paylink_pending_uniqueness.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | `subscriptions`/`payments` (base schema) | 5th | `create unique index if not exists` — idempotent |
| 7 | `20260916_pending_payment_24h_expiry.sql` | **SUPERSEDED_DO_NOT_APPLY** | Direct file comparison (this and file #9 below redefine the identical three function signatures: `cohort_available_seats(uuid)`, `public_cohorts_catalog(text)`, `enroll_subscription_atomic(uuid,uuid,text,uuid)`) — confirmed by reading both files in full in an earlier round, re-confirmed structurally this pass via grep | N/A — never apply | **Never** — excluded from all ordering | Superseded by #9 (`20260917_seat_hold_alignment_and_atomic_admin_rpc.sql`), whose version of the same three functions additionally accounts for Paylink-pending holds via `cohort_occupied_seats()`. If a version of these three functions matching *this* file's (older) logic is found live in the diagnostic script's §3 signature output, that is itself evidence the database needs the #9 file (re-)applied to correct it — not this file |
| 8 | `20260916_teacher_applications.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Base schema | 4th (parallel to #4/#5) | `create table if not exists` — idempotent |
| 9 | `20260917_platform_settings.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Base schema | 6th | `create table if not exists` + `insert ... on conflict (id) do nothing` (idempotent, unlike #1's insert) + first version of `admin_update_platform_settings` RPC |
| 10 | `20260917_seat_hold_alignment_and_atomic_admin_rpc.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #1 (redefines `enroll_subscription_atomic` first created there); functionally **must** be applied at or after #7's position for the correct version to be the one live | 7th — **must always be scheduled after #7's file position, even though #7 itself is never applied** (i.e. if both happen to be applied in a single pass for any reason, this file must run last) | This is the authoritative source of the seat-hold/occupancy logic; see #7's note. Also introduces `cohort_occupied_seats()` and `admin_update_cohort_operations_atomic()` |
| 11 | `20260918_grade_exact_and_action_reason.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #1, #4 | 8th | `add column if not exists` only — idempotent |
| 12 | `20260919_admins_role_backfill.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Base schema (`admins`) | 9th | `add column if not exists role ... default 'super_admin'` — no separate `UPDATE`, fully idempotent (verified by reading the full file in an earlier round) |
| 13 | `20260919_cycles_foundation.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Base schema | 9th (parallel to #12) | `create table if not exists` — idempotent |
| 14 | `20260920_settings_foundation_extension.sql` | **REQUIRES_REVIEW** | None — this is exactly why diagnostic script §6 exists | #9, #13 | Blocked until human review | Contains `add column if not exists` (idempotent, safe) **and** `update platform_settings set pause_max_days = 28 where pause_max_days = 30;` — a real conditional data mutation. Run diagnostic script §6 first: if `pause_max_days` is currently `30`, applying this file changes live data (intentionally, per this project's design — but requires an explicit human go-ahead per the Step 9.1 instruction, not an automatic apply); if it is already `28` (or something else entirely, meaning it was manually changed), the `UPDATE`'s `WHERE` clause makes it a safe no-op or a signal of unexpected prior drift respectively |
| 15 | `20260921_phase2_commercial_model.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #13 (`cycles`), #1 | 10th | Adds `plan_snapshot_*` columns + redefines `enroll_subscription_atomic` again (3rd version) — idempotent DDL + `create or replace function` |
| 16 | `20260922_phase3_registration_capacity.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #10, #15 | 11th | Adds `hold_expires_at`, introduces `cohort_occupied_seats` v2 and `enroll_subscription_atomic` v4 |
| 17 | `20260923_phase3_atomic_activation_and_hold_race_fix.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #16 | 12th | `activate_subscription_atomic` — new function, idempotent `create or replace` |
| 18 | `20260924_phase4_refunds.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Base schema (`payments`) | 13th | New table `payment_refunds` + first refund RPC — idempotent |
| 19 | `20260925_phase4_refund_race_and_hardening.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #18 | 14th | Redefines refund RPCs (hardened versions) — idempotent `create or replace` |
| 20 | `20260926_phase5_exceptions_and_support.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Base schema | 15th | New tables `operational_exceptions`, `support_cases` + transition RPCs — idempotent |
| 21 | `20260926b_phase5_detection_sync.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #20 | 16th | `create or replace function sync_operational_exceptions()` — defining the function is idempotent; the function's own `insert` statements only execute when the function is later *called*, which is outside the scope of applying this migration file |
| 22 | `20260927_phase5_part_a_refinement_and_phase6_operations.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #20, #21, #8 (teacher applications), #13 | 17th | Adds recurrence columns + teacher activation/transfer/pause RPCs — idempotent |
| 23 | `20260928_phase6_makeup_credit_correction.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | Base schema (`makeup_credits`) | 18th | Makeup credit issue/cancel RPCs — idempotent |
| 24 | `20260929_phase7_readiness_and_system_health.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #13, #20 | 19th | New tables `readiness_blocker_overrides`, `webhook_events` + `complete_cycle_atomic` — idempotent |
| 25 | `20260930_phase8_admin_users_and_governance.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof | #12 (`admins.role`) | 20th | Adds `admins.active`/`admins.pending_email` + role/active/attendance-override RPCs — idempotent |
| 26 | `20261001_phase9_pre_correction_plan_mutation_and_capacity_defaults.sql` | APPLY_IF_MISSING | Local simulation only (Test 3/4 above) — not Production proof; never tested against a real environment | Base schema (`plans`) | 21st (last) | Single function `admin_update_plan_atomic` — idempotent `create or replace` |

## What Phase 9 does with this table next (not done in this step)

1. Run `supabase/phase9_database_reconciliation_readonly.sql` against the real project.
2. Re-open this manifest and change each row's Evidence column from "None" to the actual finding
   (table/function/constraint present or absent, signature match or mismatch).
3. Any row whose object is confirmed present becomes `VERIFIED_APPLIED` — with the evidence stated,
   never inferred.
4. Any row whose object is confirmed absent stays `APPLY_IF_MISSING` and is queued, in the "Safe
   ordering" sequence above, for actual application — which is a **later** step, not part of this
   read-only reconciliation.
5. Row #14 (`20260920_settings_foundation_extension.sql`) gets an explicit human decision recorded
   here once its live `pause_max_days` value is known.
6. Row #7 (`20260916_pending_payment_24h_expiry.sql`) never changes classification, regardless of
   what evidence turns up — its exclusion is a standing rule, not a pending question.
