# KHOTA V34 — Changed Files

## `src/app/globals.css`
- `header{...}`: added `padding-top:env(safe-area-inset-top)` (iPhone notch safety).
- `.hero-editorial-v28{...}`: added `min-height:86svh` after the existing `86vh` (progressive
  enhancement — `vh` fallback stays for browsers without `svh` support).
- `@media(max-width:850px)` hero block: added `svh` fallback pattern for the mobile min-height,
  added `env(safe-area-inset-bottom)` to content padding, reduced heading floor
  (`clamp(32px,8vw,54px)` vs the previous higher floor), reduced body/action spacing.
- New `@media(max-width:480px)` rule: hides the hero's secondary ("outline") CTA button only
  below 480px width — the link is not removed from the page, still reachable via navigation and
  later page sections.

## `src/app/motabaa/plans/page.tsx`
- `getData()`: now checks the `plans` query's own `error` field (previously only the cohorts
  RPC's error was checked — a failed plans query could silently resolve to `[]` while reporting
  `live: true`).
- `catch` block: now logs `err.message` via `console.error` (server-side only, no secret
  values) instead of silently discarding the error with no trace.
- User-facing `!live` message: replaced the incorrect `.env.local`-referencing text with a
  generic, honest Arabic message appropriate for a production environment.

## Not changed (confirmed, not assumed)
`PlansSelector.tsx`, `EnrollForm.tsx`, `PaymentClient.tsx`, `api/enroll/route.ts`,
`api/payment/confirm/route.ts`, `supabase-admin.ts`, any Supabase schema/RLS/RPC, `grade-config.ts`,
`plan-display.ts`, pricing, plan IDs, cohort logic — verified via `diff` (filtering logic
identical) and via `find`-based touched-file listing (only the two files above were modified).
