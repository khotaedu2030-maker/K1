// KHOTA Independence Score — منطق حساب صرف على الخادم فقط.
// لا يُستدعى هذا الملف أبدًا من أي مكوّن "use client" — القيمة النهائية total_score
// يجب أن تُحسب هنا وتُخزَّن في قاعدة البيانات، لا أن تُحسب في المتصفح.

export type IndependenceInputs = {
  task_management: number; // 1-5
  task_initiation: number; // 1-5
  help_seeking: number; // 1-5
  task_completion: number; // 1-5
  time_organization: number; // 1-5
};

// المعادلة الحالية: مجموع الخمسة أبعاد ÷ 25 × 100.
// كُتبت كدالة مستقلة عمدًا حتى يسهل تغيير المعادلة لاحقًا (وزن مختلف لكل بُعد مثلًا)
// دون المساس بأي كود آخر يستدعيها.
export function calculateIndependenceScore(inputs: IndependenceInputs): number {
  const invalid = validateIndependenceInputs(inputs);
  if (invalid) {
    throw new Error(invalid);
  }

  const sum =
    inputs.task_management +
    inputs.task_initiation +
    inputs.help_seeking +
    inputs.task_completion +
    inputs.time_organization;

  const percentage = (sum / 25) * 100;
  return Math.round(percentage * 10) / 10; // رقم عشري واحد فقط — لا نوهم بدقة أكبر مما هي عليه
}

// تحقق صارم على الخادم — لا نعتمد فقط على CHECK constraints في قاعدة البيانات.
// يعيد رسالة الخطأ إن وُجدت، أو null إن كانت كل القيم صحيحة (عدد صحيح بين 1 و5).
export function validateIndependenceInputs(inputs: Partial<IndependenceInputs>): string | null {
  const keys: (keyof IndependenceInputs)[] = [
    "task_management",
    "task_initiation",
    "help_seeking",
    "task_completion",
    "time_organization",
  ];
  for (const key of keys) {
    const value = inputs[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
      return `قيمة غير صالحة لـ ${key}: يجب أن تكون عددًا صحيحًا بين 1 و5`;
    }
  }
  return null;
}

export function independenceTrendLabel(current: number, previous: number | null): string {
  if (previous === null) return "أول قياس";
  const diff = current - previous;
  if (Math.abs(diff) < 1) return "مستقر";
  return diff > 0 ? `تحسّن ${Math.round(diff)} نقطة` : `تراجع ${Math.round(Math.abs(diff))} نقطة`;
}

// تحقق من حقول التقييم الأكاديمي — نفس enum المفروض في CHECK constraints بقاعدة البيانات،
// لكن نتحقق هنا أيضًا حتى لا نعتمد على قاعدة البيانات وحدها لرفض مدخلات خاطئة.
export const VALID_LEVELS = ["needs_support", "age_appropriate", "advanced"] as const;
export type LevelValue = (typeof VALID_LEVELS)[number];

export function isValidLevelOrNull(value: unknown): value is LevelValue | null | undefined {
  return value === null || value === undefined || VALID_LEVELS.includes(value as LevelValue);
}

export const VALID_ASSESSMENT_TYPES = ["baseline", "monthly_review", "manual_review"] as const;
export type AssessmentType = (typeof VALID_ASSESSMENT_TYPES)[number];

export function isValidAssessmentType(value: unknown): value is AssessmentType {
  return typeof value === "string" && (VALID_ASSESSMENT_TYPES as readonly string[]).includes(value);
}
