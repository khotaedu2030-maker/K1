// أدوات صريحة لتوقيت وتقويم الرياض — لا نعتمد على المنطقة الزمنية المحلية لبيئة التشغيل
// (Vercel عادة UTC افتراضيًا) في أي عملية تقويمية تخص جدولة خُطى: يوم الأسبوع، التاريخ
// التقويمي، التقدُّم يومًا بيوم، أو بناء وقت جلسة. نفس تقنية Intl.DateTimeFormat المستخدَمة
// أصلًا وبأمان في src/lib/messaging-config.ts (isQuietHoursNow) — لا مكتبة تواريخ جديدة.
//
// القاعدة المعمارية هنا: أي حساب تقويمي (تقدُّم يوم، طرح تاريخين، معرفة يوم الأسبوع) يتم إما
// عبر Intl.DateTimeFormat (لقراءة تقويم الرياض من لحظة UTC حقيقية) أو عبر Date.UTC()/getUTC*
// (حساب حسابي صرف بإطار مرجعي ثابت UTC لا يعتمد على منطقة بيئة التشغيل إطلاقًا) — لا نستخدم
// أبدًا الدوال المحلية غير المُسبَّقة بـUTC (setDate/getDate/getDay/setHours/getHours...) على
// كائن Date قد يُفسَّر بمنطقة بيئة التشغيل.

export const RIYADH_TIMEZONE = "Asia/Riyadh";

const WEEKDAY_TO_JS_DAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// تاريخ تقويمي صرف بتوقيت الرياض — بلا أي مكوِّن وقت، وبلا أي ارتباط بمنطقة بيئة التشغيل بمجرد
// استخراجه. month بترقيم JS المعتاد (0=يناير..11=ديسمبر) ليتوافق مباشرة مع Date.UTC().
export type RiyadhCalendarDate = { year: number; month: number; day: number };

// يوم الأسبوع بتوقيت الرياض المحلي (0=الأحد..6=السبت — نفس اصطلاح JS Date.getDay() ونفس
// اصطلاح تخزين cohorts.days_of_week)، مُستخرَج من لحظة UTC حقيقية عبر Intl صراحةً.
export function getRiyadhDayOfWeek(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: RIYADH_TIMEZONE }).format(date);
  return WEEKDAY_TO_JS_DAY[weekday] ?? getRiyadhWeekdayFromCalendarDate(getRiyadhCalendarDate(date));
}

// عدد الدقائق منذ منتصف الليل بتوقيت الرياض المحلي — مقارنة آمنة مع وقت محلي أدخله الأدمن
// (مثل "17:00")، بصرف النظر عن المنطقة الزمنية لبيئة التشغيل.
export function getRiyadhMinutesSinceMidnight(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: RIYADH_TIMEZONE,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minutePart = parts.find((p) => p.type === "minute")?.value ?? "0";
  // بعض البيئات تُنسِّق منتصف الليل كـ"24" بدل "00" — نُطبِّعها بـ% 24 لتفادي قيمة خاطئة.
  const hour = Number(hourPart) % 24;
  const minute = Number(minutePart);
  return hour * 60 + minute;
}

// التاريخ التقويمي بالرياض (سنة/شهر/يوم) للحظة UTC حقيقية — عبر Intl صراحةً، لا getFullYear/
// getMonth/getDate المحليَّين (قد يختلفان عن اليوم الفعلي بالرياض قرب حدود منتصف الليل إن كانت
// بيئة التشغيل بمنطقة زمنية مختلفة).
export function getRiyadhCalendarDate(date: Date): RiyadhCalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: RIYADH_TIMEZONE,
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1") - 1; // Intl تُرجِع 1-12، نُحوِّل لترقيم JS 0-11
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");
  return { year, month, day };
}

// يوم الأسبوع من تاريخ تقويمي صرف (بلا الحاجة لأي لحظة UTC) — حساب حسابي صرف عبر Date.UTC()
// وgetUTCDay() (ثابتان دائمًا، لا يعتمدان على منطقة بيئة التشغيل إطلاقًا، خلافًا لـgetDay()
// المحلية). صحيح لأي تاريخ تقويمي بصرف النظر عن كيفية الحصول عليه.
export function getRiyadhWeekdayFromCalendarDate(cal: RiyadhCalendarDate): number {
  return new Date(Date.UTC(cal.year, cal.month, cal.day)).getUTCDay();
}

// يبني لحظة UTC صحيحة من تاريخ تقويمي صرف بالرياض ووقت حائط محلي بالرياض (ساعة/دقيقة). الرياض
// UTC+3 ثابت طوال العام (لا توقيت صيفي بالسعودية) — طرح 3 ساعات مباشرةً عبر Date.UTC() آمن
// وصحيح دائمًا. يحل محل الإصدار السابق الذي كان يقرأ سنة/شهر/يوم التاريخ التقويمي عبر
// getFullYear()/getMonth()/getDate() المحليَّين (كانا يعتمدان على منطقة بيئة التشغيل أيضًا) —
// الآن يقبل RiyadhCalendarDate صرفًا، لا كائن Date، فلا مجال لهذا الاعتماد إطلاقًا.
export function riyadhWallClockToUtcInstant(cal: RiyadhCalendarDate, hour: number, minute: number): Date {
  return new Date(Date.UTC(cal.year, cal.month, cal.day, hour - 3, minute, 0, 0));
}

// يُضيف عدد أيام صحيح (موجب أو صفر) لتاريخ تقويمي صرف — حساب حسابي صرف عبر Date.UTC()/
// getUTC*() (إطار مرجعي UTC ثابت، لا علاقة له بمنطقة بيئة التشغيل)، لا setDate()/getDate()
// المحليَّين. يتعامل تلقائيًا وبأمان مع تخطي نهاية الشهر/السنة (حساب JS القياسي لـDate.UTC).
export function addRiyadhCalendarDays(cal: RiyadhCalendarDate, days: number): RiyadhCalendarDate {
  const d = new Date(Date.UTC(cal.year, cal.month, cal.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

// يقارن تاريخين تقويميَّين صرفَين: سالب إن كان a قبل b، صفر إن تساويا، موجب إن كان a بعد b.
export function compareRiyadhCalendarDates(a: RiyadhCalendarDate, b: RiyadhCalendarDate): number {
  return Date.UTC(a.year, a.month, a.day) - Date.UTC(b.year, b.month, b.day);
}

// صيغة "YYYY-MM-DD" لتخزين عمود session_date (date، بلا منطقة زمنية) — نص مباشر من المكوِّنات
// الصرفة، بلا أي تحويل Date وسيط قد يُعيد إدخال اعتماد منطقة زمنية.
export function formatRiyadhCalendarDate(cal: RiyadhCalendarDate): string {
  const mm = String(cal.month + 1).padStart(2, "0");
  const dd = String(cal.day).padStart(2, "0");
  return `${cal.year}-${mm}-${dd}`;
}

// يُضيف عدد شهور صحيح لتاريخ تقويمي صرف — نفس دلالة Date.setMonth() لكن بحساب Date.UTC() صرف
// (بلا اعتماد منطقة بيئة التشغيل). يُستخدَم لحساب "شهر اشتراك من اليوم" (تاريخ التجديد).
export function addRiyadhCalendarMonths(cal: RiyadhCalendarDate, months: number): RiyadhCalendarDate {
  const d = new Date(Date.UTC(cal.year, cal.month + months, cal.day));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}
