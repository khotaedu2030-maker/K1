# KHOTA V35 — Executive Readiness Report

## VERDICT: B — READY FOR CONTROLLED PILOT ONLY

- **READY FOR REAL PAYMENTS: NO** — `/api/payment/confirm` is explicitly dev-only, hard-blocked
  in production (`NODE_ENV === "production"` → 403), with zero real gateway integration. Needs
  Moyasar/Tap/HyperPay integration — see blockers doc for exact requirements.
- **READY FOR REAL OTP LOGIN: NO** — no SMS/OTP provider configured in Supabase Auth (standing
  gap from every prior round, unchanged, not addressed this round).
- **READY FOR PILOT OPERATIONS: YES, with caveats** — core enrollment (grade→plan→cohort),
  admin teacher/meeting-URL assignment (`/admin/groups`), and parent dashboard are functional.
  Caveats: several admin sections remain genuinely unbuilt (now hidden from primary nav rather
  than left as confusing dead links — see Changed Files), and a real production build has never
  been executed anywhere in this project's history (network-blocked sandbox).

## Why not A (public marketing launch)
Payment and OTP are the two things a real public launch cannot go live without, and both are
confirmed incomplete/isolated by design. This is the same conclusion as V34; nothing this round
changes that.

## Why not C (not ready to deploy)
The core product loop (browse → select grade/plan/cohort → enroll → dev-payment confirmation →
parent dashboard) is functionally sound and has been verified at the code level across multiple
hardening passes. Auth boundaries (parent scoping by `parent_id`, pilot-auth's `NODE_ENV`
production guard, admin role check via the `admins` table) were independently re-verified this
round, not merely assumed. This is a real, working pilot candidate — just not a public-launch
candidate yet.

## What changed this round (real fixes, not cosmetic)
1. **Admin/parent navigation dead-ends removed.** The admin dashboard linked to 6 pages that are
   still literally "قيد التطوير" placeholders (`/admin/students`, `/parents`, `/sessions`,
   `/programs`, `/payments`, `/reports`) — confirmed by reading each file, not assumed. Reduced
   the primary nav to the 3 that are genuinely functional (`/admin/groups`, `/teachers`,
   `/subscriptions`). Same fix on the parent dashboard for `/parent/payments`. Routes themselves
   were not deleted — just no longer promoted as if they work.
2. **Missing favicon fixed.** Confirmed zero favicon existed anywhere in the project (neither
   App Router nor classic convention). Added `src/app/icon.svg` using the actual `LogoMark`
   component's paths/colors — not an invented asset.
3. **One genuine, pre-existing TypeScript bug fixed** (`parent/page.tsx`, implicit-any on a
   `.map()` callback).
4. **`HeroStoryRail` reduced-motion gap fixed.** The auto-advance timer previously ignored
   `prefers-reduced-motion` entirely at the JS level — the CSS rule only hid the visual
   crossfade, but content still auto-changed every 6 seconds regardless of the user's
   preference. Now the timer never starts if the preference is set.
5. **Major finding, not fixed this round**: a full project-wide `tsc` sweep (which I had not
   previously run — earlier rounds only checked files I was actively editing) surfaced **115
   pre-existing implicit-any errors across ~40 files**, present even in files untouched for
   several rounds (e.g. `MobileNav.tsx`, last touched two rounds ago). This is very likely a
   downstream consequence of `@supabase/supabase-js` types being unavailable in this sandbox
   (no `npm install`) rather than 40 independent bugs — but I cannot prove that without real
   types installed, and mass-editing 40 files under this pass's time budget risked doing more
   harm than good. Documented precisely in the Test Matrix rather than silently fixed or
   silently ignored.

## Security/auth items independently re-verified this round (not just re-stated)
- `isPilotAuthEnabled()` requires **both** `NODE_ENV !== "production"` and
  `KHOTA_PILOT_AUTH === "true"` — confirmed correct in `pilot-auth.ts`, and confirmed all 3
  `/api/pilot-auth/*` routes gate on it.
- Payment confirm route: confirmed hard-blocked in production, confirmed it does real DB
  lookups + idempotency checks (not query-param trust) even in dev mode.
- Parent data scoping: confirmed `.eq("parent_id", parentId)` filtering, not client-trust-only.
- Full secret/credential sweep (`service_role`, `sb_secret`, `JWT`, hardcoded key patterns,
  test credentials, `localhost`, `vercel.app`): zero hits. One false positive I caught and
  corrected myself during verification (a code *comment* containing the literal string
  `"use client"` as a warning, briefly flagged by a naive grep as an actual directive — redone
  correctly by checking only the literal first line of each file).
