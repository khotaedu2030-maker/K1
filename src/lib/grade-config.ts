// إعداد مركزي واحد لبنية الصفوف — يُستورد من الخادم (API routes) والعميل (PlansSelector.tsx
// وصفحات مساحة الطالب) على حدٍّ سواء، لذا هو ملف نقي بلا "server-only" وبلا أي استيراد من
// next/headers أو عملاء Supabase. لا يحتوي هذا الملف على أي شيء غير بنية الصف نفسها —
// لا تسعير، لا مدة جلسة، لا جدولة، لا عدد اشتراكات، لا قواعد تجديد (تلك في أماكنها الخاصة).

export type GradeBand = "1-3" | "4-6" | "7-9" | "10-12";
export type ToneLevel = "junior" | "standard" | "focus";

export interface GradeBandConfig {
  band: GradeBand;
  min: number;
  max: number;
  labelAr: string;
  operationalLabelAr: string;
  tone: ToneLevel;
  defaultCapacityHint: number; // تلميح افتراضي فقط — السعة الفعلية دائمًا cohorts.capacity
}

export const GRADE_BANDS: GradeBandConfig[] = [
  {
    band: "1-3",
    min: 1,
    max: 3,
    labelAr: "الصفوف 1-3",
    operationalLabelAr: "التأسيس والمتابعة الموجَّهة",
    tone: "junior",
    defaultCapacityHint: 3,
  },
  {
    band: "4-6",
    min: 4,
    max: 6,
    labelAr: "الصفوف 4-6",
    operationalLabelAr: "المتابعة والتقوية نحو الاستقلالية",
    tone: "standard",
    defaultCapacityHint: 4,
  },
  {
    band: "7-9",
    min: 7,
    max: 9,
    labelAr: "الصفوف 7-9 (متوسط)",
    operationalLabelAr: "Focus Room — متوسط",
    tone: "focus",
    defaultCapacityHint: 5,
  },
  {
    band: "10-12",
    min: 10,
    max: 12,
    labelAr: "الصفوف 10-12 (ثانوي)",
    operationalLabelAr: "Focus Room — ثانوي",
    tone: "focus",
    defaultCapacityHint: 5,
  },
];

const MIN_GRADE = 1;
const MAX_GRADE = 12;

// يفشل بوضوح (يرمي استثناء) خارج 1-12 — لا fallback صامت إلى أي Band افتراضية.
export function resolveGradeBand(grade: number): GradeBand {
  const found = GRADE_BANDS.find((b) => grade >= b.min && grade <= b.max);
  if (!found) {
    throw new Error(`grade ${grade} خارج نطاق بنية الصفوف المدعوم (1-12)`);
  }
  return found.band;
}

export function getToneLevel(grade: number): ToneLevel {
  const found = GRADE_BANDS.find((b) => grade >= b.min && grade <= b.max);
  if (!found) {
    throw new Error(`grade ${grade} خارج نطاق بنية الصفوف المدعوم (1-12)`);
  }
  return found.tone;
}

export function getGradeBandConfig(band: GradeBand): GradeBandConfig {
  const found = GRADE_BANDS.find((b) => b.band === band);
  if (!found) throw new Error(`grade_band غير معروفة: ${band}`);
  return found;
}

const GRADE_LABELS_AR: Record<number, string> = {
  1: "الأول الابتدائي",
  2: "الثاني الابتدائي",
  3: "الثالث الابتدائي",
  4: "الرابع الابتدائي",
  5: "الخامس الابتدائي",
  6: "السادس الابتدائي",
  7: "الأول متوسط",
  8: "الثاني متوسط",
  9: "الثالث متوسط",
  10: "الأول ثانوي",
  11: "الثاني ثانوي",
  12: "الثالث ثانوي",
};

// يفشل بوضوح خارج 1-12 — لا fallback صامت لعرض الرقم الخام كما لو كان تسمية صالحة.
export function getGradeLabelArabic(grade: number): string {
  const label = GRADE_LABELS_AR[grade];
  if (!label) {
    throw new Error(`grade ${grade} خارج نطاق بنية الصفوف المدعوم (1-12)`);
  }
  return label;
}

export type GradeParseResult = { ok: true; grade: number } | { ok: false; error: string };

// Validation صارم لقيمة الصف القادمة من HTML <select> (نص) أو من أي مصدر آخر (رقم/أي شيء).
// يرفض بوضوح: فراغ/مسافات فقط، boolean، array، object، NaN، Infinity، كسور عشرية، صفر،
// 13 فما فوق، وأي قيمة خارج 1-12. لا يوجد fallback صامت إلى Primary أبدًا.
export function parseAndValidateGrade(raw: unknown): GradeParseResult {
  if (raw === null || raw === undefined || typeof raw === "boolean") {
    return { ok: false, error: "قيمة الصف غير صالحة" };
  }
  if (Array.isArray(raw) || typeof raw === "object") {
    return { ok: false, error: "قيمة الصف غير صالحة" };
  }
  if (typeof raw !== "string" && typeof raw !== "number") {
    return { ok: false, error: "قيمة الصف غير صالحة" };
  }

  let numericValue: number;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: false, error: "الرجاء اختيار الصف الدراسي" };
    // أرقام صحيحة موجبة فقط — لا كسور، لا علامات، لا صيغة علمية
    if (!/^\d+$/.test(trimmed)) return { ok: false, error: "قيمة الصف غير صالحة" };
    numericValue = Number(trimmed);
  } else {
    numericValue = raw;
  }

  if (!Number.isFinite(numericValue) || Number.isNaN(numericValue)) {
    return { ok: false, error: "قيمة الصف غير صالحة" };
  }
  if (!Number.isInteger(numericValue)) {
    return { ok: false, error: "الصف يجب أن يكون رقمًا صحيحًا" };
  }
  if (numericValue < MIN_GRADE || numericValue > MAX_GRADE) {
    return { ok: false, error: `الصف يجب أن يكون بين ${MIN_GRADE} و${MAX_GRADE}` };
  }

  return { ok: true, grade: numericValue };
}
