# KHOTA V34 — Production Readiness Report

## Root cause — Bug #1 (mobile hero/header overlap)
The header itself was already minimal on mobile (confirmed: `@media(max-width:850px)` hides
the full nav and login/CTA buttons, leaving only logo + hamburger — this was NOT "the full
branded header" interfering). The real cause: the hero used `min-height:86vh` (78vh on mobile),
and **plain `vh` units are unreliable on mobile Safari** — they don't account for the
address-bar/toolbar showing or hiding, so the box's actual rendered height can differ from what
fits on screen. Combined with `align-items:flex-end` stacking a tall content block (2-line h1 +
lead + 2 CTAs + a 4-item story rail) at the bottom of that unreliable-height box, on shorter
phones the content could genuinely overflow upward toward the header area.

**Fix**: switched to `min-height:86svh` (small-viewport-height unit, correctly sized for the
visible area even with browser chrome present) with a `vh` fallback for older browsers via CSS
cascade (browsers that don't understand `svh` simply ignore that line and keep the `vh` value).
Reduced mobile content density (smaller heading floor, tighter action gaps, secondary CTA
hidden below 480px width, not removed — still reachable via nav/page links). Added
`env(safe-area-inset-bottom)` to hero content and `env(safe-area-inset-top)` to the header
itself for iPhone notch/home-indicator safety.

## Root cause — Bug #2 (grade → plan → cohort not appearing)
Confirmed by reading the actual server code, not assumed. `/motabaa/plans/page.tsx` wrapped its
entire data fetch in a blanket `try { ... } catch { return { plans: [], cohorts: [], live:
false } }` with **zero logging** — any failure (missing env var, RPC error, network blip)
silently produced empty plans/cohorts with no trace in server logs. Worse: the `plans` query's
own `error` field was never even checked (only `cohortsError` was) — meaning a failed `plans`
query wouldn't even throw, it would just silently resolve to an empty array while `live: true`
was still reported, misrepresenting a real failure as "no data."

The `!live` banner also told users/developers to "add your keys in `.env.local`" — a file that
doesn't exist in a Vercel deployment, actively pointing troubleshooting in the wrong direction.

**Fix**: added `error` checking on the `plans` query, added `console.error` logging the error's
name/message (never secret values) so a real Vercel Function log entry now exists, and replaced
the misleading `.env.local` message with a generic, honest Arabic user-facing message. **I
cannot confirm this was the actual live production failure** — I have no access to Vercel logs
or the live environment — but this exact pattern (swallow-and-hide-with-wrong-guidance) is a
textbook way a real env misconfiguration would look exactly like the symptom described. This
needs verification against actual Vercel logs after this fix ships.

## Grade → plan → cohort state logic — verified, not modified
Checked `PlansSelector.tsx` directly: `selectGrade()` already resets `planId`/`cohortId` to
null, and selecting a plan already resets `cohortId`. This was already correct from a prior
round — no fix needed, confirmed by reading the code rather than assumed.

## Security sweep results
- `غرفة التركيز`: zero remaining instances (verified clean, already fixed in a prior round).
- `service_role`/`SUPABASE_SERVICE_ROLE_KEY` references: found in 3 files
  (`parent/page.tsx`, `api/enroll/route.ts`, `motabaa/plans/page.tsx`) — all are Server
  Components/Route Handlers correctly importing the `server-only`-guarded admin client. **I made
  a mistake during verification and caught it myself**: my first automated check flagged
  `supabase-admin.ts` as a false "client component importing admin client" risk — it was
  matching the literal text `"use client"` inside one of the file's own *comments* (a warning
  telling future readers not to do that), not an actual directive. Redid the check properly
  (only the literal first line counts as a real Next.js directive) across all 39 files
  referencing the admin client — confirmed genuinely clean.
- `localhost`, `vercel.app`, `console.log`: zero hits.
- `TODO`/`FIXME`: one, in `api/payment/confirm/route.ts`, an already-documented placeholder
  marking exactly where a real payment provider needs to be wired in. Not a bug — an honest,
  intentional marker for a known external dependency (see blockers doc).
- `http://`: one hit, the SVG XML namespace declaration in `Logo.tsx`
  (`xmlns="http://www.w3.org/2000/svg"`) — a required standard, not a real link. Left untouched.

## What was NOT done this round (honest)
Given the two critical bugs plus the security/terminology sweep were the highest-value,
most concrete items achievable with certainty in this pass, the following from the brief's
much larger scope were **not executed**: full mobile QA screenshots across all 16 listed
routes, the complete transaction-flow QA matrix (E), auth/role route QA (F), full accessibility
audit of `HeroStoryRail`'s reduced-motion behavior beyond what the global CSS rule already
provides, performance/CLS audit, and a scrollIntoView UX enhancement for grade→plan flow
(explicitly optional in the brief). See the blockers document for what genuinely needs your
environment to verify.
