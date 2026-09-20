# KHOTA — Phase 9 / Step 9.2A — Production Delta Report

Ties together the real Production evidence (20 Sep 2026), what it changed about the plan, the
migration built from it, how that migration was tested, the application-code changes made alongside
it, and what is and is not verified as of this report. Written for the person reviewing this before
Sunday's go-live runbook, not for a machine.

**Companion documents**, each covering one piece in depth:
- `KHOTA_PHASE9_APPROVED_MIGRATION_DELTA.md` — the authoritative "what to actually apply" statement,
  with the full per-historical-file disposition table.
- `KHOTA_PHASE9_MIGRATION_MANIFEST.md` — Revision 3: per-file classification, now annotated against
  real evidence.
- `supabase/migrations/20261002_phase9_production_reconciliation.sql` — the migration itself, with an
  extensive header comment covering the same ground as this report at the SQL level.
- `supabase/phase9_post_migration_verification.sql` — the SELECT-only script to run after applying the
  migration to a real database (staging or Production).
- `KHOTA_PHASE9_DATABASE_RECOVERY_PLAN.md` — what to do if something goes wrong while applying it.

---

## 1. What changed this round: real evidence, not assumptions

Every earlier Phase 9 pass reasoned about Production from the repository's own migration history —
"if every migration file were applied in order, Production would look like X." That was always a
statement about the *files*, never a statement about the *actual database*. This round, for the first
time in this engagement, real read-only diagnostic output from the actual KHOTA Supabase Production
database (20 Sep 2026) was provided. It said three things that the file-history approach could not
have predicted:

**A) `platform_settings` exists, but not as this codebase's migrations assume.** Every Admin-OS
migration and every line of `src/lib/platform-settings.ts` assumed a typed singleton table
(`20260917_platform_settings.sql`: `id boolean primary key default true check (id = true)`, plus ten
typed columns). Production's real `platform_settings` table is an old key/value table: `id uuid`,
`key text`, `value jsonb`, `description text`, `created_at`/`updated_at timestamptz`. None of the typed
columns (`pause_min_days`, `pause_max_days`, `makeup_monthly_limit`, `registration_enabled`,
`seat_hold_hours`, `attendance_lock_hours`, `default_capacity_1_3/4_6/7_9/10_12`) exist there. This is
not a partially-migrated version of the typed table — it is a structurally different table that
happens to share a name.

**B) Six Admin-OS tables are missing entirely:** `cycles`, `operational_exceptions`,
`payment_refunds`, `readiness_blocker_overrides`, `support_cases`, `webhook_events`.

**C) Specific columns are missing, specific columns already exist:** `admin_actions.reason` exists.
`admins.active`, `admins.role`, `cohorts.cycle_id`, `subscriptions.hold_expires_at`,
`subscriptions.plan_snapshot_name`, `subscriptions.plan_snapshot_price_sar`,
`teachers.application_id` are all missing.

