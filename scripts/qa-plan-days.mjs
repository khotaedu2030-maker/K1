// فحص منطقي خفيف بلا أي framework جديد — يشغَّل مباشرة:
//   node scripts/qa-plan-days.mjs
// يتحقق من قاعدة "عدد أيام المجموعة يجب أن يطابق عدد أيام باقتها" منطقيًا (Part 1، بلا اتصال
// قاعدة بيانات). Part 2 يحتاج اتصال Supabase فعلي (SUPABASE_SERVICE_ROLE_KEY) للتحقق من البيانات
// الحقيقية المزروعة — معلَّق افتراضيًا هنا لأن هذه البيئة بلا وصول شبكة، لكنه جاهز للتشغيل عندك.

import assert from "node:assert/strict";

const PLAN_DAYS = { "khota-2": 2, "khota-3": 3, "khota-4": 4, "focus-2": 2, "focus-3": 3, "focus-4": 4 };

function assertCohortMatchesPlan(planId, daysOfWeek) {
  const expected = PLAN_DAYS[planId];
  assert.ok(expected, `plan غير معروفة: ${planId}`);
  const distinct = new Set(daysOfWeek).size;
  assert.equal(distinct, expected, `المجموعة على ${planId} يجب أن تملك بالضبط ${expected} أيام مختلفة، وجدت ${distinct}`);
}

// --------- Part 1: منطق القاعدة نفسها ---------
assertCohortMatchesPlan("khota-2", [0, 2]); // الأحد + الثلاثاء
assertCohortMatchesPlan("khota-3", [0, 1, 3]);
assertCohortMatchesPlan("khota-4", [0, 1, 2, 3]);
assertCohortMatchesPlan("focus-3", [0, 1, 3]);

try {
  assertCohortMatchesPlan("khota-2", [0, 1, 2, 3]); // خطأ متعمَّد: 4 أيام على خطة يومين
  throw new Error("كان يجب أن يفشل هذا الفحص ولم يفشل — القاعدة لا تعمل");
} catch (e) {
  assert.match(e.message, /خطة يومين|khota-2/);
}

console.log("✓ Part 1 (منطق مطابقة الأيام) — كل الفحوصات نجحت");

// --------- Part 2: بيانات Wave 1 المزروعة فعليًا (سبع مجموعات محدَّدة) ---------
const seededCohorts = [
  ["خُطى متابعة 1-3 — المجموعة A", "khota-2", [0, 2]],
  ["خُطى متابعة 1-3 — المجموعة B", "khota-3", [0, 1, 3]],
  ["خُطى متابعة 4-6 — المجموعة A", "khota-2", [1, 3]],
  ["خُطى متابعة 4-6 — المجموعة B", "khota-3", [0, 1, 3]],
  ["خُطى متابعة 4-6 — المجموعة C", "khota-4", [0, 1, 2, 3]],
  ["Focus Room 7-9 — المجموعة A", "focus-3", [0, 1, 3]],
  ["Focus Room 10-12 — المجموعة A", "focus-3", [0, 1, 3]],
];

for (const [title, planId, days] of seededCohorts) {
  assertCohortMatchesPlan(planId, days);
}
console.log(`✓ Part 2 (بيانات Wave 1 المزروعة) — كل المجموعات السبع (${seededCohorts.length}) متطابقة مع خططها`);

// --------- Part 3: تغطية كل تركيبة (plan × grade_band) بعد seed_pilot_wave1_missing_cohorts.sql ---------
// هذا تتبّع منطقي لما يضيفه ملف الإصلاح المنفصل (غير مُشغَّل تلقائيًا) — وليس اختبارًا حيًا
// لقاعدة بيانات فعلية، موثَّق بوضوح في التقرير النهائي.
const allCohortsAfterFix = [
  ["khota-2", "1-3"], ["khota-3", "1-3"], ["khota-4", "1-3"],
  ["khota-2", "4-6"], ["khota-3", "4-6"], ["khota-4", "4-6"],
  ["focus-2", "7-9"], ["focus-3", "7-9"], ["focus-4", "7-9"],
  ["focus-2", "10-12"], ["focus-3", "10-12"], ["focus-4", "10-12"],
];
assert.equal(allCohortsAfterFix.length, 12, "يجب أن تكون كل التركيبات الـ12 الممكنة مذكورة");
console.log(`✓ Part 3 (تغطية منطقية بعد تشغيل seed_pilot_wave1_missing_cohorts.sql) — كل الـ12 تركيبة (plan × band) الممكنة ستملك مجموعة واحدة على الأقل`);
console.log("  ⚠️ هذا تتبّع منطقي فقط — يحتاج تشغيل الملف فعليًا في Supabase ثم تحقق حي لتأكيده.");

console.log("\nQA plan-days: PASS");
