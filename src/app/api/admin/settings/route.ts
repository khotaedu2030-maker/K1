import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// الحقول الأربعة الأولى فقط مُستهلَكة فعليًا بمنطق تشغيلي حقيقي (راجع src/lib/platform-settings.ts).
// السبعة الجديدة (Phase 1 Correction) تُحفَظ فعليًا هنا لكن بلا أي مستهلك تشغيلي بعد — Foundation
// فقط، الربط الفعلي بالسلوك مؤجَّل لـPhase 3 صراحةً. الحقول المتبقية بالجدول (booking_window_days،
// default_session_duration_minutes، support_email/phone) لا تُستقبَل من هذا الـbody إطلاقًا —
// نجلب قيمها الحالية المخزَّنة ونُمرِّرها كما هي، بلا أي احتمال إعادة تعيين غير مقصودة.
export async function POST(req: Request) {
  const adminCheck = await requirePermission("settings.manage");
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json().catch(() => null);
  const admin = createSupabaseAdminClient();
  const { data: current } = await admin
    .from("admin_platform_settings")
    .select("makeup_monthly_limit, pause_min_days, pause_max_days, quiet_hours_start, quiet_hours_end, registration_enabled, seat_hold_hours, attendance_lock_hours, default_capacity_1_3, default_capacity_4_6, default_capacity_7_9, default_capacity_10_12, default_session_duration_minutes, booking_window_days, support_email, support_phone")
    .eq("id", true)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "الإعدادات غير مُهيَّأة بعد — طبّق migration الإعدادات أولًا" }, { status: 500 });
  }

  const makeupLimit = body?.makeupMonthlyLimit === undefined ? current.makeup_monthly_limit : Number(body.makeupMonthlyLimit);
  // Phase 8.5/8.6 — pause_min_days أصبحت ACTIVE فعليًا منذ Phase 6 (تُقرأ بـ
  // getRuntimeSettings().pauseMinDays وتُستهلَك داخل admin_create_subscription_pause_atomic لفرض
  // حد أدنى فعلي لمدة التجميد) — كانت هذه الصفحة تتجاهلها وتُبقي القيمة المخزَّنة كما هي فقط
  // (current.pause_min_days) بلا قبولها من الواجهة إطلاقًا. تُقبَل الآن كحقل حقيقي قابل للتعديل.
  const pauseMin = body?.pauseMinDays === undefined ? current.pause_min_days : Number(body.pauseMinDays);
  const pauseMax = body?.pauseMaxDays === undefined ? current.pause_max_days : Number(body.pauseMaxDays);
  const quietStart = typeof body?.quietHoursStart === "string" ? body.quietHoursStart : String(current.quiet_hours_start).slice(0, 5);
  const quietEnd = typeof body?.quietHoursEnd === "string" ? body.quietHoursEnd : String(current.quiet_hours_end).slice(0, 5);
  const registrationEnabled = typeof body?.registrationEnabled === "boolean" ? body.registrationEnabled : current.registration_enabled;
  const seatHoldHours = body?.seatHoldHours === undefined ? current.seat_hold_hours : Number(body.seatHoldHours);
  const attendanceLockHours = body?.attendanceLockHours === undefined ? current.attendance_lock_hours : Number(body.attendanceLockHours);
  const cap1_3 = body?.defaultCapacity1_3 === undefined ? current.default_capacity_1_3 : Number(body.defaultCapacity1_3);
  const cap4_6 = body?.defaultCapacity4_6 === undefined ? current.default_capacity_4_6 : Number(body.defaultCapacity4_6);
  const cap7_9 = body?.defaultCapacity7_9 === undefined ? current.default_capacity_7_9 : Number(body.defaultCapacity7_9);
  const cap10_12 = body?.defaultCapacity10_12 === undefined ? current.default_capacity_10_12 : Number(body.defaultCapacity10_12);

  if (
    !Number.isInteger(makeupLimit) || makeupLimit < 0 || makeupLimit > 10 ||
    !Number.isInteger(pauseMin) || pauseMin < 1 || pauseMin > 28 ||
    !Number.isInteger(pauseMax) || pauseMax < 7 || pauseMax > 28 ||
    !/^\d{2}:\d{2}$/.test(quietStart) || !/^\d{2}:\d{2}$/.test(quietEnd) ||
    !Number.isInteger(seatHoldHours) || seatHoldHours < 1 || seatHoldHours > 72 ||
    !Number.isInteger(attendanceLockHours) || attendanceLockHours < 1 || attendanceLockHours > 168 ||
    !Number.isInteger(cap1_3) || cap1_3 < 1 || cap1_3 > 30 ||
    !Number.isInteger(cap4_6) || cap4_6 < 1 || cap4_6 > 30 ||
    !Number.isInteger(cap7_9) || cap7_9 < 1 || cap7_9 > 30 ||
    !Number.isInteger(cap10_12) || cap10_12 < 1 || cap10_12 > 30
  ) {
    return NextResponse.json({ error: "قيم غير صالحة، راجع الحدود المسموحة لكل حقل" }, { status: 400 });
  }

  // pause_min_days <= pause_max_days مطلوب دائمًا (قيد قاعدة البيانات نفسه) — تحقّق واضح هنا
  // بدل ترك خطأ DB خامًا يصل المستخدم، الآن على القيمتين الجديدتين المُدخَلتين معًا.
  if (pauseMin > pauseMax) {
    return NextResponse.json({ error: "الحد الأدنى للتجميد يجب ألا يزيد عن الحد الأقصى" }, { status: 400 });
  }

  const { error } = await admin.rpc("admin_update_platform_settings", {
    p_admin_user_id: adminCheck.userId,
    p_default_session_duration_minutes: current.default_session_duration_minutes,
    p_makeup_monthly_limit: makeupLimit,
    p_pause_min_days: pauseMin,
    p_pause_max_days: pauseMax,
    p_booking_window_days: current.booking_window_days,
    p_quiet_hours_start: quietStart,
    p_quiet_hours_end: quietEnd,
    p_support_email: current.support_email,
    p_support_phone: current.support_phone,
    p_registration_enabled: registrationEnabled,
    p_seat_hold_hours: seatHoldHours,
    p_attendance_lock_hours: attendanceLockHours,
    p_default_capacity_1_3: cap1_3,
    p_default_capacity_4_6: cap4_6,
    p_default_capacity_7_9: cap7_9,
    p_default_capacity_10_12: cap10_12,
  });
  if (error) {
    console.error("[admin-settings] فشل تحديث الإعدادات:", error.message);
    return NextResponse.json({ error: "تعذّر حفظ الإعدادات" }, { status: 500 });
  }

  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_user_id: adminCheck.userId,
    action: "settings_update",
    entity_type: "admin_platform_settings",
    entity_id: "singleton",
    new_value: {
      makeupMonthlyLimit: makeupLimit, pauseMinDays: pauseMin, pauseMaxDays: pauseMax, quietHoursStart: quietStart, quietHoursEnd: quietEnd,
      registrationEnabled, seatHoldHours, attendanceLockHours,
      defaultCapacities: { "1-3": cap1_3, "4-6": cap4_6, "7-9": cap7_9, "10-12": cap10_12 },
    },
  });
  if (auditError) console.error("[admin-settings] فشل تسجيل admin_actions (غير حاجب):", auditError.message);

  return NextResponse.json({ ok: true });
}
