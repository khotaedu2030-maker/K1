# KHOTA Admin OS — Final Readiness Summary (Phases 1–8)

Branch: `feature/admin-os-foundation`, commit `e461920` + this correction pass (uncommitted at time of
writing this revision). This document is the requested single reference for "what's done, what's left,
exact migrations, exact validations, blockers, secrets, and recommended Phase 9 order." It does not
repeat every detail already in the per-phase reports — see those for full rationale.

> **Correction note (pre-Phase-9 pass):** an earlier version of this document stated flatly that
> "none of this project's migrations have ever been executed against a live Supabase instance." That
> claim was **not reliable** — it was never backed by an actual check of migration history or
> database state. §3 and §4 below stop guessing in either direction. See
> `KHOTA_PHASE9_MIGRATION_MANIFEST.md` for the full per-migration classification.

> **Offline-finalization pass note (ahead of Sunday go-live, this revision):** a full-codebase audit
> was run (customer + Admin journeys, RBAC/IDOR, payment integrity, concurrency, error/secret
> handling, Arabic terminology) and every genuine defect found was fixed locally on this branch — see
> `KHOTA_PRE_SUNDAY_DEFECT_REGISTER.md` for the complete, classified list (P0 = 0 remaining) and
> `KHOTA_PHASE9_OFFLINE_FINALIZATION_REPORT.md` for the full account. Additionally, this pass got real
> (if approximate) local PostgreSQL access — not Supabase, not Production — and used it to actually
> execute `schema.sql` and the full tracked migration sequence against a reconstructed baseline; both
> passed cleanly. See the migration manifest's "Local simulation results" section for the complete,
> honestly-qualified account. **None of this constitutes Production verification** — §4 below still
> stands as the authoritative statement of what remains genuinely unverified against a real
> environment.

> **Step 9.2A note (real Production evidence, 20 Sep 2026, this revision):** for the first time in
> this engagement, real read-only diagnostic evidence exists from the actual KHOTA Supabase
> Production database. It confirms Production is largely pre-Admin-OS, and — critically — that
> `platform_settings` already exists there with an incompatible key/value schema, not the typed
> singleton row this codebase always assumed. `20260917_platform_settings.sql` and
> `20260920_settings_foundation_extension.sql` must **never** be applied against Production as a
> result (see `KHOTA_PHASE9_APPROVED_MIGRATION_DELTA.md`). A second problem was independently found
> while building the fix: `supabase/schema.sql` folds several Admin-OS columns directly into base
> `create table if not exists` statements rather than keeping them as their own `alter table add
> column`, which would silently no-op against Production's already-existing tables. Both problems are
> resolved in one new, reviewed migration — `supabase/migrations/20261002_phase9_production_reconciliation.sql`
> — tested against a local simulation built directly from this real evidence (not just an
> approximate baseline), including a full data-preservation test. This is the new authoritative
> reconciliation plan; §3 below is superseded by `KHOTA_PHASE9_APPROVED_MIGRATION_DELTA.md` for what
> to actually apply on Sunday. Full reasoning in `KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md`. This is
> still not Production verification of anything beyond what the 20 Sep 2026 diagnostic itself
> checked — §4 below remains authoritative for everything else still unverified.

## 1. What is complete in Admin OS Phases 1–8

- **RBAC foundation** (Phase 1) — 4 roles, permission-based route guards, now consistently applied
  (Phase 8 closed the last 4 stray `requireAdmin()`-only mutation/read routes).
- **Commercial model, Cycles, capacity/registration engine** (Phases 2–3) — atomic enrollment,
  seat-hold, single occupancy source (`cohort_occupied_seats()`).
- **Refunds, attendance lock** (Phase 4).
- **Operational exceptions + support case management** (Phase 5) — the detector layer that Phase 7's
  readiness engine reuses directly.
- **Teacher activation, cohort transfer, pause management, makeup credits** (Phase 6, with a Phase 6
  correction pass that fixed a genuine atomicity/RBAC gap in makeup credits).
