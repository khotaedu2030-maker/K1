// إعداد مركزي واحد لساعات الهدوء المؤسسية — القيم أدناه هي الافتراضي الآمن فقط (يُستخدَم قبل
// تطبيق migration الإعدادات أو إن فشل الاستعلام). المصدر الفعلي عند التشغيل هو
// platform_settings عبر src/lib/platform-settings.ts.
import { getRuntimeSettings } from "@/lib/platform-settings";

export const QUIET_HOURS = {
  timezone: "Asia/Riyadh",
  startHour: 20, // 8:00 مساءً
  endHour: 8, // 8:00 صباحًا
};

export const QUIET_HOURS_MESSAGE =
  "تم استلام رسالتك، وسيتم الرد خلال ساعات التواصل.";

export async function isQuietHoursNow(date: Date = new Date()): Promise<boolean> {
  const settings = await getRuntimeSettings();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: QUIET_HOURS.timezone,
    }).format(date)
  );

  const startHour = settings.quietHoursStart;
  const endHour = settings.quietHoursEnd;
  // يدعم النطاق العابر لمنتصف الليل (مثل 20 → 8)
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}
