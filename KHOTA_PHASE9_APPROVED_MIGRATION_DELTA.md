# KHOTA — Phase 9 Approved Migration Delta

**Status: POPULATED with real Production evidence (20 Sep 2026 read-only diagnostic).** This
supersedes the previous revision of this document, which was a deliberately empty template written
before any real Production evidence existed.

## What changed since the template revision

The template (previous revision, Step 9.1) said the delta could only be computed once actual
Production diagnostic evidence existed. That evidence now exists — a read-only check against the
real KHOTA Supabase Production database, run 20 Sep 2026, confirmed:

- `platform_settings` **exists** but with an **old key/value schema** (`id uuid, key text, value
  jsonb, description text, created_at, updated_at`) — not the typed singleton row every Admin OS
  migration and this codebase's TypeScript assumed.
- **Missing tables**: `cycles`, `operational_exceptions`, `payment_refunds`,
  `readiness_blocker_overrides`, `support_cases`, `webhook_events`.
- **Missing columns**: `admins.active`, `admins.role`, `cohorts.cycle_id`,
  `subscriptions.hold_expires_at`, `subscriptions.plan_snapshot_name`,
  `subscriptions.plan_snapshot_price_sar`, `teachers.application_id`.
- **Confirmed present**: `admin_actions.reason`.

This means Production is real-evidence-confirmed to be **largely pre-Admin-OS**, consistent with
`KHOTA_PHASE9_MIGRATION_MANIFEST.md`'s conservative `APPLY_IF_MISSING` classifications, but now with
actual proof instead of "assume nothing is applied, be safe either way."

## The delta is no longer "apply these individual migration files" — it is one migration

Given the `platform_settings` incompatibility (see `KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md` for the
full reasoning) and a second, independently-discovered problem — several Admin-OS columns
(`admins.role`, `cohorts.cycle_id`, `cohorts.grade`, `subscriptions.hold_expires_at`) are folded
directly into their table's base `create table if not exists` statement in `supabase/schema.sql`
rather than kept as their own `alter table ... add column`, which means naively replaying
`schema.sql`'s base table definitions against Production's *already-existing* tables would silently
no-op and never add these columns — the safe path is **not** to apply the 20 relevant individual
historical migration files one by one. Instead, this pass built **one** new, reviewed, reconciled
migration:

**`supabase/migrations/20261002_phase9_production_reconciliation.sql`**

This single file supersedes applying migrations #1–6, #8, #10–13, #15–26 (see table below)
individually — it already contains their final, reconciled net effect (each function/table/column in
its one final approved form, not intermediate versions later overwritten), plus the two fixes above
that no individual historical file gets right against the real Production shape. **Do not also apply
the individual files listed as `SUPERSEDED_BY_20261002` below — doing so would be redundant at best
(their idempotent `if not exists` guards would mostly just no-op) and would reintroduce the
`platform_settings`/folded-column problems at worst** (specifically: `20260917_platform_settings.sql`
and `20260920_settings_foundation_extension.sql`, which must never be applied against Production's
real `platform_settings` table under any circumstance — see below).

## Fixed exclusions (true regardless of any further diagnostic result)

| Migration | Status | Reason |
|---|---|---|
| `20260916_pending_payment_24h_expiry.sql` | `DO_NOT_APPLY` — always | Superseded by `20260917_seat_hold_alignment_and_atomic_admin_rpc.sql`'s logic, which `20261002_phase9_production_reconciliation.sql` installs directly (accounting for Paylink-pending holds in seat occupancy). Applying this file would reintroduce a seat-occupancy bug. |
| `20260917_platform_settings.sql` | `DO_NOT_APPLY` — always, given real evidence | Assumes `platform_settings` does not exist yet and creates it as a typed singleton (`id boolean`). Production's real `platform_settings` already exists with a completely different, incompatible key/value schema (`id uuid`). Applying this file's `insert into platform_settings (id) values (true)` against the real table would fail outright (`invalid input syntax for type uuid: "true"`), and even if it didn't, `create table if not exists` would silently no-op against the real table, never producing the typed columns the application needs. Superseded by SECTION 0 of `20261002_phase9_production_reconciliation.sql`, which creates a new, separate table (`admin_platform_settings`) instead and leaves the real `platform_settings` untouched. |
| `20260920_settings_foundation_extension.sql` | `DO_NOT_APPLY` — always, given real evidence | Same root problem as above, compounded: its `update platform_settings set pause_max_days = 28 where pause_max_days = 30` would fail outright against the real table (no `pause_max_days` column exists there at all). Superseded by the same SECTION 0. |

