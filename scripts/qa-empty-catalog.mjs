// Catalog has a truthful state when a grade has no marketed plan/cohort.
// Validates the stale query-param guards without constructing product/pricing fixtures.
import assert from "node:assert/strict";
import fs from "node:fs";
const src=fs.readFileSync("src/app/motabaa/plans/PlansSelector.tsx","utf8");
assert.match(src,/برنامج غرفة التركيز للمتوسط والثانوي غير متاح للاشتراك حاليًا/);
assert.match(src,/لا توجد خطة معتمدة للصف/);
assert.match(src,/لن نحجز لك مقعدًا أو نحصّل رسومًا/);
assert.match(src,/isSignedIn \? "\/parent" : "\/signup"/);
assert.match(src,/أنت مسجّل الدخول بالفعل/);
assert.match(src,/firstAvailableGrade/);
assert.match(src,/عرض صفوف لديها مجموعات متاحة/);
assert.match(src,/availablePlans\.length > 1 \?/);
assert.match(src,/اختيار المجموعة غير متاح قبل توفير خطة لهذا الصف/);
assert.match(src,/availablePlans\.find\(\(p\) => p\.id === planId\)/);
assert.match(src,/step2Done = Boolean\(selectedPlan\)/);
assert.match(src,/step3Done = Boolean\(selectedCohort\)/);
assert.match(src,/if \(selectedCohortId\) params\.set\("cohort", selectedCohortId\)/);
assert.doesNotMatch(src,/لا توجد خطط متاحة لهذا الصف حاليًا/);
assert.doesNotMatch(src,/اختر خطة أخرى/);
console.log("PASS truthful no-plan/no-group checkout state and stale URL stepper guards");

const page=fs.readFileSync("src/app/motabaa/plans/page.tsx","utf8");
assert.match(page,/auth\.auth\.getUser\(\)/);
assert.match(page,/isSignedIn=\{Boolean\(user\)\}/);
console.log("PASS signed-in parent catalogue CTAs and contextual alternate grade navigation");
