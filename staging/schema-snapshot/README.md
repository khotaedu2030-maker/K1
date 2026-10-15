# KHOTA — isolated Staging schema parity

**Status (16 October 2026): COMPLETE for PostgreSQL schema, INCOMPLETE for app/real Auth testing.**

## Environment
- **STAGING ONLY** `iteskfrpeeclzshauxog` — name `khota-staging`, Singapore. Independent Supabase project created with a project price quote of **US $0/month**.
- **PRODUCTION — READ ONLY** `jylenzphqkmucwxqlzmq` — never run any of the DDL here.
- No production records, auth accounts, payments, emails or secrets were copied.

## Captured structure from production metadata (catalog queries only)
| Object | Production | Staging |
| --- | ---: | ---: |
| public tables / RLS enabled | 40 / 40 | 40 / 40 |
| columns | 407 | 407 |
| constraints | 201 | 201 |
| indexes | 77 | 77 |
| public functions | 33 | 33 |
| triggers | 1 | 1 |
| RLS policies | 32 original | 32, with 10 teacher guards added |
| authenticated SELECT table grants | 21 | 21 |
| authenticated direct INSERT/UPDATE/DELETE grants | 0 | 0 |
| anon direct table privileges | 0 | 0 |

**Pre-hardening MD5 fingerprints match exactly across production and staging** for table columns, all 201 constraints, all 77 indexes, all 33 public routine definitions and the trigger. This is stronger than counting objects, but does not cover every Supabase Auth/app configuration option.

## Installation record (already applied to Staging)
The initial 12-table synthetic test fixture was replaced **on staging only**, using transactional migrations. Each part succeeded:
- `01_public_tables.sql` — 40 tables, default grants revoked; includes a destructive reset explicitly gated to **empty / prior synthetic fixture only** and refuses any database with existing Auth users or 40 tables. **Never run against production**.
- `02_public_constraints.sql` — PK/unique/check/foreign keys.
- `03_public_indexes.sql` — non-constraint indexes.
- `04_public_functions.sql` — original function definitions; public/anon/authenticated execution revoked.
- `06_public_triggers.sql` — cohort-days trigger.
- `05_public_policies.sql` — 32 reviewed SELECT policies and RLS across all tables.
- `07_public_permissions.sql` — production-matching grants: 21 authenticated SELECT tables, no direct writes, no anon table grants, service_role full access.
- Then the reviewed **PR #55** SQL migration was applied to this **Staging project alone** and guarded the ten teacher policies. No production SQL migration occurred.
- `09_fixed_trigger_search_path.sql` — **staging-only** qualified `public.plans` and fixed `search_path` of the trigger helper; the cohort day-matching behavior was verified with valid and invalid synthetic cohorts.

**Do not run these files as a generic supabase migration series.** These are one-time catalog snapshots; installation order and staging-specific guards must be respected. No auto-deployment or merge to production.

## Behavioral test
`08_rollback_only_role_tests.sql` executed on the **production-shaped, separate Supabase Staging Postgres** service under `SET LOCAL ROLE authenticated` with synthetic `auth.users` and related test rows created *within a rollback-only transaction*. All **60/60 table checks** passed:
- Linked active teacher: ten tables visible.
- Active unrelated teacher: none.
- Disabled teacher: none.
- `active = NULL`: none.
- Correct parent: all ten, including old message history and former teacher profile.
- Unrelated parent: none.

After transaction completion, verified **zero** staging parent rows, children rows, payments rows and Auth users, so no test identity or customer data remains.

## Remaining tests / deployment hold
- The **Vercel plugin is not connected**, so the Vercel preview environment cannot yet be updated. Critically, some prior Vercel Preview environments have used the **production Supabase URL**. **DO NOT RUN E2E, signups, payments or synthetic test actions through any Preview until its production DB credentials have been replaced with the isolated staging URL and verified.**
- Genuine Supabase Auth sign-in/OTP and end-to-end app sessions via Vercel Preview **have not been tested**; SQL role impersonation is not a substitute.
- Keep Paylink payment creation/charges/webhooks disabled in preview, and configure test-only secrets separately. Do not reuse the production service_role key or Auth configuration.
- PostgREST exposed schemas should be verified through Supabase API Settings: `khota_rls` must **not** be listed; its two functions are caller-scoped and EXECUTE only to authenticated, with an empty fixed search path.
- Check expired-subscription teacher visibility against privacy/retention expectations; not fixed by PR #55.
- Current Supabase Security Advisor for stage reports only 19 INFO `rls_enabled_no_policy` entries for intentionally restricted tables. The mutable search_path warning was fixed *on stage only*.
- PR #55 remains draft and must not be merged or applied to production without explicit user approval after real Auth/API/UI staging tests.

## Important production safety
The `staging/` branch and its SQL files are not release migrations. Do **not** merge or run them on production; the snapshot is a staging reconstruction artifact. In particular, 01_public_tables.sql drops disposable fixture tables and must not be copied into normal migrations.