## Delta table — final status per historical migration file

| # | Migration file | Status | Evidence | Notes |
|---|---|---|---|---|
| — | *(untracked base-schema baseline)* | `ASSUMED_PRESENT` | Confirmed by evidence: `admins`, `cohorts`, `subscriptions`, `teachers`, `admin_actions`, `platform_settings` (old shape) all already exist | Not a migration file; the base tables these Admin-OS migrations alter are confirmed present |
| 1 | `20260906_multi_stage_support.sql` | `SUPERSEDED_BY_20261002` | — | Net effect installed via 20261002 |
| 2 | `20260908_fix_duplicate_sessions.sql` | `SUPERSEDED_BY_20261002` | — | Net effect installed via 20261002 |
| 3 | `20260908b_enforce_plan_days_integrity.sql` | `SUPERSEDED_BY_20261002` | — | Net effect installed via 20261002 |
| 4 | `20260916_admin_actions_log.sql` | `ALREADY_SATISFIED` | `admin_actions.reason` confirmed present (implies table exists) | 20261002 includes a no-op-safe `create table if not exists` for completeness; changes nothing |
| 5 | `20260916_contact_requests.sql` | `SUPERSEDED_BY_20261002` | Not directly checked by diagnostic; `create table if not exists` is safe either way | Net effect installed via 20261002 |
| 6 | `20260916_paylink_pending_uniqueness.sql` | `SUPERSEDED_BY_20261002` | Not directly checked; idempotent index creation included in 20261002 SECTION 1 | Net effect installed via 20261002 |
| 7 | `20260916_pending_payment_24h_expiry.sql` | `DO_NOT_APPLY` (fixed) | Superseded | Excluded |
| 8 | `20260916_teacher_applications.sql` | `SUPERSEDED_BY_20261002` | Not directly checked; `create table if not exists` is safe either way | Net effect installed via 20261002 |
| 9 | `20260917_platform_settings.sql` | `DO_NOT_APPLY` (fixed, see above) | Confirmed incompatible with real `platform_settings` shape | Excluded — replaced by `admin_platform_settings` |
| 10 | `20260917_seat_hold_alignment_and_atomic_admin_rpc.sql` | `SUPERSEDED_BY_20261002` | — | Final RPC versions installed via 20261002 |
| 11 | `20260918_grade_exact_and_action_reason.sql` | `SUPERSEDED_BY_20261002` (`admin_actions.reason` part `ALREADY_SATISFIED`) | `admin_actions.reason` confirmed present; `cohorts.grade` not checked | 20261002 SECTION 3 adds `cohorts.grade` explicitly (folded-column fix) |
| 12 | `20260919_admins_role_backfill.sql` | `SUPERSEDED_BY_20261002` (folded-column fix applied) | `admins.role` confirmed MISSING | 20261002 SECTION 3 adds it via the exact original standalone `alter table` statement, not via schema.sql's folded base-table version |
| 13 | `20260919_cycles_foundation.sql` | `SUPERSEDED_BY_20261002` | `cycles` confirmed MISSING | Table created via 20261002 SECTION 2 |
| 14 | `20260920_settings_foundation_extension.sql` | `DO_NOT_APPLY` (fixed, see above) | Confirmed incompatible with real `platform_settings` shape | Excluded — replaced by `admin_platform_settings` |
| 15 | `20260921_phase2_commercial_model.sql` | `SUPERSEDED_BY_20261002` (folded-column fix applied) | `cohorts.cycle_id`, `subscriptions.plan_snapshot_*` confirmed MISSING | 20261002 SECTION 3 adds `cohorts.cycle_id` explicitly |
| 16 | `20260922_phase3_registration_capacity.sql` | `SUPERSEDED_BY_20261002` (folded-column fix applied) | `subscriptions.hold_expires_at` confirmed MISSING | 20261002 SECTION 3 adds it explicitly; `enroll_subscription_atomic` patched to read `admin_platform_settings` instead of `platform_settings` |
| 17 | `20260923_phase3_atomic_activation_and_hold_race_fix.sql` | `SUPERSEDED_BY_20261002` | — | Final RPC version installed via 20261002 |
| 18 | `20260924_phase4_refunds.sql` | `SUPERSEDED_BY_20261002` | `payment_refunds` confirmed MISSING | Table + RPCs installed via 20261002 |
| 19 | `20260925_phase4_refund_race_and_hardening.sql` | `SUPERSEDED_BY_20261002` | — | Final (hardened) RPC versions installed via 20261002 |
| 20 | `20260926_phase5_exceptions_and_support.sql` | `SUPERSEDED_BY_20261002` | `operational_exceptions`, `support_cases` confirmed MISSING | Tables + RPCs installed via 20261002 |
| 21 | `20260926b_phase5_detection_sync.sql` | `SUPERSEDED_BY_20261002` (obsolete version excluded) | — | Only the FINAL `sync_operational_exceptions()` (from #22 below) is installed — this file's earlier version is deliberately not replayed |
| 22 | `20260927_phase5_part_a_refinement_and_phase6_operations.sql` | `SUPERSEDED_BY_20261002` | `teachers.application_id` confirmed MISSING | Final `sync_operational_exceptions()`, teacher activation, cohort transfer, pause RPCs installed via 20261002 |
| 23 | `20260928_phase6_makeup_credit_correction.sql` | `SUPERSEDED_BY_20261002` | — | Makeup credit RPCs installed via 20261002 |
| 24 | `20260929_phase7_readiness_and_system_health.sql` | `SUPERSEDED_BY_20261002` | `readiness_blocker_overrides`, `webhook_events` confirmed MISSING | Tables + `complete_cycle_atomic` installed via 20261002 |
| 25 | `20260930_phase8_admin_users_and_governance.sql` | `SUPERSEDED_BY_20261002` | `admins.active` confirmed MISSING | `admins.active`/`pending_email` + role/active/attendance-override RPCs installed via 20261002 |
| 26 | `20261001_phase9_pre_correction_plan_mutation_and_capacity_defaults.sql` | `SUPERSEDED_BY_20261002` | — | `admin_update_plan_atomic` installed via 20261002 |

## What "apply the delta" means on Sunday

**One migration, once**: `supabase/migrations/20261002_phase9_production_reconciliation.sql`. This
is GATE 3 of `KHOTA_SUNDAY_GO_LIVE_RUNBOOK.md`. Do not additionally apply any of the individual files
marked `SUPERSEDED_BY_20261002`, `ALREADY_SATISFIED`, or `DO_NOT_APPLY` above.

Before applying it: re-run `supabase/phase9_database_reconciliation_readonly.sql` (GATE 1) to confirm
the 20 Sep 2026 evidence this migration was built from is still accurate — if the real database has
changed in the meantime (someone else applied something, or a previous Sunday attempt partially ran),
re-check the new diagnostic output against this document's evidence column before proceeding, since
this migration's design (in particular the platform_settings decision) depends on that evidence
being current. The migration itself is fully idempotent (`if not exists` / `create or replace`
throughout, verified by two consecutive local applications — see
`KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md`), so re-running it after a partial or even a prior
successful run is always safe.

After applying it: run `supabase/phase9_post_migration_verification.sql` (GATE 4) to confirm the
result matches what this migration was designed to produce.

## Explicit non-goals of this document

- This is not a claim that Production's state is unchanged since 20 Sep 2026 — GATE 1's fresh
  diagnostic run on Sunday is what actually confirms that, and must be re-checked before applying
  anything, per above.
- This is not a claim that every object in Production was individually re-verified — several
  objects (`cohorts.grade`, `teacher_applications`, `contact_requests`, `makeup_credits`,
  `subscription_pauses`, `uq_paylink_one_pending_per_subscription`) were not explicitly checked by
  the diagnostic; the reconciliation migration handles their unknown status safely via `if not
  exists` guards throughout, so their exact current state does not change what Sunday needs to do.
- This is not a claim that local PostgreSQL simulation (see the migration manifest and
  `KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md`) is equivalent to real Production verification — it is
  strong syntax/ordering/idempotency/data-preservation evidence, not a substitute for GATE 1 and
  GATE 4 against the real database on the day.