- **Pre-Launch Control Center + System Health** (Phase 7, this round) — live-derived readiness state
  (`جاهز`/`جاهز مع تنبيهات`/`غير جاهز`), Super-Admin-only blocker overrides with a hard non-overrideable
  category for technical/integrity failures, a first-ever Cycle completion guard/mutation, a
  System Health page that never exposes secrets, and webhook receipt observability.
- **Governance completion** (Phase 8, this round) — real Users & Permissions management (invite,
  role change, activate/deactivate, with a genuinely-enforced `active` flag and a table-locked
  last-Super-Admin protection), a permission matrix sourced from the one real authorization function,
  a filterable/sanitized Audit Log with comprehensive action coverage, a corrected Settings page with
  an honest ACTIVE/FOUNDATION classification, a rebuilt role-filtered Reports page with explicit KPI
  definitions, a first-ever post-lock attendance admin-override path, and a security sweep that
  narrowed the last 4 broad-permission admin routes.

## 2. What remains before Production

- **No automated test suite exists at any phase of this project.** Every phase, including this one,
  has been verified by manual code reading, brace/paren-balance scripting, and reasoning about RPC
  logic — never by an executed automated test run in this sandbox. This remains the single largest
  gap before Production. This is a statement about *this engagement's own verification method*, not a
  claim about whether any migration has ever reached a live database anywhere — see §3 for why that
  question is handled separately now.
- **Compilation has never succeeded in this sandbox.** `npm install` has returned a 403 from
  `registry.npmjs.org` in every round of this multi-session engagement, including this one (retried
  and confirmed again this round, not assumed). `node_modules` does not exist here. `npx tsc --noEmit`
  fails immediately on missing `next`/`react`/`@types/node` declarations — not on any logic in this
  project's own files, but this has never been proven by an actual successful compile.
- **Default-capacity settings — CLOSED this pass.** Previously FOUNDATION only (stored, no consumer).
  Now ACTIVE: new cohort creation derives its default capacity from the typed settings table
  (`default_capacity_1_3/4_6/7_9/10_12`) by grade band, server-side, with an optional authorized
  explicit per-cohort override still validated server-side. Existing cohorts are never retroactively
  changed. See Phase 8 report §3 (updated) for the four regression scenarios. **Step 9.2A note:** this
  now reads from `admin_platform_settings` (the new typed table), not the legacy `platform_settings`
  key/value table — see the blockquote near the top of this document. All four call sites
  (`src/lib/platform-settings.ts`, `src/app/api/admin/settings/route.ts`,
  `src/app/admin/settings/page.tsx`, `src/app/admin/groups/page.tsx`) were retargeted this pass.
- **Plan/price change audit — CLOSED this pass.** Previously a documented gap (no audit trail on plan
  mutation). Now: `/admin/plans` (new page, `plans.manage` permission, Finance + Super Admin only),
  backed by `admin_update_plan_atomic` (RPC), writes `admin_actions` with action `plan_updated` only
  when the update actually commits a real change, and never touches `subscriptions.plan_snapshot_*` —
  see Phase 8 report §3 (updated) for the three regression scenarios.
- Teacher deactivation as a feature does not exist at all (only activation) — deliberately still
  deferred; not required for launch integrity per this pass's explicit scope instruction.
- CSV export was deliberately deferred (Phase 8 §6) — still deferred; out of scope for this pass.
- A full page-by-page empty/error-state and IDOR re-audit across all 8 phases was not performed
  exhaustively — only routes/pages directly touched in Phases 7–8 (and, this pass, the new cohort
  default-capacity path and the new plan mutation path) were verified. The full historical IDOR
  re-audit remains explicitly assigned to Phase 9 final security verification, not this pass.
- Webhook observability does not log rejected/unauthenticated webhook attempts (only legitimate,
  authenticated ones that reach payload parsing) — deliberately still deferred, per this pass's
  explicit scope instruction.

## 3. Migration state — reconcile, do not assume

**Corrected wording (this pass):** whether any of this project's migrations have actually reached a
live Supabase instance is **not something this sandbox can determine** — there is no database
connection available here, and no prior round's transcript constitutes proof either way. The
previous version of this section asserted "none has ever been executed," stated as fact. That
assertion has been withdrawn — it was a guess, not a verified state, and guessing in either direction
(assuming applied, or assuming unapplied) is exactly what Phase 9 must not do.

