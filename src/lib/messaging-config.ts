// إعداد مركزي واحد لساعات الهدوء المؤسسية — لا نكرّر "8:00 مساءً" داخل عدة ملفات. أي تعديل
// لاحق (توقيت مختلف، ربط SLA/Notifications) يبدأ ويتم من هنا فقط.
export const QUIET_HOURS = {
  timezone: "Asia/Riyadh",
  startHour: 20, // 8:00 مساءً
  endHour: 8, // 8:00 صباحًا
};

export const QUIET_HOURS_MESSAGE =
  "تم استلام رسالتك، وسيتم الرد خلال ساعات التواصل.";

export function isQuietHoursNow(date: Date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: QUIET_HOURS.timezone,
    }).format(date)
  );

  const { startHour, endHour } = QUIET_HOURS;
  // يدعم النطاق العابر لمنتصف الليل (مثل 20 → 8)
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}
