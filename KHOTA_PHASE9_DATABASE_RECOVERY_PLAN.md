# KHOTA — Phase 9 Database Recovery Plan

Covers `supabase/migrations/20261002_phase9_production_reconciliation.sql` only. Written for
whoever is at the keyboard on Sunday (owner or developer) if something goes wrong while applying it.
This is not a script to run automatically — it is a set of decisions and manual steps, because a
reckless automatic rollback is more dangerous than a calm manual one for a migration that touches
this much of the schema.

## The core fact that makes recovery simple

Every statement in this migration is additive: `create table if not exists`, `add column if not
exists`, `create or replace function`, `create index if not exists`, one `drop function if exists`
(an obsolete overload that, if it exists at all, is a leftover from a previous *partial* run of an
older, different migration file — not something any current code calls), and one `insert ... on
conflict (id) do nothing`. **Nothing in this migration drops a table, drops a column, deletes a row,
or changes the type of an existing column.** The legacy `platform_settings` key/value table is never
even queried by it, let alone modified. This means recovery almost never means "undo" — it usually
means "finish applying it, or leave it exactly where it stopped, and the database is still in a
fully valid, safe state either way."

## If the migration fails BEFORE it commits

The whole file is wrapped in `begin; ... commit;`. If any statement inside fails, PostgreSQL rolls
back everything in that transaction automatically — the database ends up in exactly the state it was
in before you ran the file. Nothing is half-applied.

**What to do:**
1. Read the exact error message and note which statement/section it failed on (the file is divided
   into numbered `SECTION` comment blocks for this reason).
2. Do not re-run the file blindly. First run
   `supabase/phase9_post_migration_verification.sql` (Sections 1 and 3 especially) to confirm the
   database really is back to its pre-migration state and nothing partial survived.
3. Compare the failing statement against the real, current database state — the most likely causes
   are: (a) the diagnostic evidence this migration was built from (20 Sep 2026) is now stale because
   something else changed the database since then, or (b) an assumption this migration makes about
   an object Production evidence didn't explicitly check (see the "NOT checked by the diagnostic"
   list in the migration's own header comment) turned out to be wrong.
4. Fix the specific statement, re-verify it doesn't reintroduce a problem for anything already
   confirmed safe, and try again. Do not skip straight to `DROP` or manual data surgery.
5. If the cause isn't obvious within a few minutes, stop for the day. This migration has not touched
   anything — the database is exactly as it was this morning. There is no time pressure to force it
   through.

## If the migration COMMITS but app deployment is delayed

This is the most likely "partial" scenario, and it is safe.

**Is the OLD (currently-deployed, pre-Admin-OS) app still compatible with the database after this
migration runs?** Yes. The old app only ever reads/writes the tables and columns it already knows
about (parents, children, teachers, cohorts, subscriptions, payments, plans, the legacy
`platform_settings` key/value table, etc.) — none of which this migration removes, renames, or
changes the type of. The six new tables (`cycles`, `operational_exceptions`, `payment_refunds`,
`readiness_blocker_overrides`, `support_cases`, `webhook_events`) and the new columns
(`admins.role`/`active`, `cohorts.cycle_id`/`grade`, `subscriptions.hold_expires_at`/
`plan_snapshot_*`, `teachers.application_id`) and the new `admin_platform_settings` table are all
inert to the old app — it never queries them, so it behaves exactly as it did before the migration.

**What to do:** nothing urgent. The database can sit in its post-migration state indefinitely with
the old app still running against it, with zero functional difference to real users. Deploy the new
app (GATE 6–9 of the runbook) whenever it's actually ready — there is no rush created by having
already applied this migration.

## If the NEW app is deployed but something about the reconciliation looks wrong afterward

Run `supabase/phase9_post_migration_verification.sql` in full and compare every section's result
against what it says to expect (each section has an inline comment describing the expected outcome).
In particular:

- **Section 10** (`inactive_or_null_admins` must be 0): if this is ever non-zero right after the
  migration, an existing admin account did not get `active = true` / `role = 'super_admin'`
  automatically — this would be a serious problem (a real admin locked out), but the migration's own
  `add column ... not null default true` / `default 'super_admin'` design makes this
  structurally very unlikely; if it somehow happens, manually setting `active = true` on the
  affected `admins` row via a targeted `UPDATE ... WHERE id = '<that row>'` (never a blanket
  update) is safe and does not require touching anything else.
- **Section 11** (row counts): if any core table's row count is *lower* than it was immediately
  before the migration, something other than this migration deleted rows in between — this migration
  itself contains no `DELETE` statement anywhere, so it cannot be the cause. Investigate what else
  touched the database in that window before assuming this migration is responsible.
- **Section 2** (legacy `platform_settings`): if its column list or row count changed at all, that
  is unexpected and worth investigating immediately, since nothing in this migration should touch it
  — most likely explanation is a different, unrelated change happened to the database around the
  same time, not this migration.

## Restoring service without deleting customer data

There should never be a need to delete anything to "restore service" after this migration, because
it never removes access to anything the old or new app needs. If the new app deployment itself has a
problem unrelated to the database (a bad build, a bad environment variable), the fix is to roll back
the **application deployment** (Vercel keeps previous deployments — "Promote to Production" on the
last known-good one, per GATE 8 of the runbook), not the database. The database in its
post-reconciliation state is compatible with both the old and the new app, so an application-level
rollback needs no matching database rollback.

## If, despite all of the above, an actual rollback of this migration is genuinely necessary

This should be rare given everything above, but if a real, specific, understood reason requires
reverting the schema changes themselves (not just the app deployment):

1. **Do this with a human who understands the current database state at that moment, not by running
   a pre-written undo script.** A generic rollback script written today, before knowing what state
   the database will actually be in when it's needed, is exactly the kind of "reckless automatic
   rollback" this plan is written to avoid.
2. The six new tables can be dropped safely IF AND ONLY IF no real data has been written into them
   yet (check row counts first — `select count(*) from cycles`, etc. for each). If any of them have
   real rows, dropping the table destroys that data — stop and reconsider whether reverting is really
   what's needed, versus just leaving the schema in place and reverting only the application code.
3. The new columns (`admins.role`/`active`, `cohorts.cycle_id`/`grade`, `subscriptions.hold_expires_at`/
   `plan_snapshot_*`, `teachers.application_id`) should generally be left in place even if the new
   app is rolled back — they are nullable or have safe defaults, the old app ignores them entirely,
   and dropping a column is a one-way, immediately-destructive operation that this plan recommends
   avoiding unless there is a specific, concrete reason tied to that exact column.
4. `admin_platform_settings` can be dropped safely if no admin has used the new Settings page yet
   (check `updated_by is null` on its single row as a proxy — if it's still exactly the seeded
   defaults, nothing has been customized there yet).
5. The legacy `platform_settings` table is never a candidate for any rollback action — this migration
   never touched it in the first place.

## What this plan deliberately does not include

No `DROP TABLE`/`DROP COLUMN` script is provided pre-written and ready to run. Given how additive and
low-risk this migration is, writing a ready-to-fire destructive script in advance would create more
risk (someone running it reflexively under pressure) than it would save time in the genuinely rare
case it's needed. If that rare case arises, steps 1–5 above are the guide for building the *specific*
statements needed at that moment, with a human who can see the actual current data.