**The interpretation this forces:** Production is largely pre-Admin-OS, with some earlier/manual
changes already present (the old-style `platform_settings` table itself is presumably one such manual
addition, predating the Admin-OS migration set entirely). Treating "apply every migration file in
order" as safe would have been wrong in at least two ways — it would have tried to create
`platform_settings` as a typed table when an incompatibly-shaped table of that name already exists
(migration failure, or worse, silent data risk depending on the exact statement), and it would have
run `20260920_settings_foundation_extension.sql`'s conditional `UPDATE ... SET pause_max_days = 28
WHERE pause_max_days = 30` against a table that has never had a `pause_max_days` column.

## 2. A second, independent problem found while building the fix

While assembling the replacement migration from `supabase/schema.sql` (the repository's
hand-consolidated "final state" file), a second problem was found that the diagnostic evidence did not
directly surface, because it's a property of the *files*, not of Production:

**The folding trap.** `schema.sql` folds four Admin-OS columns directly into their table's *base*
`create table if not exists` statement, instead of keeping them as their own `alter table ... add
column if not exists` (the pattern every other Admin-OS column addition uses). The four:
`admins.role`, `cohorts.cycle_id`, `cohorts.grade`, `subscriptions.hold_expires_at`.

This matters because `admins`, `cohorts`, and `subscriptions` **already exist** in Production (they're
core pre-Admin-OS tables). `create table if not exists` against a table that already exists is a
no-op — PostgreSQL doesn't diff the column list and add what's missing, it just does nothing. So if
`schema.sql`'s base table statements had been replayed against Production verbatim (a reasonable-
sounding "just run the consolidated file" approach), these four columns would **never** have been
added, silently, with no error to catch it.

This was found by systematically diffing every `alter table ... add column if not exists` statement
across every historical migration file against the surviving standalone-ALTER statements in
`schema.sql` (`comm -23` on sorted, normalized statement lists), then manually confirming the
multi-line-formatted exceptions the automated diff missed (`admins.role`'s ALTER spans three lines with
a `check (...)` clause, which a single-line grep pattern doesn't catch).

**Fix:** the new migration adds these four columns as their own explicit `alter table ... add column
if not exists` statements (SECTION 3), sourced verbatim from each column's original historical
migration file, positioned after the tables and dependencies they need already exist.

## 3. The `platform_settings` reconciliation decision

Section 2 of the original Phase 9 instruction called this "critical" and asked for the least
destructive solution. Three options were considered:

1. **Convert the key/value table into the typed table.** Rejected outright — this is exactly the
   destructive rewrite the instruction prohibits. It would require knowing every real key currently
   stored, migrating each into a differently-typed column, and handling whatever keys don't map to any
   known typed column. Far too much unknown risk for a table holding real, currently-relied-upon data.
2. **Build a pivot view (or RPC) over the key/value table**, translating rows into the typed shape the
   application code expects. Considered seriously, but rejected: this round's evidence tells us the
   table's *shape* (columns), not its *contents* (what keys actually exist, what their value shapes
   are). Building a view that pivots on assumed key names risks two failure modes — either the assumed
   keys don't exist and the view silently returns nothing (no better than hardcoded defaults, but with
   the added complexity and failure surface of a view), or worse, an assumed key coincidentally matches
   a real key holding something unrelated, and the view returns garbage typed data into a live
   application.
3. **Leave the legacy table completely alone; create a new, separate, additive typed table.** Chosen.
   `admin_platform_settings` is a new singleton table (`id boolean primary key default true check (id
   = true)`, the same practical shape the original `20260917_platform_settings.sql` intended, just
   under a name that cannot collide with anything already in Production), seeded once via `insert ...
   on conflict (id) do nothing` with exactly the required defaults (§2 of the original instruction):
   `registration_enabled = true`, `seat_hold_hours = 24`, `attendance_lock_hours = 24`,
   `default_capacity_1_3 = 3`, `default_capacity_4_6 = 4`, `default_capacity_7_9 = 5`,
   `default_capacity_10_12 = 5`, `pause_min_days = 7`, `pause_max_days = 28`,
   `makeup_monthly_limit = 2`. The legacy `platform_settings` table's name, schema, and every existing
   row are never touched — no code path in this reconciliation queries it, alters it, or reads its
   rows.

This satisfies every requirement in the instruction: no existing setting lost (nothing in the legacy
table is touched), no `DROP TABLE`, no destructive rewrite, existing code that happens to read the
legacy key/value table (none was found — see §4) keeps working because nothing about that table
changed, and new Admin-OS settings work immediately against the new table with the exact required
defaults.

## 4. Application code changes

A grep sweep of `src/` for every `.from("platform_settings")` call found exactly four direct
consumers, and no other code (application or RPC) reads that table by any other means:

| File | What it did | Change |
|---|---|---|
| `src/lib/platform-settings.ts` | `getRuntimeSettings()` — the single TS source-of-truth for runtime settings, consumed across the app | Retargeted to `admin_platform_settings` |
| `src/app/api/admin/settings/route.ts` | Settings save API route | Retargeted the `current` read and the `admin_actions.entity_type` audit value to `admin_platform_settings` |
| `src/app/admin/settings/page.tsx` | Admin settings UI | Retargeted the query; updated the fallback-state UI text (previously named `platform_settings` / `20260917_platform_settings.sql`) to name `admin_platform_settings` / `20261002_phase9_production_reconciliation.sql` |
| `src/app/admin/groups/page.tsx` | Default-capacity lookup for new cohort creation | Retargeted the query |

Worth noting explicitly: `src/lib/platform-settings.ts`'s `getRuntimeSettings()` already had a
graceful fallback to hardcoded defaults on any query error before this change — meaning even before
today's fix, the application was already "failing safe" (falling back to defaults) against
Production's incompatible real table shape rather than crashing. `src/app/api/admin/settings/route.ts`
did not have that same protection — it would have returned a hard 500
(`"الإعدادات غير مُهيَّأة بعد"`) against the real table shape. Both are now correct rather than merely
safe-by-accident.

Grep confirms zero remaining `.from("platform_settings")` calls anywhere in `src/` after these four
edits. Brace/paren balance was checked on all four files (all balanced) as a lightweight sanity check
in the absence of a working `tsc`/build (see §6).

## 5. The migration: `supabase/migrations/20261002_phase9_production_reconciliation.sql`

One file, 2,209 lines, wrapped in a single `begin; ... commit;` transaction. It is not a concatenation
of historical migration files — it is the final reconciled target state, assembled by extracting the
correct final version of each object directly from `supabase/schema.sql` (skipping every
now-superseded intermediate version, e.g. the obsolete 10-parameter `admin_update_platform_settings`
overload that an earlier historical migration created and a later one replaced) and adding the
Step-9.2A-specific sections (the new settings table, the four folded-trap ALTERs) by hand.

Section-by-section:

| Section | Contents |
|---|---|
| 0 | New `admin_platform_settings` table (18 typed columns, RLS enabled, seeded defaults); `drop function if exists` for the obsolete 10-param `admin_update_platform_settings` overload; final 17-param version retargeted to the new table |
| 1 | `uq_paylink_one_pending_per_subscription` index; `teacher_applications`, `contact_requests`, `admin_actions` base tables |
| 2 | `cycles` table (confirmed missing) |
| 3 | The four folding-trap ALTERs: `admins.role`, `cohorts.cycle_id`, `cohorts.grade`, `subscriptions.hold_expires_at` |
| 4 | `cohort_occupied_seats`, `cohort_available_seats`, `public_cohorts_catalog`, `admin_update_cohort_operations_atomic` |
| 5 | Subscription snapshot/hold columns, status check, `enroll_subscription_atomic` (patched to reference `admin_platform_settings` instead of `platform_settings`) |
| 6 | `activate_subscription_atomic`, `payment_refunds` table (confirmed missing), refund RPCs |
| 7 | `operational_exceptions`, `support_cases` (both confirmed missing), their transition RPCs |
| 8 | Final `sync_operational_exceptions`, teacher activation, cohort transfer, pause RPCs, makeup RPCs, `readiness_blocker_overrides`/`webhook_events` tables (confirmed missing), `complete_cycle_atomic`, `override_readiness_blocker_atomic` |
| 9 | `admins.active`/`pending_email` (active confirmed missing), admin role/active RPCs, attendance override, `admin_update_plan_atomic` |

Every statement is additive: `create table if not exists`, `add column if not exists`, `create or
replace function`, `create index if not exists`, one justified `drop function if exists` (an obsolete,
non-callable overload — not live data), one `insert ... on conflict (id) do nothing`. No `DROP TABLE`,
no `DROP COLUMN`, no `DELETE`, no destructive `ALTER ... TYPE`, anywhere in the file.

## 6. How this was tested

No connection to any real Supabase instance (staging or Production) was available in this sandbox, and
none was used — consistent with the instruction's prohibition on executing SQL against Production.
Instead, a **Production-evidence-accurate** local PostgreSQL 16 baseline was built (not a generic
approximation): starting from `schema.sql`, the four folded-trap columns were surgically removed from
their base table definitions, the six confirmed-missing tables were excluded, and the real
key/value-shaped `platform_settings` table plus `admin_actions.reason` were substituted for their
schema.sql equivalents, to match every specific fact in the evidence exactly.

Tests actually run, with real output (not static review):

1. **Baseline matches evidence.** Applied the reconstructed baseline to a fresh database; confirmed by
   query that every missing table/column in the evidence is genuinely absent, and the real
   `platform_settings` shape and `admin_actions.reason` are genuinely present.
2. **Migration applies cleanly.** Applied `20261002_phase9_production_reconciliation.sql` to that
   baseline — exit 0, zero errors.
3. **Idempotency.** Applied it a second time, immediately after — exit 0, zero errors, no duplicate
   rows in the seeded `admin_platform_settings` singleton.
4. **Data preservation.** Seeded a separate copy of the baseline with representative legacy rows across
   ten tables (parent, child, teacher, plan, cohort, subscription, payment, `platform_settings`
   key/value rows, admin, `admin_action`) before migrating. After migration: every row still exists,
   every primary ID is unchanged, every relationship is unchanged, payment amount/status is unchanged,
   subscription state is unchanged, the seeded `platform_settings` key/value rows are byte-identical,
   the legacy cohort's `cycle_id` stayed `NULL` (no fake Cycle was invented), and the existing admin row
   safely became `role = 'super_admin', active = true` with zero lockout risk. Ran the migration a
   second time against this data-populated database too — idempotency holds with real data present, not
   just against an empty schema.
5. **Object-level verification.** Confirmed all 25 expected RPC signatures exist and match; confirmed
   the obsolete 10-param overload is genuinely gone; confirmed least-privilege `EXECUTE` grants (the
   five admin-only RPCs spot-checked grant only the table owner and `service_role` — never `anon`/
   `authenticated`; the two intentionally-public catalog/availability RPCs correctly include them);
   confirmed all five required protective indexes exist; confirmed RLS is enabled on every new/modified
   table.
6. **The verification script verifies itself.** `supabase/phase9_post_migration_verification.sql` was
   actually executed against the migrated database (not just reviewed) — every one of its 11 sections
   returned exactly the expected result, which also validates the verification script's own
   correctness for when it's run against real Production after Sunday's apply step.

**What this testing does not, and cannot, cover:** the local simulation is built from the diagnostic
evidence's *stated facts*, not a full pg_dump of Production. Anything about Production's real schema
that the 20 Sep diagnostic did not explicitly check (see the "NOT checked by the diagnostic" list in
the migration file's own header comment — e.g., exact column types/nullability on tables not listed
in evidence §C, existing RLS policies on pre-existing tables, existing triggers beyond the ones this
codebase's own migrations are known to have created) is an assumption, not a verified fact. This is
inherent to working from read-only diagnostic evidence rather than a live connection, and is why the
runbook still calls for re-confirming evidence currency immediately before applying on Sunday, not
relying on this round's snapshot indefinitely.

## 7. Build/typecheck status

`npm install --no-audit --no-fund` returns `403 Forbidden - GET https://registry.npmjs.org/...`
immediately, exactly as in every prior round of this engagement. Per the instruction ("do not
repeatedly retry"), this was attempted once this round and not retried further.

**Status: `BUILD_NOT_VERIFIED_EXTERNAL_403`.** No `tsc --noEmit` or `next build` has ever succeeded in
this sandbox, for any round of this engagement — this is an environment limitation (no package
registry access), not evidence about the code's correctness one way or the other. The four edited
files were checked for brace/paren balance as a lightweight substitute; this is not a substitute for an
actual type check and is not represented as one.

## 8. Final disposition of the historical migration files

Restated here for completeness; the authoritative version with full per-file reasoning is
`KHOTA_PHASE9_APPROVED_MIGRATION_DELTA.md`.

- **`DO_NOT_APPLY`, unconditionally, all three:** `20260916_pending_payment_24h_expiry.sql`
  (superseded by `20260917_seat_hold_alignment_and_atomic_admin_rpc.sql`),
  `20260917_platform_settings.sql` (assumes a typed table that was never Production's real
  `platform_settings`), `20260920_settings_foundation_extension.sql` (extends a typed table/column set
  that doesn't exist in Production; its conditional `UPDATE` has no column to target).
- **Every other historical migration file:** superseded, for Sunday's apply purposes, by
  `20261002_phase9_production_reconciliation.sql` — its net effect is the reconciled sum of every
  legitimate historical migration except the three above. Applying the historical files individually
  is no longer the plan; applying the one reconciliation file is.

## 9. What is, and is not, being claimed

**Is being claimed:** the reconciliation migration is additive, was built from real Production
evidence (not assumption), is transactional, was tested by actually executing it (multiple times,
including with seeded legacy data) against a Production-shaped local simulation, and every object it
was designed to produce was confirmed present afterward by an actually-executed verification query —
not by reading the SQL and reasoning about what it should do.

**Is not being claimed:** that this migration has been run against Production, staging, or any real
Supabase instance. That every fact about Production's actual current schema is known — only the facts
the 20 Sep 2026 diagnostic explicitly checked are known; everything else is an informed assumption
consistent with "largely pre-Admin-OS." That the application builds — `npm install`'s 403 in this
sandbox means no build has ever been verified in this engagement, this round included. That secrets
have been reviewed, rotated, or checked (out of scope for this step; §6 of
`KHOTA_ADMIN_OS_FINAL_READINESS.md` remains authoritative there).

## 10. Verdict

**`PRODUCTION_DELTA_READY_FOR_REVIEW`**

The migration, verification script, and recovery plan are built, internally consistent, and tested as
thoroughly as a sandbox without a live Supabase connection allows. No SQL has been executed against
Production. No push, merge, or deploy has occurred. Nothing here should be treated as "apply it" —
review is the next step, per the instruction's explicit final gate.
