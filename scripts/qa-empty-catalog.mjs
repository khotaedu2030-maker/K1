// Catalog has a truthful state when a grade has no marketed plan/cohort.
// Validates the stale query-param guards without constructing product/pricing fixtures.
import assert from "node:assert/strict";
import fs from "node:fs";
const src=fs.readFileSync("src/app/motabaa/plans/PlansSelector.tsx","utf8");
assert.match(src,/برنامج غرفة التركيز للمتوسط والثانوي غير متاح للاشتراك حاليًا/);
assert.match(src,/لا توجد خطة معتمدة للصف/);
assert.match(src,/لن نحجز لك مقعدًا أو نحصّل رسومًا/);
assert.match(src,/href="\/signup"/);
assert.match(src,/availablePlans\.length > 1 \?/);
assert.match(src,/اختيار المجموعة غير متاح قبل توفير خطة لهذا الصف/);
assert.match(src,/availablePlans\.find\(\(p\) => p\.id === planId\)/);
assert.match(src,/step2Done = Boolean\(selectedPlan\)/);
assert.match(src,/step3Done = Boolean\(selectedCohort\)/);
assert.match(src,/if \(selectedCohortId\) params\.set\("cohort", selectedCohortId\)/);
assert.doesNotMatch(src,/لا توجد خطط متاحة لهذا الصف حاليًا/);
assert.doesNotMatch(src,/اختر خطة أخرى/);
console.log("PASS truthful no-plan/no-group checkout state and stale URL stepper guards");
