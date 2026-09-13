# KHOTA V35 — Test Matrix (honest PASS/FAIL/NOT VERIFIED/BLOCKED)

| Check | Result |
|---|---|
| `npm install` | **FAIL** — `403 Forbidden` on `registry.npmjs.org`. No network access in this sandbox, present in every round of this project without exception. |
| `npx tsc --noEmit` | **RAN FOR REAL.** ~3366 lines total. Breakdown: (a) the large majority are "Cannot find module 'next/...'/'react'/'@supabase/...'" — direct result of no `node_modules`, not code defects. (b) **115 genuine `TS7006` implicit-any errors across ~40 files** — confirmed pre-existing (present in files untouched for multiple rounds), most likely a downstream cascade of missing Supabase type definitions rather than 40 independent bugs, but **not provably so without real `npm install`**. Fixed 1 of these (`parent/page.tsx`) as a sample/quick win; the other ~114 are documented as legacy debt, not fixed this round — see rationale in the executive report. |
| `npm run build` | **FAIL** — `next: not found`, direct consequence of the `npm install` failure above. |
| `npm run lint` | **FAIL** — `eslint: not found`, same cause. Cannot separate "pre-existing vs. newly introduced" lint issues because lint has never once run successfully in this project's history. |
| Pilot Auth production guard | **PASS (verified)** — read `pilot-auth.ts` and all 3 `/api/pilot-auth/*` routes directly; confirmed `NODE_ENV !== "production"` is a hard requirement, not a soft check. |
| Payment confirm route production block | **PASS (verified)** — read the route directly; confirmed `NODE_ENV === "production"` → HTTP 403, confirmed real DB lookup + idempotency check even in dev mode (not query-param trust). |
| Parent data scoping (`parent_id` filter) | **PASS (verified)** — read `parent/schedule/page.tsx` directly; confirmed `.eq("parent_id", parentId)`. |
| Secret/credential sweep (`service_role`, `sb_secret`, `JWT`, hardcoded keys, test creds, `localhost`, `vercel.app`) | **PASS (verified)** — zero hits, full repo grep. |
| Stale terminology (`غرفة التركيز`/`Focus Room` user-facing) | **PASS (verified)** — zero hits, full repo grep. |
| Admin/parent nav dead-ends | **FAIL found and FIXED** — see Changed Files. |
| Favicon | **FAIL found and FIXED** — see Changed Files. |
| Canonical domain (`https://khota.sa`) | **PASS (verified)** — `metadataBase` correctly set, confirmed in `layout.tsx`. |
| Sitemap completeness | **PASS (verified)** — includes `/motabaa/stages` (added in a prior round), consistent. |
| Mobile viewport testing (375/390/430/768/1024/1440) | **NOT VERIFIED** — no browser available in this sandbox, ever. The hero `svh` fix from V34 addresses the known root cause class of the reported overlap bug but was never visually confirmed. |
| Full transaction flow live click-through (Home→Start→Grade→Plan→Cohort→Enroll→Payment→Login→Parent) | **NOT VERIFIED** — same reason. |
| Grade 1/4/7/10/12 plan-appearance testing | **NOT VERIFIED live** — the underlying filtering logic was re-confirmed unchanged via `diff` against a known-good baseline, and the 12-combination data coverage was verified in an earlier round via a direct SQL-mapping script, but no live click-through was possible here. |
| Teacher cohort/session scoping | **NOT VERIFIED this round** — not re-audited; no changes made to teacher routes, prior rounds' verification stands unchanged. |
| Auth role redirects (parent/student/teacher/admin cross-boundary) | **NOT VERIFIED live** — code-level review only (middleware + RLS were not modified this round). |
| Performance/CLS/image loading audit | **NOT VERIFIED** — no browser/Lighthouse available here. |
| Accessibility (contrast, keyboard nav, `HeroStoryRail` reduced-motion) | **FOUND AND FIXED this round** — `HeroStoryRail`'s JS auto-advance timer did not check `prefers-reduced-motion` itself; the global CSS rule only suppressed the visual crossfade transition, not the actual content auto-change every 6 seconds. Added a `window.matchMedia("(prefers-reduced-motion: reduce)")` check that skips starting the timer entirely when the user has that preference. Not visually confirmed in a real browser (none available here), but the logic is straightforward and low-risk. |

## Routes reviewed this round
`/admin` (nav fix), `/parent` (nav + type fix), plus targeted file reads of: `pilot-auth.ts`,
`middleware.ts`, `api/payment/confirm/route.ts`, `parent/schedule/page.tsx`,
`supabase-admin.ts`, `layout.tsx`, `sitemap.ts`, and every file under `src/app/admin/*` /
`src/app/parent/*` for placeholder-text classification.

## Mobile widths tested
**None live.** All mobile-related reasoning this round and the prior round was static-code-
level (CSS cascade tracing), not visual/device testing.
