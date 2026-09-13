# KHOTA V35 — Remaining Launch Blockers

## Hard blockers (must resolve before public launch)
1. **Real payment gateway.** `/api/payment/confirm` is dev-only, hard-disabled in production.
   To integrate Moyasar (or similar): replace this route's dev logic with a signed-webhook
   handler that verifies, server-side: payment ID exists, `status === "paid"`, amount matches
   the plan price exactly, currency is SAR, and the payment correlates to the correct
   subscription ID — with idempotency (a payment ID must not activate a subscription twice).
   Never mark a subscription paid from a browser redirect or query parameter alone.
2. **Real SMS/OTP provider** — must be configured in Supabase Auth → Phone before login can
   work for real users. Standing gap, unchanged across every round of this project.
3. **A real `npm install && npm run build` has never once succeeded anywhere in this project's
   history** — this sandbox has no network access. This must be verified on your machine/CI
   before any deployment decision, not assumed from this report.

## Should-resolve-soon (not hard blockers for a controlled pilot)
4. **115 pre-existing TypeScript implicit-any errors** across ~40 files (see Test Matrix) —
   very likely resolve automatically once real `npm install` provides actual Supabase types,
   but this is unproven here. Run `npx tsc --noEmit` after a real install and see how many
   remain; only the leftover ones need manual fixing.
5. **Six placeholder admin sections** (`/admin/students`, `/parents`, `/sessions`, `/programs`,
   `/payments`, `/reports`) and one parent-facing one (`/parent/payments`) are genuinely
   unbuilt. Hidden from primary navigation this round so pilot users/admins don't hit dead
   ends, but the underlying functionality (student roster view, parent directory, session
   schedule view, payment history, reporting) doesn't exist yet. Whether these are needed
   before a controlled pilot depends on how your pilot team plans to operate day-to-day — if
   they need to see e.g. a student roster through the UI rather than Supabase directly, that's
   a real pre-pilot task, not optional polish.

## Environment variables required in Vercel (names only)
Unchanged from V34: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and `KHOTA_PILOT_AUTH` must be absent/false in production.

## Genuinely external, cannot be simulated here
Real teacher assignments, real meeting URLs for cohorts, `khota.sa` DNS/hosting activation,
Apple Pay domain verification (once a real gateway is chosen), final production secrets/keys.

## What this pass could not verify (needs your environment)
Everything requiring a live browser or a successful build: mobile visual QA at any width, the
full click-through transaction flow, Lighthouse/performance numbers, and live auth
role-boundary testing (e.g., attempting cross-family data access as an actual logged-in user).
All of the auth/security guarantees in the executive report were verified by reading the
actual source code paths involved, which is a meaningful but different thing from live
penetration testing.
