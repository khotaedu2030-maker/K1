// أوقات التواصل: المنصة تستقبل الرسائل دائمًا. يُعرض فقط إشعار باحتمال تأخر الرد.
// جميع المقارنات بالدقيقة وفق توقيت الرياض، دون التأثير على OTP أو الجلسات.
import { getRuntimeSettings } from "@/lib/platform-settings";
import { getRiyadhMinutesSinceMidnight, RIYADH_TIMEZONE } from "@/lib/riyadh-time";

export const QUIET_HOURS = {
  timezone: RIYADH_TIMEZONE,
  startHour: 20,
  endHour: 8,
};

export const QUIET_HOURS_MESSAGE =
  "وصلت رسالتك. قد يتأخر الرد حتى تبدأ ساعات التواصل المعتادة.";

export function isQuietHoursAtMinute(nowMinutes: number, startMinutes: number, endMinutes: number): boolean {
  // Equal values mean there is no overnight quiet-hours interval.
  if (startMinutes === endMinutes) return false;
  if (startMinutes > endMinutes) return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

export async function isQuietHoursNow(date: Date = new Date()): Promise<boolean> {
  const settings = await getRuntimeSettings();
  const minutesNow = getRiyadhMinutesSinceMidnight(date);
  return isQuietHoursAtMinute(minutesNow, settings.quietHoursStartMinutes, settings.quietHoursEndMinutes);
}
