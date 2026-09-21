import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// القيم الافتراضية هنا **تساوي حرفيًا** السلوك الحالي المُشفَّر بالكود (ABSENCE_POLICY،
// QUIET_HOURS، PAUSE_POLICY) — إن لم يوجد جدول admin_platform_settings بعد (Migration لم
// تُطبَّق)، السلوك الفعلي لا يتغيّر إطلاقًا، صفر مخاطرة. (اسم الجدول: admin_platform_settings،
// وليس platform_settings — راجع تعليق دالة getRuntimeSettings أدناه للسبب.)
export type RuntimeSettings = {
  makeupMonthlyLimit: number;
  pauseMinDays: number;
  pauseMaxDays: number;
  quietHoursStart: number; // ساعة 0-23
  quietHoursEnd: number;
  registrationEnabled: boolean;
  attendanceLockHours: number;
  // Phase 9 correction — كانت هذه الأربعة FOUNDATION فقط (مخزَّنة، لا مستهلك). الآن ACTIVE:
  // src/app/api/admin/cohorts/route.ts يستهلكها كقيمة افتراضية لسعة مجموعة جديدة حسب grade_band
  // عند عدم إرسال capacity صراحةً من الطلب.
  defaultCapacity1_3: number;
  defaultCapacity4_6: number;
  defaultCapacity7_9: number;
  defaultCapacity10_12: number;
};

const DEFAULTS: RuntimeSettings = {
  makeupMonthlyLimit: 2, // = ABSENCE_POLICY.MONTHLY_STUDENT_CAUSED_MAKEUP_LIMIT الحالي
  pauseMinDays: 7, // = القيمة الافتراضية الفعلية لعمود platform_settings.pause_min_days (Phase 6: تُقرأ الآن أيضًا، لم تكن مكشوفة بهذه الدالة سابقًا)
  pauseMaxDays: 28, // = القيمة الافتراضية الفعلية لعمود platform_settings.pause_max_days منذ تصحيح Phase 1 (سياسة 1-4 أسابيع)
  quietHoursStart: 20, // = QUIET_HOURS.startHour الحالي
  quietHoursEnd: 8, // = QUIET_HOURS.endHour الحالي
  registrationEnabled: true, // = السلوك الحالي قبل وجود هذا الإعداد أصلًا (التسجيل مفتوح دائمًا)
  // على عكس بقية الإعدادات أعلاه، لا "سلوك مُشفَّر قديم" لقفل الحضور كان موجودًا لنحافظ عليه —
  // 24 ساعة هي السياسة المعتمَدة والقيمة الافتراضية الفعلية لعمود attendance_lock_hours نفسه
  // (Phase 1). هذا الرقم يُطبَّق فورًا بمجرد نشر هذا الكود (سواء طُبِّقت الهجرة أم لا) لأن Phase 3
  // يُقدِّم ميزة القفل عمدًا بهذه القيمة الافتراضية تحديدًا، لا يحافظ على غياب قفل قديم.
  attendanceLockHours: 24,
  // = القيم الافتراضية الفعلية لأعمدة default_capacity_* بجدول platform_settings نفسها
  // (migrations/20260920_settings_foundation_extension.sql) — لو الجدول غير موجود بعد، هذه
  // القيم تُستخدَم مباشرة، فلا يتغيّر أي سلوك حالي (إنشاء مجموعة بلا capacity صريحة كان سيفشل
  // فورًا قبل هذا التصحيح لأن capacity كانت حقلًا مطلوبًا من العميل — الآن تصبح لها قيمة
  // افتراضية معقولة حتى بلا الجدول، بدل فشل الطلب).
  defaultCapacity1_3: 3,
  defaultCapacity4_6: 4,
  defaultCapacity7_9: 5,
  defaultCapacity10_12: 5,
};

let cache: { value: RuntimeSettings; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // دقيقة واحدة — يكفي لتفادي استعلام متكرر بلا داعٍ على كل رسالة/طلب تجميد، بلا مخاطرة بقاء قديم طويلًا

// نقطة القراءة الوحيدة لأي إعداد تشغيلي — تُستخدَم من منطق العمل الفعلي (تجميد، تعويض، رسائل)،
// لا من واجهة الإدارة فقط. تتعامل بأمان مع غياب الجدول (قبل تطبيق الـmigration) بإرجاع
// الافتراضي المطابق للسلوك الحالي، لا بكسر الطلب.
export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.value;

  try {
    // Phase 9 Step 9.2A production reconciliation — Production's real platform_settings
    // table turned out to be a pre-existing, unrelated key/value table (id uuid, key,
    // value jsonb), not the typed singleton row this code always assumed. Rather than
    // touch that table, the reconciliation migration created a new, separate typed table
    // — admin_platform_settings — for exactly this purpose. See
    // supabase/migrations/20261002_phase9_production_reconciliation.sql and
    // KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md for the full reasoning. The legacy
    // platform_settings table is left untouched and is no longer read anywhere in this
    // codebase.
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("admin_platform_settings")
      .select("makeup_monthly_limit, pause_min_days, pause_max_days, quiet_hours_start, quiet_hours_end, registration_enabled, attendance_lock_hours, default_capacity_1_3, default_capacity_4_6, default_capacity_7_9, default_capacity_10_12")
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
      pauseMinDays: data.pause_min_days ?? DEFAULTS.pauseMinDays,
      pauseMaxDays: data.pause_max_days ?? DEFAULTS.pauseMaxDays,
      quietHoursStart: Number(String(data.quiet_hours_start).slice(0, 2)) || DEFAULTS.quietHoursStart,
      quietHoursEnd: Number(String(data.quiet_hours_end).slice(0, 2)) || DEFAULTS.quietHoursEnd,
      registrationEnabled: data.registration_enabled ?? DEFAULTS.registrationEnabled,
      attendanceLockHours: data.attendance_lock_hours ?? DEFAULTS.attendanceLockHours,
      defaultCapacity1_3: data.default_capacity_1_3 ?? DEFAULTS.defaultCapacity1_3,
      defaultCapacity4_6: data.default_capacity_4_6 ?? DEFAULTS.defaultCapacity4_6,
      defaultCapacity7_9: data.default_capacity_7_9 ?? DEFAULTS.defaultCapacity7_9,
      defaultCapacity10_12: data.default_capacity_10_12 ?? DEFAULTS.defaultCapacity10_12,
    };
    cache = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return DEFAULTS;
  }
}
