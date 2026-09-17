import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// القيم الافتراضية هنا **تساوي حرفيًا** السلوك الحالي المُشفَّر بالكود (ABSENCE_POLICY،
// QUIET_HOURS، PAUSE_POLICY) — إن لم يوجد جدول platform_settings بعد (Migration لم تُطبَّق)،
// السلوك الفعلي لا يتغيّر إطلاقًا، صفر مخاطرة.
export type RuntimeSettings = {
  makeupMonthlyLimit: number;
  pauseMaxDays: number;
  quietHoursStart: number; // ساعة 0-23
  quietHoursEnd: number;
};

const DEFAULTS: RuntimeSettings = {
  makeupMonthlyLimit: 2, // = ABSENCE_POLICY.MONTHLY_STUDENT_CAUSED_MAKEUP_LIMIT الحالي
  pauseMaxDays: 7, // = PAUSE_POLICY.MAX_PAUSE_DAYS الحالي
  quietHoursStart: 20, // = QUIET_HOURS.startHour الحالي
  quietHoursEnd: 8, // = QUIET_HOURS.endHour الحالي
};

let cache: { value: RuntimeSettings; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // دقيقة واحدة — يكفي لتفادي استعلام متكرر بلا داعٍ على كل رسالة/طلب تجميد، بلا مخاطرة بقاء قديم طويلًا

// نقطة القراءة الوحيدة لأي إعداد تشغيلي — تُستخدَم من منطق العمل الفعلي (تجميد، تعويض، رسائل)،
// لا من واجهة الإدارة فقط. تتعامل بأمان مع غياب الجدول (قبل تطبيق الـmigration) بإرجاع
// الافتراضي المطابق للسلوك الحالي، لا بكسر الطلب.
export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.value;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("platform_settings")
      .select("makeup_monthly_limit, pause_max_days, quiet_hours_start, quiet_hours_end")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) {
      // الجدول غير موجود بعد (migration لم تُطبَّق)، أو خطأ استعلام — الافتراضي الآمن فقط،
      // بلا تسجيل صاخب هنا (متوقَّع تمامًا قبل تطبيق الـmigration، ليس عطلًا).
      cache = { value: DEFAULTS, fetchedAt: Date.now() };
      return DEFAULTS;
    }

    const value: RuntimeSettings = {
      makeupMonthlyLimit: data.makeup_monthly_limit ?? DEFAULTS.makeupMonthlyLimit,
      pauseMaxDays: data.pause_max_days ?? DEFAULTS.pauseMaxDays,
      quietHoursStart: Number(String(data.quiet_hours_start).slice(0, 2)) || DEFAULTS.quietHoursStart,
      quietHoursEnd: Number(String(data.quiet_hours_end).slice(0, 2)) || DEFAULTS.quietHoursEnd,
    };
    cache = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return DEFAULTS;
  }
}