**Superseded by Step 9.2A (this revision):** the paragraph above described the state of knowledge
*before* real Production evidence existed. That evidence now exists (20 Sep 2026 — see the blockquote
note above), and it changes the answer for this section from "reconcile file-by-file at apply time" to
"apply one already-reconciled migration." The full per-migration classification — 26 files, each
marked against the real evidence — lives in **`KHOTA_PHASE9_MIGRATION_MANIFEST.md`** (Revision 3), and
the authoritative statement of what to actually run on Sunday is
**`KHOTA_PHASE9_APPROVED_MIGRATION_DELTA.md`**. Two facts, corrected against the real evidence, replace
what this section used to say:

- **`20260916_pending_payment_24h_expiry.sql` is still superseded and must never be applied as an
  independent step** — unchanged from before; the replacement is
  `20260917_seat_hold_alignment_and_atomic_admin_rpc.sql`, and both are folded into the reconciled
  target state that `20261002_phase9_production_reconciliation.sql` produces.
- **`20260920_settings_foundation_extension.sql` is no longer merely "requires human review" — it is
  `DO_NOT_APPLY`, unconditionally.** Production's real `platform_settings` table has never had a
  `pause_max_days` column (it uses the old key/value schema — see §A of the evidence). The
  `update platform_settings set pause_max_days = 28 where pause_max_days = 30;` statement this file
  contains would either fail outright or silently affect zero rows against the real table; either way,
  running it teaches nothing and risks nothing being caught. It is excluded from the reconciliation
  migration entirely, and `20260917_platform_settings.sql` (the singleton-table migration this file
  extends) is `DO_NOT_APPLY` for the same underlying reason: Production's `platform_settings` was never
  that singleton table in the first place.

`supabase/schema.sql` remains the cumulative, sequentially-appended equivalent of all migrations *as
files* — that description is still true and unchanged. What Step 9.2A adds is a second, independent
finding: schema.sql folds several Admin-OS columns (`admins.role`, `cohorts.cycle_id`,
`cohorts.grade`, `subscriptions.hold_expires_at`) directly into their table's base
`create table if not exists` statement rather than a separate `alter table add column`. Since those
tables already exist in Production, replaying schema.sql's base definitions verbatim would silently
never add these four columns. `20261002_phase9_production_reconciliation.sql` adds them back as
explicit standalone ALTERs (SECTION 3 of that file). Full reasoning in
`KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md`.

**Phase 9's first action on migrations was reconciliation, never blanket application — that
reconciliation is now done.** The single new migration
(`supabase/migrations/20261002_phase9_production_reconciliation.sql`) is the resulting safe ordered
delta, built directly from real evidence and tested against a Production-shaped local simulation
(including a full data-preservation test). It has not been applied to Production — see
`KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md` and `KHOTA_PHASE9_DATABASE_RECOVERY_PLAN.md` for what
"applying it" on Sunday involves and how to recover if something goes wrong.

## 4. Readiness, split by what kind of verification it actually has

Previous versions of this section blurred "verified by reading the code" and "verified by running
it" together, and asserted "nothing has ever run against a real database" without proof. Corrected
into four honest buckets:

