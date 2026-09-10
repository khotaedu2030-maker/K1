// مصدر واحد لأسماء الأيام العربية وترتيبها وصياغة الأعداد — تُستخدَم في كل مكان تظهر فيه
// تفاصيل خطة/مجموعة (صفحة الخطط، التسجيل، الدفع، لوحة ولي الأمر) لضمان عرض موحَّد لا يعتمد
// على ترتيب تخزين days_of_week في القاعدة ولا على locale المتصفح.

export const WEEKDAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// يرتّب الأيام حسب ترتيب الأسبوع الصحيح دائمًا (0=الأحد..6=السبت)، بصرف النظر عن ترتيبها
// كما وصلت من القاعدة، ثم يعيدها كنص عربي واضح مفصول — لا JSON، لا enum خام.
export function formatDaysList(daysOfWeek: number[], separator = " • "): string {
  return [...daysOfWeek]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_NAMES_AR[d] ?? "")
    .filter(Boolean)
    .join(separator);
}

// صياغة عربية صحيحة لعدد الأيام: مفرد/مثنى/جمع قليل (3-10)/جمع كثرة (11+).
export function formatDayCount(n: number): string {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}

// صياغة عربية صحيحة لعدد المقاعد المتاحة.
export function formatSeatCount(n: number): string {
  if (n === 1) return "مقعد واحد";
  if (n === 2) return "مقعدان";
  if (n >= 3 && n <= 10) return `${n} مقاعد`;
  return `${n} مقعدًا`;
}

// صياغة عربية صحيحة لعدد الجلسات.
export function formatSessionCount(n: number): string {
  if (n === 1) return "جلسة واحدة";
  if (n === 2) return "جلستان";
  if (n >= 3 && n <= 10) return `${n} جلسات`;
  return `${n} جلسة`;
}

// اسم عرض عربي نظيف للمجموعة — لا يُظهر عنوان cohort.title التقني الخام للمستخدم النهائي
// (مثل "Focus Room 10-12 — المجموعة B") بل "المجموعة (ب)" فقط. المعلومات التقنية
// (grade_band/product) تبقى داخلية بحتة، تُستخدَم للفلترة فقط لا للعرض.
const LATIN_TO_ARABIC_GROUP_LETTER: Record<string, string> = {
  A: "أ", B: "ب", C: "ج", D: "د", E: "هـ", F: "و",
};

export function formatCohortDisplayName(title: string): string {
  const match = title.match(/المجموعة\s+([A-Za-z])\s*$/);
  if (match) {
    const letter = LATIN_TO_ARABIC_GROUP_LETTER[match[1].toUpperCase()] ?? match[1];
    return `المجموعة (${letter})`;
  }
  return "المجموعة";
}
