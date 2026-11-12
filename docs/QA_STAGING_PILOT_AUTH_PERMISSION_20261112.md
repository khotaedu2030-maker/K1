# KHOTA — Staging-only Auth permission repair (2026-11-12)

**Scope:** Isolated Supabase **Staging** project `iteskfrpeeclzshauxog` only. Production `jylenzphqkmucwxqlzmq`, Vercel `k1`, payments, and `main` remain untouched.

## Failure evidence
- Staging-only Next.js authenticated HTTP integration reached `POST /api/admin/pilot-activate` with a synthetic verified teacher, pending child subscription, and cohort without Teams URL.
- Instead of the expected domain validation `409 teams_link_missing`, the API returned `503` ("تعذّر تفعيل الاشتراك التجريبي. لم تُسجّل دفعة مالية.").
- The RPC `public.activate_pilot_trial_atomic` is `SECURITY INVOKER` and queries `auth.users (id,email_confirmed_at)`. SQL metadata demonstrated that caller `service_role` had no SELECT privilege for either column. The function is executable only by `service_role`, not `PUBLIC`, `anon`, or `authenticated`.
- Service-role Auth Admin HTTP calls did succeed; those privileges do **not** imply PostgREST SQL SELECT permission on `auth.users`.

## Staging repair actually applied
The isolated Staging migration ledger records migration **`20261112094028_staging_pilot_auth_confirmed_column_grant`**:

```sql
GRANT SELECT (id, email_confirmed_at) ON TABLE auth.users TO service_role;
```

No whole-table grant, Auth password access, anonymous privilege, or `SECURITY DEFINER` change was made.

Verified on Staging:
- `has_column_privilege('service_role','auth.users','id','SELECT') = true`
- `has_column_privilege('service_role','auth.users','email_confirmed_at','SELECT') = true`
- `has_column_privilege('service_role','auth.users','encrypted_password','SELECT') = false`
- `has_column_privilege('anon','auth.users','id','SELECT') = false`
- `has_column_privilege('authenticated','auth.users','id','SELECT') = false`
- Live read under `SET LOCAL ROLE service_role` succeeded using `BEGIN READ ONLY`; staging service role could count verified Auth identities, without outputting private details.
- Supabase Security Advisor remained 20 INFO RLS-with-no-policy and 1 WARN leaked-password-protection disabled (existing notices).

## Rollback and release gate
Because pre-repair column privileges were absent, a staged rollback would be:
```sql
REVOKE SELECT (id, email_confirmed_at) ON TABLE auth.users FROM service_role;
```
Do **not** execute a rollback during active QA unless specifically requested.

**This document is audit evidence, not an approved production migration.** Before production: review the use of managed `auth.users`, validate Postgres privileges and least-privilege alternatives, capture a schema backup/rollback plan, obtain a separate owner approval, and re-run full staging tests. Never merge this QA branch or deploy its database changes automatically.
