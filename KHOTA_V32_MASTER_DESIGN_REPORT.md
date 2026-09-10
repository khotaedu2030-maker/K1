# KHOTA V32 — Master Design Report

## Honest scope statement (read first)
The brief requested a full master-design pass across marketing, product, parent, student,
teacher, and admin — matching an approved reference image. **I did not rebuild all of that in
this pass.** What follows is precise about what changed now vs. what was already in place from
prior rounds vs. what genuinely was not touched. I will not claim a full site-wide alignment
pass that didn't happen.

## 1) Design system implemented
No new token system this round — the V29 token set (spacing scale, container width 1360px,
z-index scale, `--motion-fast/base/slow`, `--ease-premium`) from a prior round is still in
place and was reused, not replaced.

## 2) Homepage implementation
**Net-new this round**: the Hero Story Rail described in section 8 of the brief — a real,
interactive feature that did not exist before. 4 stories (بعد المدرسة / خُطى معه / لولي الأمر /
جلسات التركيز), each swapping image + headline + lead + CTA. Auto-progresses every 6s, **stops
permanently after the first user interaction** (click), keyboard-accessible (`role="tablist"`,
real `<button>` elements, `aria-selected`), teal progress line per rail item, crossfade between
images via opacity transition. Respects `prefers-reduced-motion` via the existing global CSS
rule (no separate JS handling needed since the global rule already collapses all
transition/animation durations to 0.01ms).

The rest of the homepage (grade grid, progression, session/parent/teacher scenes, plans
preview, trust strip, closing CTA) is **unchanged from V30/V31** — not re-verified against the
new reference image this round.

## 3) Story Hero implementation
Covered above — this is the one clearly new, well-specified deliverable I built end-to-end
this round.

## 4) Marketing pages updated
Only the homepage. `/motabaa`, `/motabaa/how-it-works`, `/about`, `/teachers`,
`/teach-with-khota` were **not re-touched** this round (last modified in V28/V29/V30 — a
Story Rail–style pass on `/motabaa`'s hero specifically was not implemented, since the brief's
Story Rail spec was scoped to "the hero" generally and I prioritized shipping it correctly on
the homepage rather than partially on multiple pages).

## 5) Product/enrollment pages updated
`/motabaa/enroll` and `/motabaa/enroll/payment`: **one line each** — the "جلسات التركيز"
terminology fix (below). No visual changes. `/motabaa/plans`, `/start`: not touched this round.

## 6) Parent application updated
`WeeklySummary.tsx`: fixed a real mobile layout defect (below). No other visual changes to
`/parent/*` this round.

## 7) Student application updated
Not touched this round.

## 8) Teacher application updated
`/teachers` (marketing page, not the `/teacher/*` app): one line — removed a redundant inline
style that was silently blocking a responsive media query (below). The operational `/teacher/*`
app itself was not touched.

## 9) Admin application updated
Not touched this round.

## 10) Shared components/tokens changed
**New**: `src/components/HeroStoryRail.tsx`. Everything else reused as-is.

## 11) Responsive/mobile work
Found and fixed **three real, confirmed defects** — not new media queries added
speculatively, actual bugs traced to root cause:
- `/motabaa/plans` preview grid on homepage: an inline `style={{gridTemplateColumns:"repeat(3,1fr)"}}`
  was permanently overriding the class's own responsive breakpoints (inline styles beat
  stylesheet media queries regardless of viewport) — it would have stayed 3 columns even at
  375px. Fixed with a proper `.stage-card-grid-3` modifier class with its own 850px/480px rules.
- Same exact bug pattern on `/teachers` and `/motabaa/how-it-works`'s `.progression` sections
  (3–4 column text layouts staying locked at full column count on mobile). Fixed identically.
- `WeeklySummary.tsx`'s 3-stat grid (`.kpi`) had **no mobile breakpoint at all** in the base
  class (not a regression — it never had one). Added one (`.kpi-3`, collapses to 1 column at
  ≤480px) since 3 columns × 22px padding at ~100px width each was a genuine cramping risk.
- **I made a mistake while fixing the `.progression` case and caught it myself**: a `str_replace`
  accidentally nested a new rule set inside the wrong `@media` block, which would have produced
  invalid/broken CSS. Caught it by re-reading the file after the edit, not by assumption, and
  corrected it before moving on.

