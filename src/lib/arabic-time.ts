// أدوات نص عربية مشتركة للوحة ولي الأمر — بلا أي منطق أعمال، فقط تنسيق عرض.
const RIYADH_TZ = "Asia/Riyadh";
const AR_LATN = "ar-SA-u-nu-latn"; // عربي بأرقام لاتينية (4:30 م) بدل الأرقام الهندية

function dayKeyInRiyadh(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: RIYADH_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatRiyadhTime(date: Date): string {
  return new Intl.DateTimeFormat(AR_LATN, { timeZone: RIYADH_TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function formatRiyadhWeekdayDate(date: Date): string {
  return new Intl.DateTimeFormat(AR_LATN, { timeZone: RIYADH_TZ, weekday: "long", day: "numeric", month: "long" }).format(date);
}

function arabicHoursPhrase(n: number): string {
  if (n === 1) return "ساعة";
  if (n === 2) return "ساعتين";
  if (n >= 3 && n <= 10) return `${n} ساعات`;
  return `${n} ساعة`;
}

// "تبدأ بعد 45 دقيقة" / "تبدأ بعد ساعتين و15 دقيقة" / "غدًا، 4:30 م" / "الثلاثاء 15 سبتمبر، 4:30 م"
// لا عدّاد بالثواني إطلاقًا — أقصى دقة هي الدقيقة، ولا قيمة أكبر من 23 ساعة كرقم خام أبدًا
// (بعد 24 ساعة نتحول تلقائيًا للتاريخ/اليوم الفعلي بدل عدد الساعات).
export function formatRelativeSessionTime(startsAt: string | Date, now: Date = new Date()): string {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000);

  if (minutesUntil <= 0) return "الجلسة جارية الآن";
  if (minutesUntil < 1) return "تبدأ بعد أقل من دقيقة";
  if (minutesUntil < 60) return `تبدأ بعد ${minutesUntil} دقيقة`;

  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;

  if (hours < 24) {
    if (mins === 0) return `تبدأ بعد ${arabicHoursPhrase(hours)}`;
    return `تبدأ بعد ${arabicHoursPhrase(hours)} و${mins} دقيقة`;
  }

  const startDay = dayKeyInRiyadh(start);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (startDay === dayKeyInRiyadh(tomorrow)) {
    return `غدًا، ${formatRiyadhTime(start)}`;
  }

  return `${formatRiyadhWeekdayDate(start)}، ${formatRiyadhTime(start)}`;
}

export function formatSessionDay(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(AR_LATN, { timeZone: RIYADH_TZ, weekday: "long" }).format(d);
}

export function formatSessionDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(AR_LATN, { timeZone: RIYADH_TZ, day: "numeric", month: "long" }).format(d);
}

export function formatSessionTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatRiyadhTime(d);
}

// اسم البرنامج كما يظهر لولي الأمر — لا يظهر "Focus Room" بالإنجليزية أبدًا مهما كانت القيمة
// المخزَّنة في cohorts.title (لم تُغيَّر بيانات المجموعات نفسها، هذا تحويل عرض فقط).
export function toParentFacingProgramName(title: string | null | undefined): string {
  if (!title) return "خُطى متابعة";
  // اسم البرنامج فقط — بلا رقم مرحلة تقني (7-9/10-12) وبلا اسم مجموعة خام؛ المجموعة تُعرض
  // بشكل منفصل عند الحاجة عبر formatCohortDisplayName في src/lib/plan-display.ts.
  return title
    .replace(/Focus Room/gi, "جلسات التركيز")
    .replace(/\s*\d+-\d+/g, "")
    .replace(/\s*—\s*المجموعة\s+[A-Za-z]\s*$/, "")
    .trim();
}

const SESSION_STATUS_LABEL_AR: Record<string, string> = {
  scheduled: "مجدولة",
  completed: "اكتملت",
  cancelled: "أُلغيت",
};

export function sessionStatusLabelAr(status: string): string {
  return SESSION_STATUS_LABEL_AR[status] ?? status;
}
