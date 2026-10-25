# KHOTA — isolated Vercel staging launch gate (25 October 2026)

This is an operational checklist for [launch issue #56](https://github.com/khotaedu2030-maker/K1/issues/56), not proof that the live web preview has been isolated. **No production changes are authorized by this document.**

## Verified baseline
- Production Supabase project: `jylenzphqkmucwxqlzmq`; keep unchanged.
- Separate **ACTIVE_HEALTHY** Supabase staging project: `iteskfrpeeclzshauxog`, 40 RLS-enabled public tables; staging has no active test Auth users or student/teacher/parent data yet.
- Vercel **production** project: `k1` (`prj_ztQ52qhSQsqFGBLfdOinctN9hA0y`); owns `khota.sa` and `www.khota.sa`.
- At last read-only check, `k1` had one `NEXT_PUBLIC_SUPABASE_URL` targeting both **Production and Preview**, and that URL was the **PRODUCTION** Supabase project. Its `SUPABASE_SERVICE_ROLE_KEY` was likewise targeted at both. **Do not run mutating browser/API tests against current k1 preview URLs.**
- Pull request #55 (teacher RLS) must remain unmerged until complete real Supabase Auth/PostgREST/browser tests and separate explicit approval.

## Gate A — provision a new *Vercel* project (not a second Supabase project)
1. Select Vercel **KHOTA** team, authorize the connected app for that team; do not create this under an unrelated personal account.
2. Create a distinct Vercel project named `khota-staging-web` (or approved equivalent), linked to `khotaedu2030-maker/K1`. No production custom domains or promotions.
3. Protect staging deployments with Vercel Authentication/team access; keep the environment scoped to this new **staging-only Vercel project**, not by changing `k1` Preview variables.
4. Use the following **staging-only** settings in the new project's environment variable UI:
   - `KHOTA_ENVIRONMENT=staging`
   - `NEXT_PUBLIC_SUPABASE_URL=https://iteskfrpeeclzshauxog.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = publishable/anon key from **staging** Supabase only
   - `SUPABASE_SERVICE_ROLE_KEY` = **staging** secret; server-side/sensitive only, never `NEXT_PUBLIC_`
   - `NEXT_PUBLIC_SITE_URL` = actual protected staging-only `https://*.vercel.app` origin
   - `KHOTA_PAYMENTS_ENABLED=false`
   - `KHOTA_PILOT_AUTH=false`
   - **Do not configure any live Paylink, production Resend, live webhook secrets, production customer data or production Supabase credentials.**
5. Set the staging project's **Build Command** to `npm run qa:staging-env && npm run build`. The command fails closed if the Supabase URL, Vercel project ID (when exposed), website URL, payment flag, or key presence does not pass static safety checks. Run `npm run qa:staging-env` on the same staging environment before E2E.
6. **Credential ownership check:** for legacy Supabase JWT service keys, the script rejects a JWT with a non-staging `ref`. For opaque `sb_secret_*` keys and publishable keys, syntax alone cannot prove key ownership; check their origin via Supabase staging dashboard and a read-only authenticated API request before provisioning any accounts. Never log secrets.
7. Confirm the deployed staging origin actually calls the staging Supabase API by inspecting requests and reviewing Vercel's **staging project only** runtime settings. Must not reference `jylenzphqkmucwxqlzmq`. This is a prerequisite to **all mutating QA**.

## Gate B — real staging QA
- Create *fake* parent, child, teacher (active, inactive, null-active), and admin Supabase Auth users in staging.
- Test genuine login/OTP, signed JWT/PostgREST RLS access, group creation, enrollment, lessons, reports, homework, makeup credits, attendance, cancellation, account deactivation. Use staging-only test meeting links.
- Verify every teacher read policy in #55, unauthorized child/teacher/parent isolation, no cross-tenant access, and that `khota_rls` is not exposed to PostgREST API.
- Simulate payment conditions only in the sandbox, with `KHOTA_PAYMENTS_ENABLED=false` for real checkout; no live invoices, webhook activation or charges.
- Review PR #55; **never merge/apply its production RLS migration without explicit owner approval**.

## Gate C — company-launch handoff
- Resolve real legal entity, business activity/licensing classification, merchant onboarding, support contact and registration details. The website's legal-profile currently hides missing identity fields.
- Keep real Paylink disabled until legally/operationally ready and a separately approved production rollout is made.
- Record dated acceptance evidence for the first 20-student controlled pilot in #56.

## Operational status
- New isolated Vercel staging project: **NOT YET CREATED OR VERIFIED**.
- Production `k1` untouched. Do not use a `READY` Vercel build or CI test status as proof of real end-to-end functionality.