No live browser/device testing was performed — see section 20.

## 12) Accessibility work
Story Rail: real `<button>` elements (not `<div onClick>`), `role="tablist"`/`role="tab"`,
`aria-selected`, focus-visible inherited from the global `:focus-visible` rule (untouched,
already present). Nothing else audited this round.

## 13) Existing media used
Story Rail reuses 4 of the 10 approved images (`khota-hero`, `khota-grade-7-9`,
`khota-progress`, `khota-grade-10-12`) — no new images generated or added, per the brief's
"do not generate new images" instruction.

## 14) Media gaps
None new. Same standing limitation from prior rounds: the original photo set has minor branding
artifacts in the background of a couple of shots — already documented in earlier reports, not
re-audited here.

## 15) Arabic terminology fixes
Re-ran a full search for "غرفة التركيز" and "Focus Room" across `src/`. Found and fixed **4
real instances** (all user-facing display strings, not the internal `focus_room` DB key, which
was correctly left untouched):
- `src/app/motabaa/enroll/page.tsx`
- `src/app/motabaa/enroll/payment/page.tsx`
- `src/components/StagePicker.tsx` (currently unused/orphaned component, fixed anyway for
  correctness if it's ever wired back in)
- **`src/lib/arabic-time.ts`** — this was the important one: the shared
  `toParentFacingProgramName()` function used live by the Parent Dashboard's session cards was
  still mapping "Focus Room" → "غرفة التركيز" (the old term). This is the function that actually
  renders on a real parent's screen, so this was the highest-value fix of the four.

Final verification: zero remaining instances of "غرفة التركيز" anywhere in `src/`.

## 16) Exact files changed
`src/app/globals.css` • `src/app/page.tsx` • `src/components/HeroStoryRail.tsx` (new) •
`src/components/Footer.tsx` • `src/components/StagePicker.tsx` •
`src/app/motabaa/enroll/page.tsx` • `src/app/motabaa/enroll/payment/page.tsx` •
`src/app/motabaa/how-it-works/page.tsx` • `src/app/teachers/page.tsx` •
`src/app/parent/schedule/WeeklySummary.tsx` • `src/lib/arabic-time.ts`.

(This list also includes the V31 premium-polish work from the immediately preceding turn —
footer signature moment, plan-tile hover states, next-session-hero card depth — since no ZIP
was delivered between that turn and this one.)

## 17) TypeScript result
`npx tsc --noEmit` **ran for real** — ~3300 lines of output, the overwhelming majority
"Cannot find module 'next/...'"/"'react'"/"Cannot find name 'process'" — a direct consequence
of `npm install` failing (below), not real code defects. I specifically isolated and fixed the
**one genuine issue** in code I wrote this round (`HeroStoryRail.tsx`'s `setActive` callback
parameter was implicitly `any`). One other flagged error (a `Reveal` prop-type mismatch on
`page.tsx` line 208) I investigated and concluded is very likely a downstream artifact of the
missing React type declarations rather than a real bug in that (standard, correct) JSX — I did
not guess-fix it, since doing so could introduce an incorrect change to working code.

## 18) Build result
**FAIL** — `next: not found`. Direct consequence of `npm install` failing with
`403 Forbidden` on `registry.npmjs.org` — no network access in this sandbox, the same
constraint present in every round of this entire project. Re-attempted specifically for this
pass, same result.

## 19) Lint result
**FAIL** — `eslint: not found`, same root cause.

## 20) Browser QA actually performed
**None.** No dev server, no browser, in this environment — this has never been possible in any
round of this project. All defects reported above were found by static code
analysis (reading the CSS cascade, tracing inline-style-vs-media-query conflicts, checking
class usage) — not by looking at a rendered page. I will not claim otherwise.

## 21) Known remaining issues
- The reference image's visual language (light backgrounds dominating, cinematic hero, story
  rail, teacher/plans/parent compositions) was substantially already in place from V28–V31 —
  but was **not re-verified page-by-page against this specific reference** this round beyond
  the homepage hero.
- `/motabaa/plans`, `/start`, `/motabaa/enroll` visual polish per this reference: not reviewed.
- `/parent/*`, `/student/*`, `/teacher/*`, `/admin/*` design-system consolidation per this
  reference: not reviewed beyond the two defect fixes noted above.
- No real build/lint/browser confirmation possible here — needs your machine.
