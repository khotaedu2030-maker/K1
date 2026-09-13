# KHOTA V34 — Remaining Blockers & Unverified Items

## DB migration required?
**No.** Both fixes this round are frontend/server-logic only (error handling + CSS). Zero
schema/RLS/RPC changes.

## Environment variables required in Vercel (names only, never values)
These must be set correctly in the Vercel project's Environment Variables for the site to
function in production — I cannot verify their actual values from here:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KHOTA_PILOT_AUTH` — must be **absent or `false`** in production (pilot auth must never
  silently become production auth, per standing project rule from earlier rounds).

If Bug #2 (plans/cohorts not appearing) persists after this fix ships, **check the Vercel
Function logs for `/motabaa/plans`** — the new `console.error` line will now show the actual
error name/message, which should point directly at which of the above is misconfigured.

## Tests actually run vs. not
| Check | Status |
|---|---|
| `npx tsc --noEmit` | **RAN** — ~3366 lines, all traced to missing `node_modules` (no network access in this sandbox), zero new genuine code errors introduced this round |
| `npm run build` | **FAIL** — `next: not found`, direct result of `npm install` failing with `403 Forbidden` (no network access here — this has been the case in every round of this project) |
| `npm run lint` | **FAIL** — same root cause |
| Browser/device QA (375/390/430/768/1024/1440) | **NOT VERIFIED** — no browser or device available in this environment, ever, in any round |
| Full transaction flow (Home→Start→Grade→Plan→Cohort→Enroll→Payment) live click-through | **NOT VERIFIED** — same reason |
| Auth/role route protection (parent/student/teacher/admin) live testing | **NOT VERIFIED** — code-level review only was possible; middleware/RLS were not modified this round so prior verification stands, but no fresh live test was performed |
| Acceptance Test Matrix items 1–20 | **NOT VERIFIED** individually — none require a live browser to confirm, which isn't available here |

## What genuinely needs your environment
1. **Deploy this build to Vercel (or your local machine) and run `npm install && npm run build`
   for real** — the single most important unblock, since nothing here could be compiled or
   rendered in this sandbox at any point in this project's history.
2. **Check Vercel Function logs** for the new `console.error` output on `/motabaa/plans` if the
   empty-plans issue recurs — this will now tell you the real cause instead of hiding it.
3. **Test the mobile hero fix on an actual iPhone Safari** (or at minimum a real mobile browser
   simulator with `svh` support, which Safari has had since iOS 15.4/Chrome since ~108) — the
   fix is a well-understood, standard technique for this exact bug class, but was not visually
   confirmed here.
4. Real payment gateway integration — still isolated/dev-only as documented in every prior
   round's report, unchanged this round, explicitly flagged as a launch blocker per the brief's
   own instruction not to touch payment architecture in this pass.
5. Production SMS/OTP provider, final teacher assignments, real meeting URLs, DNS/hosting
   activation for `khota.sa` — all unchanged standing items from prior rounds' reports.

## Honesty note
I will not claim "production ready" — per the brief's own instruction (section N), and because
the two most consequential things (an actual production build succeeding, and a real browser
rendering the mobile fix correctly) were not possible to verify in this environment.