> **Local simulation update (offline-finalization pass):** this pass gained genuine (if approximate,
> non-Supabase) local PostgreSQL 16 access and used it to actually execute `schema.sql` and the full
> tracked migration sequence, in order, against a reconstructed baseline — both passed cleanly, and a
> re-run idempotency check also passed for the migrations (one pre-existing, low-severity `schema.sql`
> idempotency issue was found and is documented, not fixed — see the migration manifest's "Local
> simulation results" section for full detail). This moves *migration syntax, ordering, and internal
> dependency consistency* out of pure guesswork and into "executed and observed, locally, once." It
> does **not** move to RUNTIME VERIFIED below, because that bucket is reserved for verification against
> a real Supabase/Production-equivalent environment (real RLS enforcement, real Supabase Auth triggers,
> the actual target schema state) — none of which this local cluster provides. The buckets below are
> otherwise unchanged and remain the authoritative statement of what Phase 9 must still verify for
> real.

### CODE VERIFIED STATICALLY (read, traced, reasoned about — never executed here)
- Every atomic RPC introduced or modified across Phases 1–8 and this pass (makeup-credit monthly
  limit, last-Super-Admin protection, cycle completion guard, readiness-blocker override idempotency,
  `admin_update_cohort_operations_atomic`, `admin_update_plan_atomic`) — logic traced by hand against
  its SQL, concurrency behavior (`for update` locking, `is not distinct from` no-op detection)
  reasoned about, never run under real concurrent load.
- `default_capacity_*` consumption in cohort creation (this pass) and `admin_update_plan_atomic`'s
  audit-only-on-real-change behavior (this pass) — read in full, not executed.
- TypeScript/JSX structural integrity of every file touched this pass — see §6 verification sweep in
  the Phase 8 report for the exact method and its limits (no real `tsc` run was possible; see below).

### RUNTIME VERIFIED (actually executed and observed, at some point, in some environment)
- Nothing in this engagement's own sessions. No claim is made here that this project has *never*
  run against a live Supabase instance anywhere, ever — that would be an equally unverified guess in
  the other direction. What can be stated plainly: **this sandbox has never had live database or
  package-registry access, in any round, including this one**, so nothing produced *by this
  engagement* has been runtime-verified by this engagement.

### RUNTIME NOT YET VERIFIED IN THIS PHASE
- `npm install` / `npx tsc --noEmit` / `npm run build` — blocked by a persistent 403 from
  `registry.npmjs.org` in this sandbox, re-confirmed this pass (see §6 of the updated Phase 8 report
  for the exact command and error).
- Every atomic RPC under actual concurrent load (see CODE VERIFIED STATICALLY above — reasoned about,
  not run).
- A real (non-simulated) Paylink webhook delivery round-trip against
  `/api/payments/paylink/webhook`, to confirm `webhook_events` actually receives rows in practice —
  still outstanding, unchanged by this pass.
- Supabase Auth's invite-email delivery (`inviteUserByEmail`) end-to-end — still outstanding,
  unchanged by this pass.
- Production Email OTP delivery — this project's System Health page can only confirm *config
  presence*, never that mail actually delivers; the "Configuration present ≠ Provider operational"
  gap is unchanged by this pass and must be re-tested end-to-end before launch.
- The production Admin/staff role flow (invite → accept → role-gated access in a real deployed
  environment) — reasoned about via code, never run end-to-end.
- Exposed/old secret rotation or revocation: **this document does not know, and will not guess, which
  secret is currently active vs. already rotated/revoked.** That state must be verified directly
  against the real secret store in Phase 9 — see §6 below, unchanged in substance from the prior
  version of this document, restated here to keep it next to the other unverified-runtime items.

### DATABASE STATE TO RECONCILE IN PHASE 9 — DONE this pass (Step 9.2A), pending only actual apply
- **Superseded by Step 9.2A.** This used to be an open question ("whether each of the 25 migrations'
  resulting tables/functions already exist"). It no longer is: real read-only diagnostic evidence from
  the actual Production database (20 Sep 2026) answered it directly (see the blockquote near the top
  of this document, and §A/B/C of `KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md`), and the resulting safe
  delta has been built, tested against a Production-shaped local simulation, and written to
  `supabase/migrations/20261002_phase9_production_reconciliation.sql`. What remains is not
  reconciliation work — it is the act of applying that one file to real Production and running
  `supabase/phase9_post_migration_verification.sql` afterward, per the Sunday runbook.
- The `platform_settings.pause_max_days` question is now moot: Production's real `platform_settings`
  table was never the typed table `20260920_settings_foundation_extension.sql` assumes (it is, and
  remains, an old key/value table), so that file's conditional `UPDATE` is excluded outright rather
  than gated on a human decision about its current value.

## 5. Known launch blockers (as this codebase would report them today, if run against a populated DB)

Cannot be stated definitively without a running database — no live data exists to query. Structurally,
today, category-E blockers (§ Phase 7 report §3) would fire in any environment missing
`PAYLINK_BASE_URL`/`PAYLINK_API_ID`/`PAYLINK_API_SECRET`/`PAYLINK_WEBHOOK_SECRET` — i.e., **any
environment that hasn't had Paylink production credentials configured yet is `غير جاهز` by design**,
non-overridably. This is intentional, not a bug to fix.

## 6. Secret rotation/revocation still required

**None performed by this pass, and none by Phases 7–8 either.** No secret was read, logged, rotated,
or touched at any point in Phases 7–8 or this correction pass — confirmed by the grep sweep in the
Phase 8 report §10 (and re-confirmed this pass — no new file touches secret values). The existing
required secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PAYLINK_API_SECRET`, `PAYLINK_WEBHOOK_SECRET`,
`KHOTA_PILOT_SECRET`) were only ever referenced via presence/existence checks in this codebase
(`src/lib/paylink.ts`/`require-admin.ts`/etc.), never logged or exposed.

**This document does not know, and will not guess, whether any of these secrets are currently
"exposed/old" versus already rotated** — that depends entirely on the real secret store's current
state (Supabase project settings, hosting provider's environment variables, Paylink dashboard), none
of which this sandbox has access to. Any prior mention (in earlier rounds' reports) of a secret
needing rotation described a *risk*, not a confirmed current exposure. **Phase 9 must verify the
actual current state of each secret directly against its real store before deciding what, if
anything, needs rotation or revocation** — this document will not assert a rotation/revocation status
it cannot check.

## 7. Recommended Phase 9 execution order

1. **Get a real, buildable environment** — resolve the `npm install` 403 (this is almost certainly
   sandbox-specific, not a real project blocker; needs to be verified in whatever environment
   Production deployment will actually use; re-confirmed persistent in this sandbox during the
   offline-finalization pass too, not retried further per instruction) and run a genuine
   `tsc`/`next build`/test pass for the first time in this project's history.
2. **Reconciliation is done (Step 9.2A) — apply the one resulting migration, verify, done.** Real
   Production evidence (20 Sep 2026) was used to build
   `supabase/migrations/20261002_phase9_production_reconciliation.sql` as the safe ordered delta —
   this superseded the earlier plan of connecting to a staging instance to work out the delta live.
   What's left for Sunday: apply that single file to Production inside the runbook's GATE 3 (re-confirm
   the evidence is still current first, since the file is safe to re-run if it isn't), then run
   `supabase/phase9_post_migration_verification.sql` (GATE 4) and compare against
   `KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md`'s expected results. Never apply
   `20260916_pending_payment_24h_expiry.sql`, `20260917_platform_settings.sql`, or
   `20260920_settings_foundation_extension.sql` under any circumstance — all three are `DO_NOT_APPLY`
   (see `KHOTA_PHASE9_APPROVED_MIGRATION_DELTA.md`).
3. Run the regression scenarios from every phase's report against real data and real concurrency —
   starting with the atomicity-critical ones (makeup limit, last-Super-Admin, cycle completion guard,
   this pass's default-capacity derivation and plan-mutation audit scenarios).
4. **Configure real Paylink credentials in staging** and run one genuine webhook round-trip to
   confirm `webhook_events` and payment activation both behave as designed.
5. **Verify actual secret state** (§6) directly against the real secret store — do not assume any
   secret's current rotation/revocation status.
6. **Decide the two still-open items** deliberately deferred by this pass: whether teacher
   deactivation is needed as a launch-blocking feature, and whether webhook rejected-attempt logging
   is needed before launch — both remain explicitly out of scope until Phase 9 makes that call.
7. **Only then**: Push, Deploy, apply the reconciled migration delta to Production, rotate/set real
   production secrets as needed — none of which have been done, or should be done, from this sandbox.

**This execution order is now the basis for `KHOTA_SUNDAY_GO_LIVE_RUNBOOK.md`**, which breaks it down
into 20 named, owner-executable gates with PASS/STOP conditions for the actual Sunday session. This
section is kept here as the underlying rationale; the runbook is what the owner should actually follow
on the day.

No Push. No Deploy. No Production SQL. Phase 9 Step 9.1 (audit/manifest) and the offline-finalization
pass are complete; live Phase 9 execution (reconciliation, migration, merge, deploy, real payment/OTP
tests, secret rotation) has not started.
