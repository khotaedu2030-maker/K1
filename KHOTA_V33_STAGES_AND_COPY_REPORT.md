# KHOTA V33 — Stages Page + Copy Alignment

## Context
Same brief as the previous turn, resent with the reference image again (no answer to my
clarifying questions about the "Preview unavailable" screenshot, so I proceeded on the
assumption this meant: continue executing more of the scope flagged as not-yet-done).

## What was built this round

### 1) New: dedicated Stages page (`/motabaa/stages`)
The reference shows a standalone "صفحة المراحل" page. I checked and confirmed **this page
did not exist** — "المراحل" in the nav was only an anchor link to a homepage section, not a
real page (section 12 of the brief explicitly wants a dedicated page). Built:
- `src/components/StagesExplorer.tsx` — light, tabbed interface (4 stage-band tabs: 1–3 / 4–6 /
  7–9 / 10–12, labeled الابتدائي المبكر / الابتدائي العالي / المتوسط / الثانوي per the brief's
  exact labels), large photo that swaps per selected stage, description + CTA that update
  together. Light background throughout — not a cinematic dark hero, matching "cinematic but
  not necessarily dark" from section 12.
- `src/app/motabaa/stages/page.tsx` — the page itself, headline "خُطى تكبر معه." (exact match
  to the brief).
- Updated `nav-links.ts` so "المراحل" now points to this real page instead of the anchor.
- Added the route to `sitemap.ts`.

### 2) Copy alignment to the brief's exact wording
The brief gives verbatim copy for two sections that I had previously written in my own words
during V28–V30. Per "Do not reinterpret," I replaced mine with the brief's exact text:
- **Editorial Message** (homepage, after hero): was "بعد المدرسة تبدأ مهمة ثانية في البيت." →
  now exactly "مو كل طالب يحتاج درسًا إضافيًا." / "أحيانًا يحتاج أن يعرف ماذا عليه، ومن أين
  يبدأ."
- **The KHOTA Steps** sequence: was "يعرف ما عليه / يبدأ بالأهم / ينجز بتركيز / يستعد للغد" →
  now exactly the brief's 4 words: "يعرف / يرتب / ينجز / يستعد."
- **Parent marketing headline**: was "أنت قريب من تقدّمه، من غير ما تحمل كل التفاصيل." → now
  exactly "وأنت تعرف كيف يتقدّم." (kept my existing supporting list below it — الجلسة
  القادمة/ما أنجزه/etc. — since the brief didn't give new copy for that part, only the
  headline).

## Verified, not touched
- `/login`: checked for a leftover dark navy panel — none found, already light from prior
  rounds. No changes made.
- Business logic: `diff` re-confirmed `PlansSelector.tsx` filtering logic unchanged.

## What is still not done (honest, same as last report)
Everything I flagged as untouched in the V32 report remains untouched: `/motabaa`,
`/motabaa/how-it-works` (beyond what V28 already built), `/about`, `/teachers`,
`/teach-with-khota`, `/motabaa/plans`, `/start`, `/motabaa/enroll(/payment)`, all of
`/parent/*` beyond the one earlier fix, all of `/student/*`, `/teacher/*`, `/admin/*`. This
round's effort went specifically into the one genuinely missing page (Stages) and the exact
copy the brief gave verbatim, rather than a shallow pass across everything.

## Files changed
`src/app/globals.css` (Stages page CSS) • `src/app/page.tsx` (3 copy edits) •
`src/app/sitemap.ts` (new route) • `src/components/nav-links.ts` (real link) •
`src/components/StagesExplorer.tsx` (new) • `src/app/motabaa/stages/page.tsx` (new).

## Verification performed
Balance-checked all TS/TSX (clean). Re-ran the `PlansSelector.tsx` logic `diff` (identical).
Checked every image reference resolves to a real file (clean). Checked every internal `href`
resolves to a real route (clean, including the new `/motabaa/stages`).

## TypeScript
`npx tsc --noEmit` ran — ~3366 lines, all in the new files traced back to the same missing-
`node_modules` cause as every prior round (module-not-found cascades). No genuine new
implicit-any in code I wrote this round (unlike the last two rounds, nothing to fix here).

## Build / Lint
**FAIL** / not run — same `npm install` 403 network block as every round of this project.

## Browser QA
**None performed.** No environment for it here, as always.
