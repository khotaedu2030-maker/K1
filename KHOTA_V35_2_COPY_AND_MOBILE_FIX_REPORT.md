# KHOTA V35.2 — Copy + Mobile Visual Review

## Scope
Focused correction on customer-facing copy and the three verified iPhone issues. No database, Supabase, auth, payment logic, pricing, cohort, grade-band, or enrollment business rules were changed.

## Visual fixes
1. **Hero readability on mobile**: strengthened the mobile-only directional/navy overlay behind the text area and improved text contrast without replacing the photography.
2. **"في كل جلسة" progression section**: changed the four-step mobile layout from a long single column into a compact 2×2 composition.
3. **Grade-stage duplication**: stopped deriving a heading from the first part of the description. Each stage now has a distinct headline and supporting sentence.

## Copy review — key changes
- Reframed the homepage problem from “مو كل طالب يحتاج درسًا إضافيًا” to a clearer articulation: the problem is not always understanding the lesson; often it is knowing what to do, where to start, and how to finish.
- Reduced repeated “لا…” framing across the homepage and teachers sections. KHOTA is now described more often by what it does, not only by what it does not do.
- Shortened the hero value proposition to a clearer family benefit.
- Reworked the Focus/secondary hero story from “تنظيم، لا تدريس إضافي” to a positive outcome-oriented message.
- Rewrote awkward phrases in `/motabaa`, including “يعمل، لا يُشاهَد وهو يعمل”.
- Improved `/motabaa/how-it-works` so the session journey is explained positively and directly.
- Expanded FAQ group-size information to include grades 7–12 (up to 5 students in Focus Sessions).
- Consolidated duplicate privacy/trust messaging on the homepage.
- Removed a customer-facing implementation note from enrollment (“payment provider will be linked later”) and replaced it with a customer-safe statement.
- Removed duplicated enrollment heading (“باقي خطوة واحدة” twice).
- Adjusted Privacy copy so it does not imply SMS OTP is already enabled in production.
- Adjusted Terms copy so it does not promise automatic recurring billing before the final payment provider/renewal implementation is confirmed.
- Improved several stage descriptions to reduce generic/translated wording.

## Files changed
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/GradeGrid.tsx`
- `src/components/StagesExplorer.tsx`
- `src/app/motabaa/page.tsx`
- `src/app/motabaa/how-it-works/page.tsx`
- `src/app/teachers/page.tsx`
- `src/app/start/page.tsx`
- `src/app/about/page.tsx`
- `src/app/help/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/motabaa/enroll/EnrollForm.tsx`

## Intentionally not changed
- Hidden/legacy English and Qudurat product routes were not rewritten as part of the KHOTA pilot customer journey.
- Real payment gateway and production OTP were not implemented.
- Internal operational identifiers such as `focus_room` remain untouched.

## Verification note
A full Next.js build cannot be treated as valid in this container because project dependencies (`node_modules`, Next/React types) are not installed. Running the globally available TypeScript compiler therefore produces dependency/JSX-type cascade errors. These are environment errors and are not evidence of new errors introduced by this pass.

The final build still needs to be run on the user's normal development machine with the existing `.env.local`:

```powershell
npm install
npx tsc --noEmit
npm run build
```

Then verify on iPhone: hero contrast, four-step section height, grade cards, plans flow, and checkout summary safe areas.
