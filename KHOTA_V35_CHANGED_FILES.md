# KHOTA V35 — Changed Files

## `src/app/admin/page.tsx`
`links` array reduced from 9 entries to the 3 that lead to genuinely functional pages
(`/admin/groups`, `/admin/teachers`, `/admin/subscriptions`). The 6 removed
(`students`/`parents`/`sessions`/`programs`/`payments`/`reports`) still return literal
"قيد التطوير" content — confirmed by reading each file. Routes not deleted, just not promoted
in primary navigation.

## `src/app/parent/page.tsx`
- Removed the `["المدفوعات", "/parent/payments"]` nav entry — same reasoning, confirmed
  placeholder, route not deleted. Subscription/price info remains available via the existing
  "الاشتراك" link.
- Fixed one genuine pre-existing TypeScript error: `tasks.map((t, i) => ...)` had implicitly-
  `any` callback parameters — added explicit types `(t: { title: string; status: string }, i:
  number)`. Zero behavior change.

## `src/components/HeroStoryRail.tsx`
Auto-advance `useEffect` now checks `window.matchMedia("(prefers-reduced-motion: reduce)")`
and skips starting the interval timer entirely if set — previously only the CSS crossfade was
suppressed, not the underlying content auto-change. Zero change to the manual click/keyboard
interaction path.

## `src/app/icon.svg` (new)
Favicon — confirmed none existed anywhere in the project. Built from the exact paths/gradient/
colors already defined in `src/components/Logo.tsx`'s `LogoMark`, with a cream background
rect added for visibility as a small tab icon. Served automatically by Next.js App Router's
`icon.svg` convention — no additional code required.

## Not changed (confirmed, not assumed)
Supabase schema/RLS/RPC, `PlansSelector.tsx`, `api/enroll/route.ts`,
`api/payment/confirm/route.ts`, `pilot-auth.ts`, `middleware.ts`, pricing, grade-band logic,
`grade-config.ts`, cohort logic — verified via `diff` (plans filtering logic identical) and
via `find`-based touched-file listing (only the three items above were modified this round).
